/**
 * Editor-Ansicht des BD-PDF-Blocks (ohne Build-Step, nutzt wp-Globals).
 *
 * Nach der PDF-Auswahl rendert der Editor alle Seiten einmal mit PDF.js und
 * lädt sie über die REST-Route bdpdf/v1/pages hoch. Die Vorschau ist eine
 * reine React-Doppelseiten-Ansicht mit identischem Markup und Stylesheet wie
 * das Frontend – bewusst OHNE StPageFlip im Editor-Canvas: dessen globale
 * Event-Handler schlucken Klicks und brechen Gutenbergs Popover-Mechanik
 * (Werkzeugleiste). Die Umblätter-Animation gibt es nur im Frontend.
 *
 * @package bdpdf
 */
( function ( wp ) {
	'use strict';

	const { registerBlockType } = wp.blocks;
	const el = wp.element.createElement;
	const { useState, useEffect } = wp.element;
	const { useBlockProps, MediaPlaceholder, MediaReplaceFlow, BlockControls, InspectorControls } =
		wp.blockEditor;
	const { PanelBody, ToggleControl, SelectControl, Spinner } = wp.components;
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
	 * Doppelseiten-Aufteilung wie im Frontend-Flipbook: mit Buchdeckel steht
	 * die erste Seite allein, danach Paare.
	 *
	 * @param {number}  count     Seitenzahl.
	 * @param {boolean} showCover Erste Seite als Buchdeckel.
	 * @return {number[][]} Liste sichtbarer Seitenpaare (0-basiert).
	 */
	function bdpdfSpreads( count, showCover ) {
		const out = [];
		let start = 0;
		if ( showCover && count > 0 ) {
			out.push( [ 0 ] );
			start = 1;
		}
		for ( let i = start; i < count; i += 2 ) {
			out.push( i + 1 < count ? [ i, i + 1 ] : [ i ] );
		}
		return out;
	}

	registerBlockType( 'bdpdf/flipbook', {
		edit: function ( props ) {
			const { attributes, setAttributes } = props;
			const blockProps = useBlockProps( {
				className: 'bdpdf-flipbook bdpdf-editor',
				'data-bdpdf-appearance': attributes.appearanceMode || 'auto',
			} );

			const [ status, setStatus ]       = useState( 'leer' ); // leer | prueft | rendert | bereit | fehler
			const [ progress, setProgress ]   = useState( { done: 0, total: 0 } );
			const [ pages, setPages ]         = useState( null );
			const [ spreadIdx, setSpreadIdx ] = useState( 0 );

			const onSelect = function ( media ) {
				setPages( null );
				setSpreadIdx( 0 );
				setStatus( 'prueft' );
				setAttributes( {
					pdfId: media.id,
					pdfUrl: media.url,
					pdfTitle: media.title || '',
				} );
			};

			// Nach Auswahl: Status prüfen, bei Bedarf rendern und hochladen.
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
							setPages( info.urls );
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
							setPages( done.urls );
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

			// Buchdeckel-Wechsel: Ansicht auf den Anfang zurücksetzen.
			useEffect( () => {
				setSpreadIdx( 0 );
			}, [ attributes.showCover ] );

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

			// Vorschau-Inhalt: Doppelseite (React, ohne StPageFlip).
			let inhalt;
			if ( 'bereit' === status && pages ) {
				const alle    = bdpdfSpreads( pages.length, !! attributes.showCover );
				const idx     = Math.min( spreadIdx, alle.length - 1 );
				const spread  = alle[ idx ];
				const letzte  = spread[ spread.length - 1 ] + 1;
				const info    = 1 === spread.length
					? `Seite ${ spread[ 0 ] + 1 } / ${ pages.length }`
					: `Seiten ${ spread[ 0 ] + 1 }–${ letzte } / ${ pages.length }`;
				inhalt = [
					el(
						'div',
						{ className: 'bdpdf-book bdpdf-book-static', key: 'book' },
						spread.map( ( p ) =>
							el(
								'div',
								{ className: 'bdpdf-page', key: 'p' + p },
								el( 'img', { src: pages[ p ], alt: '' } )
							)
						)
					),
					el(
						'div',
						{ className: 'bdpdf-nav', key: 'nav' },
						el(
							'div',
							{ className: 'wp-block-button is-style-default' },
							el(
								'button',
								{
									type: 'button',
									className: 'bdpdf-prev wp-block-button__link wp-element-button',
									disabled: idx <= 0,
									onClick: () => setSpreadIdx( Math.max( 0, idx - 1 ) ),
								},
								'‹ ' + __( 'Zurück', 'bdpdf' )
							)
						),
						el( 'span', { className: 'bdpdf-pageinfo' }, info ),
						el(
							'div',
							{ className: 'wp-block-button is-style-default' },
							el(
								'button',
								{
									type: 'button',
									className: 'bdpdf-next wp-block-button__link wp-element-button',
									disabled: idx >= alle.length - 1,
									onClick: () => setSpreadIdx( Math.min( alle.length - 1, idx + 1 ) ),
								},
								__( 'Weiter', 'bdpdf' ) + ' ›'
							)
						)
					),
					el(
						'p',
						{ className: 'bdpdf-fallback', key: 'fallback' },
						el( 'a', { href: attributes.pdfUrl, download: true }, __( 'PDF herunterladen', 'bdpdf' ) )
					),
				];
			} else {
				inhalt = [
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
				];
			}

			return el(
				'div',
				blockProps,
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
				// Farbmodus gehört in den Stil-Tab (Pinsel) – gleiche Logik
				// und gleiche Optionen wie bei Blitz & Donner Forms.
				el(
					InspectorControls,
					{ group: 'styles' },
					el(
						PanelBody,
						{ title: __( 'Erscheinungsbild', 'bdpdf' ), initialOpen: true },
						el( SelectControl, {
							label: __( 'Farbmodus', 'bdpdf' ),
							value: attributes.appearanceMode || 'auto',
							help:
								'theme' === ( attributes.appearanceMode || 'auto' )
									? __( 'Farben, Buttons und Typografie kommen vollständig aus dem Theme (theme.json). Das Plugin fügt kein eigenes CSS hinzu.', 'bdpdf' )
									: undefined,
							options: [
								{ label: __( 'Theme (Standard)', 'bdpdf' ), value: 'theme' },
								{ label: __( 'Automatisch (System)', 'bdpdf' ), value: 'auto' },
								{ label: __( 'Hell', 'bdpdf' ), value: 'light' },
								{ label: __( 'Dunkel', 'bdpdf' ), value: 'dark' },
							],
							onChange: function ( value ) {
								setAttributes( { appearanceMode: value || 'auto' } );
							},
						} )
					)
				),
				inhalt
			);
		},
		save: function () {
			return null;
		},
	} );
} )( window.wp );
