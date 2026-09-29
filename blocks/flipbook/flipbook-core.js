/**
 * Flipbook-Kern für das Frontend.
 *
 * Baut aus fertigen Seitenbild-URLs das StPageFlip-Buch im HTML-Modus auf und
 * verdrahtet Navigation, Seitenanzeige und Tastatur. Bewusst NICHT im Editor
 * verwendet: StPageFlips globale Event-Handler schlucken Klicks und brechen
 * Gutenbergs Popover-Mechanik (Werkzeugleiste). Der Editor zeigt stattdessen
 * eine statische Doppelseiten-Ansicht mit denselben Klassen (editor.js).
 *
 * @package bdpdf
 */
( function ( win ) {
	'use strict';

	if ( win.bdpdfFlipbook ) {
		return;
	}

	// In versteckten Tabs feuert requestAnimationFrame nicht – Fallback auf
	// setTimeout, damit Rendering und Blätter-Animation weiterlaufen.
	const nativeRAF = win.requestAnimationFrame.bind( win );
	win.requestAnimationFrame = ( cb ) =>
		win.document.hidden ? setTimeout( () => cb( win.performance.now() ), 16 ) : nativeRAF( cb );

	/**
	 * Initialisiert ein Flipbook.
	 *
	 * @param {HTMLElement} root  Block-Wrapper mit .bdpdf-book/.bdpdf-nav.
	 * @param {string[]}    pages Seitenbild-URLs oder Data-URLs.
	 * @param {Object}      opts  { pageWidth, pageHeight, showCover }.
	 * @return {Object} { pageFlip, setPageSrc }.
	 */
	/**
	 * Blätter-Art auflösen (#A1M). 'auto' schlägt für genau zwei Seiten
	 * (Vorder- und Rückseite, z.B. Flyer oder Karte) «Blatt umdrehen» vor,
	 * sonst den Standard Softcover.
	 *
	 * @param {string} style Gewählte Art: auto | softcover | hardcover | sheet.
	 * @param {number} count Anzahl Seiten.
	 * @return {string} softcover | hardcover | sheet.
	 */
	function resolveFlipStyle( style, count ) {
		if ( 'softcover' === style || 'hardcover' === style || 'sheet' === style ) {
			return style;
		}
		return 2 === count ? 'sheet' : 'softcover';
	}

	function init( root, pages, opts ) {
		const flipStyle = resolveFlipStyle( opts.flipStyle, pages.length );
		root.dataset.flipResolved = flipStyle;
		if ( 'sheet' === flipStyle ) {
			return initSheet( root, pages, opts );
		}
		const doc = root.ownerDocument;
		const St  = ( doc.defaultView && doc.defaultView.St ) || win.St;

		const loader   = root.querySelector( '.bdpdf-loader' );
		const bookEl   = root.querySelector( '.bdpdf-book' );
		const nav      = root.querySelector( '.bdpdf-nav' );
		const pageinfo = root.querySelector( '.bdpdf-pageinfo' );
		const btnPrev  = root.querySelector( '.bdpdf-prev' );
		const btnNext  = root.querySelector( '.bdpdf-next' );

		bookEl.innerHTML = ''; // Sicherheitsnetz: nie auf Altbestand initialisieren.

		const pageEls = pages.map( ( src ) => {
			const pageEl     = doc.createElement( 'div' );
			pageEl.className = 'bdpdf-page';
			const img        = doc.createElement( 'img' );
			img.src          = src;
			img.alt          = '';
			pageEl.appendChild( img );
			return pageEl;
		} );

		const ratio    = opts.pageHeight / opts.pageWidth;
		const baseW    = Math.round( opts.pageWidth / 2 );
		// Optionale Höhen-Obergrenze (Popover): das Buch soll nie höher werden
		// als der verfügbare Platz, damit Navigation und Download sichtbar
		// bleiben. maxWidth folgt aus der Höhe über das Seitenverhältnis,
		// damit StPageFlip proportional verkleinert statt zu verzerren.
		const maxHeight = opts.maxHeight && opts.maxHeight > 0
			? Math.round( opts.maxHeight )
			: opts.pageHeight;
		const maxWidth  = opts.maxHeight && opts.maxHeight > 0
			? Math.min( opts.pageWidth, Math.round( maxHeight / ratio ) )
			: opts.pageWidth;
		const pageFlip = new St.PageFlip( bookEl, {
			width: baseW,
			height: Math.round( baseW * ratio ),
			size: 'stretch',
			minWidth: 240,
			minHeight: Math.round( 240 * ratio ),
			maxWidth: maxWidth,
			maxHeight: maxHeight,
			showCover: false !== opts.showCover,
			maxShadowOpacity: 0.25, // ruhiger als bisher 0.4 (#A1M, Deko)
			flippingTime: 700,
			mobileScrollSupport: false,
		} );
		pageFlip.loadFromHTML( pageEls );

		// Softcover (Standard): alle Seiten blättern weich, auch der Umschlag.
		// StPageFlip macht bei showCover erste und letzte Seite «hard»; das
		// wird hier zurückgenommen. Hardcover: Umschlag vorn und hinten
		// klappt steif um, auch ohne einzelnen Umschlag.
		const collection = pageFlip.getPageCollection();
		pageEls.forEach( ( el, i ) => {
			const hard = 'hardcover' === flipStyle && ( 0 === i || pageEls.length - 1 === i );
			collection.getPage( i ).setDensity( hard ? 'hard' : 'soft' );
		} );

		if ( loader ) {
			loader.hidden = true;
		}
		bookEl.hidden = false;
		nav.hidden    = false;

		const count      = pages.length;
		const updateInfo = () => {
			const idx         = pageFlip.getCurrentPageIndex(); // 0-basiert, linke Seite.
			const single      = 'portrait' === pageFlip.getOrientation() || 0 === idx;
			const lastVisible = single ? idx + 1 : Math.min( idx + 2, count );
			pageinfo.textContent = single
				? `Seite ${ idx + 1 } / ${ count }`
				: `Seiten ${ idx + 1 }–${ lastVisible } / ${ count }`;
			btnPrev.disabled = idx <= 0;
			btnNext.disabled = lastVisible >= count;
		};
		pageFlip.on( 'flip', updateInfo );
		pageFlip.on( 'changeOrientation', updateInfo );
		updateInfo();

		btnPrev.addEventListener( 'click', () => pageFlip.flipPrev() );
		btnNext.addEventListener( 'click', () => pageFlip.flipNext() );
		root.addEventListener( 'keydown', ( e ) => {
			if ( 'ArrowLeft' === e.key ) {
				e.preventDefault();
				pageFlip.flipPrev();
			}
			if ( 'ArrowRight' === e.key ) {
				e.preventDefault();
				pageFlip.flipNext();
			}
		} );

		// Grösse neu berechnen, wenn sich die Containerbreite ohne Fenster-Resize
		// ändert (z.B. Padding/Breite aus dem Stil-Tab im Editor) – sonst
		// überlappt das Buch die Navigation.
		let resizeObserver = null;
		const view = doc.defaultView || win;
		if ( view.ResizeObserver ) {
			let lastW = bookEl.clientWidth;
			resizeObserver = new view.ResizeObserver( () => {
				const w = bookEl.clientWidth;
				if ( Math.abs( w - lastW ) > 1 ) {
					lastW = w;
					try {
						pageFlip.getUI().update();
					} catch ( e ) {} // eslint-disable-line no-empty
				}
			} );
			resizeObserver.observe( bookEl );
		}

		return {
			pageFlip,
			resizeObserver,
			setPageSrc: ( i, src ) => {
				const img = pageEls[ i ] && pageEls[ i ].querySelector( 'img' );
				if ( img && img.src !== src ) {
					img.src = src;
				}
			},
		};
	}

	/**
	 * Modus «Blatt umdrehen» (#A1M): ein vorne und hinten bedrucktes Blatt.
	 * Jeder Schritt dreht das Blatt um seine senkrechte Mittelachse. Damit
	 * keine Kante hinter die Auflagefläche (Bildschirmebene) rutscht, hebt
	 * sich das Blatt während der Drehung mindestens um die halbe Breite mal
	 * sin(Winkel) nach vorne an, plus etwas Luft: anheben, drehen, ablegen.
	 *
	 * Gibt ein zu init() kompatibles Objekt zurück; pageFlip ist ein kleiner
	 * Ersatz mit den Methoden, die view.mjs (setupHiRes) benutzt.
	 */
	function initSheet( root, pages, opts ) {
		const doc      = root.ownerDocument;
		const loader   = root.querySelector( '.bdpdf-loader' );
		const bookEl   = root.querySelector( '.bdpdf-book' );
		const nav      = root.querySelector( '.bdpdf-nav' );
		const pageinfo = root.querySelector( '.bdpdf-pageinfo' );
		const btnPrev  = root.querySelector( '.bdpdf-prev' );
		const btnNext  = root.querySelector( '.bdpdf-next' );
		const srcs     = pages.slice();
		const count    = srcs.length;
		const listener = [];
		let idx        = 0;
		let laeuft     = false;

		bookEl.innerHTML = '';
		const buehne = doc.createElement( 'div' );
		buehne.className = 'bdpdf-sheet';
		buehne.style.aspectRatio = opts.pageWidth + ' / ' + opts.pageHeight;
		// Höhe begrenzen (Popover: maxHeight, sonst 80 % der Fensterhöhe).
		buehne.style.maxWidth = opts.maxHeight && opts.maxHeight > 0
			? Math.round( opts.maxHeight * opts.pageWidth / opts.pageHeight ) + 'px'
			: 'calc(80vh * ' + opts.pageWidth + ' / ' + opts.pageHeight + ')';
		const karte = doc.createElement( 'div' );
		karte.className = 'bdpdf-sheet-card';
		const flaeche = ( seite ) => {
			const f     = doc.createElement( 'div' );
			f.className = 'bdpdf-page bdpdf-sheet-face bdpdf-sheet-' + seite;
			const img   = doc.createElement( 'img' );
			img.alt     = '';
			f.appendChild( img );
			karte.appendChild( f );
			return img;
		};
		const vorne  = flaeche( 'front' );
		const hinten = flaeche( 'back' );
		vorne.src    = srcs[ 0 ];
		buehne.appendChild( karte );
		bookEl.appendChild( buehne );

		if ( loader ) {
			loader.hidden = true;
		}
		bookEl.hidden = false;
		nav.hidden    = false;

		const updateInfo = () => {
			pageinfo.textContent = 2 === count
				? ( 0 === idx ? 'Vorderseite' : 'Rückseite' )
				: `Seite ${ idx + 1 } / ${ count }`;
			btnPrev.disabled = laeuft || idx <= 0;
			btnNext.disabled = laeuft || idx >= count - 1;
		};

		const drehen = ( ziel ) => {
			if ( laeuft || ziel < 0 || ziel >= count || ziel === idx ) {
				return;
			}
			const richtung = ziel > idx ? -1 : 1; // vorwärts: rechte Kante hebt sich
			hinten.src = srcs[ ziel ];
			const halb  = buehne.clientWidth / 2;
			const luft  = buehne.clientWidth * 0.08;
			const reduziert = win.matchMedia && win.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
			const fertig = () => {
				idx       = ziel;
				vorne.src = srcs[ idx ];
				laeuft    = false;
				updateInfo();
				listener.forEach( ( cb ) => cb() );
			};
			if ( reduziert || ! karte.animate ) {
				fertig();
				return;
			}
			laeuft = true;
			updateInfo();
			// Perspektive relativ zur Blattbreite, damit das Anheben nicht zu
			// stark vergrössert (max. rund 1.25-fach).
			buehne.style.perspective = Math.round( buehne.clientWidth * 3 ) + 'px';
			const frames = [];
			for ( let s = 0; s <= 24; s++ ) {
				const t     = s / 24;
				const winkel = richtung * 180 * t;
				const hub    = halb * Math.abs( Math.sin( winkel * Math.PI / 180 ) ) + luft * Math.sin( Math.PI * t );
				frames.push( { transform: `translateZ(${ hub.toFixed( 1 ) }px) rotateY(${ winkel.toFixed( 2 ) }deg)` } );
			}
			const anim = karte.animate( frames, { duration: 900, easing: 'cubic-bezier(.45,.05,.35,1)' } );
			anim.onfinish = () => {
				// Erst Inhalt tauschen, dann Drehung wegnehmen: kein Aufblitzen.
				vorne.src = srcs[ ziel ];
				anim.cancel();
				fertig();
			};
		};

		btnPrev.addEventListener( 'click', () => drehen( idx - 1 ) );
		btnNext.addEventListener( 'click', () => drehen( idx + 1 ) );
		karte.addEventListener( 'click', () => drehen( idx < count - 1 ? idx + 1 : idx - 1 ) );
		root.addEventListener( 'keydown', ( e ) => {
			if ( 'ArrowLeft' === e.key ) {
				e.preventDefault();
				drehen( idx - 1 );
			}
			if ( 'ArrowRight' === e.key ) {
				e.preventDefault();
				drehen( idx + 1 );
			}
		} );
		updateInfo();

		const pageFlip = {
			getCurrentPageIndex: () => idx,
			getOrientation: () => 'portrait',
			on: ( ev, cb ) => {
				if ( 'flip' === ev ) {
					listener.push( cb );
				}
			},
			flipNext: () => drehen( idx + 1 ),
			flipPrev: () => drehen( idx - 1 ),
			getUI: () => ( { update() {} } ),
		};

		return {
			pageFlip,
			resizeObserver: null,
			setPageSrc: ( i, src ) => {
				srcs[ i ] = src;
				if ( i === idx && vorne.src !== src ) {
					vorne.src = src;
				}
			},
		};
	}

	win.bdpdfFlipbook = { init, resolveFlipStyle };
} )( window );
