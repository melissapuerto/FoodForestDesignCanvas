import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { ensureLocaleLoaded, setPlainLocale } from '../../src/lib/i18n/translate';

// The English dictionary is a lazy chunk in production; load it once so the
// synchronous locale flips below behave like a running app that has it cached.
beforeAll(() => ensureLocaleLoaded('en'));
import { localSpeciesName, localAnimalName, localPfafField, localRuleMessage } from '../../src/lib/i18n/dataLocal';
import { scorePlant } from '../../src/lib/recommend/scorePlant';
import { suggestPlan } from '../../src/lib/permaculture/engine';
import { allNormalizedPlants } from '../../src/lib/pfaf/pfafSchema';
import { EMPTY_RULE_INDEX, type CanvasState, type EngineSite } from '../../src/lib/recommend/types';
import type { WizardInputs } from '../../src/lib/permaculture/types';

// The engine builds user-facing strings (scoring reasons, zone names, plan
// warnings) inside plain TS, away from the Svelte i18n store. These guard that
// it goes through the dictionaries rather than emitting hardcoded Spanish.

const emptyCanvas: CanvasState = { placed: [], layerCounts: {}, functionCounts: {} };

const tropicalSite: EngineSite = {
  lat: 20.9, lng: -89.6, bioregion: 'mesoamerica', usdaZone: 11,
  climate: 'tropical-humedo', moisture: 'medium', soil: null
};

// A cold site disqualifies a tropical plant, which exercises the reason strings.
const coldSite: EngineSite = {
  lat: 60, lng: 10, bioregion: 'nordic', usdaZone: 5,
  climate: 'frio', moisture: 'medium', soil: null
};

const wizardInputs: WizardInputs = {
  parcelName: 'Test', location: '', lat: 20.9, lng: -89.6,
  areaValue: 1, areaUnit: 'ha', climate: 'tropical-humedo',
  sunExposure: 'mixto', waterAccess: 'lluvia', region: '',
  microclimates: [], soil: '', humidity: '', altitude: '', goals: []
};

function mango() {
  const p = allNormalizedPlants().find((x) => x.sci === 'Mangifera indica');
  if (!p) throw new Error('fixture plant missing');
  return p;
}

afterEach(() => setPlainLocale('es'));

describe('recommendation engine reasons follow the locale', () => {
  it('gives the disqualification reason in the active locale', () => {
    setPlainLocale('es');
    const es = scorePlant(mango(), coldSite, emptyCanvas, EMPTY_RULE_INDEX);
    expect(es.eligible).toBe(false);
    expect(es.reasons[0]).toContain('No resiste el frío');

    setPlainLocale('en');
    const en = scorePlant(mango(), coldSite, emptyCanvas, EMPTY_RULE_INDEX);
    expect(en.eligible).toBe(false);
    expect(en.reasons[0]).toContain('Cannot survive the cold');
    expect(en.reasons[0]).not.toMatch(/[áéíóúñ¿¡]/);
  });

  it('gives scoring reasons for an eligible plant in English', () => {
    setPlainLocale('en');
    const score = scorePlant(mango(), tropicalSite, emptyCanvas, EMPTY_RULE_INDEX);
    expect(score.eligible).toBe(true);
    expect(score.reasons.length).toBeGreaterThan(0);
    for (const r of score.reasons) expect(r).not.toMatch(/[áéíóúñ¿¡]/);
  });
});

describe('plan zones and strata follow the locale', () => {
  it('names zones and strata in English', () => {
    setPlainLocale('en');
    const plan = suggestPlan(wizardInputs);
    expect(plan.zones.length).toBeGreaterThan(0);
    expect(plan.zones[0].name).toBe('Living kitchen');
    for (const z of plan.zones) {
      expect(z.name).not.toMatch(/[áéíóúñ]/);
      expect(z.notes).not.toMatch(/[áéíóúñ]/);
    }
    for (const s of plan.strata) expect(s.role).not.toMatch(/[áéíóúñ]/);
  });

  it('names them in Spanish when the locale is Spanish', () => {
    setPlainLocale('es');
    const plan = suggestPlan(wizardInputs);
    expect(plan.zones[0].name).toBe('Cocina viva');
  });
});

describe('seeded rules are localized, user rules are not', () => {
  const seeded = {
    entity_a: 'maiz', entity_b: 'frijol',
    entity_a_kind: 'plant', entity_b_kind: 'plant',
    relationship: 'companion',
    message: 'Maíz y Fríjol suelen ayudarse cuando comparten espacio.',
    is_user_owned: false
  };

  it('rebuilds a seeded rule from the template in English', () => {
    setPlainLocale('en');
    const msg = localRuleMessage(seeded);
    expect(msg).toBe('Maize / Corn and Common bean tend to help each other when they share space.');
    expect(msg).not.toMatch(/[áéíóúñ]/);
  });

  it('keeps the Spanish text when the locale is Spanish', () => {
    setPlainLocale('es');
    expect(localRuleMessage(seeded)).toContain('Maíz');
    expect(localRuleMessage(seeded)).toContain('suelen ayudarse');
  });

  it('never rewrites a rule the user wrote', () => {
    setPlainLocale('en');
    const mine = { ...seeded, is_user_owned: true, message: 'Mi abuela dice que se ayudan.' };
    expect(localRuleMessage(mine)).toBe('Mi abuela dice que se ayudan.');
  });
});

describe('catalog data is localized at display time', () => {
  it('translates seeded species and animal names, and leaves user data alone', () => {
    setPlainLocale('en');
    expect(localSpeciesName('Aguacate', 'Persea americana')).toBe('Avocado');
    expect(localAnimalName('lombriz', 'Lombriz')).toBe('Earthworm');
    expect(localPfafField('Pleno sol')).toBe('Full sun');
    // A species the user added themselves is unknown to the map: shown as typed.
    expect(localSpeciesName('Mi planta', 'Planta inventada')).toBe('Mi planta');

    setPlainLocale('es');
    expect(localSpeciesName('Aguacate', 'Persea americana')).toBe('Aguacate');
    expect(localAnimalName('lombriz', 'Lombriz')).toBe('Lombriz');
  });
});
