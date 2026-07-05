<?php
/**
 * Frontend-Ausgabe des BD-PDF-Blocks.
 *
 * Verfügbare Variablen: $attributes, $content, $block.
 *
 * @package bdpdf
 */

if ( empty( $attributes['pdfUrl'] ) ) {
	return;
}

$bdpdf_pdf_url = esc_url( $attributes['pdfUrl'] );
$bdpdf_label   = ! empty( $attributes['pdfTitle'] )
	? $attributes['pdfTitle']
	: __( 'PDF-Dokument, blätterbar', 'bdpdf' );

// Vorgerenderte Seitenbilder (vom Editor nach der PDF-Auswahl erzeugt).
$bdpdf_pages_json = '';
$bdpdf_page_w     = 0;
$bdpdf_page_h     = 0;
if ( ! empty( $attributes['pdfId'] ) ) {
	$bdpdf_att_id = absint( $attributes['pdfId'] );
	$bdpdf_meta   = get_post_meta( $bdpdf_att_id, '_bdpdf_pages', true );
	if ( ! empty( $bdpdf_meta['count'] ) ) {
		$bdpdf_upload = wp_upload_dir();
		$bdpdf_base   = trailingslashit( $bdpdf_upload['baseurl'] ) . 'bdpdf/' . $bdpdf_att_id;
		$bdpdf_urls   = array();
		for ( $bdpdf_i = 1; $bdpdf_i <= (int) $bdpdf_meta['count']; $bdpdf_i++ ) {
			$bdpdf_urls[] = $bdpdf_base . '/page-' . $bdpdf_i . '.jpg';
		}
		$bdpdf_pages_json = wp_json_encode( $bdpdf_urls );
		$bdpdf_page_w     = (int) $bdpdf_meta['width'];
		$bdpdf_page_h     = (int) $bdpdf_meta['height'];
	}
}

// Darstellungsmodus wie bei Blitz & Donner Forms: theme | auto | light | dark.
$bdpdf_appearance = isset( $attributes['appearanceMode'] ) ? sanitize_key( (string) $attributes['appearanceMode'] ) : 'auto';
if ( ! in_array( $bdpdf_appearance, array( 'theme', 'auto', 'light', 'dark' ), true ) ) {
	$bdpdf_appearance = 'auto';
}

$bdpdf_wrapper = get_block_wrapper_attributes(
	array(
		'class'                 => 'bdpdf-flipbook',
		'data-bdpdf-appearance' => $bdpdf_appearance,
	)
);
?>
<div <?php echo $bdpdf_wrapper; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- von WordPress escaped. ?>
	data-pdf-url="<?php echo $bdpdf_pdf_url; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- oben mit esc_url() escaped. ?>"
	<?php if ( $bdpdf_pages_json ) : ?>
	data-pages="<?php echo esc_attr( $bdpdf_pages_json ); ?>"
	data-page-w="<?php echo esc_attr( $bdpdf_page_w ); ?>"
	data-page-h="<?php echo esc_attr( $bdpdf_page_h ); ?>"
	<?php endif; ?>
	data-show-cover="<?php echo empty( $attributes['showCover'] ) ? '0' : '1'; ?>"
	tabindex="0"
	role="region"
	aria-label="<?php echo esc_attr( $bdpdf_label ); ?>">
	<div class="bdpdf-loader">
		<p class="bdpdf-loader-text"><?php esc_html_e( 'PDF wird geladen …', 'bdpdf' ); ?></p>
		<progress class="bdpdf-progress" max="1" value="0"></progress>
	</div>
	<div class="bdpdf-book" hidden></div>
	<div class="bdpdf-nav" hidden>
		<div class="wp-block-button is-style-default">
			<button type="button" class="bdpdf-prev wp-block-button__link wp-element-button">&lsaquo; <?php esc_html_e( 'Zurück', 'bdpdf' ); ?></button>
		</div>
		<span class="bdpdf-pageinfo" aria-live="polite"></span>
		<div class="wp-block-button is-style-default">
			<button type="button" class="bdpdf-next wp-block-button__link wp-element-button"><?php esc_html_e( 'Weiter', 'bdpdf' ); ?> &rsaquo;</button>
		</div>
	</div>
	<p class="bdpdf-fallback">
		<a href="<?php echo $bdpdf_pdf_url; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- oben mit esc_url() escaped. ?>" download>
			<?php esc_html_e( 'PDF herunterladen', 'bdpdf' ); ?>
		</a>
	</p>
</div>
