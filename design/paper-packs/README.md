# Paper Worlds — lokaler Entwurf 01

Stand: 13. September 2026. Acht eigenständige Hintergründe, spielbare Origami-Figuren,
Farbpaare und Papier-Säulen. Kanada und Russland sind getrennt. Nichts gepusht,
keine Veröffentlichung, keine Migration und kein Kauf-/Event-System aktiviert.

Vorschau bei laufendem Entwicklungsserver: <http://127.0.0.1:5173/design/paper-packs/>.
„Set lokal testen“ stattet alle vier kosmetischen Achsen aus und öffnet das Spiel.
Einzeln stehen die Teile auch in der bestehenden Galerie. Alles ist aktuell frei
zum Testen. Diese freien Draft-Unlocks müssen vor einem späteren Release bewusst
durch das beschlossene Modell ersetzt werden; nicht versehentlich als fertiges
Event-System veröffentlichen. Die Vorschauseite selbst ist nur im Dev-Server
verfügbar, die Spiel-Assets sind in den normalen Build integriert.

## Die acht Richtungen

| Set | Figur | Welt und Säulen | Möglicher Kapitelstart (Entwurf) |
| --- | --- | --- | --- |
| Deutschland — Wald & Werkstatt | Storch | Papierwald, Dorf, salbeigrüne Fachwerk-Falten | Eigene Herbstwoche, z. B. 1.–7. Oktober |
| Paper Cup | Papierpokal | Gefaltetes Stadion, Papierfähnchen, Netzfalten | Redaktionell festgelegte Turnierwoche |
| Japan — Folded Garden | Koi | Sakura, Papiergarten, washiartige Fächerfalten | Eigenes Frühlingskapitel, 15. März–15. April |
| Nordlicht — Paper Fjord | Papageitaucher | Ruhiger Fjord, Aurora-Papierbänder, Kristallfalten | Winterkapitel, 15. November–28. Februar |
| Kanada — Maple Flight | Kanadagans | Ahornwald, See, kupferfarbene Falten | Herbstkapitel, 15. September–15. Oktober |
| Russland — Wintermärchen | Gimpel | Birken, Schnee, ruhiges Winterdorf | Winterkapitel, 1. Dezember–28. Februar |
| Neujahr — Midnight Wishes | Wunschlaterne | Papiersterne, warme Fenster, Sternfalten | 26. Dezember–7. Januar |
| Cyberpunk — Neon Fold | Neon-Rabe | Matte Papierstadt, Cyan-/Magenta-Kanten | Wiederkehrende, angekündigte Neon-Woche |

Alle Fenster sind Produktideen, keine Behauptung über offizielle Feiertage oder
Turniertermine. Paper Cup verwendet keine offiziellen Turnier-/Verbandslogos.
Länderpakete sind Landschafts- und Papercraft-Themen, keine Staatsangehörigkeits-
oder Standortprüfung. Kein GPS, kein Länderzwang.

## Vorschlag: Kapitel statt kompletter Bundle-Drops

Das Event-Datum öffnet die Teilnahme an einer Aufgabenfolge, nicht den Zugang zu
einem Zahlungsvorteil. Einstieg durch einen gewerteten Lauf mit mindestens fünf
Punkten; bloßes Öffnen der App reicht nicht. Danach wird die Figur dauerhaft
freigeschaltet. Alternativ die Figur als kostenlose Leihfigur fürs Kapitel geben
und erst nach Abschluss behalten — aber das ist mehr UI-/Status-Komplexität.

1. Kapitel beginnen: Figur bekommen.
2. Drei gewertete Läufe mit der Figur, jeweils mindestens fünf Punkte: Farbpalette.
3. Eine thematische Aufgabe abschließen: passende Papier-Säulen.
4. An drei beliebigen Tagen am Kapitel spielen: Hintergrund und Abschlussstempel.

Die Tage müssen nicht aufeinanderfolgen. Innerhalb des Event-Fensters begonnenen
Kapitel dürfen später beendet werden. Freigeschaltete Teile bleiben dauerhaft.
Spätere Wiederholungen ermöglichen verpasste Kapitel; keine Pflicht, nachts zu
spielen. Ein freiwilliger Prestige-Stempel darf schwerer sein, der Basissatz
sollte für normale Spieler erreichbar bleiben.

