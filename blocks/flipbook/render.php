<?php
/**
 * Frontend-Ausgabe des BD-PDF-Blocks.
 *
 * Verfügbare Variablen: $attributes, $content, $block.
 *
 * @package bdpdf
 */

// Beispiel-Modus: solange kein eigenes PDF gewählt ist, zeigt der Block das
// gebündelte Demo-PDF – so lassen sich alle Einstellungen sofort ausprobieren.
$bdpdf_is_demo = empty( $attributes['pdfUrl'] ) && ! empty( $attributes['useDemo'] );
if ( empty( $attributes['pdfUrl'] ) && ! $bdpdf_is_demo ) {
	return;
}
$bdpdf_demo = $bdpdf_is_demo ? bdpdf_demo_config() : null;

$bdpdf_pdf_url = esc_url( $bdpdf_is_demo ? $bdpdf_demo['pdfUrl'] : $attributes['pdfUrl'] );
$bdpdf_label   = ! empty( $attributes['pdfTitle'] )
	? $attributes['pdfTitle']
	: ( $bdpdf_is_demo
		? __( 'Beispiel-PDF, blätterbar', 'blitz-donner-pdf' )
		: __( 'PDF-Dokument, blätterbar', 'blitz-donner-pdf' ) );

// Vorgerenderte Seitenbilder (vom Editor nach der PDF-Auswahl erzeugt).
$bdpdf_pages_json  = '';
$bdpdf_page_w      = 0;
$bdpdf_page_h      = 0;
$bdpdf_layout      = 'single';
$bdpdf_cover_singl = 0;
$bdpdf_tail_singl  = 0;
if ( $bdpdf_is_demo ) {
	$bdpdf_pages_json = wp_json_encode( $bdpdf_demo['pages'] );
	$bdpdf_page_w     = (int) $bdpdf_demo['width'];
	$bdpdf_page_h     = (int) $bdpdf_demo['height'];
} elseif ( ! empty( $attributes['pdfId'] ) ) {
	$bdpdf_att_id = absint( $attributes['pdfId'] );
	$bdpdf_meta   = get_post_meta( $bdpdf_att_id, '_bdpdf_pages', true );
	if ( ! empty( $bdpdf_meta['count'] ) ) {
		$bdpdf_upload = wp_upload_dir();
		$bdpdf_base   = trailingslashit( $bdpdf_upload['baseurl'] ) . 'bdpdf/' . $bdpdf_att_id;
		$bdpdf_urls   = array();
		for ( $bdpdf_i = 1; $bdpdf_i <= (int) $bdpdf_meta['count']; $bdpdf_i++ ) {
			$bdpdf_urls[] = $bdpdf_base . '/page-' . $bdpdf_i . '.jpg';
		}
		$bdpdf_pages_json  = wp_json_encode( $bdpdf_urls );
		$bdpdf_page_w      = (int) $bdpdf_meta['width'];
		$bdpdf_page_h      = (int) $bdpdf_meta['height'];
		$bdpdf_layout      = isset( $bdpdf_meta['layout'] ) && 'spread' === $bdpdf_meta['layout'] ? 'spread' : 'single';
		$bdpdf_cover_singl = ! empty( $bdpdf_meta['cover_single'] ) ? 1 : 0;
		$bdpdf_tail_singl  = ! empty( $bdpdf_meta['tail_single'] ) ? 1 : 0;
	}
}

// Im Doppelseiten-Modus bestimmt das PDF, ob der Umschlag einzeln steht –
// nur so stimmen die Seitenpaare wieder mit den Original-Doppelseiten überein.
$bdpdf_show_cover = 'spread' === $bdpdf_layout
	? ( $bdpdf_cover_singl ? '1' : '0' )
	: ( empty( $attributes['showCover'] ) ? '0' : '1' );

// Darstellungsmodus wie bei Blitz & Donner Forms: theme | auto | light | dark.
$bdpdf_appearance = isset( $attributes['appearanceMode'] ) ? sanitize_key( (string) $attributes['appearanceMode'] ) : 'theme';
if ( ! in_array( $bdpdf_appearance, array( 'theme', 'auto', 'light', 'dark' ), true ) ) {
	$bdpdf_appearance = 'theme';
}

