/**
 * Frontend-Logik des BD-PDF-Blocks.
 *
 * Regelfall: Die Seiten sind nach dem Hochladen bereits vorgerendert
 * (data-pages) und das Flipbook steht sofort – ohne PDF.js. Nur wenn der
 * Viewport mehr Pixel braucht als gespeichert, rendert PDF.js die sichtbaren
 * Seiten nach. Fallback für Alt-Inhalte ohne Vorab-Rendering: komplettes
 * Client-Rendering wie bisher.
 *
 * @package bdpdf
 */

const DPR = Math.min( window.devicePixelRatio || 1, 3 );

let pdfjsPromise = null;
function loadPdfjs() {
	if ( ! pdfjsPromise ) {
		pdfjsPromise = import( './pdf.min.mjs' ).then( ( m ) => {
			m.GlobalWorkerOptions.workerSrc = new URL( './pdf.worker.min.mjs', import.meta.url ).href;
			return m;
		} );
	}
	return pdfjsPromise;
}

/**
 * Nachrendern sichtbarer Seiten, wenn der Viewport grösser ist als die
 * gespeicherte Bildbreite. Rendert lazy, cached pro Seite.
 */
function setupHiRes( root, inst, count, storedWidth ) {
	const cache   = new Map();
	let pdfPromise = null;

	const neededWidth = () => {
		const img = root.querySelector( '.bdpdf-page img' );
		const el  = img ? img.closest( '.bdpdf-page' ) : null;
		const w   = el ? el.getBoundingClientRect().width : 0;
		return Math.round( w * DPR );
	};

	const upgradeVisible = async () => {
		const needed = neededWidth();
		if ( needed <= storedWidth * 1.05 ) {
			return; // Gespeicherte Auflösung reicht.
		}
		if ( ! pdfPromise ) {
			pdfPromise = loadPdfjs().then( ( m ) => m.getDocument( root.dataset.pdfUrl ).promise );
		}
		const pdf = await pdfPromise;
		const idx = inst.pageFlip.getCurrentPageIndex();
		// Sichtbare Doppelseite plus je eine Seite Vorgriff.
		const wanted = [ idx, idx + 1, idx - 1, idx + 2 ].filter( ( i ) => i >= 0 && i < count );
		for ( const i of wanted ) {
			if ( cache.has( i ) ) {
				inst.setPageSrc( i, cache.get( i ) );
				continue;
			}
			const page     = await pdf.getPage( i + 1 );
			const base     = page.getViewport( { scale: 1 } );
			const scale    = Math.min( 4, needed / base.width );
			const viewport = page.getViewport( { scale } );
			const canvas   = document.createElement( 'canvas' );
			canvas.width   = viewport.width;
			canvas.height  = viewport.height;
			await page.render( { canvasContext: canvas.getContext( '2d' ), viewport, intent: 'print' } ).promise;
			const src = canvas.toDataURL( 'image/jpeg', 0.9 );
			cache.set( i, src );
			inst.setPageSrc( i, src );
		}
	};

	inst.pageFlip.on( 'flip', () => {
		upgradeVisible().catch( () => {} );
	} );
	upgradeVisible().catch( () => {} );
}

/** Fallback für Blöcke ohne vorgerenderte Seiten: alles im Client rendern. */
async function legacyRender( root ) {
	const loadText = root.querySelector( '.bdpdf-loader-text' );
	const progress = root.querySelector( '.bdpdf-progress' );
	try {
		const pdfjsLib = await loadPdfjs();
		const pdf      = await pdfjsLib.getDocument( root.dataset.pdfUrl ).promise;
		progress.max   = pdf.numPages;

		const scale  = DPR > 1 ? 2.5 : 2;
		const images = [];
		let pageW = 0;
		let pageH = 0;
		for ( let i = 1; i <= pdf.numPages; i++ ) {
			const page     = await pdf.getPage( i );
			const viewport = page.getViewport( { scale } );
			if ( 1 === i ) {
				pageW = viewport.width;
				pageH = viewport.height;
			}
			const canvas  = document.createElement( 'canvas' );
			canvas.width  = viewport.width;
			canvas.height = viewport.height;
			// intent 'print' rendert ohne requestAnimationFrame – läuft auch im Hintergrund-Tab.
			await page.render( { canvasContext: canvas.getContext( '2d' ), viewport, intent: 'print' } ).promise;
			images.push( canvas.toDataURL( 'image/jpeg', 0.9 ) );
			progress.value = i;
		}

		window.bdpdfFlipbook.init( root, images, {
			pageWidth: pageW,
			pageHeight: pageH,
			showCover: '1' === root.dataset.showCover,
		} );
	} catch ( err ) {
		loadText.textContent = 'Das PDF konnte nicht geladen werden.';
		progress.hidden = true;
		// eslint-disable-next-line no-console
		console.error( '[bdpdf]', err );
	}
}

document.querySelectorAll( '.wp-block-bdpdf-flipbook[data-pdf-url]' ).forEach( ( root ) => {
	const pages = root.dataset.pages ? JSON.parse( root.dataset.pages ) : null;
	if ( pages && pages.length ) {
		// Regelfall: vorgerendert → sofort verfügbar.
		const inst = window.bdpdfFlipbook.init( root, pages, {
			pageWidth: parseInt( root.dataset.pageW, 10 ),
			pageHeight: parseInt( root.dataset.pageH, 10 ),
			showCover: '1' === root.dataset.showCover,
		} );
		setupHiRes( root, inst, pages.length, parseInt( root.dataset.pageW, 10 ) );
	} else {
		legacyRender( root );
	}
} );
