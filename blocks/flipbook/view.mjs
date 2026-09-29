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
async function legacyRender( root, maxHeight ) {
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

		// Doppelseiten (data-layout="spread", Attribut pageLayout, #A1M): jede
		// breite PDF-Seite am Bund in zwei Buchseiten teilen. Schmale erste/
		// letzte Seiten (< 75 % der Maximalbreite) bleiben ganz, wie beim
		// Vorrendern im Editor.
		const spread = 'spread' === root.dataset.layout;
		const widths = [];
		if ( spread ) {
			for ( let i = 1; i <= pdf.numPages; i++ ) {
				widths.push( ( await pdf.getPage( i ) ).getViewport( { scale: 1 } ).width );
			}
		}
		const maxW        = spread ? Math.max.apply( null, widths ) : 0;
		const singles     = widths.map( ( w ) => w < 0.75 * maxW );
		const coverSingle = spread && !! singles[ 0 ];

		for ( let i = 1; i <= pdf.numPages; i++ ) {
			const page     = await pdf.getPage( i );
			const viewport = page.getViewport( { scale } );
			const canvas  = document.createElement( 'canvas' );
			canvas.width  = viewport.width;
			canvas.height = viewport.height;
			// intent 'print' rendert ohne requestAnimationFrame – läuft auch im Hintergrund-Tab.
			await page.render( { canvasContext: canvas.getContext( '2d' ), viewport, intent: 'print' } ).promise;
			const parts = [ canvas ];
			if ( spread && ! singles[ i - 1 ] ) {
				const halfW = Math.floor( canvas.width / 2 );
				parts.length = 0;
				for ( const [ x, w ] of [ [ 0, halfW ], [ -halfW, canvas.width - halfW ] ] ) {
					const teil  = document.createElement( 'canvas' );
					teil.width  = w;
					teil.height = canvas.height;
					teil.getContext( '2d' ).drawImage( canvas, x, 0 );
					parts.push( teil );
				}
			}
			for ( const part of parts ) {
				if ( ! pageW ) {
					pageW = part.width;
					pageH = part.height;
				}
				images.push( part.toDataURL( 'image/jpeg', 0.9 ) );
			}
			progress.value = i;
		}

		zeigeBuch( root, images, {
			pageWidth: pageW,
			pageHeight: pageH,
			// Bei Doppelseiten bestimmt das PDF, ob der Umschlag einzeln steht.
			showCover: spread ? coverSingle : '1' === root.dataset.showCover,
			maxHeight: maxHeight || 0,
			flipStyle: root.dataset.flipStyle || 'auto',
		}, false );
	} catch ( err ) {
		loadText.textContent = 'Das PDF konnte nicht geladen werden.';
		progress.hidden = true;
		// eslint-disable-next-line no-console
		console.error( '[bdpdf]', err );
	}
}

/**
 * Verfügbare Buchhöhe (#A1M, «contain»): Buch plus Leiste sollen ganz
 * sichtbar sein. Im Vollbild zählt das Fenster; in einem scrollenden
 * Container (z.B. Lightbox des Themes) dessen sichtbare Höhe ab dem Block;
 * sonst die Fensterhöhe. Reserve für Leiste und Download-Link.
 *
 * @param {HTMLElement} root Block-Wrapper.
 * @param {number}      cap  Optionale Obergrenze (Popover des Plugins).
 * @return {number} Höhe in Pixeln, mindestens 240.
 */
function verfuegbareHoehe( root, cap ) {
	const nav     = root.querySelector( '.bdpdf-nav' );
	const fb      = root.querySelector( '.bdpdf-fallback' );
	const reserve = Math.max( nav ? nav.offsetHeight : 0, 48 ) + ( fb ? fb.offsetHeight : 0 ) + 40;
	let h = window.innerHeight - reserve;
	const el = document.fullscreenElement === root ? null : scrollBehaelter( root );
	if ( el ) {
		// Abstand des Blocks vom Inhaltsanfang des Containers (z.B. Titel).
		const oben = root.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
		h = Math.min( h, el.clientHeight - Math.max( oben, 0 ) - reserve );
	}
	if ( cap > 0 ) {
		h = Math.min( h, cap );
	}
	return Math.max( 240, Math.round( h ) );
}

/** Nächster scrollende Vorfahre (z.B. Lightbox-Inhalt), sonst null. */
function scrollBehaelter( root ) {
	let el = root.parentElement;
	while ( el && el !== document.body ) {
		const oy = getComputedStyle( el ).overflowY;
		if ( ( 'auto' === oy || 'scroll' === oy ) && el.clientHeight > 0 ) {
			return el;
		}
		el = el.parentElement;
	}
	return null;
}

/**
 * Buch anzeigen und bei Grössenwechsel (Fenster, Vollbild) neu aufbauen,
 * auf derselben Seite. hires: gespeicherte Seiten bei Bedarf nachschärfen.
 */
