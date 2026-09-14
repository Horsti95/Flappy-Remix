/** Local art draft: all components are free to test. No event dates or paid
 * entitlement checks are enforced here. This catalog contains cosmetics only;
 * the simulation must never import it. */
interface PaperPackDefinition {
  id: string; name: string; shapeId: string; shapeName: string; presetId: string;
  body: readonly [number, number, number]; accent: readonly [number, number, number];
  skyTop: string; skyBottom: string; pipeBody: string; pipeCap: string;
  category: "paper" | "contraband";
}

export const PAPER_PACKS = [
  {
    "id": "paper-germany",
    "name": "Deutschland — Wald & Werkstatt",
    "shapeId": "pack-stork",
    "shapeName": "Origami-Storch",
    "presetId": "preset-paper-germany",
    "body": [
      235,
      233,
      219
    ],
    "accent": [
      215,
      108,
      65
    ],
    "skyTop": "#e6ede5",
    "skyBottom": "#d4dfc2",
    "pipeBody": "#42715b",
    "pipeCap": "#dec58b",
    "category": "paper"
  },
  {
    "id": "paper-cup",
    "name": "Paper Cup",
    "shapeId": "pack-trophy",
    "shapeName": "Papierpokal",
    "presetId": "preset-paper-cup",
    "body": [
      226,
      210,
      161
    ],
    "accent": [
      185,
      116,
      44
    ],
    "skyTop": "#daedf0",
    "skyBottom": "#bbd1b4",
    "pipeBody": "#426c78",
    "pipeCap": "#efe1b0",
    "category": "contraband"
  },
  {
    "id": "paper-japan",
    "name": "Japan — Folded Garden",
    "shapeId": "pack-koi",
    "shapeName": "Origami-Koi",
    "presetId": "preset-paper-japan",
    "body": [
      239,
      230,
      216
    ],
    "accent": [
      209,
      89,
      81
    ],
    "skyTop": "#f3ece0",
    "skyBottom": "#e8d4cf",
    "pipeBody": "#986563",
    "pipeCap": "#ead5bc",
    "category": "paper"
  },
  {
    "id": "paper-northern-lights",
    "name": "Nordlicht — Paper Fjord",
    "shapeId": "pack-puffin",
    "shapeName": "Origami-Papageitaucher",
    "presetId": "preset-paper-northern-lights",
    "body": [
      220,
      232,
      232
    ],
    "accent": [
      242,
      170,
      85
    ],
    "skyTop": "#263b55",
    "skyBottom": "#36586d",
    "pipeBody": "#98bdc0",
    "pipeCap": "#efe6ca",
    "category": "paper"
  },
  {
    "id": "paper-canada",
    "name": "Kanada — Maple Flight",
    "shapeId": "pack-goose",
    "shapeName": "Origami-Kanadagans",
    "presetId": "preset-paper-canada",
    "body": [
      226,
      217,
      194
    ],
    "accent": [
      183,
      77,
      57
    ],
    "skyTop": "#f2e8d4",
    "skyBottom": "#c2d8d2",
    "pipeBody": "#95644d",
    "pipeCap": "#ead6ab",
    "category": "paper"
  },
  {
    "id": "paper-russia",
    "name": "Russland — Wintermärchen",
    "shapeId": "pack-bullfinch",
    "shapeName": "Origami-Gimpel",
    "presetId": "preset-paper-russia",
    "body": [
      222,
      226,
      232
    ],
    "accent": [
      215,
      82,
      89
    ],
    "skyTop": "#e2ebef",
    "skyBottom": "#bdcfda",
    "pipeBody": "#577791",
    "pipeCap": "#e4d3b7",
    "category": "paper"
  },
  {
    "id": "paper-new-year",
    "name": "Neujahr — Midnight Wishes",
    "shapeId": "pack-lantern",
    "shapeName": "Wunschlaterne",
    "presetId": "preset-paper-new-year",
    "body": [
      250,
      224,
      152
    ],
    "accent": [
      227,
      139,
      76
    ],
    "skyTop": "#213444",
    "skyBottom": "#374c5b",
    "pipeBody": "#698b99",
    "pipeCap": "#e6c67b",
    "category": "paper"
  },
  {
    "id": "paper-cyberpunk",
    "name": "Cyberpunk — Neon Fold",
    "shapeId": "pack-raven",
    "shapeName": "Neon-Rabe",
    "presetId": "preset-paper-cyberpunk",
    "body": [
      182,
      204,
      225
    ],
    "accent": [
      69,
      224,
      228
    ],
    "skyTop": "#182638",
    "skyBottom": "#34304d",
    "pipeBody": "#628a9c",
    "pipeCap": "#d88caf",
    "category": "paper"
  }
] as const satisfies readonly PaperPackDefinition[];

export type PaperPackId = (typeof PAPER_PACKS)[number]["id"];
export type PaperPackShapeId = (typeof PAPER_PACKS)[number]["shapeId"];
export function getPaperPack(id: string | null | undefined) {
  return PAPER_PACKS.find((p) => p.id === id);
}
export function getPaperPackForShape(id: string | null | undefined) {
  return PAPER_PACKS.find((p) => p.shapeId === id);
}

