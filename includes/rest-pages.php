<?php
/**
 * REST-Endpoints zum Speichern und Abfragen vorgerenderter PDF-Seitenbilder.
 *
 * Der Editor rendert die Seiten nach der PDF-Auswahl einmal mit PDF.js und
 * lädt sie hier hoch. Ablage: uploads/bdpdf/<attachment-id>/page-<n>.jpg,
 * Metadaten am Attachment (_bdpdf_pages).
 *
 * @package bdpdf
 */

defined( 'ABSPATH' ) || exit;

/**
 * Berechtigung: Attachment existiert, Nutzer darf Dateien hochladen und
 * dieses Attachment bearbeiten.
 *
 * @param WP_REST_Request $request Anfrage.
 * @return bool
 */
function bdpdf_rest_can_edit( $request ) {
	$att_id = absint( $request['id'] );
	$post   = get_post( $att_id );
	return $post
		&& 'attachment' === $post->post_type
		&& current_user_can( 'upload_files' )
		&& current_user_can( 'edit_post', $att_id );
}

/**
 * Basisverzeichnis der vorgerenderten Seiten eines Attachments.
 *
 * @param int  $att_id Attachment-ID.
 * @param bool $url    true = URL statt Pfad.
 * @return string
 */
function bdpdf_pages_base( $att_id, $url = false ) {
	$upload = wp_upload_dir();
	$base   = $url ? $upload['baseurl'] : $upload['basedir'];
	return trailingslashit( $base ) . 'bdpdf/' . absint( $att_id );
}

/**
 * Status und URLs der vorgerenderten Seiten.
 *
 * @param WP_REST_Request $request Anfrage.
 * @return WP_REST_Response
 */
function bdpdf_rest_get_pages( $request ) {
	$att_id = absint( $request['id'] );
	$meta   = get_post_meta( $att_id, '_bdpdf_pages', true );

	// Formatierte Werte für die Datei-Zeile (gleiche Funktionen wie render.php,
	// damit Editor und Frontend zeichengenau übereinstimmen).
	$datei     = get_attached_file( $att_id );
	$size_text = $datei && file_exists( $datei ) ? size_format( filesize( $datei ), 1 ) : '';
	$zeit      = get_post_timestamp( $att_id );
	$date_text = $zeit ? wp_date( get_option( 'date_format' ), $zeit ) : '';

	if ( empty( $meta['count'] ) ) {
		return rest_ensure_response(
			array(
				'count'          => 0,
				'file_size_text' => $size_text,
				'file_date_text' => $date_text,
			)
		);
	}
	$urls = array();
	for ( $i = 1; $i <= (int) $meta['count']; $i++ ) {
		$urls[] = bdpdf_pages_base( $att_id, true ) . '/page-' . $i . '.jpg';
	}
	return rest_ensure_response(
		array(
			'file_size_text' => $size_text,
			'file_date_text' => $date_text,
			'count'        => (int) $meta['count'],
			'width'        => (int) $meta['width'],
			'height'       => (int) $meta['height'],
			'layout'       => isset( $meta['layout'] ) ? $meta['layout'] : 'single',
			'cover_single' => ! empty( $meta['cover_single'] ) ? 1 : 0,
			'tail_single'  => ! empty( $meta['tail_single'] ) ? 1 : 0,
			'urls'         => $urls,
		)
	);
}

/**
 * Ein Seitenbild entgegennehmen und speichern.
 *
 * @param WP_REST_Request $request Anfrage.
 * @return WP_REST_Response|WP_Error
 */
