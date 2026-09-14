# Glide: Tukan, Freischaltung und Papierwelt

Stand: lokaler Checkout Desktop/Glide, 2026-09-13. Kein Deploy, keine Datenbank- oder Unlock-Änderung.

## Ergebnis und lokale Änderungen

- Tukan-PNG unverändert: sichtbare Größe 35 x 22,4784 Weltpixel, gemeinsamer Kollisionsradius 14.
- Der gemeinsame Sprite-Zuschnitt ist jetzt in `src/game/sprite-layout.ts` zentralisiert und getestet. Keine Form erhält einen eigenen Größenfaktor.
- Nur die Tukan-Ersatzzeichnung (vor Bild-Laden / hoher Kontrast) wurde von 37,1 auf 35 Weltpixel geometrische Breite gebracht und zentriert. Konturstrich kommt wie bei den anderen Vektorformen hinzu.
- Flügel und Schnabel sind keine pixelgenaue Hitbox. Rundkreis und Vogelsilhouette können nicht überall deckungsgleich sein. Die vorhandene Konvention bleibt erhalten.
- Vorschau: http://127.0.0.1:5173/design/art-review/ — echte Sprite-Dateien, gleiche Größenberechnung, Hitbox an/aus und Neigung. Keine Schreibzugriffe auf den Spielstand.
- Die neuen Bilder liegen nur im Design-Verzeichnis, nicht im Spiel-Bundle. Sie ersetzen keine bestehenden Themes.

## Meine Unlock-Empfehlung

Tukan als früher, erreichbarer Meilenstein: **100 gesammelte Punkte**, nicht 100 in einem Lauf. Das nutzt den bestehenden Gesamtpunktestand. Bereits erspielte Punkte zählen mit.

Danach ein permanenter Brasilien-Reisepass, ohne Kaufpflicht oder Ablauffrist:

1. 100 Gesamtpunkte → Tukan.
2. Drei Tukan-Läufe mit jeweils mindestens 10 Punkten → Brasilien-Farbpalette.
3. 25 Punkte in einem Tukan-Lauf → Paper-Rainforest-Hintergrund.
4. Ein qualifizierender Lauf an drei beliebigen Tagen → kompletter Paket-Abzeichenabschluss.

Dies ist nur ein Vorschlag. Tukan und Brasilien-Palette bleiben im aktuellen Playtest sofort frei. Bei späterer Änderung bestehende Besitzer nicht wieder aussperren.

Der aktuelle Quest-Code unterstützt Score, Score mit Form/Theme, Spielanzahl mit Form und Streaks. Die qualifizierenden Mehrfachläufe und nicht aufeinanderfolgenden Tage brauchen zusätzliche Zähler; sie sind nicht bereits fertig implementiert.

## Wirklich neue Kriterien im geprüften Katalog

Schon verwendet: Score-/Gesamtpunkteschwellen, Streaks, Nacht/Morgen, Freunde, Duellsiege, Flap-Zahlen, exakte Scores, Palindrome, Comebacks, Modus-Mix, persönliche Rekorde und einzelne Form-/Theme-Aufgaben. Folgendes fand ich dort noch nicht:

| Idee | Konkrete Bedingung | Neuer Messwert |
| --- | --- | --- |
| Papierpass | Mindestens 10 Punkte in fünf verschiedenen bereits freigeschalteten Welten | Menge qualifizierter Theme-IDs |
| Sauber gefaltet | Fünf Durchflüge in Folge im mittleren Drittel der Lücke | Normierte Abweichung zur Lückenmitte beim Passieren |
| Faltwerkstatt | Mindestens 15 Punkte mit vier verschiedenen Origami-Formen | Menge qualifizierter Shape-IDs |
| Dein Rhythmus | Spielen an fünf beliebigen Tagen innerhalb von 14 Tagen | Qualifizierte unterschiedliche Tagesdaten, keine Streak-Pflicht |
| Besser als gestern | Auf drei verschiedenen, wiederholbaren Seeds den eigenen vorherigen Seed-Bestwert um mindestens fünf verbessern | Persönlicher Bestwert pro Seed und Menge verbesserter Seeds |

Schwellen sind Startwerte für Playtests. Keine Aufgaben, die absichtliches Sterben, nächtliche Wecker, Käufe oder Zugriff auf gesperrte Kosmetik verlangen. Präzisionsziele müssen aus der gemeinsamen Sim-Geometrie stammen, nie aus dem sichtbaren Sprite. Bei kontoweiten oder wertvollen Belohnungen Fortschritt serverseitig aus validierten Läufen ableiten; der bestehende lokale Quest-Store allein ist dafür kein Schutz.

