<?php
/**
 * Plugin Name:       Blitz & Donner PDF
 * Plugin URI:        https://plugins.blitzdonner.ch
 * Description:       Gutenberg-Block «BD PDF», der ein PDF aus der Mediathek als blätterbares Buch anzeigt. Seiten werden nach dem Hochladen vorgerendert; PDF.js und StPageFlip sind lokal gebündelt, kein CDN.
 * Version:           0.8.1
 * Requires at least: 6.5
 * Requires PHP:      7.4
 * Author:            Blitz & Donner
 * Author URI:        https://blitzdonner.ch
 * License:           GPL-3.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-3.0.html
 * Update URI:        https://plugins.blitzdonner.ch/blitz-donner-pdf
 * Text Domain:       blitz-donner-pdf
 *
 * @package bdpdf
 */

defined( 'ABSPATH' ) || exit;

define( 'BDPDF_VERSION', '0.8.1' );
define( 'BDPDF_PLUGIN_FILE', __FILE__ );
define( 'BDPDF_TARGET_WIDTH', 2000 ); // Pixelbreite der vorgerenderten Seitenbilder.

// Gebündeltes Beispiel-PDF (assets/demo/): füllt die Block-Vorschau (example)
// und den «Ausprobieren»-Modus, solange kein eigenes PDF gewählt ist.
define( 'BDPDF_DEMO_COUNT', 4 );
define( 'BDPDF_DEMO_WIDTH', 898 );
define( 'BDPDF_DEMO_HEIGHT', 1265 );

/**
 * Demo-Konfiguration für Editor und Frontend: URLs des gebündelten
 * Beispiel-PDFs und seiner vorgerenderten Seitenbilder.
 *
 * @return array{pdfUrl: string, pages: string[], width: int, height: int}
 */
function bdpdf_demo_config() {
	$pages = array();
	for ( $i = 1; $i <= BDPDF_DEMO_COUNT; $i++ ) {
		$pages[] = plugins_url( 'assets/demo/page-' . $i . '.jpg', BDPDF_PLUGIN_FILE );
	}
	$demo_pfad = plugin_dir_path( BDPDF_PLUGIN_FILE ) . 'assets/demo/pdf-demo.pdf';
	return array(
		'pdfUrl'   => plugins_url( 'assets/demo/pdf-demo.pdf', BDPDF_PLUGIN_FILE ),
		'pages'    => $pages,
		'width'    => BDPDF_DEMO_WIDTH,
		'height'   => BDPDF_DEMO_HEIGHT,
		// Formatierte Werte für die Datei-Zeile – identisch in Editor und Frontend.
		'sizeText' => file_exists( $demo_pfad ) ? size_format( filesize( $demo_pfad ), 1 ) : '',
		'dateText' => wp_date( get_option( 'date_format' ), strtotime( '2026-01-15' ) ),
	);
}

/**
 * Preset-Notation var:preset|spacing|50 → var(--wp--preset--spacing--50).
 *
 * @param mixed $wert Roh-Wert aus Block-Attribut oder globalen Stilen.
 * @return string CSS-tauglicher Wert oder leerer String.
 */
function bdpdf_css_var( $wert ) {
	if ( ! is_string( $wert ) || '' === $wert ) {
		return '';
	}
	if ( 0 === strpos( $wert, 'var:' ) ) {
		return 'var(--wp--' . str_replace( array( 'var:', '|' ), array( '', '--' ), $wert ) . ')';
	}
	return $wert;
}

require_once __DIR__ . '/includes/rest-pages.php';

// Update-Client: bezieht Updates vom Self-hosted Server (kein Killswitch,
// bei fehlendem/gesperrtem Token wird nur das Update verweigert).
// Frueh auf plugins_loaded: Der Filter pre_set_site_transient_update_plugins
// muss registriert sein, BEVOR WordPress den update_plugins-Transient befuellt
// (auch im Cron-Loopback) – sonst blendet WP die Auto-Update-Schaltung aus.
add_action(
	'plugins_loaded',
	function () {
		if ( ! class_exists( 'BD_Update_Client' ) ) {
			require_once __DIR__ . '/includes/class-bd-update-client.php';
		}
		new BD_Update_Client(
			array(
				'plugin_file' => __FILE__,
				'slug'        => 'blitz-donner-pdf',
				'server_url'  => 'https://plugins.blitzdonner.ch',
				'version'     => BDPDF_VERSION,
				'option_key'  => 'bdpdf_license_token',
				'const_key'   => 'BDPDF_LICENSE_TOKEN',
			)
		);
	}
);

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
			'demo'        => bdpdf_demo_config(),
		);
		wp_add_inline_script(
			'bdpdf-flipbook-editor-script',
			'window.bdpdfEditor = ' . wp_json_encode( $settings ) . ';',
			'before'
		);
	}
);

// Nachlader für dynamisch eingefügten Inhalt: WordPress reiht Block-Assets
// nur bei serverseitigem Rendern ein. Lädt ein Theme den Beitrag per AJAX
// nach (z.B. Popover auf einer Übersichtsseite), fehlen sie. Der schlanke
// Loader beobachtet den DOM und holt die Assets erst, wenn ein Block auftaucht.
add_action(
	'wp_enqueue_scripts',
	function () {
		$loader_config = array(
			'viewCss'  => plugins_url( 'blocks/flipbook/view.css', __FILE__ ) . '?ver=' . BDPDF_VERSION,
			'pageFlip' => plugins_url( 'blocks/flipbook/page-flip.browser.js', __FILE__ ) . '?ver=' . BDPDF_VERSION,
			'core'     => plugins_url( 'blocks/flipbook/flipbook-core.js', __FILE__ ) . '?ver=' . BDPDF_VERSION,
			'view'     => plugins_url( 'blocks/flipbook/view.mjs', __FILE__ ) . '?ver=' . BDPDF_VERSION,
		);
		wp_register_script(
			'bdpdf-dynamic-loader',
			plugins_url( 'blocks/flipbook/dynamic-loader.js', __FILE__ ),
			array(),
			BDPDF_VERSION,
			array(
				'in_footer' => true,
				'strategy'  => 'defer',
			)
		);
		wp_add_inline_script(
			'bdpdf-dynamic-loader',
			'window.bdpdfLoaderConfig = ' . wp_json_encode( $loader_config ) . ';',
			'before'
		);
		wp_enqueue_script( 'bdpdf-dynamic-loader' );
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
