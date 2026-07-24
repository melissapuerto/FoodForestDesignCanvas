// Hand-tuned single-stroke codex glyphs. Stroke uses currentColor so callers
// set the tone via CSS color. Paths copied from the React prototype's Glyph
// object (Kuxtal/Kuxtal.html).

export type GlyphPaths = {
  paths: string[];
  fills?: Array<{ d: string }>;
  circles?: Array<{ cx: number; cy: number; r: number; fill?: boolean }>;
  ellipses?: Array<{ cx: number; cy: number; rx: number; ry: number; transform?: string }>;
  rects?: Array<{ x: number; y: number; w: number; h: number; rx?: number }>;
  strokeLinejoin?: 'round' | 'miter';
};

export type GlyphName =
  // Plants
  | 'Maiz' | 'Frijol' | 'Calabaza' | 'Aguacate' | 'Yuca' | 'Cacao' | 'Chile'
  | 'Platano' | 'Mango' | 'Papaya' | 'Cafe' | 'Guanabana' | 'Chachafruto'
  | 'Cilantro' | 'Girasol' | 'Aji'
  // Animals
  | 'Abeja' | 'Lombriz' | 'Pajaro' | 'Mariposa' | 'Iguana' | 'Topo' | 'Hormiga'
  | 'Lagartija' | 'Rana'
  // UI
  | 'Sun' | 'Drop' | 'Mountain' | 'Wind' | 'Compass' | 'Layers' | 'Seed'
  | 'Mic' | 'Camera' | 'Plus' | 'Close' | 'ArrowRight' | 'Cube' | 'Map'
  | 'Warning' | 'Sparkle' | 'Settings' | 'Book' | 'Box' | 'Moon' | 'Chart'
  | 'People' | 'Help' | 'Trash' | 'Pin' | 'Check' | 'Reset' | 'Wave'
  | 'List' | 'Basket' | 'Gear' | 'ChevronDown';

