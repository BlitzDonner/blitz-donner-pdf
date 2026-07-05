<?php
/**
 * Plugin Name:       Blitz & Donner PDF
 * Plugin URI:        https://plugins.blitzdonner.ch
 * Description:       Gutenberg-Block «BD PDF», der ein PDF aus der Mediathek als blätterbares Buch anzeigt. Seiten werden nach dem Hochladen vorgerendert; PDF.js und StPageFlip sind lokal gebündelt, kein CDN.
 * Version:           0.3.1
 * Requires at least: 6.5
 * Requires PHP:      7.4
 * Author:            Blitz & Donner
 * Author URI:        https://blitzdonner.ch
 * License:           GPL-3.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-3.0.html
 * Update URI:        https://plugins.blitzdonner.ch/bdpdf
 * Text Domain:       bdpdf
 *
 * @package bdpdf
 */

defined( 'ABSPATH' ) || exit;

define( 'BDPDF_VERSION', '0.3.1' );
define( 'BDPDF_TARGET_WIDTH', 2000 ); // Pixelbreite der vorgerenderten Seitenbilder.

require_once __DIR__ . '/includes/rest-pages.php';

add_action(
	'init',
	function () {
		register_block_type( __DIR__ . '/blocks/flipbook' );

		// Einstellungen für das Editor-Skript (kein Build-Step, darum inline).
		$settings = array(
			'pdfjsUrl'    => plugins_url( 'blocks/flipbook/pdf.min.mjs', __FILE__ ),
			'workerUrl'   => plugins_url( 'blocks/flipbook/pdf.worker.min.mjs', __FILE__ ),
			'pageFlipUrl' => plugins_url( 'blocks/flipbook/page-flip.browser.js', __FILE__ ),
			'coreUrl'     => plugins_url( 'blocks/flipbook/flipbook-core.js', __FILE__ ),
			'targetWidth' => BDPDF_TARGET_WIDTH,
			'version'     => BDPDF_VERSION,
		);
		wp_add_inline_script(
			'bdpdf-flipbook-editor-script',
			'window.bdpdfEditor = ' . wp_json_encode( $settings ) . ';',
			'before'
		);
	}
);

// Vorgerenderte Seitenbilder entfernen, wenn das PDF-Attachment gelöscht wird.
add_action(
	'delete_attachment',
	function ( $att_id ) {
		$upload = wp_upload_dir();
		$dir    = trailingslashit( $upload['basedir'] ) . 'bdpdf/' . absint( $att_id );
		if ( ! is_dir( $dir ) ) {
			return;
		}
		foreach ( glob( $dir . '/page-*.jpg' ) as $file ) {
			wp_delete_file( $file );
		}
		@rmdir( $dir ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- leerer Ordner, Fehlschlag unkritisch.
		delete_post_meta( $att_id, '_bdpdf_pages' );
	}
);