### Ideen für die besondere Aufgabe je Kapitel

- Deutschland / Werkstatt: Drei verschiedene Papierformen mit jeweils 10 Punkten
  fliegen. Fördert Experimentieren statt nur dieselbe Gesamtspielzahl.
- Paper Cup / Dreiklang: In einem selbst gestarteten Dreier-Set dreimal mindestens
  10 Punkte erzielen; keine Ranked-Siege und kein Zwang, Freunde einzuladen.
- Japan / Balance: Drei Läufe im selbst gewählten Zielband 10–20, 20–30 oder 30–40.
  Nur das Erreichen des Bands zählen, keinen absichtlichen Absturz verlangen.
- Nordlicht / Wiederkehr: Drei verschiedene Daily-Seeds abschließen; Gastspieler
  dürfen mitmachen, kein Nachtzeitfenster.
- Kanada / Reisebuch: Insgesamt 60 Punkte über mindestens drei verschiedene Seeds
  sammeln; Seed-Wechsel muss im Modus transparent zugänglich sein.
- Russland / Winterpost: Eine Challenge abschließen, unabhängig vom Sieg. Eine
  Solo-Alternative mit demselben Aufwand vorsehen.
- Neujahr / Kleiner Vorsatz: Eigenes Ziel aus 10/20/30 wählen und an zwei beliebigen
  Tagen erreichen. Kein persönlicher Rekordzwang für erfahrene Spieler.
- Cyberpunk / Remix: Drei verschiedene rein kosmetische Loadouts jeweils über
  zehn Punkte fliegen. Keine Schwierigkeitserhöhung durch Dunkelheit verlangen.

Das sind noch keine implementierten oder sicher verifizierbaren Kriterien.
Aktuell existierende Zähler reichen nicht für alle Vorschläge. Später braucht es
serverseitig überprüfte Läufe, Kapitel-/Reward-IDs, idempotente Vergabe, einen
festgelegten Umgang mit Offline-Läufen und eindeutige UTC-Zeitfenster. Gerätezeit
und lokale Galerie-Flags dürfen keine knappen oder bezahlten Rewards vergeben.
Neue Kapitel nicht auf bestehende Level-/Daily-/Quest-Ketten aufsetzen, bevor
deren Datenmodell abgeglichen wurde.

## Fairness und Bildtechnik

- Keine Änderungen an `config.ts` oder `sim.ts`: Radius weiterhin 14 im Standardmodus,
  dieselben Flugregeln, Säulenbreiten und Lücken für alle Figuren.
- Alle neuen Sprites: zwei ausgerichtete 256×256-PNG-Ebenen mit echter Transparenz,
  nach enger Inhaltserkennung auf dieselbe längste Kante von 35 Weltpixeln skaliert.
  Ein Koi bleibt breiter als ein Pokal; gleiche Kollisionsregel bedeutet nicht,
  dass jede Silhouette exakt kreisförmig in die Hitbox passt.
- Neue Säulen werden direkt mit Canvas gezeichnet. Matte Flächen/Faltmuster sind
  innerhalb der bestehenden Rechtecke abgeschnitten; keine Äste, Blätter oder
  Lichtschleier ragen in die Fluglücke. Kontrastmodus nutzt dieselben flachen
  Körper und Kappen wie der bestehende Stil.
- Hintergründe sind kompakte WebP-Dateien (zusammen ca. 640 KB dezimal), zur Laufzeit
  bedarfsweise geladen. Sie sind zusätzlich im Offline-Precache enthalten. Der
  Gesamt-Precache des bestehenden Spiels enthält weiterhin ältere große Bilder;
  dieser Entwurf ist kein vollständiges Performance-Audit.
- Die Vorschau verwendet die echten Sprite-/Säulenfunktionen. Kontrastmodus nutzt
  vereinfachte Vektorfiguren, wie das Spiel selbst, statt die detaillierten Bitmaps.

## Herkunft und Wiederherstellung

