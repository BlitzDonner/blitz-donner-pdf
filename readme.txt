=== Blitz & Donner PDF ===
Contributors: blitzdonner
Tags: pdf, flipbook, block, media
Requires at least: 6.5
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 0.4.0
License: GPL-3.0-or-later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Zeigt PDFs aus der Mediathek als blätterbare Bücher mit Umblätter-Animation an – ohne externe Dienste.

== Description ==

Blitz & Donner PDF stellt den Gutenberg-Block «PDF-Flipbook» bereit. Die Redaktion wählt ein PDF aus der Mediathek; das Frontend zeigt es als Buch mit realistischer Umblätter-Animation.

* Blättern per Knopf, Pfeiltasten oder Ziehen an der Seitenecke
* Erste Seite wahlweise als Buchdeckel
* Doppelseiten-Ansicht, auf schmalen Bildschirmen automatisch Einzelseiten
* Ohne JavaScript erscheint ein Download-Link
* Keine externen Requests: PDF.js und StPageFlip sind im Plugin gebündelt

== Bundled Libraries ==

* PDF.js 4.8.69 – Apache License 2.0, Quellcode: https://github.com/mozilla/pdf.js
* StPageFlip 2.0.7 – MIT License, Quellcode: https://github.com/Nodlik/StPageFlip

== Installation ==

1. Plugin installieren und aktivieren.
2. Im Editor den Block «PDF-Flipbook» einfügen (Kategorie Medien).
3. PDF aus der Mediathek wählen oder hochladen.

== Frequently Asked Questions ==

= Werden externe Dienste kontaktiert? =

Nein. Alle Bibliotheken liegen im Plugin, das PDF kommt aus der eigenen Mediathek.

= Wie gross darf das PDF sein? =

Alle Seiten werden im Browser vorgerendert. Bis etwa 60 Seiten bleibt die Ladezeit angenehm; darüber steigt sie spürbar.

== Changelog ==

= 0.4.0 =
* Update-Client eingebaut: bezieht Updates vom Blitz-&-Donner-Update-Server (plugins.blitzdonner.ch) mit Token, SHA-256-Prüfung und Ed25519-Pflichtsignatur. Kein Killswitch: ohne gültiges Token wird nur das Update verweigert, das Plugin läuft uneingeschränkt weiter.

= 0.3.2 =
* Editor-Vorschau neu als schlanke Doppelseiten-Ansicht ohne StPageFlip: gleiches Markup und Stylesheet wie das Frontend, blätterbar über dieselben Knöpfe. StPageFlip im Editor-Canvas hatte Klicks geschluckt und Gutenbergs Werkzeugleiste unterdrückt.
* Behoben: Umschalten von «Erste Seite als Buchdeckel» liess die Vorschau verschwinden.
* Behoben: Werkzeugleiste (inkl. «PDF ersetzen») erschien beim Klick auf den Block nicht.

= 0.3.1 =
* Editor: Buchgrösse wird bei Padding-/Breitenänderungen aus dem Stil-Tab neu berechnet (ResizeObserver) – keine Überlappung mit der Navigation mehr.
* Stil-Tab-Schriftgrösse wirkt jetzt: Skin-Schriftgrösse mit Spezifität 0, Navigation und Seitenanzeige skalieren in em mit.
* Editor: Klick auf den Blockhintergrund wählt den Block aus.

= 0.3.0 =
* Vier Darstellungsmodi wie bei Blitz & Donner Forms: Theme (Standard-Auswahl im Stil-Tab), Automatisch, Hell, Dunkel. Hell/Dunkel übernehmen die Forms-Optik 1:1 (Tokens, Karte, Buttons); Theme fügt kein eigenes Erscheinungs-CSS hinzu – alles kommt aus theme.json.
* Navigations-Buttons als wp-element-button, damit Themes sie im Theme-Modus selbst stylen.
* theme.json kann die Hell/Dunkel-Palette über settings.custom.bdpdf.* übersteuern.

= 0.2.0 =
* Seiten werden nach dem Hochladen einmal vorgerendert (Ablage in uploads/bdpdf/) und stehen im Frontend sofort bereit; Nachrendern nur noch bei zu grossem Viewport.
* Der Editor zeigt das echte Flipbook – gleiches Markup, gleiches Stylesheet wie das Frontend.
* Blocktitel neu «BD PDF»; Stil-Tab mit Abständen, Rahmen, Radius, Schatten, Farben und Typografie (Block-Supports).
* Neue REST-Route bdpdf/v1/pages (nur für angemeldete Nutzer mit Upload-Recht, JPEG-Validierung serverseitig).

= 0.1.1 =
* Scharfe Darstellung auf Retina-Displays: StPageFlip läuft jetzt im HTML-Modus statt im Canvas-Modus, Seiten werden auf hochauflösenden Bildschirmen höher gerendert.

= 0.1.0 =
* Erste Version: Block «PDF-Flipbook» mit Mediathek-Auswahl, Buchdeckel-Option und Tastatursteuerung.
