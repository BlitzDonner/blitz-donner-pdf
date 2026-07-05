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
	function init( root, pages, opts ) {
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
		const pageFlip = new St.PageFlip( bookEl, {
			width: baseW,
			height: Math.round( baseW * ratio ),
			size: 'stretch',
			minWidth: 240,
			minHeight: Math.round( 240 * ratio ),
			maxWidth: opts.pageWidth,
			maxHeight: opts.pageHeight,
			showCover: false !== opts.showCover,
			maxShadowOpacity: 0.4,
			flippingTime: 700,
			mobileScrollSupport: false,
		} );
		pageFlip.loadFromHTML( pageEls );

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

	win.bdpdfFlipbook = { init };
} )( window );