export const GLYPHS: Record<GlyphName, GlyphPaths> = {
  // ---- Plants ----
  Maiz: {
    paths: [
      'M16 28 V8',
      'M16 12 C 12 11 10 8 10 5 C 13 5 15 7 16 10',
      'M16 16 C 20 15 22 12 22 9 C 19 9 17 11 16 14',
      'M16 20 C 12 19 10 16 10 13 C 13 13 15 15 16 18',
      'M11 28 H 21'
    ]
  },
  Frijol: {
    paths: [
      'M8 28 C 8 18 14 12 14 6',
      'M14 6 C 18 9 19 13 16 16',
      'M14 12 C 18 14 20 17 18 21',
      'M14 18 C 18 19 21 22 19 26'
    ]
  },
  Calabaza: {
    paths: [
      'M10 13 V 27',
      'M16 12 V 28',
      'M22 13 V 27',
      'M16 12 C 14 9 14 6 17 4'
    ],
    ellipses: [{ cx: 16, cy: 20, rx: 11, ry: 8 }]
  },
  Aguacate: {
    paths: ['M16 4 C 8 6 6 14 8 22 C 10 28 22 28 24 22 C 26 14 24 6 16 4 Z'],
    circles: [{ cx: 16, cy: 18, r: 4 }]
  },
  Yuca: {
    paths: [
      'M16 28 V 14',
      'M16 14 L 8 6',
      'M16 14 L 24 6',
      'M16 14 L 12 4',
      'M16 14 L 20 4',
      'M16 14 L 4 12',
      'M16 14 L 28 12'
    ]
  },
  Cacao: {
    paths: [
      'M16 8 V 28',
      'M13 10 C 14 14 14 22 13 26',
      'M19 10 C 18 14 18 22 19 26',
      'M16 8 C 16 6 18 4 21 4'
    ],
    ellipses: [{ cx: 16, cy: 18, rx: 6, ry: 10 }]
  },
  Chile: {
    paths: [
      'M10 8 C 12 6 16 6 18 8',
      'M14 8 C 12 14 14 22 22 26',
      'M14 8 C 16 14 18 20 22 26'
    ]
  },
  Aji: {
    paths: [
      'M10 8 C 12 6 16 6 18 8',
      'M14 8 C 12 14 14 22 22 26',
      'M14 8 C 16 14 18 20 22 26'
    ]
  },
  Platano: {
    paths: [
      'M16 28 V 16',
      'M16 16 C 8 14 6 8 8 4',
      'M16 16 C 24 14 26 8 24 4',
      'M16 16 C 14 12 14 8 16 4',
      'M12 28 H 20'
    ]
  },
  Mango: {
    paths: ['M16 28 V 18'],
    ellipses: [
      { cx: 11, cy: 12, rx: 6, ry: 8, transform: 'rotate(-15 11 12)' },
      { cx: 21, cy: 12, rx: 6, ry: 8, transform: 'rotate(15 21 12)' },
      { cx: 16, cy: 9, rx: 5, ry: 7 }
    ]
  },
  Papaya: {
    paths: [
      'M16 28 V 14',
      'M16 14 C 8 12 4 8 4 4',
      'M16 14 C 24 12 28 8 28 4',
      'M16 14 C 12 12 10 8 10 4',
      'M16 14 C 20 12 22 8 22 4',
      'M16 14 C 16 10 16 6 16 4'
    ]
  },
  Cafe: {
    paths: [
      'M16 28 V 14',
      'M16 14 C 10 12 8 8 8 4',
      'M16 14 C 22 12 24 8 24 4'
    ],
    ellipses: [{ cx: 16, cy: 20, rx: 5, ry: 4 }]
  },
  Guanabana: {
    paths: [
      'M16 28 V 22',
      'M14 4 C 12 6 12 8 14 10',
      'M18 4 C 20 6 20 8 18 10'
    ],
    ellipses: [{ cx: 16, cy: 16, rx: 8, ry: 9 }]
  },
  Chachafruto: {
    paths: [
      'M16 28 V 18',
      'M16 18 L 6 8',
      'M16 18 L 26 8',
      'M16 18 L 10 4',
      'M16 18 L 22 4',
      'M16 18 L 16 4'
    ]
  },
  Cilantro: {
    paths: [
      'M16 28 V 14',
      'M10 16 C 8 12 10 8 14 8',
      'M22 16 C 24 12 22 8 18 8',
      'M16 14 C 14 10 16 6 18 4',
      'M16 14 C 18 10 16 6 14 4'
    ]
  },
  Girasol: {
    paths: [
      'M16 28 V 18',
      'M16 4 V 8',
      'M8 8 L 11 11',
      'M24 8 L 21 11',
      'M16 22 V 26',
      'M4 16 H 8',
      'M24 16 H 28'
    ],
    circles: [{ cx: 16, cy: 14, r: 4 }]
  },

  // ---- Animals ----
  Abeja: {
    paths: [
      'M10 16 H 22',
      'M10 20 H 22',
      'M16 10 C 10 8 6 12 8 16',
      'M16 10 C 22 8 26 12 24 16'
    ],
    ellipses: [{ cx: 16, cy: 18, rx: 6, ry: 8 }],
    circles: [{ cx: 16, cy: 9, r: 1.5 }]
  },
  Lombriz: {
    paths: [
      'M4 16 C 8 12 12 20 16 16 C 20 12 24 20 28 16',
      'M6 13 V 19',
      'M11 13 V 19',
      'M16 13 V 19',
      'M21 13 V 19',
      'M26 13 V 19'
    ]
  },
  Pajaro: {
    paths: ['M6 18 C 10 14 14 14 18 16 L 28 12 L 24 18 L 28 22 L 18 22 C 14 22 10 22 6 18 Z'],
    circles: [{ cx: 22, cy: 14, r: 0.8, fill: true }]
  },
  Mariposa: {
    paths: [
      'M16 10 V 24',
      'M16 14 C 12 8 4 8 4 14 C 4 20 12 22 16 18',
      'M16 14 C 20 8 28 8 28 14 C 28 20 20 22 16 18'
    ],
    circles: [{ cx: 16, cy: 10, r: 1, fill: true }]
  },
  Iguana: {
    paths: [
      'M2 18 C 8 16 14 16 18 18 L 26 16 L 30 14',
      'M18 18 L 22 22',
      'M10 18 V 22',
      'M14 18 V 22',
      'M6 13 L 4 11',
      'M10 13 L 9 10'
    ]
  },
  Lagartija: {
    paths: [
      'M2 18 C 8 16 14 16 18 18 L 26 16 L 30 14',
      'M18 18 L 22 22',
      'M10 18 V 22',
      'M14 18 V 22'
    ]
  },
  Topo: {
    paths: [
      'M6 18 L 2 16',
      'M10 22 V 25',
      'M22 22 V 25'
    ],
    ellipses: [{ cx: 16, cy: 18, rx: 10, ry: 6 }],
    circles: [{ cx: 20, cy: 17, r: 0.8, fill: true }]
  },
  Hormiga: {
    paths: [
      'M9 13 L 6 10',
      'M9 13 L 8 9',
      'M16 13 V 6',
      'M16 19 V 24',
      'M9 19 L 6 23',
      'M23 19 L 26 23'
    ],
    circles: [
      { cx: 9, cy: 16, r: 3 },
      { cx: 16, cy: 16, r: 3 },
      { cx: 23, cy: 16, r: 3 }
    ]
  },
  Rana: {
    paths: [
      'M6 22 C 6 16 12 12 16 12 C 20 12 26 16 26 22 Z',
      'M10 12 C 10 9 12 8 13 9',
      'M22 12 C 22 9 20 8 19 9'
    ],
    circles: [
      { cx: 12, cy: 11, r: 1.4 },
      { cx: 20, cy: 11, r: 1.4 }
    ]
  },

  // ---- UI / Tools ----
  Sun: {
    paths: [
      'M16 4 V 8',
      'M16 24 V 28',
      'M4 16 H 8',
      'M24 16 H 28',
      'M7.5 7.5 L 10 10',
      'M22 22 L 24.5 24.5',
      'M7.5 24.5 L 10 22',
      'M22 10 L 24.5 7.5'
    ],
    circles: [{ cx: 16, cy: 16, r: 6 }]
  },
  Drop: {
    paths: [
      'M16 4 C 10 12 6 18 6 22 C 6 27 10 30 16 30 C 22 30 26 27 26 22 C 26 18 22 12 16 4 Z'
    ]
  },
  Mountain: {
    paths: ['M3 26 L 12 12 L 18 20 L 22 14 L 29 26 Z']
  },
  Wind: {
    paths: [
      'M4 12 H 20 C 23 12 23 6 20 6',
      'M4 18 H 26 C 29 18 29 24 26 24',
      'M4 24 H 14'
    ]
  },
  Compass: {
    paths: ['M16 6 L 19 16 L 16 26 L 13 16 Z'],
    circles: [
      { cx: 16, cy: 16, r: 13 }
    ]
  },
  Layers: {
    paths: [
      'M16 4 L 28 11 L 16 18 L 4 11 Z',
      'M4 16 L 16 23 L 28 16',
      'M4 21 L 16 28 L 28 21'
    ]
  },
  Seed: {
    paths: ['M16 8 C 16 4 20 2 24 4'],
    ellipses: [{ cx: 16, cy: 18, rx: 6, ry: 10 }]
  },
  Mic: {
    paths: [
      'M6 16 C 6 22 10 26 16 26 C 22 26 26 22 26 16',
      'M16 26 V 30',
      'M12 30 H 20'
    ],
    rects: [{ x: 12, y: 4, w: 8, h: 16, rx: 4 }]
  },
  Camera: {
    paths: ['M11 9 L 13 5 H 19 L 21 9'],
    rects: [{ x: 3, y: 9, w: 26, h: 18, rx: 2 }],
    circles: [{ cx: 16, cy: 18, r: 5 }]
  },
  Plus: { paths: ['M16 6 V 26 M6 16 H 26'] },
  Close: { paths: ['M8 8 L 24 24 M24 8 L 8 24'] },
  ArrowRight: { paths: ['M6 16 H 26 M20 10 L 26 16 L 20 22'] },
  Cube: {
    paths: [
      'M16 4 L 28 10 V 22 L 16 28 L 4 22 V 10 Z',
      'M16 4 V 16 M16 16 L 4 10 M16 16 L 28 10'
    ]
  },
  Map: {
    paths: [
      'M3 8 L 11 5 L 21 8 L 29 5 V 24 L 21 27 L 11 24 L 3 27 Z',
      'M11 5 V 24 M21 8 V 27'
    ]
  },
  Warning: {
    paths: ['M16 4 L 30 28 H 2 Z', 'M16 13 V 20'],
    circles: [{ cx: 16, cy: 24, r: 0.8, fill: true }]
  },
  Sparkle: {
    paths: ['M16 4 L 18 14 L 28 16 L 18 18 L 16 28 L 14 18 L 4 16 L 14 14 Z']
  },
  Settings: {
    paths: ['M16 2 V 6 M16 26 V 30 M2 16 H 6 M26 16 H 30 M6 6 L 9 9 M23 23 L 26 26 M6 26 L 9 23 M23 9 L 26 6'],
    circles: [{ cx: 16, cy: 16, r: 4 }]
  },
  Book: {
    paths: [
      'M5 5 H 14 C 16 5 16 7 16 8 V 27 C 16 26 14 25 12 25 H 5 Z',
      'M27 5 H 18 C 16 5 16 7 16 8 V 27 C 16 26 18 25 20 25 H 27 Z'
    ]
  },
  Box: {
    paths: ['M4 9 L 16 4 L 28 9 V 23 L 16 28 L 4 23 Z', 'M4 9 L 16 14 L 28 9', 'M16 14 V 28']
  },
  Moon: {
    paths: ['M22 6 C 16 6 12 10 12 16 C 12 22 16 26 22 26 C 18 22 16 19 16 16 C 16 13 18 10 22 6 Z']
  },
  Chart: {
    paths: ['M5 27 H 27', 'M9 27 V 19', 'M15 27 V 12', 'M21 27 V 16', 'M27 27 V 8']
  },
  People: {
    paths: [
      'M5 26 C 5 22 7 19 11 19 C 15 19 17 22 17 26',
      'M16 26 C 16 22 19 19 22 19 C 26 19 27 22 27 26',
      'M11 14 A 4 4 0 0 1 11 6 A 4 4 0 0 1 11 14',
      'M22 14 A 3 3 0 0 1 22 8 A 3 3 0 0 1 22 14'
    ]
  },
  Help: {
    paths: ['M11 12 C 11 8 14 6 16 6 C 19 6 21 8 21 11 C 21 14 16 14 16 18'],
    circles: [
      { cx: 16, cy: 16, r: 13 },
      { cx: 16, cy: 23, r: 0.9, fill: true }
    ]
  },
  Trash: {
    paths: [
      'M5 8 H 27',
      'M9 8 V 26 H 23 V 8',
      'M12 8 V 5 H 20 V 8',
      'M13 12 V 22',
      'M19 12 V 22'
    ]
  },
  Pin: {
    paths: ['M16 4 C 11 4 7 8 7 13 C 7 19 16 28 16 28 C 16 28 25 19 25 13 C 25 8 21 4 16 4 Z'],
    circles: [{ cx: 16, cy: 13, r: 3 }]
  },
  Check: { paths: ['M5 17 L 12 24 L 27 8'] },
  Reset: {
    paths: ['M5 14 A 11 11 0 1 1 6 22', 'M5 8 V 14 H 11']
  },
  Wave: {
    paths: ['M3 16 Q 8 10 13 16 T 23 16 T 29 16']
  },
  List: {
    paths: ['M9 8 H 27', 'M9 16 H 27', 'M9 24 H 27'],
    circles: [
      { cx: 5, cy: 8, r: 1 },
      { cx: 5, cy: 16, r: 1 },
      { cx: 5, cy: 24, r: 1 }
    ]
  },
  Basket: {
    paths: [
      'M6 12 L 10 26 H 22 L 26 12 Z',
      'M6 12 L 16 4 L 26 12'
    ]
  },
  Gear: {
    paths: [
      'M16 3 L18 7 L22 5.5 L21 10 L25 11 L22 14 L25 17 L21 18 L22 22 L18 21 L16 25 L14 21 L10 22 L11 18 L7 17 L10 14 L7 11 L11 10 L10 5.5 L14 7 Z'
    ],
    circles: [{ cx: 16, cy: 14, r: 4 }]
  },
  ChevronDown: {
    paths: ['M8 12 L16 20 L24 12']
  }
};