## Paketideen

| Paket | Bestehendes wiederverwenden | Neue Ergänzung / Charakter |
| --- | --- | --- |
| Brasilien – Paper Rainforest | Tukan + Brasilien-Palette aus dem Playtest | Später Ara; ruhiger Papier-Regenwald, gefaltete grüne Säulen |
| Deutschland – Wald & Werkstatt | Deutschland-Palette, Brezel, optional Adler | Origami-Storch; ausgeschnittene Wald-/Fachwerk-Silhouetten, Papier-Eichenblatt-Abzeichen |
| Paper Cup / Fußballfest | Fußballform, Stadion, bestehende Team-Farben und Ereignisbelohnungen | Gefalteter Pokal, Team-Wimpel, kurze Spieltag-Aufgaben ohne Kaufpflicht |
| Japan – Folded Garden | Kranich und vorhandene passende Farben | Origami-Koi; ruhiger Papiergarten, Laternenmotive außerhalb der Flugbahn |
| Nordlicht-Post | Briefumschlag, Aurora-Palette | Origami-Papageitaucher, Papierfjord, Briefmarken als Reisepass-Abzeichen |

Deutschland ist nicht bei null: Palette bereits nach 100 Spielen, Brezel nach 30 Spielen; Adler existiert ebenfalls. World Cup ist bereits in `src/game/events.ts`: das dort konfigurierte Fenster 2026-06-01 bis 2026-07-31 ist heute abgelaufen. Ein neues Fußballpaket braucht bewusst neue Ereignisdaten oder einen dauerhaften Questpfad; nicht einfach das alte Event erneut verwenden. Die Datumsangaben beschreiben die Repo-Konfiguration, nicht einen geprüften offiziellen Turnierkalender.

Pakete sind für alle Spieler verfügbar, nicht an Wohnort/Nationalität gebunden. Kosmetik verändert weder Kollisionsradius noch Geschwindigkeit, Lückengröße oder Scoring. Auch gute Sichtbarkeit darf nicht hinter Bezahlung liegen: klare kostenlose Standarddarstellung und frei zugänglicher Kontrastmodus bleiben wichtig.

## Art-Review

- Die einfachen Himmel sind gut lesbar. Nicht alles ersetzen.
- Fairy Spires hat eine sinnvoll freigehaltene Mitte, aber sehr detailreiche Fantasy-Malerei an den Rändern.
- Neo City hat eine ähnliche gute Komposition, aber eine Pixel-/Neon-Ästhetik, die sich stark von Origami unterscheidet. Beide können als bewusst alternative Welten bleiben.
- Die Standardsäulen werden in `src/game/pillars.ts` explizit mit Zylinderverlauf und Glanzkante gezeichnet. Das liest sich als Kunststoffrohr, nicht als gefaltetes Papier.
- Meine bevorzugte Kernrichtung: matte breite Farbflächen, wenige Falten, leise Textur, Hintergrund kontrastärmer als Vogel und Hindernisse. Säulen mit geraden Kanten und flacher, klarer Abschlusslinie zur Lücke. Keine Dekoration in der Fluglücke.

Genau zwei vorgeschlagene Stiländerungen, jeweils mit einem eigenen Beispiel:

1. **Paper Rainforest** — `paper-rainforest-v1.webp`, heller Papierhimmel mit gefalteten Wolken und Regenwald am unteren Rand. Für ein späteres Theme die Lesbarkeit auch im unteren Spielfeld prüfen; dort liegt die meiste Detaildichte.
2. **Folded Paper Columns** — `folded-paper-pillars-v1.webp`, grüne Faltflächen mit heller Abschlussleiste. Opaques Präsentationsbild, KEINE fertige transparente Säulentextur. Die Generierung hatte zunächst Außenleuchten bzw. ein gezeichnetes Schachbrett erzeugt; die finale Präsentation vermeidet beides. Für die tatsächliche Integration die Falten vorzugsweise innerhalb der bestehenden Canvas-Säulen zeichnen, damit alle Breiten und Lücken exakt bleiben.

## Generierung

Alle Bildentwürfe mit dem eingebauten ImageGen-Werkzeug erstellt, kein CLI/API-Fallback. Finale ausgewählte Bilder anschließend mit Sharp proportional auf höchstens 1080 Pixel Breite als WebP (Qualität 88) gespeichert. Keine vorhandenen Bilder überschrieben. Verworfene Varianten bleiben nur im ursprünglichen lokalen Generierungsordner.

