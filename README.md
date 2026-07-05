# Blitz & Donner PDF
WordPress-Plugin von Blitz & Donner (Slug und Prefix: `bdpdf`). Stellt den Gutenberg-Block «PDF-Flipbook» bereit: Ein PDF aus der Mediathek wird im Frontend als blätterbares Buch mit Umblätter-Animation angezeigt.
## Namenskonvention
Alle B&D-Plugins heissen «Blitz & Donner …» (zuerst die Marke, dann die Funktion) und tragen einen Slug-Prefix von mindestens 5 Zeichen, beginnend mit `bd`. Hier: `bdpdf`. Der Prefix gilt für Slug, Textdomain, Block-Namespace, CSS-Klassen und PHP-Symbole.
## Funktionsweise
Der Block ist dynamisch (`render.php`). Im Editor wählt die Redaktion ein PDF aus der Mediathek; das Frontend rendert alle Seiten mit PDF.js in Canvas-Bilder und übergibt sie an StPageFlip. Beide Bibliotheken sind lokal gebündelt – kein CDN, keine externen Requests.
## Komponenten
- `bdpdf.php` – Bootstrap, registriert den Block über `block.json`
- `readme.txt` – WordPress.org-Readme (Directory-tauglich)
- `blocks/flipbook/block.json` – Block-Metadaten (apiVersion 3, dynamisch, Block-Name `bdpdf/flipbook`)
- `blocks/flipbook/render.php` – Frontend-Markup mit Escaping
- `blocks/flipbook/editor.js` – Editor-UI ohne Build-Step (wp-Globals, kein JSX)
- `blocks/flipbook/view.mjs` – Frontend-Logik als ES-Modul (`viewScriptModule`)
- `blocks/flipbook/pdf.min.mjs`, `pdf.worker.min.mjs` – PDF.js 4.8.69 (Apache 2.0)
- `blocks/flipbook/page-flip.browser.js` – StPageFlip 2.0.7 (MIT)
## Lizenz
GPL-3.0-or-later. Bewusst GPLv3 statt GPLv2: Die gebündelte Apache-2.0-Bibliothek PDF.js ist nur mit GPLv3 kompatibel. Beide Bibliotheken sind vom WordPress-Plugin-Directory akzeptierte Lizenzen; die unminifizierten Quellen sind in `readme.txt` verlinkt.
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
