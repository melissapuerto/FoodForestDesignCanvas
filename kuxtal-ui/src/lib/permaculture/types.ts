// Food-forest 7 strata + permaculture zones 1–5.
// Inputs come from the wizard; outputs are a structured plan the canvas + Settings can render.

import { tr, type TranslationKey } from '../i18n/translate';

export type ClimateProfile =
  | 'tropical-humedo'
  | 'tropical-seco'
  | 'subtropical'
  | 'templado'
  | 'frio'
  | 'desconocido';

export type SunExposure = 'completo' | 'parcial' | 'sombra' | 'mixto';
export type WaterAccess = 'lluvia' | 'pozo' | 'rio' | 'limitada' | 'nada';
export type AreaUnit =
  | 'm2'
  | 'km2'
  | 'ha'
  | 'acre'
  | 'manzana'
  | 'fanegada'
  | 'cuadra'
  | 'tarea'
  | 'cuerda'
  | 'yard2'
  | 'ft2'
  | 'vara2';

export type Goal = 'alimento' | 'medicinal' | 'sanar-suelo' | 'comercio' | 'biodiversidad';

export type WizardInputs = {
  parcelName: string;
  location: string;
  lat: number | null;
  lng: number | null;
  areaValue: number;
  areaUnit: AreaUnit;
  climate: ClimateProfile;
  sunExposure: SunExposure;
  waterAccess: WaterAccess;
  region: string;
  microclimates: string[];
  soil: string;
  humidity: string;
  altitude: string;
  goals: Goal[];
  challenges?: string[];
  budget?: string;
};

export type StratumId =
  | 'canopy'
  | 'sub-canopy'
  | 'shrub'
  | 'herb'
  | 'groundcover'
  | 'vine'
  | 'root';

export type Stratum = {
  id: StratumId;
  name: string;
  role: string;
  speciesIds: string[];
};

export type ZoneNumber = 1 | 2 | 3 | 4 | 5;

export type ZoneProposal = {
  zone: ZoneNumber;
  name: string;
  intent: string;
  ringRadiusM: number;
  areaPercent: number;
  density: 'alta' | 'media' | 'baja';
  suggestedSpecies: string[];
  notes: string;
};

export type Plan = {
  inputs: WizardInputs;
  totalAreaM2: number;
  zones: ZoneProposal[];
  strata: Stratum[];
  generatedAt: string;
  warnings: string[];
};

// All factors are in m². For "Otro" / unknown values, callers fall back to 1 m².
export const AREA_FACTOR: Record<AreaUnit, number> = {
  m2: 1,
  km2: 1_000_000,
  ha: 10_000,
  acre: 4046.86,
  manzana: 7000,    // ~7 000 m² (Centroamérica)
  fanegada: 6400,   // ~64 áreas (Colombia)
  cuadra: 10_000,   // ~1 ha (Cono Sur)
  tarea: 628.86,    // ~628.86 m² (República Dominicana)
  cuerda: 3930.4,   // ~3 930 m² (Puerto Rico)
  yard2: 0.836127,
  ft2: 0.092903,
  vara2: 0.6987     // ~0.7 m² (vara castellana)
};

export const AREA_UNITS: AreaUnit[] = [
  'm2', 'km2', 'ha', 'acre', 'manzana', 'fanegada', 'cuadra', 'tarea', 'cuerda', 'yard2', 'ft2', 'vara2'
];

/** Localized display label for an area unit. */
export function areaLabel(unit: AreaUnit): string {
  return tr(`area_${unit}` as TranslationKey);
}

/** Localized label for a zone's planting density. */
export function densityLabel(d: 'alta' | 'media' | 'baja'): string {
  return tr(`density_${d}` as TranslationKey);
}

export function toM2(value: number, unit: AreaUnit): number {
  return value * AREA_FACTOR[unit];
}

export function fromM2(m2: number, unit: AreaUnit): number {
  return m2 / AREA_FACTOR[unit];
}
