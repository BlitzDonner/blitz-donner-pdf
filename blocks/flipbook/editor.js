/**
 * Editor-Ansicht des BD-PDF-Blocks (ohne Build-Step, nutzt wp-Globals).
 *
 * Nach der PDF-Auswahl rendert der Editor alle Seiten einmal mit PDF.js und
 * lädt sie über die REST-Route bdpdf/v1/pages hoch. Danach zeigt der Editor
 * dieselbe Flipbook-Ansicht wie das Frontend (gleiches Markup, gleiches
 * Stylesheet, gleicher Kern).
 *
 * @package bdpdf
 */
( function ( wp ) {
	'use strict';

	const { registerBlockType } = wp.blocks;
	const el = wp.element.createElement;
	const { useState, useEffect, useRef } = wp.element;
	const { useBlockProps, MediaPlaceholder, MediaReplaceFlow, BlockControls, InspectorControls } =
		wp.blockEditor;
	const { PanelBody, ToggleControl, Spinner } = wp.components;
	const { __ } = wp.i18n;
	const apiFetch = wp.apiFetch;

	const ALLOWED_TYPES = [ 'application/pdf' ];
	const CFG = () => window.bdpdfEditor || {};

	/** PDF.js einmalig laden (ES-Modul per dynamischem Import). */
	let pdfjsPromise = null;
	function loadPdfjs() {
		if ( ! pdfjsPromise ) {
			pdfjsPromise = import( CFG().pdfjsUrl ).then( ( m ) => {
				m.GlobalWorkerOptions.workerSrc = CFG().workerUrl;
				return m;
			} );
		}
		return pdfjsPromise;
	}

	/**
	 * Stellt sicher, dass StPageFlip und der Flipbook-Kern im Dokument des
	 * Blocks verfügbar sind (im iframe-Editor ist das nicht das Admin-Dokument).
	 */
	function ensureLibs( doc ) {
		const w = doc.defaultView;
		const load = ( check, url ) =>
			new Promise( ( resolve, reject ) => {
				if ( check() ) {
					return resolve();
				}
				const s   = doc.createElement( 'script' );
				s.src     = url;
				s.onload  = () => resolve();
				s.onerror = () => reject( new Error( 'Skript nicht ladbar: ' + url ) );
				doc.head.appendChild( s );
			} );
		return load( () => !! w.St, CFG().pageFlipUrl ).then( () =>
			load( () => !! w.bdpdfFlipbook, CFG().coreUrl )
		);
	}

	/** Rendert das PDF seitenweise und lädt jede Seite zur REST-Route hoch. */
	async function renderAndUpload( pdfId, pdfUrl, onProgress ) {
		const pdfjsLib = await loadPdfjs();
		const pdf      = await pdfjsLib.getDocument( pdfUrl ).promise;
		const total    = pdf.numPages;
		let pageW      = 0;
		let pageH      = 0;

		for ( let i = 1; i <= total; i++ ) {
			const page     = await pdf.getPage( i );
			const base     = page.getViewport( { scale: 1 } );
			const scale    = ( CFG().targetWidth || 2000 ) / base.width;
			const viewport = page.getViewport( { scale } );
			if ( 1 === i ) {
				pageW = Math.round( viewport.width );
				pageH = Math.round( viewport.height );
			}
			const canvas  = document.createElement( 'canvas' );
			canvas.width  = viewport.width;
			canvas.height = viewport.height;
			await page.render( { canvasContext: canvas.getContext( '2d' ), viewport, intent: 'print' } ).promise;

			await apiFetch( {
				path: '/bdpdf/v1/pages/' + pdfId,
				method: 'POST',
				data: {
					page: i,
					total: total,
					width: pageW,
					height: pageH,
					image: canvas.toDataURL( 'image/jpeg', 0.9 ),
				},
			} );
			onProgress( i, total );
		}
	}

	/**
	 * Frontend-identisches Markup (Buch, Navigation, Fallback-Link).
	 * Bewusst ohne hidden-Attribute: Sichtbarkeit steuert der Flipbook-Kern
	 * direkt am DOM, React soll sie bei Re-Renders nicht zurücksetzen.
	 */
	function flipbookMarkup( pdfUrl ) {
		return [
			el( 'div', { className: 'bdpdf-book', key: 'book' } ),
			el(
				'div',
				{ className: 'bdpdf-nav', key: 'nav' },
				el( 'button', { type: 'button', className: 'bdpdf-prev' }, '‹ ' + __( 'Zurück', 'bdpdf' ) ),
				el( 'span', { className: 'bdpdf-pageinfo', 'aria-live': 'polite' } ),
				el( 'button', { type: 'button', className: 'bdpdf-next' }, __( 'Weiter', 'bdpdf' ) + ' ›' )
			),
			el(
				'p',
				{ className: 'bdpdf-fallback', key: 'fallback' },
				el( 'a', { href: pdfUrl, download: true }, __( 'PDF herunterladen', 'bdpdf' ) )
			),
		];
	}

	registerBlockType( 'bdpdf/flipbook', {
		edit: function ( props ) {
			const { attributes, setAttributes } = props;
			const blockProps = useBlockProps( { className: 'bdpdf-flipbook bdpdf-editor' } );

			const [ status, setStatus ]     = useState( 'leer' ); // leer | prueft | rendert | bereit | fehler
			const [ progress, setProgress ] = useState( { done: 0, total: 0 } );
			const [ pages, setPages ]       = useState( null );
			const rootRef = useRef( null );
			const instRef = useRef( null );

			const onSelect = function ( media ) {
				setPages( null );
				setStatus( 'prueft' );
				setAttributes( {
					pdfId: media.id,
					pdfUrl: media.url,
					pdfTitle: media.title || '',
				} );
			};

			// 1) Nach Auswahl: Status prüfen, bei Bedarf rendern und hochladen.
			useEffect( () => {
				if ( ! attributes.pdfId ) {
					setStatus( 'leer' );
					return;
				}
				let cancelled = false;
				( async () => {
					try {
						setStatus( 'prueft' );
						const info = await apiFetch( { path: '/bdpdf/v1/pages/' + attributes.pdfId } );
						if ( cancelled ) {
							return;
						}
						if ( info.count > 0 ) {
							setPages( { urls: info.urls, width: info.width, height: info.height } );
							setStatus( 'bereit' );
							return;
						}
						setStatus( 'rendert' );
						await renderAndUpload( attributes.pdfId, attributes.pdfUrl, ( done, total ) => {
							if ( ! cancelled ) {
								setProgress( { done, total } );
							}
						} );
						const done = await apiFetch( { path: '/bdpdf/v1/pages/' + attributes.pdfId } );
						if ( ! cancelled ) {
							setPages( { urls: done.urls, width: done.width, height: done.height } );
							setStatus( 'bereit' );
						}
					} catch ( err ) {
						// eslint-disable-next-line no-console
						console.error( '[bdpdf]', err );
						if ( ! cancelled ) {
							setStatus( 'fehler' );
						}
					}
				} )();
				return () => {
					cancelled = true;
				};
			}, [ attributes.pdfId ] );

			// 2) Sobald Seiten bereit sind: echtes Flipbook wie im Frontend aufbauen.
			useEffect( () => {
				if ( 'bereit' !== status || ! pages || ! rootRef.current ) {
					return;
				}
				const root = rootRef.current;
				let disposed = false;
				ensureLibs( root.ownerDocument )
					.then( () => {
						if ( disposed ) {
							return;
						}
						const w = root.ownerDocument.defaultView;
						instRef.current = w.bdpdfFlipbook.init( root, pages.urls, {
							pageWidth: pages.width,
							pageHeight: pages.height,
							showCover: !! attributes.showCover,
						} );
					} )
					.catch( ( err ) => {
						// eslint-disable-next-line no-console
						console.error( '[bdpdf]', err );
					} );
				return () => {
					disposed = true;
					if ( instRef.current && instRef.current.pageFlip ) {
						try {
							instRef.current.pageFlip.destroy();
						} catch ( e ) {} // eslint-disable-line no-empty
						instRef.current = null;
					}
					const book = root.querySelector( '.bdpdf-book' );
					if ( book ) {
						book.hidden = true;
						book.innerHTML = '';
					}
				};
			}, [ status, pages, attributes.showCover ] );

			if ( ! attributes.pdfUrl ) {
				return el(
					'div',
					blockProps,
					el( MediaPlaceholder, {
						icon: 'book',
						labels: {
							title: __( 'BD PDF', 'bdpdf' ),
							instructions: __(
								'Wähle ein PDF aus der Mediathek oder lade eines hoch. Es wird sofort gerendert und als blätterbares Buch angezeigt.',
								'bdpdf'
							),
						},
						accept: 'application/pdf',
						allowedTypes: ALLOWED_TYPES,
						onSelect: onSelect,
					} )
				);
			}

			let statusText = __( 'PDF wird geladen …', 'bdpdf' );
			if ( 'prueft' === status ) {
				statusText = __( 'Prüfe vorgerenderte Seiten …', 'bdpdf' );
			} else if ( 'rendert' === status ) {
				statusText = __( 'Seiten werden gerendert und gespeichert …', 'bdpdf' )
					+ ( progress.total ? ` (${ progress.done }/${ progress.total })` : '' );
			} else if ( 'fehler' === status ) {
				statusText = __( 'Rendern fehlgeschlagen – Details in der Browser-Konsole.', 'bdpdf' );
			}

			return el(
				'div',
				Object.assign( {}, blockProps, { ref: rootRef } ),
				el(
					BlockControls,
					{ group: 'other' },
					el( MediaReplaceFlow, {
						mediaId: attributes.pdfId,
						mediaURL: attributes.pdfUrl,
						accept: 'application/pdf',
						allowedTypes: ALLOWED_TYPES,
						onSelect: onSelect,
						name: __( 'PDF ersetzen', 'bdpdf' ),
					} )
				),
				el(
					InspectorControls,
					null,
					el(
						PanelBody,
						{ title: __( 'Flipbook-Einstellungen', 'bdpdf' ) },
						el( ToggleControl, {
							label: __( 'Erste Seite als Buchdeckel', 'bdpdf' ),
							help: __( 'Zeigt die erste Seite einzeln, danach Doppelseiten.', 'bdpdf' ),
							checked: !! attributes.showCover,
							onChange: function ( value ) {
								setAttributes( { showCover: value } );
							},
						} )
					)
				),
				'bereit' === status
					? flipbookMarkup( attributes.pdfUrl )
					: [
						el(
							'div',
							{ className: 'bdpdf-loader', key: 'loader' },
							'fehler' !== status ? el( Spinner, { key: 'spin' } ) : null,
							el( 'p', { className: 'bdpdf-loader-text' }, statusText ),
							'rendert' === status
								? el( 'progress', {
									className: 'bdpdf-progress',
									max: progress.total || 1,
									value: progress.done,
								} )
								: null
						),
					]
			);
		},
		save: function () {
			return null;
		},
	} );
} )( window.wp );
