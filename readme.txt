=== Blitz & Donner PDF ===
Contributors: blitzdonner
Tags: pdf, flipbook, block, media
Requires at least: 6.5
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 1.0.0
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

= 1.0.0 =
* Erste Version: Block «PDF-Flipbook» mit Mediathek-Auswahl, Buchdeckel-Option und Tastatursteuerung.
