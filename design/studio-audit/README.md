# Glide — Paper Studio: Art-Review und UI-Entwurf

Stand: 14. September 2026. Lokaler Branch: `codex/paper-studio-overhaul`.

## Kurzurteil

Ja, die Stile sollten vereinheitlicht werden. „Aus Papier“ beschreibt bisher das Material, aber noch keine gemeinsame Bildsprache. Kameraperspektive, Konturen, Detailgrad, Beleuchtung und Farbkontrast unterscheiden sich deutlich. Das UI bringt mit braunem Notizbuch, Klebestreifen und dunklen Glasflächen noch eine weitere Sprache hinzu.

Ich würde **nicht sofort alle alten Assets löschen**. Erst eine zusammenhängende Referenz im echten Spiel festlegen, dann ganze Motivfamilien nach diesem Maßstab ersetzen. Bestehende IDs, Freischaltungen und gespeicherte Ausrüstung bleiben erhalten.

Dieser Branch enthält einen umgesetzten UI-Entwurf und ein spielbares Referenz-Set. Er ist **keine vollständige Neugenerierung aller bisherigen Grafiken**. Nichts wurde gepusht oder veröffentlicht.

## Was visuell nicht zusammenpasst

Die lokale Inventarseite `/design/studio-audit/` zeigt die registrierten Hintergründe, alle Formen einschließlich versteckter Varianten und alle Säulen. Farben der Figuren sind für den Vergleich absichtlich einheitlich. Prozedurale Welten werden dort nur durch ihre Grundfarben dargestellt; bewegte Effekte sind im Spiel zu beurteilen.

| Familie | Befund | Empfehlung |
| --- | --- | --- |
| Neo City / Fairy Spires | Malerisch, stark beleuchtet und räumlich; viel mehr Detail als Figuren und Säulen. | Motive behalten, als große matte Papierflächen neu aufbauen. |
| Stadium und die neun Ascent-Bilder | Deutliche Fluchtpunkte bzw. Tunnel vermitteln Vorwärtsflug in die Tiefe. Das Spiel bewegt sich seitlich. | Zuerst ersetzen: Seitenansicht, offene Flugzone, keine zentrale „Rennstrecke“. Ascent darf farblich und atmosphärisch aufsteigen, ohne die Kameralogik zu wechseln. |
| Deutschland / Kanada / Russland | Neue Papierpakete, aber teilweise dichte Miniatur-Dioramen mit vielen kleinen Objekten. | Anzahl der Formen und Schatten reduzieren; Landschaft an die unteren bzw. äußeren Ränder verlagern. |
| Japan / Nordlicht / Cyberpunk / Paper Cup / Neujahr | Japan ist ruhiger; andere Entwürfe wirken teils kristallin, teils stärker beleuchtet. Die gemeinsame Bezeichnung „paper“ allein reicht nicht. | Gleiche Perspektive, Faltskala und Lichtquelle. Unterschiede über Motive und Palette, nicht über ein anderes Rendering-Modell. |
| Figuren | Einfache dick umrandete SVGs, Pixel-Figur, detailliert konturierte Origami-Sprites und weich schattierte neue Figuren stehen nebeneinander. | Spielfiguren in einer kompakten, konturlosen Faltfamilie neu zeichnen. Witzige „Contraband“-Motive dürfen bleiben, aber aus demselben Material. |
| Versteckte Varianten | Unter anderem wirkt `swan2` im Inventar durch Restflächen/unsaubere Freistellung schmutzig; weitere Varianten sind visuell redundant. | Versteckt lassen. Vor einem erneuten Angebot Freistellung und Silhouette ersetzen; keine bereits vergebenen IDs entfernen. |
| Säulen | Glänzend-runde Körper, Neon, Glas und neue matte Muster verwenden sehr unterschiedliche Oberflächen. | Einheitliche kantige Grundform und klare Kollisionskante. Thema über flache Falten/Farbe, nicht über wechselnde Geometrie. |
| Oberfläche | Papiertextur, Handschrift, Glas-Panels, viele gleichgewichtige Aktionen und sehr kleine Galerie-Tabs konkurrieren. | Helle Papierfläche, dunkle Tinte, klare Hierarchie und wiederkehrende Komponenten. |

## Verbindliche Richtung: Paper Studio

