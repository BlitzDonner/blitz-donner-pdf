=== Blitz & Donner PDF ===
Contributors: blitzdonner
Tags: pdf, flipbook, block, media
Requires at least: 6.5
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 0.8.3
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

= 0.8.3 =
* Datei-Zeile auf das Wesentliche reduziert: Symbol, frei definierbare Beschriftung und die zwei Links «Ansehen»/«Herunterladen». Grösse und Datum entfallen – solche Angaben ergänzt die Redaktion bei Bedarf als eigenen Inhalt daneben.

= 0.8.2 =
* Popover als echte Lightbox neu gestaltet: das PDF schwebt gross im abgedunkelten Raum, das Chrome (Schliessen, Navigation, Download) ist dezent und schwebt darüber – keine wuchtigen Theme-Buttons, kein leerer weisser Kasten mehr. Rundes Schliessen-X, kompakte Glas-Navigation.

= 0.8.1 =
* Datei-Zeile: «Ansehen» und «Herunterladen» sind jetzt Textlinks statt Buttons; das PDF-Symbol ist rein dekorativ. Barrierefrei mit sprechenden Link-Namen (Dateibezug) und aria-haspopup für das Popover.
* Popover: Zurück/Weiter und der Download-Link bleiben immer sichtbar (nur das Buch scrollt); die Blätter-Buttons sind kompakter.

= 0.8.0 =
* Neu: Darstellung «Datei-Zeile» – der Block als kompakte Download-Zeile mit PDF-Symbol, Titel, Dateigrösse und Erstellungsdatum (pro Block überschreibbar). «Ansehen» öffnet das blätterbare PDF in einem Popover (mobil Vollbild), «Herunterladen» lädt die Datei direkt; beide Knöpfe sind abschaltbar. Mehrere Zeilen untereinander fluchten wie eine Tabelle.
* Der Block erscheint im Einfüge-Menü als zwei Varianten: «BD PDF – Buch» und «BD PDF – Datei-Zeile».

= 0.7.1 =
* Globale Stile im Website-Editor wirken jetzt vollständig: Der Block liest «Block-Abstand» und «Schatten» aus Design → Editor → Stile → Blöcke selbst (live im Editor, per wp_get_global_styles im Frontend). WordPress gibt beide Werte für Blöcke ohne Layout-Support sonst nicht aus.

= 0.7.0 =
* Editor-Vorschau pixelgleich zum Frontend: gleiche Buchbreite und Seitenverhältnisse wie StPageFlip, einzelne Umschläge liegen wie im Buch auf der rechten (vorn) bzw. linken (hinten) Buchhälfte.
* Schatten liegt neu auf dem gerenderten Buch statt auf dem Block-Rahmen – im Frontend, im Beitrags-Editor und im Website-Editor identisch.

= 0.6.2 =
* Einstellbarer Abstand zwischen Buch und Navigation: neuer Regler «Block-Abstand» im Stil-Tab (Abmessungen). Ohne eigene Einstellung gilt der Block-Abstand des Themes, sonst 0.75rem.

= 0.6.1 =
* Standard-Farbmodus neu «Theme»: Der Block folgt ab Werk vollständig theme.json und den globalen Stilen (Design → Editor → Stile) – Änderungen dort wirken live, auch am Beispiel-PDF im Stilbuch. Die Apple-Optik (Hell/Dunkel/Automatisch) bleibt als bewusste Wahl pro Block erhalten; in diesen Modi übersteuert sie globale Stile absichtlich.

= 0.6.0 =
* Gebündeltes Beispiel-PDF: Die Block-Vorschau (Auge im Inserter, Stilbuch im Site-Editor) zeigt jetzt ein echtes Beispiel-Flipbook. Im Platzhalter gibt es neu «Mit Beispiel-PDF ausprobieren» – alle Einstellungen (Buchdeckel, Farbmodus, Stil-Tab) wirken sofort am Beispiel, bis ein eigenes PDF gewählt wird.

= 0.5.1 =
* Fix: Flipbook erscheint jetzt auch in dynamisch nachgeladenem Inhalt (z.B. Theme-Popover, das den Beitrag per AJAX lädt). Ein schlanker Nachlader holt CSS, StPageFlip, Core und View-Modul, sobald ein Block im DOM auftaucht; das View-Modul initialisiert nachträglich eingefügte Blöcke selbst.

= 0.5.0 =
* Neu: Einstellung «Seitenlayout» (Einzelseiten oder Doppelseiten). Im Doppelseiten-Modus wird jede breite PDF-Seite beim Vorab-Rendern am Bund geteilt – das Buch klappt exakt am Bund und zeigt die Doppelseiten wie gestaltet. Schmale erste/letzte Seiten werden automatisch als einzelner Umschlag erkannt.
* Beim Neu-Rendern (z.B. Layout-Wechsel) bleibt die alte Fassung im Frontend verfügbar, bis der neue Lauf abgeschlossen ist; überzählige Alt-Dateien werden erst danach entfernt.

= 0.4.3 =
* Update-Client startet früher (plugins_loaded statt init): WordPress zeigt die Auto-Update-Schaltung in der Plugin-Liste jetzt zuverlässig an.

= 0.4.2 =
* Auto-Updates ohne Lizenz-Token: Der Update-Client fragt den Server auch ohne hinterlegtes Token an; das Plugin ist auf dem Blitz-&-Donner-Update-Server als frei markiert. Signatur- und Prüfsummen-Schutz bleiben unverändert aktiv.

= 0.4.1 =
* Plugin-Slug korrigiert: neu blitz-donner-pdf (Konvention Marke + Funktion, wie blitz-donner-forms); bdpdf bleibt Code- und Datenbank-Präfix. Hauptdatei heisst neu blitz-donner-pdf.php, Text-Domain folgt dem Slug. Block-Name bdpdf/flipbook und alle gespeicherten Daten bleiben unverändert – bestehender Content ist nicht betroffen.

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
