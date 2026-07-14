/**
 * Nachlader für dynamisch eingefügte Flipbook-Blöcke.
 *
 * Läuft auf jeder Frontend-Seite. WordPress reiht die Block-Assets nur ein,
 * wenn der Block beim Seitenaufbau serverseitig gerendert wird. Lädt ein
 * Theme den Beitragsinhalt aber erst per AJAX nach (z.B. in ein Popover),
 * fehlen CSS, StPageFlip, Core und View-Modul. Dieses Skript beobachtet den
 * DOM und lädt die Assets genau dann nach, wenn ein Block auftaucht.
 *
 * @package bdpdf
 */
( function () {
	'use strict';

	var cfg = window.bdpdfLoaderConfig;
	if ( ! cfg ) {
		return;
	}

	var SELECTOR = '.wp-block-bdpdf-flipbook[data-pdf-url]';
	var gestartet = false;

	function ladeStylesheet() {
		// Bereits vorhanden, wenn der Block serverseitig gerendert wurde.
		if ( document.getElementById( 'bdpdf-flipbook-style-css' ) || document.getElementById( 'bdpdf-dyn-css' ) ) {
			return;
		}
		var link = document.createElement( 'link' );
		link.id = 'bdpdf-dyn-css';
		link.rel = 'stylesheet';
		link.href = cfg.viewCss;
		document.head.appendChild( link );
	}

	function ladeSkript( src ) {
		return new Promise( function ( resolve, reject ) {
			var s = document.createElement( 'script' );
			s.src = src;
			s.onload = resolve;
			s.onerror = reject;
			document.head.appendChild( s );
		} );
	}

	function starte() {
		if ( gestartet ) {
			return;
		}
		gestartet = true;
		ladeStylesheet();
		var kette = Promise.resolve();
		if ( ! window.St ) {
			kette = kette.then( function () {
				return ladeSkript( cfg.pageFlip );
			} );
		}
		kette.then( function () {
			return window.bdpdfFlipbook ? null : ladeSkript( cfg.core );
		} ).then( function () {
			// Das View-Modul initialisiert alle vorhandenen Blöcke und
			// beobachtet danach selbst den DOM.
			return import( cfg.view );
		} ).catch( function ( err ) {
			// eslint-disable-next-line no-console
			console.error( '[bdpdf] Nachladen der Flipbook-Assets fehlgeschlagen:', err );
		} );
	}

	function pruefe( node ) {
		if ( gestartet || window.bdpdfFlipbook ) {
			// Assets sind schon da (serverseitig gerendert) – das View-Modul
			// übernimmt neue Blöcke selbst.
			return;
		}
		var treffer = ( node.matches && node.matches( SELECTOR ) ) ||
			( node.querySelector && node.querySelector( SELECTOR ) );
		if ( treffer ) {
			starte();
		}
	}

	function beobachte() {
		pruefe( document.body );
		new MutationObserver( function ( mutations ) {
			if ( gestartet ) {
				return;
			}
			for ( var i = 0; i < mutations.length; i++ ) {
				var nodes = mutations[ i ].addedNodes;
				for ( var j = 0; j < nodes.length; j++ ) {
					if ( 1 === nodes[ j ].nodeType ) {
						pruefe( nodes[ j ] );
						if ( gestartet ) {
							return;
						}
					}
				}
			}
		} ).observe( document.body, { childList: true, subtree: true } );
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', beobachte );
	} else {
		beobachte();
	}
}() );
