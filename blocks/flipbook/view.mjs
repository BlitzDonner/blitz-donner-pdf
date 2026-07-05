/**
 * Frontend-Logik des PDF-Flipbook-Blocks.
 *
 * Rendert die PDF-Seiten mit PDF.js in Canvas-Bilder und übergibt sie an
 * StPageFlip (globales `St` aus page-flip.browser.js, geladen als viewScript).
 *
 * @package bdpdf
 */

import * as pdfjsLib from './pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL( './pdf.worker.min.mjs', import.meta.url ).href;

// In versteckten Tabs feuert requestAnimationFrame nicht – Fallback auf setTimeout,
// damit Rendering und Blätter-Animation auch im Hintergrund weiterlaufen.
const nativeRAF = window.requestAnimationFrame.bind( window );
window.requestAnimationFrame = ( cb ) =>
	document.hidden ? setTimeout( () => cb( performance.now() ), 16 ) : nativeRAF( cb );

const RENDER_SCALE = 2;

async function bdpdfInitFlipbook( root ) {
	const loader   = root.querySelector( '.bdpdf-loader' );
	const loadText = root.querySelector( '.bdpdf-loader-text' );
	const progress = root.querySelector( '.bdpdf-progress' );
	const bookEl   = root.querySelector( '.bdpdf-book' );
	const nav      = root.querySelector( '.bdpdf-nav' );
	const pageinfo = root.querySelector( '.bdpdf-pageinfo' );
	const btnPrev  = root.querySelector( '.bdpdf-prev' );
	const btnNext  = root.querySelector( '.bdpdf-next' );

	try {
		const pdf = await pdfjsLib.getDocument( root.dataset.pdfUrl ).promise;
		progress.max = pdf.numPages;

		const images = [];
		let pageW = 0;
		let pageH = 0;
		for ( let i = 1; i <= pdf.numPages; i++ ) {
			const page     = await pdf.getPage( i );
			const viewport = page.getViewport( { scale: RENDER_SCALE } );
			if ( 1 === i ) {
				pageW = viewport.width / RENDER_SCALE;
				pageH = viewport.height / RENDER_SCALE;
			}
			const canvas  = document.createElement( 'canvas' );
			canvas.width  = viewport.width;
			canvas.height = viewport.height;
			// intent 'print' rendert ohne requestAnimationFrame – läuft auch im Hintergrund-Tab.
			await page.render( { canvasContext: canvas.getContext( '2d' ), viewport, intent: 'print' } ).promise;
			images.push( canvas.toDataURL( 'image/jpeg', 0.85 ) );
			progress.value = i;
		}

		loader.hidden = true;
		bookEl.hidden = false;
		nav.hidden    = false;

		const ratio    = pageH / pageW;
		const pageFlip = new St.PageFlip( bookEl, {
			width: pageW,
			height: pageH,
			size: 'stretch',
			minWidth: 240,
			minHeight: Math.round( 240 * ratio ),
			maxWidth: Math.round( pageW * 2 ),
			maxHeight: Math.round( pageH * 2 ),
			showCover: '1' === root.dataset.showCover,
			maxShadowOpacity: 0.4,
			flippingTime: 700,
			mobileScrollSupport: false,
		} );
		pageFlip.loadFromImages( images );

		const updateInfo = () => {
			const idx         = pageFlip.getCurrentPageIndex(); // 0-basiert, linke Seite.
			const count       = pdf.numPages;
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
	} catch ( err ) {
		loadText.textContent = 'Das PDF konnte nicht geladen werden.';
		progress.hidden = true;
		// eslint-disable-next-line no-console
		console.error( '[bdpdf]', err );
	}
}

document.querySelectorAll( '.wp-block-bdpdf-flipbook[data-pdf-url]' ).forEach( bdpdfInitFlipbook );