- **Material:** mattes Kartonpapier, große lesbare Faltflächen, kaum sichtbare Körnung. Keine Plastikreflexe, keine dicken schwarzen Außenlinien.
- **Licht:** weich von links oben. Kleine Kontaktschatten, kein wechselndes dramatisches Szenenlicht.
- **Perspektive:** seitliche Spielfiguren und flache Landschaftsschichten. Keine Kameraflucht durch Tore oder Gebäude.
- **Hintergründe:** der Großteil der Flugzone bleibt ruhig. Details überwiegend unten/am Rand; Hindernisse dürfen nicht wie Hintergrunddekoration aussehen.
- **Figuren:** ca. fünf bis sieben große Flächen; kompakter Körper, kurze Anhänge, klare Flugrichtung. Auf tatsächlichen 35 Weltpixeln prüfen, nicht nur als großes schönes Vorschaubild.
- **Säulen:** deckende Körper, zwei bis drei matte Ebenen und gut sichtbare Abschlusskante. Muster innerhalb der vorhandenen Geometrie.
- **Farben:** Grundsystem Papier `#f5f1e7`, Tinte `#25483d`, Salbei, Sand und wenig Terrakotta. Themen dürfen andere Farben haben, müssen aber dieselbe Helligkeitshierarchie einhalten.
- **UI:** System-Sans für Bedienung, Georgia für große Überschriften, einheitliche native Linien-Icons. Keine zusätzliche Font- oder Icon-Abhängigkeit.

### Übertragung auf die Themenpakete

| Paket | Motiv behalten | In Paper Studio ändern |
| --- | --- | --- |
| Deutschland | Storch, Wald, dezente Landesfarben | Wenige Baum-/Dachsilhouetten; Flagge als kleiner Akzent, nicht vollflächiger Hintergrund. |
| Paper Cup | Papierpokal und Spielfeldbezug | Tribüne als flache untere Papierlage statt Stadiontunnel; Konfetti nur außerhalb der Flugzone. |
| Japan | Koi und gefalteter Garten | Beste Ausgangsbasis: große Gartenformen, sparsame rote Akzente, weniger Miniaturarchitektur. |
| Nordlicht | Papageitaucher, Fjord, Aurora | Aurora als breite Papierbänder; weniger Kristall-/Low-Poly-Anmutung. |
| Kanada | Gans, See, Ahorn | Zwei bis drei Landschaftslagen, einzelne große Ahornformen statt dichtem Diorama. |
| Russland | Gimpel und Winterlandschaft | Schnee aus ruhigen gefalteten Flächen; Architektur nur als kleine Rand-Silhouette. |
| Neujahr | Laterne und Mitternacht | Papiersterne und wenige Lichtakzente; Feuerwerk nicht hinter den Hinderniskanten. |
| Cyberpunk | Rabe und Stadt | Dunkles Papier mit schmalen farbigen Faltkanten. Keine glänzenden Röhren und keine Neonüberstrahlung der Lücken. |

Das sind Art-Direction-Vorgaben, noch keine Ersatzbilder für diese acht Pakete. Die vorhandenen Entwürfe bleiben auswählbar.

## Bereits umgesetzt

### Echter neuer Startbildschirm

- Aktuell ausgerüstete Figur und Welt in der Flugkarte, keine erfundenen Statistikwerte.
- Eine klare Hauptaktion: **Take flight**. Daily prominent darunter, Ranked und Practice nachgeordnet.
- Feste Navigation: Collection, Leaderboard, Journey, Friends, Challenges.
- Nutzerstatus, Level und Einstellungen im Kopfbereich. Fehlende Backend-Konfiguration wird als lokaler/offline Betrieb bezeichnet, nicht als erfolgreiche Cloud-Synchronisation.
- Inhalt kann auf kleinen Displays scrollen; Navigation bleibt erreichbar.

### Gemeinsame Oberflächen

- Collection mit klaren Text-Tabs statt sieben winzigen Vorschaukacheln; bestehende Ausrüstung und Fortschritte bleiben nutzbar.
- Einheitliche helle Flächen für Daily, Bestenliste, Freunde, Challenges, Ranked, Journey, Profil und vorhandene Paper-Panels.
- Überarbeitete Settings-, Pause- und Ergebnisdarstellung, Fokusmarkierungen und Dialog-Tastaturnavigation.
- Gut lesbare inaktive Filter und Modus-Chips auf hellem Papier; Auswahlzustände für Galerie und Bestenliste auch per ARIA.
- Der Platzhalter-Werbebanner ist standardmäßig aus. Er erscheint nur bei explizitem Opt-in **und** gesetztem Text. Es wurde kein Werbenetzwerk hinzugefügt.
- Browser-Zoom ist nicht mehr durch `user-scalable=no` gesperrt.

### Referenz-Set im tatsächlichen Spiel

| Auswahl | ID | Datei / Umsetzung |
| --- | --- | --- |
| Paper swift | `studio-swift` | `public/sprites/studio-swift.png` + `studio-swift-accent.png` |
| Paper Meadow | `studio-meadow` | `public/backgrounds/studio-meadow.webp` |
| Studio folds | `studio-fold` | Deterministische Canvas-Flächen in `src/game/pillars.ts` |
| Sage & clay | `preset-studio` | Zweifarbige Palette in `src/game/preset-skins.ts` |

