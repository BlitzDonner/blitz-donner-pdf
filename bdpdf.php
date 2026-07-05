<?php
/**
 * Plugin Name:       Blitz & Donner PDF
 * Plugin URI:        https://plugins.blitzdonner.ch
 * Description:       Gutenberg-Block, der ein PDF aus der Mediathek als blätterbares Buch anzeigt. PDF.js und StPageFlip sind lokal gebündelt, kein CDN.
 * Version:           1.0.0
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

add_action(
	'init',
	function () {
		register_block_type( __DIR__ . '/blocks/flipbook' );
	}
);