function zeigeBuch( root, pages, basis, hires ) {
	let zuletzt = 0;
	const bauen = ( erzwingen ) => {
		const h = verfuegbareHoehe( root, basis.maxHeight );
		if ( ! erzwingen && root.__bdpdfInst && Math.abs( h - zuletzt ) < 30 ) {
			return;
		}
		zuletzt = h;
		let start = 0;
		const alt = root.__bdpdfInst;
		if ( alt ) {
			start = alt.pageFlip.getCurrentPageIndex();
			if ( alt.resizeObserver ) {
				alt.resizeObserver.disconnect();
			}
			if ( alt.pageFlip.destroy ) {
				alt.pageFlip.destroy(); // entfernt auch .bdpdf-book
			}
			if ( ! root.querySelector( '.bdpdf-book' ) ) {
				const nav    = root.querySelector( '.bdpdf-nav' );
				const neu    = document.createElement( 'div' );
				neu.className = 'bdpdf-book';
				nav.parentNode.insertBefore( neu, nav );
			}
		}
		const inst = window.bdpdfFlipbook.init( root, pages, Object.assign( {}, basis, { maxHeight: h, startPage: start } ) );
		if ( hires ) {
			setupHiRes( root, inst, pages.length, basis.pageWidth );
		}
	};
	bauen( true );

	let timer = null;
	window.addEventListener( 'resize', () => {
		clearTimeout( timer );
		timer = setTimeout( () => bauen( false ), 250 );
	} );
	document.addEventListener( 'fullscreenchange', () => setTimeout( () => bauen( true ), 100 ) );
	// Lightboxen öffnen animiert: Grösse des Containers beobachten, damit
	// das Buch nach dem Einblenden die endgültige Höhe bekommt.
	const behaelter = scrollBehaelter( root );
	if ( behaelter && window.ResizeObserver ) {
		new ResizeObserver( () => {
			clearTimeout( timer );
			timer = setTimeout( () => bauen( false ), 250 );
		} ).observe( behaelter );
	}
	// Themes verschieben den Block beim Öffnen einer Lightbox teils erst
	// nachträglich in den endgültigen Container: ein paar Nachmessungen,
	// dazu beim ersten Zeigen/Fokus auf den Viewer.
	let runden = 0;
	const nachmessen = setInterval( () => {
		bauen( false );
		if ( ++runden >= 20 ) {
			clearInterval( nachmessen );
		}
	}, 750 );
	// Wird der Block sichtbar (etwa nach dem Umhängen in die Lightbox),
	// Platz neu messen.
	if ( window.IntersectionObserver ) {
		new IntersectionObserver( ( eintraege ) => {
			if ( eintraege.some( ( e ) => e.isIntersecting ) ) {
				bauen( false );
			}
		} ).observe( root );
	}
	root.addEventListener( 'pointerenter', () => bauen( false ) );
	root.addEventListener( 'focusin', () => bauen( false ) );

	// In einer Lightbox (Theme-Popup oder Dialog) den Fokus in den Viewer
	// legen, damit Pfeiltasten sofort blättern. Esc bleibt beim Theme.
	if ( root.closest( '.popup, dialog' ) ) {
		root.focus( { preventScroll: true } );
	}
}

/** Vollbild-Knopf: Block ins Vollbild und zurück. */
function setupVollbild( root ) {
	const knopf = root.querySelector( '.bdpdf-fullscreen' );
	if ( ! knopf ) {
		return;
	}
	if ( ! document.fullscreenEnabled || root.querySelector( 'dialog' ) ) {
		knopf.hidden = true;
		return;
	}
	knopf.addEventListener( 'click', () => {
		if ( document.fullscreenElement === root ) {
			document.exitFullscreen();
		} else {
			root.requestFullscreen().then( () => root.focus( { preventScroll: true } ) ).catch( () => {} );
		}
	} );
}

const BDPDF_SELECTOR = '.wp-block-bdpdf-flipbook[data-pdf-url]';

/** Initialisiert einen Block-Wrapper genau einmal. */
/**
 * Buch initialisieren (vorgerenderte Seiten oder Legacy-Client-Rendering).
 *
 * @param {HTMLElement} root      Block-Wrapper.
 * @param {number}      maxHeight Optionale Höhen-Obergrenze in Pixeln (Popover).
 */
function bootBook( root, maxHeight ) {
	const pages = root.dataset.pages ? JSON.parse( root.dataset.pages ) : null;
	if ( pages && pages.length ) {
		// Regelfall: vorgerendert → sofort verfügbar.
		zeigeBuch( root, pages, {
			pageWidth: parseInt( root.dataset.pageW, 10 ),
			pageHeight: parseInt( root.dataset.pageH, 10 ),
			showCover: '1' === root.dataset.showCover,
			flipStyle: root.dataset.flipStyle || 'auto',
			maxHeight: maxHeight || 0,
		}, true );
	} else {
		legacyRender( root, maxHeight );
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
			// Buchhöhe in der Lightbox deckeln: Platz für Navigation und
			// Download-Link reservieren, sonst füllt das Dokument den Raum.
			bootBook( root, Math.round( window.innerHeight * 0.76 ) );
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
	setupVollbild( root );
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
