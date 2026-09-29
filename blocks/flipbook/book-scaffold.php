<?php
/**
 * Buch-Gerüst des BD-PDF-Blocks (Loader, Buch, Navigation, Fallback-Link).
 *
 * Wird von render.php eingebunden – im Buch-Modus direkt im Wrapper, im
 * Datei-Modus innerhalb des Popover-Dialogs. Erwartet die lokalen Variablen
 * aus render.php ($bdpdf_pdf_url). Bewusst KEINE Funktionsdefinitionen:
 * render.php läuft pro Block-Instanz.
 *
 * @package bdpdf
 */

defined( 'ABSPATH' ) || exit;
?>
<div class="bdpdf-loader">
	<p class="bdpdf-loader-text"><?php esc_html_e( 'PDF wird geladen …', 'blitz-donner-pdf' ); ?></p>
	<progress class="bdpdf-progress" max="1" value="0"></progress>
</div>
<div class="bdpdf-book" hidden></div>
<div class="bdpdf-nav" hidden>
	<div class="wp-block-button is-style-default">
		<button type="button" class="bdpdf-prev wp-block-button__link wp-element-button" aria-label="<?php esc_attr_e( 'Zurück', 'blitz-donner-pdf' ); ?>">&lsaquo;</button>
	</div>
	<span class="bdpdf-pageinfo" aria-live="polite"></span>
	<div class="wp-block-button is-style-default">
		<button type="button" class="bdpdf-next wp-block-button__link wp-element-button" aria-label="<?php esc_attr_e( 'Weiter', 'blitz-donner-pdf' ); ?>">&rsaquo;</button>
	</div>
	<button type="button" class="bdpdf-fullscreen" aria-label="<?php esc_attr_e( 'Vollbild', 'blitz-donner-pdf' ); ?>" title="<?php esc_attr_e( 'Vollbild', 'blitz-donner-pdf' ); ?>"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 0h2v6h-6v-2h4v-4z"/></svg></button>
</div>
<p class="bdpdf-fallback">
	<a href="<?php echo $bdpdf_pdf_url; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- in render.php mit esc_url() escaped. ?>" download>
		<?php esc_html_e( 'PDF herunterladen', 'blitz-donner-pdf' ); ?>
	</a>
</p>
