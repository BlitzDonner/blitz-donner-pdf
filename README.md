# Blitz & Donner PDF
WordPress-Plugin von Blitz & Donner (Slug und Prefix: `bdpdf`). Stellt den Gutenberg-Block «PDF-Flipbook» bereit: Ein PDF aus der Mediathek wird im Frontend als blätterbares Buch mit Umblätter-Animation angezeigt.
## Namenskonvention
Alle B&D-Plugins heissen «Blitz & Donner …» (zuerst die Marke, dann die Funktion) und tragen einen Slug-Prefix von mindestens 5 Zeichen, beginnend mit `bd`. Hier: `bdpdf`. Der Prefix gilt für Slug, Textdomain, Block-Namespace, CSS-Klassen und PHP-Symbole.
## Funktionsweise
Der Block «BD PDF» ist dynamisch (`render.php`). Nach der PDF-Auswahl rendert der Editor alle Seiten einmal mit PDF.js und lädt sie über die REST-Route `bdpdf/v1/pages` hoch (Ablage `uploads/bdpdf/<attachment-id>/page-<n>.jpg`, Metadaten am Attachment). Das Frontend zeigt die vorgerenderten Bilder sofort; nur wenn der Viewport mehr Pixel braucht als gespeichert, rendert PDF.js die sichtbaren Seiten nach. Der Editor zeigt eine Doppelseiten-Vorschau mit identischem Markup und Stylesheet, aber ohne StPageFlip (dessen Event-Handler brechen Gutenbergs Werkzeugleisten-Popover); geblättert wird dort über dieselben Knöpfe. Beide Bibliotheken sind lokal gebündelt – kein CDN, keine externen Requests.
## Komponenten
- `bdpdf.php` – Bootstrap, registriert Block, Editor-Konfiguration, Aufräumen beim Attachment-Löschen
- `includes/rest-pages.php` – REST-Route `bdpdf/v1/pages/<id>` (GET Status, POST Seitenbild; Upload-Recht + JPEG-Validierung)
- `readme.txt` – WordPress.org-Readme (Directory-tauglich)
- `blocks/flipbook/block.json` – Block-Metadaten (apiVersion 3, dynamisch, Titel «BD PDF», Stil-Supports)
- `blocks/flipbook/render.php` – Frontend-Markup mit Escaping, liefert vorgerenderte Seiten-URLs
- `blocks/flipbook/flipbook-core.js` – gemeinsamer Flipbook-Kern für Frontend und Editor (klassisches Skript)
- `blocks/flipbook/editor.js` – Editor-UI ohne Build-Step: Auswahl, Rendern+Upload, Live-Vorschau
- `blocks/flipbook/view.mjs` – Frontend-Logik als ES-Modul: Sofortanzeige, Hi-Res-Nachrendern, Fallback
- `blocks/flipbook/pdf.min.mjs`, `pdf.worker.min.mjs` – PDF.js 4.8.69 (Apache 2.0)
- `blocks/flipbook/page-flip.browser.js` – StPageFlip 2.0.7 (MIT)
## Lizenz
GPL-3.0-or-later. Bewusst GPLv3 statt GPLv2: Die gebündelte Apache-2.0-Bibliothek PDF.js ist nur mit GPLv3 kompatibel. Beide Bibliotheken sind vom WordPress-Plugin-Directory akzeptierte Lizenzen; die unminifizierten Quellen sind in `readme.txt` verlinkt.
## Darstellungsmodi (wie Blitz & Donner Forms)
Im Stil-Tab bietet der Block den «Farbmodus» mit vier Werten (Attribut `appearanceMode`, Wrapper-Attribut `data-bdpdf-appearance`):
- **Theme:** Das Plugin fügt kein Erscheinungs-CSS hinzu – nur strukturelle Layoutregeln. Buttons sind `wp-element-button`, Farben und Typografie kommen vollständig aus theme.json.
- **Hell / Dunkel:** isolierte Apple-Optik, Token-Werte 1:1 aus Blitz & Donner Forms (Karte #ffffff/#1c1c1e, Text #1d1d1f/#f5f5f7, Akzent #0071e3/#0a84ff, Radius 10/16 px, Buttons 0.7rem/1.5rem, Gewicht 600).
- **Automatisch:** Hell, bei `prefers-color-scheme: dark` Dunkel.
Themes können die Hell/Dunkel-Palette ohne eigenes CSS übersteuern – via `settings.custom.bdpdf.*` in theme.json (wird zu `--wp--custom--bdpdf--…`): `light-card`, `light-text`, `light-label`, `light-border`, `light-accent`, `light-on-accent` sowie dieselben Schlüssel mit `dark-`.
## Bedienung
1. Block «PDF-Flipbook» einfügen (Kategorie Medien).
2. PDF aus der Mediathek wählen oder hochladen.
3. Optional in den Block-Einstellungen: «Erste Seite als Buchdeckel» abschalten.
Im Frontend: Blättern per Knopf, Pfeiltasten (bei fokussiertem Block) oder Ziehen an der Seitenecke. Ohne JavaScript erscheint ein Download-Link.
## Anforderungen
WordPress 6.5+ (wegen `viewScriptModule`), PHP 7.4+.
## Bekannte Grenzen
- Der Editor zeigt einen Platzhalter, keine Live-Vorschau des Flipbooks.
- Sehr grosse PDFs (über etwa 60 Seiten) brauchen spürbar Ladezeit, da alle Seiten vorgerendert werden.