Der neue Vogel und Hintergrund wurden mit Imagegen unter derselben Stilvorgabe erzeugt. Prompts und lokale Quelldateien stehen in `sources.json`. `scripts/prep-studio-art.mjs` exportiert daraus die WebP-Welt und ausgerichtete transparente Farbebenen. Die drei Laufzeit-Bilddateien zusammen: **73.584 Bytes**, rund 72 KiB.

Neue Installationen verwenden Vogel, Welt und Säulen als Standard. Bereits gespeicherte gültige Auswahl wird nicht überschrieben. Das Referenz-Set ist im Entwurf frei auswählbar, ohne neue Kauf- oder Datumsbedingungen.

### Fairness und Bedienfehler

- Keine Änderung an `config.ts` oder `sim.ts`: bestehende Kollisionen, Seeds und Physik bleiben gleich.
- Gemeinsame Sprite-Normierung: längste sichtbare Seite 35 Weltpixel bei Radius 14. Das ist eine optische Annäherung, **keine** pixelgenaue Silhouettenkollision. Es gibt keine besondere Trefferfläche für den neuen Vogel.
- Der Sprite-Zuschnitt berücksichtigt nun beide Farbebenen, damit eine konturlose Schnabelspitze nicht abgeschnitten wird.
- Die Studio-Säulen lassen dieselbe Lücke frei und behalten die High-Contrast-Geometrie.
- Eine ausgewählte Palette markiert nicht gleichzeitig „cream + ink“ als ausgerüstet.
- Settings meldet seinen offenen Zustand an die Menüverwaltung, damit der periodische Daily-Refresh das Panel nicht ersetzt.
- Größenwechsel zeichnen den vorhandenen Canvas-Zustand neu, auch wenn kein laufender Animationsschritt stattfindet.
- Die Flugsteuerung überlässt fokussierten Knöpfen/Feldern ihre Tastaturbedienung. Leertaste aktiviert im Menü wieder den Knopf statt abgefangen zu werden.

## Prüfung und Grenzen

- **275 Tests bestanden**, 31 Testdateien; zusätzliche Tests für Menüziele, Text-Escaping, Bestands-Auswahl, neue Assets, Säulengeometrie, Zweiebenen-Zuschnitt und Tastaturbedienung.
- TypeScript-Prüfung ohne Fehler.
- Lokaler Produktions-Build mit PWA-Cache geprüft; die Studio-Bilder sind enthalten. Der gesamte Cache bleibt wegen der erhaltenen Altgrafiken ungefähr 7,3 MiB groß.
- Browserprüfung: Desktop sowie 360×640 und 320×568; Home, Collection, Settings, Daily, Journey und Offline-Zustände weiterer Menüs. Praktischer ungewerteter Flug mit dem Referenz-Set, Pause, Größenwechsel und Rückkehr getestet.
- Einstellung per Leertaste umgeschaltet und auf den ursprünglichen Wert zurückgestellt. Keine Daily-Versuche verbraucht und kein Ranked-Match gestartet.
- Die lokale Umgebung meldet fehlende Supabase-Frontend-Konfiguration. Gefüllte Online-Bestenlisten, echte Account-Synchronisation, Freundesaktionen und Ranked-Serverabläufe sind damit **nicht** Ende-zu-Ende bestätigt.
- Kein Test auf einem tatsächlich installierten Android-/iOS-PWA-Gerät; keine umfassende Screenreader- oder WCAG-Zertifizierung.
- Eine vollständige Neuzeichnung aller Legacy-Sprites, aller Welten, Partikeleffekte, Badges und App-Icons ist noch offen. Die gemeinsame Oberfläche ist umgesetzt, nicht jeder datenabhängige Sonderzustand neu gestaltet.

## Sinnvolle nächste Art-Runde

1. Referenz-Set und UI im echten Spiel freigeben oder gezielt anpassen.
2. Zuerst Ascent/Stadium sowie die malerischen Legacy-Welten im seitlichen Paper-Studio-Look ersetzen.
3. Danach Länderwelten als gemeinsame Serie erzeugen; je Paket erst Hintergrund + Figur + Säulen zusammen abnehmen.
4. Alte Kontur-Sprites familienweise ersetzen. IDs und Unlock-Regeln beibehalten; alte Bilddateien erst entfernen, wenn sie nicht mehr referenziert werden und ein überprüfter Ersatz existiert.
5. Vor einem Release die Online-Zustände und installierte PWA auf echten Geräten prüfen.

Alle Arbeiten sind lokal und uncommitted. Vorhandene, nicht zu diesem UI-Entwurf gehörende Änderungen wurden nicht zurückgesetzt; keine Migration, kein Merge, kein Push und kein Deployment in diesem Arbeitsschritt.