// Datei-Modus: Anzeige-Daten der Zeile (Grösse, Datum, Titel).
$bdpdf_mode = isset( $attributes['displayMode'] ) && 'file' === $attributes['displayMode'] ? 'file' : 'book';
$bdpdf_file_size = '';
$bdpdf_file_date = '';
$bdpdf_row_title = ! empty( $attributes['pdfTitle'] ) ? $attributes['pdfTitle'] : '';
if ( 'file' === $bdpdf_mode ) {
	$bdpdf_date_format = get_option( 'date_format' );
	if ( $bdpdf_is_demo ) {
		$bdpdf_file_size = $bdpdf_demo['sizeText'];
		$bdpdf_file_date = $bdpdf_demo['dateText'];
		if ( '' === $bdpdf_row_title ) {
			$bdpdf_row_title = __( 'Beispiel-PDF', 'blitz-donner-pdf' );
		}
	} elseif ( ! empty( $attributes['pdfId'] ) ) {
		$bdpdf_datei = get_attached_file( absint( $attributes['pdfId'] ) );
		if ( $bdpdf_datei && file_exists( $bdpdf_datei ) ) {
			$bdpdf_file_size = size_format( filesize( $bdpdf_datei ), 1 );
		}
		$bdpdf_zeit = get_post_timestamp( absint( $attributes['pdfId'] ) );
		if ( $bdpdf_zeit ) {
			$bdpdf_file_date = wp_date( $bdpdf_date_format, $bdpdf_zeit );
		}
		if ( '' === $bdpdf_row_title ) {
			$bdpdf_row_title = wp_basename( (string) $bdpdf_datei );
		}
	}
	// Redaktioneller Override (YYYY-MM-DD aus dem Datumsfeld im Inspector).
	if ( ! empty( $attributes['dateOverride'] ) && is_string( $attributes['dateOverride'] ) ) {
		$bdpdf_ts = strtotime( $attributes['dateOverride'] );
		if ( $bdpdf_ts ) {
			$bdpdf_file_date = wp_date( $bdpdf_date_format, $bdpdf_ts );
		}
	}
}
$bdpdf_show_view     = ! isset( $attributes['showViewButton'] ) || false !== $attributes['showViewButton'];
$bdpdf_show_download = ! isset( $attributes['showDownloadButton'] ) || false !== $attributes['showDownloadButton'];

// «Block-Abstand» (blockGap): Kern serialisiert ihn bei Blöcken ohne
// Layout-Support nicht selbst – weder den Blockwert noch den globalen
// Blockwert aus dem Website-Editor. Kette: Blockwert → globaler Blockwert
// → CSS-Fallback (Theme-Gap → 0.75rem).
$bdpdf_gap = isset( $attributes['style']['spacing']['blockGap'] ) ? bdpdf_css_var( $attributes['style']['spacing']['blockGap'] ) : '';
if ( '' === $bdpdf_gap && function_exists( 'wp_get_global_styles' ) ) {
	$bdpdf_gap = bdpdf_css_var( wp_get_global_styles( array( 'spacing', 'blockGap' ), array( 'block_name' => 'bdpdf/flipbook' ) ) );
}

// Schatten aus den GLOBALEN Stilen ebenfalls aufs Buch umleiten (der
// Blockwert wird weiter unten per str_replace umgeleitet; der Kern legt den
// globalen Wert sonst als Stylesheet-Regel auf den Wrapper, den view.css
// bewusst neutralisiert).
$bdpdf_global_shadow = '';
if ( empty( $attributes['style']['shadow'] ) && function_exists( 'wp_get_global_styles' ) ) {
	$bdpdf_global_shadow = bdpdf_css_var( wp_get_global_styles( array( 'shadow' ), array( 'block_name' => 'bdpdf/flipbook' ) ) );
}

