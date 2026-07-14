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

// «Block-Abstand» (blockGap) aus dem Stil-Tab: Kern serialisiert ihn bei
// Blöcken ohne Layout-Support nicht selbst, darum hier als eigene Variable.
$bdpdf_gap = isset( $attributes['style']['spacing']['blockGap'] ) && is_string( $attributes['style']['spacing']['blockGap'] )
	? $attributes['style']['spacing']['blockGap']
	: '';
if ( '' !== $bdpdf_gap && 0 === strpos( $bdpdf_gap, 'var:' ) ) {
	// Preset-Notation var:preset|spacing|50 → var(--wp--preset--spacing--50).
	$bdpdf_gap = 'var(--wp--' . str_replace( array( 'var:', '|' ), array( '', '--' ), $bdpdf_gap ) . ')';
}

$bdpdf_wrapper = get_block_wrapper_attributes(
	array(
		'class'                 => 'bdpdf-flipbook',
		'data-bdpdf-appearance' => $bdpdf_appearance,
		'style'                 => '' !== $bdpdf_gap ? '--bdpdf-gap:' . $bdpdf_gap . ';' : '',
	)
);
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
	<div class="bdpdf-loader">
		<p class="bdpdf-loader-text"><?php esc_html_e( 'PDF wird geladen …', 'blitz-donner-pdf' ); ?></p>
		<progress class="bdpdf-progress" max="1" value="0"></progress>
	</div>
	<div class="bdpdf-book" hidden></div>
	<div class="bdpdf-nav" hidden>
		<div class="wp-block-button is-style-default">
			<button type="button" class="bdpdf-prev wp-block-button__link wp-element-button">&lsaquo; <?php esc_html_e( 'Zurück', 'blitz-donner-pdf' ); ?></button>
		</div>
		<span class="bdpdf-pageinfo" aria-live="polite"></span>
		<div class="wp-block-button is-style-default">
			<button type="button" class="bdpdf-next wp-block-button__link wp-element-button"><?php esc_html_e( 'Weiter', 'blitz-donner-pdf' ); ?> &rsaquo;</button>
		</div>
	</div>
	<p class="bdpdf-fallback">
		<a href="<?php echo $bdpdf_pdf_url; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- oben mit esc_url() escaped. ?>" download>
			<?php esc_html_e( 'PDF herunterladen', 'blitz-donner-pdf' ); ?>
		</a>
	</p>
</div>
