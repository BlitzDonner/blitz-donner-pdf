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
 * Zuordnung Buchseite → PDF-Seite im Doppelseiten-Modus.
 *
 * Im Layout 'spread' ist jede breite PDF-Seite in zwei Buchseiten geteilt;
 * einzelne Umschlagseiten (vorn/hinten) bleiben ganz.
 *
 * @param {number}  i           Buchseiten-Index (0-basiert).
 * @param {number}  count       Anzahl Buchseiten.
 * @param {string}  layout      'single' | 'spread'.
 * @param {boolean} coverSingle Erste PDF-Seite ist einzelner Umschlag.
 * @param {boolean} tailSingle  Letzte PDF-Seite ist einzelner Umschlag.
 * @return {{page: number, half: (number|null)}} PDF-Seite (1-basiert) und
 *         Hälfte (0 = links, 1 = rechts, null = ganze Seite).
 */
function bookToPdf( i, count, layout, coverSingle, tailSingle ) {
	if ( 'spread' !== layout ) {
		return { page: i + 1, half: null };
	}
	const cover = coverSingle ? 1 : 0;
	if ( coverSingle && 0 === i ) {
		return { page: 1, half: null };
	}
	if ( tailSingle && i === count - 1 ) {
		const spreads = ( count - cover - 1 ) / 2;
		return { page: cover + spreads + 1, half: null };
	}
	const idx = i - cover;
	return { page: cover + Math.floor( idx / 2 ) + 1, half: idx % 2 };
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
		const pdf         = await pdfPromise;
		const layout      = root.dataset.layout || 'single';
		const coverSingle = '1' === root.dataset.coverSingle;
		const tailSingle  = '1' === root.dataset.tailSingle;
		const idx = inst.pageFlip.getCurrentPageIndex();
		// Sichtbare Doppelseite plus je eine Seite Vorgriff.
		const wanted = [ idx, idx + 1, idx - 1, idx + 2 ].filter( ( i ) => i >= 0 && i < count );
		for ( const i of wanted ) {
			if ( cache.has( i ) ) {
				inst.setPageSrc( i, cache.get( i ) );
				continue;
			}
			const ziel     = bookToPdf( i, count, layout, coverSingle, tailSingle );
			const page     = await pdf.getPage( ziel.page );
			const base     = page.getViewport( { scale: 1 } );
			const isHalf   = null !== ziel.half;
			const baseW    = isHalf ? base.width / 2 : base.width;
			const scale    = Math.min( 4, needed / baseW );
			const viewport = page.getViewport( { scale } );
			const halfW    = Math.floor( viewport.width / 2 );
			const canvas   = document.createElement( 'canvas' );
			canvas.width   = isHalf ? ( 0 === ziel.half ? halfW : Math.round( viewport.width ) - halfW ) : Math.round( viewport.width );
			canvas.height  = Math.round( viewport.height );
			await page.render( {
				canvasContext: canvas.getContext( '2d' ),
				viewport,
				intent: 'print',
				// Rechte Hälfte: Zeichnung um die halbe Breite nach links schieben.
				transform: isHalf && 1 === ziel.half ? [ 1, 0, 0, 1, -halfW, 0 ] : undefined,
			} ).promise;
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

const BDPDF_SELECTOR = '.wp-block-bdpdf-flipbook[data-pdf-url]';

/** Initialisiert einen Block-Wrapper genau einmal. */
/** Buch initialisieren (vorgerenderte Seiten oder Legacy-Client-Rendering). */
function bootBook( root ) {
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
}

/**
 * Datei-Modus: Zeile mit Popover. Das Buch im Dialog wird erst beim ersten
 * Öffnen initialisiert (lazy) – die Seite bleibt schnell.
 */
function setupFileMode( root ) {
	const dialog = root.querySelector( '.bdpdf-dialog' );
	if ( ! dialog ) {
		return;
	}
	let initialisiert = false;
	const oeffnen = () => {
		dialog.showModal();
		if ( ! initialisiert ) {
			initialisiert = true;
			bootBook( root );
		}
	};
	root.querySelectorAll( '.bdpdf-open-dialog' ).forEach( ( knopf ) => {
		knopf.addEventListener( 'click', oeffnen );
	} );
	const schliessKnopf = dialog.querySelector( '.bdpdf-dialog-close' );
	if ( schliessKnopf ) {
		schliessKnopf.addEventListener( 'click', () => dialog.close() );
	}
	// Klick auf den Backdrop (= das dialog-Element selbst) schliesst;
	// ESC liefert das native <dialog> von allein.
	dialog.addEventListener( 'click', ( e ) => {
		if ( e.target === dialog ) {
			dialog.close();
		}
	} );
}

function initFlipbookRoot( root ) {
	if ( root.dataset.bdpdfInit ) {
		return;
	}
	root.dataset.bdpdfInit = '1';
	if ( 'file' === root.dataset.mode ) {
		setupFileMode( root );
	} else {
		bootBook( root );
	}
}

/** Findet Blöcke im übergebenen Teilbaum (inklusive Wurzel). */
function scanForFlipbooks( container ) {
	if ( container.matches && container.matches( BDPDF_SELECTOR ) ) {
		initFlipbookRoot( container );
	}
	if ( container.querySelectorAll ) {
		container.querySelectorAll( BDPDF_SELECTOR ).forEach( initFlipbookRoot );
	}
}

scanForFlipbooks( document );

// Dynamisch eingefügte Blöcke initialisieren – etwa wenn ein Theme
// Beitragsinhalte per AJAX in ein Popover lädt.
new MutationObserver( ( mutations ) => {
	for ( const mutation of mutations ) {
		mutation.addedNodes.forEach( ( node ) => {
			if ( 1 === node.nodeType ) {
				scanForFlipbooks( node );
			}
		} );
	}
} ).observe( document.body, { childList: true, subtree: true } );