function bdpdf_rest_save_page( $request ) {
	$att_id = absint( $request['id'] );
	$page   = absint( $request->get_param( 'page' ) );
	$total  = absint( $request->get_param( 'total' ) );
	$width  = absint( $request->get_param( 'width' ) );
	$height = absint( $request->get_param( 'height' ) );
	$image  = (string) $request->get_param( 'image' );

	if ( $page < 1 || $total < 1 || $page > $total || $total > 2000 ) {
		return new WP_Error( 'bdpdf_bad_page', __( 'Ungültige Seitennummer.', 'blitz-donner-pdf' ), array( 'status' => 400 ) );
	}

	// Data-URL-Präfix abtrennen und Bilddaten prüfen: muss ein echtes JPEG
	// in plausibler Grösse sein – wir speichern nichts Ungeprüftes.
	$image = preg_replace( '#^data:image/jpeg;base64,#', '', $image );
	$data  = base64_decode( $image, true );
	if ( false === $data || strlen( $data ) > 6 * MB_IN_BYTES ) {
		return new WP_Error( 'bdpdf_bad_image', __( 'Ungültige Bilddaten.', 'blitz-donner-pdf' ), array( 'status' => 400 ) );
	}
	$info = getimagesizefromstring( $data );
	if ( false === $info || 'image/jpeg' !== $info['mime'] || $info[0] > 4096 || $info[1] > 4096 ) {
		return new WP_Error( 'bdpdf_bad_image', __( 'Ungültige Bilddaten.', 'blitz-donner-pdf' ), array( 'status' => 400 ) );
	}

	$dir = bdpdf_pages_base( $att_id );
	if ( ! wp_mkdir_p( $dir ) ) {
		return new WP_Error( 'bdpdf_fs', __( 'Ablageordner konnte nicht erstellt werden.', 'blitz-donner-pdf' ), array( 'status' => 500 ) );
	}
	if ( false === file_put_contents( $dir . '/page-' . $page . '.jpg', $data ) ) { // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- eigener Upload-Ordner.
		return new WP_Error( 'bdpdf_fs', __( 'Seitenbild konnte nicht gespeichert werden.', 'blitz-donner-pdf' ), array( 'status' => 500 ) );
	}

	// Nach der letzten Seite die Metadaten setzen – erst dann gilt das
	// Dokument als vollständig vorgerendert. Bewusst KEIN Löschen zu Beginn
	// des Laufs: das Frontend soll während eines Neu-Renderns (z.B. nach
	// Layout-Wechsel) durchgehend die alte, vollständige Fassung ausliefern.
	// Erst nach erfolgreichem Abschluss fliegen überzählige Alt-Dateien raus.
	if ( $page === $total ) {
		foreach ( glob( $dir . '/page-*.jpg' ) ?: array() as $bdpdf_old ) {
			$bdpdf_n = (int) preg_replace( '/\D/', '', basename( $bdpdf_old ) );
			if ( $bdpdf_n > $total ) {
				wp_delete_file( $bdpdf_old );
			}
		}
		$layout = 'spread' === $request->get_param( 'layout' ) ? 'spread' : 'single';
		update_post_meta(
			$att_id,
			'_bdpdf_pages',
			array(
				'count'        => $total,
				'width'        => $width > 0 ? $width : $info[0],
				'height'       => $height > 0 ? $height : $info[1],
				'layout'       => $layout,
				'cover_single' => 'spread' === $layout && $request->get_param( 'cover_single' ) ? 1 : 0,
				'tail_single'  => 'spread' === $layout && $request->get_param( 'tail_single' ) ? 1 : 0,
				'version'      => BDPDF_VERSION,
			)
		);
	}

	return rest_ensure_response( array( 'saved' => $page ) );
}

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'bdpdf/v1',
			'/pages/(?P<id>\d+)',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => 'bdpdf_rest_get_pages',
					'permission_callback' => 'bdpdf_rest_can_edit',
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => 'bdpdf_rest_save_page',
					'permission_callback' => 'bdpdf_rest_can_edit',
					'args'                => array(
						'page'         => array( 'type' => 'integer', 'required' => true ),
						'total'        => array( 'type' => 'integer', 'required' => true ),
						'width'        => array( 'type' => 'integer', 'required' => false ),
						'height'       => array( 'type' => 'integer', 'required' => false ),
						'layout'       => array( 'type' => 'string', 'required' => false, 'enum' => array( 'single', 'spread' ) ),
						'cover_single' => array( 'type' => 'integer', 'required' => false ),
						'tail_single'  => array( 'type' => 'integer', 'required' => false ),
						'image'        => array( 'type' => 'string', 'required' => true ),
					),
				),
			)
		);
	}
);
