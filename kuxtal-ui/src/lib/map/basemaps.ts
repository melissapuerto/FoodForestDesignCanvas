/**
 * Basemap style specifications and the zone colour palette — pure map styling,
 * extracted from MapCanvas.svelte (Use Small and Slow Solutions: shrink the
 * oversize core; keep the pure, testable parts out of the component).
 *
 * All tiles come from OpenStreetMap / Esri; glyphs from the MapLibre demo font
 * server. No API keys, consistent with "FOSS-only, no proprietary services in
 * the runtime path" (the tile hosts are the documented online dependency).
 */
export type Basemap = 'streets' | 'satellite' | 'paper' | 'blank';

const GLYPHS = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';

/** Muted, paper-toned OSM raster — the codex default. */
export const PAPER_STYLE: any = {
  version: 8,
  sources: {
    paper: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap'
    }
  },
  layers: [
    { id: 'paper-bg', type: 'background', paint: { 'background-color': '#F1ECDD' } },
    {
      id: 'paper-osm',
      type: 'raster',
      source: 'paper',
      paint: {
        'raster-saturation': -0.55,
        'raster-contrast': -0.05,
        'raster-brightness-min': 0.18,
        'raster-brightness-max': 0.95,
        'raster-opacity': 0.7
      }
    }
  ],
  glyphs: GLYPHS
};

export const STREETS_STYLE: any = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap'
    }
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  glyphs: GLYPHS
};

export const SATELLITE_STYLE: any = {
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Tiles © Esri'
    }
  },
  layers: [{ id: 'esri', type: 'raster', source: 'esri' }],
  glyphs: GLYPHS
};

/** Offline / "Canvas" mode — a blank paper background, no network tiles. */
export const BLANK_STYLE: any = {
  version: 8,
  sources: {},
  layers: [{ id: 'blank-bg', type: 'background', paint: { 'background-color': '#FAF8F2' } }],
  glyphs: GLYPHS
};

/** Select the MapLibre style object for a basemap choice. */
export function styleFor(b: Basemap): any {
  if (b === 'blank') return BLANK_STYLE;
  if (b === 'satellite') return SATELLITE_STYLE;
  if (b === 'streets') return STREETS_STYLE;
  return PAPER_STYLE;
}

/** Zone fill palette — Z1 deep ocre → Z5 jade (codex tones). */
export function zoneTone(zn: number | null): string {
  if (zn === 1) return '#D6A87A';
  if (zn === 2) return '#C7894C';
  if (zn === 3) return '#9CA47B';
  if (zn === 4) return '#7C9F88';
  if (zn === 5) return '#5B8F76';
  return '#C7B58A';
}

/** Zone outline palette (darker than the fill). */
export function zoneLineTone(zn: number | null): string {
  if (zn === 1) return '#A85D2A';
  if (zn === 2) return '#8C5421';
  if (zn === 3) return '#5C6E3A';
  if (zn === 4) return '#3F6F4F';
  if (zn === 5) return '#2D5A48';
  return '#6B5340';
}