Hintergründe und Figuren wurden mit dem Imagegen-Workflow erstellt, einzeln pro
Asset. `sources.json` enthält die vollständigen Prompts und ursprünglichen lokalen
Ausgabepfade. Diese Rohpfade sind maschinenabhängig; die fertigen Runtime-Dateien
unter `public/backgrounds` und `public/sprites` sind eigenständige Projektdateien.
`node scripts/prep-paper-packs.mjs` wiederholt nur die mechanische Größen-/Format-
und Zwei-Farb-Aufbereitung, wenn die Rohbilder an den Manifest-Pfaden noch existieren.
Die Säulen sind native Canvas-Kosmetik, keine skalierten Präsentationsbilder.

## Optionales Account-Willkommen — Einschätzung, noch nicht implementiert

Ja, sinnvoll. Primäre Botschaft: **„Spielstand sichern“**, nicht „Account-Pflicht“.
Empfehlung: Einmal nach dem ersten Flug oder als kleines überspringbares Willkommen.
Aktionen: „Spielstand sichern“ / „Erst mal spielen“. Später jederzeit unter Konto.
Kein Login-Zwang für den ersten Flug, kein Ranking-/XP-Vorteil für Registrierung.
Falls eine Belohnung: kleiner rein kosmetischer Reisepass-Stempel, erst nach
bestätigter dauerhafter Kontoverknüpfung und einmalig serverseitig vergeben.

Vor einer Aussage wie „Alles immer synchronisiert“ gibt es konkrete Arbeit:

- In `src/social/auth.ts` gibt es bereits E-Mail-/OAuth-Helfer. Das Konto-Panel
  bietet derzeit Benutzernamen und Geräte-Verknüpfungscodes, noch keinen fertigen
  Google-/E-Mail-Onboarding-Flow.
- Gäste sind bereits Supabase-Anonymous-User. Das bestehende Konto muss mit einer
  dauerhaften Identität verknüpft werden, damit die User-ID erhalten bleibt.
- Die vorhandenen Helfer fallen bei Fehlern teilweise von Verknüpfen auf normales
  Anmelden zurück. Das darf beim Sichern des Gastfortschritts nicht still passieren:
  Kontokonflikte brauchen eine ausdrückliche Auswahl und ggf. eine Merge-Regel.
- Profil-/Serverfortschritt existiert bereits, Quests und Teile der Statistiken /
  kosmetischen Auswahl liegen aber noch lokal. Registrierung allein baut keine
  vollständige geräteübergreifende Synchronisierung.
- Lokale Kosmetik-Caches sind nicht überall pro User-ID getrennt. Kontowechsel und
  Start-Synchronisierung müssen geprüft werden, damit eine alte Geräteauswahl
  nicht das neu angemeldete Profil überschreibt.

Grobe Umsetzungsschätzung, abhängig von Provider-Konfiguration und gewünschter
Sync-Tiefe: reiner Hinweisdialog etwa 2–4 Stunden; sauberer Ein-Provider-Flow mit
Gast-Upgrade, Rückkehr, Fehlerfällen und Tests etwa 1–2 Tage. Vollständigerer
Cross-Device-Sync zusätzlich mehrere Tage (grob 2–4), nach Datenmodell-Audit.
Live-Provider, Redirect-URLs und E-Mail-Versand wurden hier nicht verifiziert.
Keine Auth-Einstellung und kein Datenbankzustand wurden für diesen Entwurf geändert.

Offizielle Grundlagen:
[Supabase Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous),
[Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking).

## Prüfung

- 261 Tests in 28 Dateien bestanden, darunter 33 neue Pack-/Asset-/Geometriechecks.
- TypeScript-Prüfung bestanden; Produktionsbuild erfolgreich.
- Browser: alle acht Hintergründe und Figuren geladen; lokale Vorschau enthält
  Hitbox-, Neigungs- und Kontrastkontrollen. Wechsel des Japan-Sets ins Spiel,
  korrekt ausgerüsteter Koi im Hangar sowie Tap-Steuerung im ungewerteten
  Übungsmodus visuell geprüft. Kein Backend-/Live-Deployment-Test.
