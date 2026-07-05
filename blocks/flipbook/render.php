<?php
/**
 * Frontend-Ausgabe des PDF-Flipbook-Blocks.
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

$bdpdf_wrapper = get_block_wrapper_attributes( array( 'class' => 'bdpdf-flipbook' ) );
?>
<div <?php echo $bdpdf_wrapper; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- von WordPress escaped. ?>
	data-pdf-url="<?php echo $bdpdf_pdf_url; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- oben mit esc_url() escaped. ?>"
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
		<button type="button" class="bdpdf-prev">&lsaquo; <?php esc_html_e( 'Zurück', 'bdpdf' ); ?></button>
		<span class="bdpdf-pageinfo" aria-live="polite"></span>
		<button type="button" class="bdpdf-next"><?php esc_html_e( 'Weiter', 'bdpdf' ); ?> &rsaquo;</button>
	</div>
	<p class="bdpdf-fallback">
		<a href="<?php echo $bdpdf_pdf_url; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- oben mit esc_url() escaped. ?>" download>
			<?php esc_html_e( 'PDF herunterladen', 'bdpdf' ); ?>
		</a>
	</p>
</div>
