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
	const { useState, useEffect, useRef, Fragment } = wp.element;
	const { useBlockProps, MediaPlaceholder, MediaReplaceFlow, BlockControls, InspectorControls } =
		wp.blockEditor;
	const { PanelBody, ToggleControl, SelectControl, Spinner, Button, TextControl } = wp.components;
	const { __ } = wp.i18n;
	const { useSelect } = wp.data;
	const apiFetch = wp.apiFetch;

	const ALLOWED_TYPES = [ 'application/pdf' ];
	const CFG = () => window.bdpdfEditor || {};

	/** Preset-Notation var:preset|spacing|50 → var(--wp--preset--spacing--50). */
	function bdpdfCssVar( wert ) {
		if ( 'string' !== typeof wert || '' === wert ) {
			return '';
		}
		if ( 0 === wert.indexOf( 'var:' ) ) {
			return 'var(--wp--' + wert.replace( 'var:', '' ).split( '|' ).join( '--' ) + ')';
		}
		return wert;
	}

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
	 * Rendert das PDF und lädt jede BUCHSEITE zur REST-Route hoch.
	 *
	 * layout 'single': eine Buchseite pro PDF-Seite (Standard).
	 * layout 'spread': Doppelseiten-PDF – jede breite PDF-Seite wird am Bund
	 * in zwei Buchseiten geteilt. Schmale erste/letzte Seiten (Umschlag,
	 * Breite < 75 % der Maximalbreite) bleiben ganz; so klappt das Buch exakt
	 * am Bund und zeigt die Doppelseiten wie gestaltet.
	 */
	async function renderAndUpload( pdfId, pdfUrl, layout, onProgress ) {
		const pdfjsLib = await loadPdfjs();
		const pdf      = await pdfjsLib.getDocument( pdfUrl ).promise;
		const spread   = 'spread' === layout;
		const target   = CFG().targetWidth || 2000;

		// Erster Pass: nur Seitenbreiten lesen (billig, ohne Rendern).
		const widths = [];
		for ( let i = 1; i <= pdf.numPages; i++ ) {
			widths.push( ( await pdf.getPage( i ) ).getViewport( { scale: 1 } ).width );
		}
		const maxW        = Math.max.apply( null, widths );
		const singles     = widths.map( ( w ) => spread && w < 0.75 * maxW );
		const coverSingle = spread && singles[ 0 ];
		const tailSingle  = spread && pdf.numPages > 1 && singles[ pdf.numPages - 1 ];

		let total = 0;
		for ( let i = 0; i < pdf.numPages; i++ ) {
			total += spread && ! singles[ i ] ? 2 : 1;
		}

		let bookPage = 0;
		let pageW    = 0;
		let pageH    = 0;
		for ( let i = 1; i <= pdf.numPages; i++ ) {
			const page = await pdf.getPage( i );
			const base = page.getViewport( { scale: 1 } );
			// Doppelseiten rendern auf 2×target, damit jede Hälfte target breit
			// ist; einzelne Umschlagseiten bekommen dieselbe Pixeldichte.
			const scale    = spread ? ( 2 * target ) / maxW : target / base.width;
			const viewport = page.getViewport( { scale } );
			const canvas   = document.createElement( 'canvas' );
			canvas.width   = Math.round( viewport.width );
			canvas.height  = Math.round( viewport.height );
			await page.render( { canvasContext: canvas.getContext( '2d' ), viewport, intent: 'print' } ).promise;

			const parts = [];
			if ( spread && ! singles[ i - 1 ] ) {
				const halfW = Math.floor( canvas.width / 2 );
				const left  = document.createElement( 'canvas' );
				left.width  = halfW;
				left.height = canvas.height;
				left.getContext( '2d' ).drawImage( canvas, 0, 0 );
				const right  = document.createElement( 'canvas' );
				right.width  = canvas.width - halfW;
				right.height = canvas.height;
				right.getContext( '2d' ).drawImage( canvas, -halfW, 0 );
				parts.push( left, right );
			} else {
				parts.push( canvas );
			}

			for ( const part of parts ) {
				bookPage++;
				if ( ! pageW ) {
					pageW = part.width;
					pageH = part.height;
				}
				await apiFetch( {
					path: '/bdpdf/v1/pages/' + pdfId,
					method: 'POST',
					data: {
						page: bookPage,
						total: total,
						width: pageW,
						height: pageH,
						layout: spread ? 'spread' : 'single',
						cover_single: coverSingle ? 1 : 0,
						tail_single: tailSingle ? 1 : 0,
						image: part.toDataURL( 'image/jpeg', 0.9 ),
					},
				} );
				onProgress( bookPage, total );
			}
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
			const modus = 'file' === attributes.displayMode ? 'file' : 'book';
			// Globale Stile für diesen Block (Website-Editor → Stile → Blöcke):
			// Kern gibt blockGap ohne Layout-Support und Schatten fürs Buch
			// nicht selbst aus – darum hier LIVE aus dem Datenspeicher lesen.
			const globalBlock = useSelect( ( select ) => {
				const core = select( 'core' );
				const gsId = core.__experimentalGetCurrentGlobalStylesId
					? core.__experimentalGetCurrentGlobalStylesId()
					: null;
				if ( ! gsId ) {
					return {};
				}
				const rec = core.getEditedEntityRecord( 'root', 'globalStyles', gsId );
				return ( rec && rec.styles && rec.styles.blocks && rec.styles.blocks[ 'bdpdf/flipbook' ] ) || {};
			}, [] );

			// «Block-Abstand» als Variable durchreichen – der Kern serialisiert
			// ihn ohne Layout-Support nicht selbst. Kette: Blockwert → globaler
			// Blockwert → CSS-Fallback (Theme-Gap → 0.75rem).
			const bdpdfGap = bdpdfCssVar(
				attributes.style && attributes.style.spacing && 'string' === typeof attributes.style.spacing.blockGap
					? attributes.style.spacing.blockGap
					: ( globalBlock.spacing && 'string' === typeof globalBlock.spacing.blockGap ? globalBlock.spacing.blockGap : '' )
			);
			const blockProps = useBlockProps( {
				className: 'bdpdf-flipbook bdpdf-editor bdpdf-mode-' + modus,
				'data-bdpdf-appearance': attributes.appearanceMode || 'theme',
				'data-mode': modus,
				style: bdpdfGap ? { '--bdpdf-gap': bdpdfGap } : undefined,
			} );
			// Schatten gehört aufs Buch, nicht auf den Wrapper: den vom
			// Schatten-Support erzeugten box-shadow in die Variable umleiten,
			// die view.css auf .bdpdf-page anwendet. Fällt der Blockwert weg,
			// gilt der globale Blockwert aus dem Website-Editor.
			if ( blockProps.style && blockProps.style.boxShadow ) {
				blockProps.style = Object.assign( {}, blockProps.style, {
					'--bdpdf-book-shadow': blockProps.style.boxShadow,
				} );
				delete blockProps.style.boxShadow;
			} else if ( 'string' === typeof globalBlock.shadow && '' !== globalBlock.shadow ) {
				blockProps.style = Object.assign( {}, blockProps.style || {}, {
					'--bdpdf-book-shadow': bdpdfCssVar( globalBlock.shadow ),
				} );
			}

			const [ status, setStatus ]       = useState( 'leer' ); // leer | prueft | rendert | bereit | fehler
			const [ progress, setProgress ]   = useState( { done: 0, total: 0 } );
			const [ pages, setPages ]         = useState( null );
			const [ pagesMeta, setPagesMeta ] = useState( { coverSingle: false, w: 0, h: 0, sizeText: '', dateText: '' } );
			const [ spreadIdx, setSpreadIdx ] = useState( 0 );
			const pageLayout = attributes.pageLayout || 'single';
			const istDemo    = !! attributes.useDemo && ! attributes.pdfId;
			const pdfHref    = attributes.pdfUrl || ( istDemo && CFG().demo ? CFG().demo.pdfUrl : '' );
			const zeigeView  = false !== attributes.showViewButton;
			const zeigeDown  = false !== attributes.showDownloadButton;
			const [ dialogOffen, setDialogOffen ] = useState( false );
			const dialogRef  = useRef( null );

			// Dialog im Editor: natives <dialog> wie im Frontend (Pixelgleichheit).
			useEffect( () => {
				const d = dialogRef.current;
				if ( ! d ) {
					return;
				}
				if ( dialogOffen && ! d.open ) {
					try {
						d.showModal();
					} catch ( e ) {} // eslint-disable-line no-empty
				}
				const zu = () => setDialogOffen( false );
				d.addEventListener( 'close', zu );
				return () => {
					d.removeEventListener( 'close', zu );
					if ( d.open ) {
						d.close();
					}
				};
			}, [ dialogOffen ] );

			const onSelect = function ( media ) {
				setPages( null );
				setSpreadIdx( 0 );
				setStatus( 'prueft' );
				setAttributes( {
					pdfId: media.id,
					pdfUrl: media.url,
					pdfTitle: media.title || '',
					useDemo: false,
				} );
			};

			// Nach Auswahl oder Layout-Wechsel: Status prüfen, bei Bedarf
			// rendern und hochladen. Passt das gespeicherte Layout nicht zum
			// eingestellten, wird neu gerendert; überzählige Alt-Dateien
			// entfernt der Server erst nach erfolgreichem Abschluss.
			useEffect( () => {
				// Beispiel-Modus: gebündelte Demo-Bilder, kein REST, kein Rendern.
				// Füllt auch die Block-Vorschau (example in block.json) – dort
				// sind keine REST-Aufrufe möglich.
				if ( attributes.useDemo && ! attributes.pdfId ) {
					const demo = CFG().demo || {};
					setPages( demo.pages || [] );
					setPagesMeta( { coverSingle: false, w: demo.width || 0, h: demo.height || 0, sizeText: demo.sizeText || '', dateText: demo.dateText || '' } );
					setSpreadIdx( 0 );
					setStatus( 'bereit' );
					return;
				}
				if ( ! attributes.pdfId ) {
					setStatus( 'leer' );
					return;
				}
				let cancelled = false;
				const uebernehmen = ( info ) => {
					setPages( info.urls );
					setPagesMeta( {
						coverSingle: !! info.cover_single,
						w: info.width || 0,
						h: info.height || 0,
						sizeText: info.file_size_text || '',
						dateText: info.file_date_text || '',
					} );
					setSpreadIdx( 0 );
					setStatus( 'bereit' );
				};
				( async () => {
					try {
						setStatus( 'prueft' );
						const info = await apiFetch( { path: '/bdpdf/v1/pages/' + attributes.pdfId } );
						if ( cancelled ) {
							return;
						}
						if ( info.count > 0 && ( info.layout || 'single' ) === pageLayout ) {
							uebernehmen( info );
							return;
						}
						setStatus( 'rendert' );
						await renderAndUpload( attributes.pdfId, attributes.pdfUrl, pageLayout, ( done, total ) => {
							if ( ! cancelled ) {
								setProgress( { done, total } );
							}
						} );
						const done = await apiFetch( { path: '/bdpdf/v1/pages/' + attributes.pdfId } );
						if ( ! cancelled ) {
							uebernehmen( done );
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
			}, [ attributes.pdfId, pageLayout, attributes.useDemo ] );

			// Buchdeckel-Wechsel: Ansicht auf den Anfang zurücksetzen.
			useEffect( () => {
				setSpreadIdx( 0 );
			}, [ attributes.showCover ] );

			if ( ! attributes.pdfUrl && ! attributes.useDemo ) {
				return el(
					'div',
					blockProps,
					el(
						MediaPlaceholder,
						{
							icon: 'book',
							labels: {
								title: __( 'BD PDF', 'blitz-donner-pdf' ),
								instructions: __(
									'Wähle ein PDF aus der Mediathek oder lade eines hoch. Es wird sofort gerendert und als blätterbares Buch angezeigt.',
									'blitz-donner-pdf'
								),
							},
							accept: 'application/pdf',
							allowedTypes: ALLOWED_TYPES,
							onSelect: onSelect,
						},
						el(
							Button,
							{
								variant: 'secondary',
								onClick: () => setAttributes( { useDemo: true } ),
							},
							__( 'Mit Beispiel-PDF ausprobieren', 'blitz-donner-pdf' )
						)
					)
				);
			}

			let statusText = __( 'PDF wird geladen …', 'blitz-donner-pdf' );
			if ( 'prueft' === status ) {
				statusText = __( 'Prüfe vorgerenderte Seiten …', 'blitz-donner-pdf' );
			} else if ( 'rendert' === status ) {
				statusText = __( 'Seiten werden gerendert und gespeichert …', 'blitz-donner-pdf' )
					+ ( progress.total ? ` (${ progress.done }/${ progress.total })` : '' );
			} else if ( 'fehler' === status ) {
				statusText = __( 'Rendern fehlgeschlagen – Details in der Browser-Konsole.', 'blitz-donner-pdf' );
			}

			// Vorschau-Inhalt: Doppelseite (React, ohne StPageFlip).
			// Im Doppelseiten-Modus bestimmt das PDF selbst, ob der Umschlag
			// einzeln steht (automatisch erkannt) – nicht der Schalter.
			const effektiverDeckel = 'spread' === pageLayout ? pagesMeta.coverSingle : !! attributes.showCover;
			let inhalt;
			if ( 'bereit' === status && pages ) {
				const alle    = bdpdfSpreads( pages.length, effektiverDeckel );
				const idx     = Math.min( spreadIdx, alle.length - 1 );
				const spread  = alle[ idx ];
				const letzte  = spread[ spread.length - 1 ] + 1;
				const info    = 1 === spread.length
					? `Seite ${ spread[ 0 ] + 1 } / ${ pages.length }`
					: `Seiten ${ spread[ 0 ] + 1 }–${ letzte } / ${ pages.length }`;
				// Einzelseiten liegen wie im Frontend auf der Buchfläche:
				// Umschlag vorn rechts, Rückseite hinten links.
				const kinder = spread.map( ( p ) =>
					el(
						'div',
						{ className: 'bdpdf-page', key: 'p' + p },
						el( 'img', { src: pages[ p ], alt: '' } )
					)
				);
				if ( 1 === spread.length && alle.length > 1 ) {
					if ( 0 === idx ) {
						kinder.unshift( el( 'div', { className: 'bdpdf-page-blank', key: 'blank' } ) );
					} else if ( idx === alle.length - 1 ) {
						kinder.push( el( 'div', { className: 'bdpdf-page-blank', key: 'blank' } ) );
					}
				}
				const buchTeile = [
					el(
						'div',
						{
							className: 'bdpdf-book bdpdf-book-static',
							key: 'book',
							style: pagesMeta.w > 0
								? { '--bdpdf-pw': pagesMeta.w, '--bdpdf-ph': pagesMeta.h }
								: undefined,
						},
						kinder
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
								'‹ ' + __( 'Zurück', 'blitz-donner-pdf' )
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
								__( 'Weiter', 'blitz-donner-pdf' ) + ' ›'
							)
						)
					),
					el(
						'p',
						{ className: 'bdpdf-fallback', key: 'fallback' },
						el( 'a', { href: pdfHref, download: true }, __( 'PDF herunterladen', 'blitz-donner-pdf' ) )
					),
				];

				if ( 'file' === modus ) {
					// Datei-Zeile: identisches Markup wie render.php; das Buch
					// erscheint im nativen <dialog> (statische Vorschau).
					const zeileTitel = attributes.pdfTitle
						|| ( istDemo
							? __( 'Beispiel-PDF', 'blitz-donner-pdf' )
							: decodeURIComponent( ( attributes.pdfUrl.split( '/' ).pop() || '' ) ) );
					const oeffnen = () => setDialogOffen( true );
					const iconPfad = 'M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V8h4.5L14 3.5zM8 13h1.6c1 0 1.7.7 1.7 1.6 0 .9-.7 1.6-1.7 1.6h-.5V18H8v-5zm1.1 2.3h.4c.4 0 .7-.3.7-.7 0-.4-.3-.7-.7-.7h-.4v1.4zm3-2.3h1.7c1.3 0 2.2 1 2.2 2.5S15.1 18 13.8 18h-1.7v-5zm1.1 4h.5c.7 0 1.1-.6 1.1-1.5s-.4-1.5-1.1-1.5h-.5v3zm3.7-4H20v1h-1.9v1.1h1.6v1h-1.6V18h-1.2v-5z';
					inhalt = [
						el(
							'div',
							{ className: 'bdpdf-file-row', key: 'row' },
							el(
								'span',
								{ className: 'bdpdf-file-main' },
								el(
									'svg',
									{ className: 'bdpdf-file-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
									el( 'path', { fill: 'currentColor', d: iconPfad } )
								),
								el( 'span', { className: 'bdpdf-file-title' }, zeileTitel )
							),
							el(
								'span',
								{ className: 'bdpdf-file-actions' },
								zeigeView
									? el(
										'button',
										{
											type: 'button',
											className: 'bdpdf-file-link bdpdf-open-dialog',
											'aria-haspopup': 'dialog',
											'aria-label': zeileTitel + ' ' + __( 'ansehen', 'blitz-donner-pdf' ),
											onClick: oeffnen,
										},
										__( 'Ansehen', 'blitz-donner-pdf' )
									)
									: null,
								zeigeDown
									? el(
										'a',
										{
											className: 'bdpdf-file-link',
											href: pdfHref,
											download: true,
											'aria-label': zeileTitel + ' ' + __( 'herunterladen', 'blitz-donner-pdf' ),
											onClick: ( e ) => e.preventDefault(),
										},
										__( 'Herunterladen', 'blitz-donner-pdf' )
									)
									: null
							)
						),
						dialogOffen
							? el(
								'dialog',
								{
									className: 'bdpdf-dialog',
									key: 'dialog',
									ref: dialogRef,
									'aria-label': zeileTitel,
									onClick: ( e ) => {
										if ( e.target === dialogRef.current ) {
											setDialogOffen( false );
										}
									},
								},
								el(
									'div',
									{ className: 'bdpdf-dialog-inhalt' },
									el(
										'button',
										{
											type: 'button',
											className: 'bdpdf-dialog-close',
											'aria-label': __( 'Schliessen', 'blitz-donner-pdf' ),
											onClick: () => setDialogOffen( false ),
										},
										'\u00d7'
									),
									buchTeile
								)
							)
							: null,
					];
				} else {
					inhalt = buchTeile;
				}
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
						name: __( 'PDF ersetzen', 'blitz-donner-pdf' ),
					} )
				),
				el(
					InspectorControls,
					null,
					el(
						PanelBody,
						{ title: __( 'Flipbook-Einstellungen', 'blitz-donner-pdf' ) },
						el( SelectControl, {
							__next40pxDefaultSize: true,
							__nextHasNoMarginBottom: true,
							label: __( 'Darstellung', 'blitz-donner-pdf' ),
							value: modus,
							options: [
								{ label: __( 'Buch (blätterbar auf der Seite)', 'blitz-donner-pdf' ), value: 'book' },
								{ label: __( 'Datei-Zeile (Download, Ansehen im Popover)', 'blitz-donner-pdf' ), value: 'file' },
							],
							onChange: function ( value ) {
								setAttributes( { displayMode: 'file' === value ? 'file' : 'book' } );
							},
						} ),
						'file' === modus
							? el(
								Fragment,
								null,
								el( TextControl, {
									__next40pxDefaultSize: true,
									__nextHasNoMarginBottom: true,
									label: __( 'Beschriftung', 'blitz-donner-pdf' ),
									help: __( 'Text neben dem Symbol. Leer = Dateiname aus der Mediathek.', 'blitz-donner-pdf' ),
									value: attributes.pdfTitle || '',
									onChange: function ( value ) {
										setAttributes( { pdfTitle: value } );
									},
								} ),
								el( ToggleControl, {
									__nextHasNoMarginBottom: true,
									label: __( '«Ansehen»-Knopf (Popover)', 'blitz-donner-pdf' ),
									checked: zeigeView,
									onChange: function ( value ) {
										setAttributes( { showViewButton: value } );
									},
								} ),
								el( ToggleControl, {
									__nextHasNoMarginBottom: true,
									label: __( '«Herunterladen»-Knopf', 'blitz-donner-pdf' ),
									checked: zeigeDown,
									onChange: function ( value ) {
										setAttributes( { showDownloadButton: value } );
									},
								} )
							)
							: null,
						istDemo
							? el(
								'p',
								{ className: 'components-base-control__help' },
								__( 'Beispiel-PDF aktiv: Einstellungen wirken sofort auf das Beispiel. Über «PDF ersetzen» in der Werkzeugleiste wählst du dein eigenes PDF.', 'blitz-donner-pdf' )
							)
							: null,
						el( SelectControl, {
							__next40pxDefaultSize: true,
							__nextHasNoMarginBottom: true,
							disabled: istDemo,
							help: istDemo ? __( 'Für das Beispiel-PDF fix «Einzelseiten».', 'blitz-donner-pdf' ) : undefined,
							label: __( 'Seitenlayout', 'blitz-donner-pdf' ),
							value: pageLayout,
							options: [
								{ label: __( 'Einzelseiten (Standard)', 'blitz-donner-pdf' ), value: 'single' },
								{ label: __( 'Doppelseiten – am Bund teilen', 'blitz-donner-pdf' ), value: 'spread' },
							],
							help:
								'spread' === pageLayout
									? __( 'Für PDFs, bei denen eine PDF-Seite eine ganze Druck-Doppelseite enthält. Jede Seite wird in der Mitte geteilt, das Buch klappt am Bund. Schmale erste/letzte Seiten werden automatisch als einzelner Umschlag erkannt.', 'blitz-donner-pdf' )
									: __( 'Jede PDF-Seite ist eine Buchseite.', 'blitz-donner-pdf' ),
							onChange: function ( value ) {
								setAttributes( { pageLayout: 'spread' === value ? 'spread' : 'single' } );
							},
						} ),
						'single' === pageLayout
							? el( ToggleControl, {
								__nextHasNoMarginBottom: true,
								label: __( 'Erste Seite als Buchdeckel', 'blitz-donner-pdf' ),
								help: __( 'Zeigt die erste Seite einzeln, danach Doppelseiten.', 'blitz-donner-pdf' ),
								checked: !! attributes.showCover,
								onChange: function ( value ) {
									setAttributes( { showCover: value } );
								},
							} )
							: null
					)
				),
				// Farbmodus gehört in den Stil-Tab (Pinsel) – gleiche Logik
				// und gleiche Optionen wie bei Blitz & Donner Forms.
				el(
					InspectorControls,
					{ group: 'styles' },
					el(
						PanelBody,
						{ title: __( 'Erscheinungsbild', 'blitz-donner-pdf' ), initialOpen: true },
						el( SelectControl, {
							__next40pxDefaultSize: true,
							__nextHasNoMarginBottom: true,
							label: __( 'Farbmodus', 'blitz-donner-pdf' ),
							value: attributes.appearanceMode || 'theme',
							help:
								'theme' === ( attributes.appearanceMode || 'theme' )
									? __( 'Farben, Buttons und Typografie kommen vollständig aus dem Theme (theme.json). Das Plugin fügt kein eigenes CSS hinzu.', 'blitz-donner-pdf' )
									: undefined,
							options: [
								{ label: __( 'Theme (Standard)', 'blitz-donner-pdf' ), value: 'theme' },
								{ label: __( 'Automatisch (System)', 'blitz-donner-pdf' ), value: 'auto' },
								{ label: __( 'Hell', 'blitz-donner-pdf' ), value: 'light' },
								{ label: __( 'Dunkel', 'blitz-donner-pdf' ), value: 'dark' },
							],
							onChange: function ( value ) {
								setAttributes( { appearanceMode: value || 'theme' } );
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