$bdpdf_wrapper = get_block_wrapper_attributes(
	array(
		'class'                 => 'bdpdf-flipbook bdpdf-mode-' . $bdpdf_mode,
		'data-bdpdf-appearance' => $bdpdf_appearance,
		'data-mode'             => $bdpdf_mode,
		'style'                 => ( '' !== $bdpdf_gap ? '--bdpdf-gap:' . $bdpdf_gap . ';' : '' )
			. ( '' !== $bdpdf_global_shadow ? '--bdpdf-book-shadow:' . $bdpdf_global_shadow . ';' : '' ),
	)
);
// Schatten gehört aufs Buch, nicht auf den Wrapper: den vom Schatten-Support
// erzeugten box-shadow in die Variable umschreiben, die view.css auf
// .bdpdf-page anwendet (gleiche Umleitung wie im Editor).
$bdpdf_wrapper = str_replace( array( 'box-shadow:', 'box-shadow :' ), '--bdpdf-book-shadow:', $bdpdf_wrapper );
?>
<div <?php echo $bdpdf_wrapper; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- von WordPress escaped. ?>
	data-pdf-url="<?php echo $bdpdf_pdf_url; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- oben mit esc_url() escaped. ?>"
	<?php if ( $bdpdf_pages_json ) : ?>
	data-pages="<?php echo esc_attr( $bdpdf_pages_json ); ?>"
	data-page-w="<?php echo esc_attr( $bdpdf_page_w ); ?>"
	data-page-h="<?php echo esc_attr( $bdpdf_page_h ); ?>"
	data-layout="<?php echo esc_attr( $bdpdf_layout ); ?>"
	data-cover-single="<?php echo esc_attr( $bdpdf_cover_singl ); ?>"
	data-tail-single="<?php echo esc_attr( $bdpdf_tail_singl ); ?>"
	<?php endif; ?>
	data-show-cover="<?php echo esc_attr( $bdpdf_show_cover ); ?>"
	tabindex="0"
	role="region"
	aria-label="<?php echo esc_attr( $bdpdf_label ); ?>">
<?php if ( 'file' === $bdpdf_mode ) : ?>
	<div class="bdpdf-file-row">
		<?php $bdpdf_main_tag = $bdpdf_show_view ? 'button' : 'span'; ?>
		<<?php echo $bdpdf_main_tag; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- fixes Tag. ?> <?php echo $bdpdf_show_view ? 'type="button"' : ''; ?> class="bdpdf-file-main<?php echo $bdpdf_show_view ? ' bdpdf-open-dialog' : ''; ?>">
			<svg class="bdpdf-file-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V8h4.5L14 3.5zM8 13h1.6c1 0 1.7.7 1.7 1.6 0 .9-.7 1.6-1.7 1.6h-.5V18H8v-5zm1.1 2.3h.4c.4 0 .7-.3.7-.7 0-.4-.3-.7-.7-.7h-.4v1.4zm3-2.3h1.7c1.3 0 2.2 1 2.2 2.5S15.1 18 13.8 18h-1.7v-5zm1.1 4h.5c.7 0 1.1-.6 1.1-1.5s-.4-1.5-1.1-1.5h-.5v3zm3.7-4H20v1h-1.9v1.1h1.6v1h-1.6V18h-1.2v-5z"/></svg>
			<span class="bdpdf-file-title"><?php echo esc_html( $bdpdf_row_title ); ?></span>
		</<?php echo $bdpdf_main_tag; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- fixes Tag. ?>>
		<span class="bdpdf-file-size"><?php echo esc_html( $bdpdf_file_size ); ?></span>
		<span class="bdpdf-file-date"><?php echo esc_html( $bdpdf_file_date ); ?></span>
		<span class="bdpdf-file-actions">
			<?php if ( $bdpdf_show_view ) : ?>
			<span class="wp-block-button is-style-default">
				<button type="button" class="bdpdf-open-dialog wp-block-button__link wp-element-button"><?php esc_html_e( 'Ansehen', 'blitz-donner-pdf' ); ?></button>
			</span>
			<?php endif; ?>
			<?php if ( $bdpdf_show_download ) : ?>
			<span class="wp-block-button is-style-default">
				<a class="wp-block-button__link wp-element-button" href="<?php echo $bdpdf_pdf_url; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- oben mit esc_url() escaped. ?>" download><?php esc_html_e( 'Herunterladen', 'blitz-donner-pdf' ); ?></a>
			</span>
			<?php endif; ?>
		</span>
	</div>
	<dialog class="bdpdf-dialog" aria-label="<?php echo esc_attr( $bdpdf_label ); ?>">
		<div class="bdpdf-dialog-inhalt">
			<button type="button" class="bdpdf-dialog-close" aria-label="<?php esc_attr_e( 'Schliessen', 'blitz-donner-pdf' ); ?>">&times;</button>
			<?php include __DIR__ . '/book-scaffold.php'; ?>
		</div>
	</dialog>
<?php else : ?>
	<?php include __DIR__ . '/book-scaffold.php'; ?>
<?php endif; ?>
</div>