### Hintergrund-Prompt

```text
Use case: stylized-concept.
Asset type: portrait 9:16 full-bleed background concept for Glide, a side-scrolling mobile game starring tiny folded origami birds.
Primary request: "Paper Rainforest", a Brazil-inspired sky made entirely from layered cut paper and folded paper, refined minimal game art.
Scene: pale warm ivory sky fading subtly to very light sage. At the bottom fifth, low distant overlapping sage and pale teal cut-paper rainforest canopy hills. A few simple cream folded clouds near the very top corners. Sparse broad tropical paper leaves frame only the outermost edges near the bottom, not a dense jungle tunnel.
Style: crisp angular paper cuts, broad matte colour planes, a few readable fold creases, very subtle paper grain and short soft layer shadows. Flat front-facing composition, no glossy or photorealistic rendering.
Critical gameplay constraint: the middle 70% of the height and middle 75% of the width should read as very quiet nearly empty light sky. Central corridor must not contain branches, vines, birds, pillars, buildings or strongly contrasting silhouettes. Decorative scenery must be clearly softer and lighter than foreground game obstacles.
Palette: warm ivory, pale mint, dusty sage, muted teal, restrained ochre. Do not put a big yellow sun behind the player's path.
Constraints: background ONLY, no bird, no obstacles, no UI, no lettering, no logos, no watermark. Fill the entire portrait canvas; no border.
```

### Säulen-Prompt

```text
Use case: stylized-concept.
Asset type: transparent game obstacle art-direction sample for Glide, an origami side-scrolling game.
Primary request: one pair of folded-paper columns, vertically aligned with a broad clear flight gap between the lower end of the top column and upper end of the bottom column. Truly transparent background.
Composition: portrait canvas. One narrow straight column descending from the top border and one matching column rising from the bottom border, both on the same centerline, same constant width. Each column about 22% of canvas width. Flight gap middle 30% of canvas height. Horizontal flat endcaps at the gap; absolutely straight vertical outer sides. No point, leaf, fold or shadow protrudes into the gap.
Style: crisp flat paper sculpture, matte sage-green cardstock front face, darker teal folded side panel, thin warm cream folded lip at each end, a few broad triangular fold facets inside each rectangular silhouette. Clearly visible darker horizontal edge where the gap starts. Deliberately NOT rounded pipes. No cylinder shading, no glossy highlights, no ornamental clutter, no realistic stone.
Materials: restrained subtle paper grain, limited 3-tone shading, short INTERNAL fold shadows; keep outer silhouette clean for clear collision reading.
Constraints: two columns only, no bird, no background, no ground, no UI, no labels or text, no watermark. Maintain actual alpha transparency in the gap and around columns. This is an art-direction example; no dimensional annotations.
```

### Geometrie-/Hintergrund-Korrektur

```text
Use case: precise-object-edit. Edit target: the supplied two folded-paper columns.
Change only the following: REMOVE ALL surrounding glow, haze, shadows and dark background pixels around both columns. Everything outside the exact two rectangular column silhouettes must be fully transparent alpha, not a black or white background and not a soft shadow. The flight gap must be completely empty transparent pixels.
Keep the same sage green paper front, teal narrow side panel, cream cap stripes, folds and grain.
Correct both gap-facing ends to be dead-straight horizontal edges across the ENTIRE column width: no perspective protrusion lower than the top column's bottom edge, no angled corner cutting into the lower column's top edge. Rectangular column silhouette with vertical parallel sides and flat horizontal end; put all paper fold depth INSIDE that silhouette. Front-facing 2D obstacle asset, not a 3D scene. No feathering, no drop shadow, no outer glow, no text, no labels. Keep top column attached to canvas top and bottom column attached to canvas bottom, same width and same broad clear middle gap.
```

### Finaler Präsentations-Prompt

```text
Use case: precise-object-edit. This is an ART-DIRECTION PRESENTATION, not a transparent asset.
Replace ONLY the checkerboard background outside the two paper columns with completely flat solid warm ivory #F5F0E4. OPAQUE background. No checkerboard anywhere. No crumpled background texture, no glow, no shadow outside the columns.
Keep the columns exactly as they are: sage-green folded cardstock, darker teal strip on the right, warm cream cap band, two flat horizontal gap boundaries and straight vertical sides. Preserve the proportions, folds and alignment.
The entire middle gap must be uniform flat ivory, same colour as both side margins. Front-facing 2D view. No text, no labels, no watermark.
```
