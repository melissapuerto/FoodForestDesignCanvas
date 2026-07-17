// Standalone logic check for the recommendation engine (no DB / DOM).
// Bundle with esbuild then run with node — see the npm command in the PR notes.
import { recommendPlants, scorePlant } from '../src/lib/recommend/scorePlant';
import { allNormalizedPlants } from '../src/lib/pfaf/pfafSchema';
import { EMPTY_RULE_INDEX, type CanvasState, type EngineSite } from '../src/lib/recommend/types';

let failures = 0;
function check(label: string, cond: boolean): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) failures++;
}

const emptyCanvas: CanvasState = { placed: [], layerCounts: {}, functionCounts: {} };
const byId = new Map(allNormalizedPlants().map((p) => [p.id, p]));

// ── Temperate site (lat 46 → USDA 7) ──
const temperate: EngineSite = {
  lat: 46, lng: 7, bioregion: 'temperate', usdaZone: 7, climate: 'templado', moisture: 'medium', soil: null
};
const tempRanked = recommendPlants({ site: temperate, canvas: emptyCanvas, limit: 100 });
const tempIds = new Set(tempRanked.map((r) => r.plant.id));
check('temperate: returns recommendations', tempRanked.length > 0);
check('temperate: Mango (hard 11) is filtered out as ineligible', !tempIds.has('pfaf-29'));
check('temperate: Frambuesa (temperate native shrub) is eligible', tempIds.has('pfaf-5'));

const mango = byId.get('pfaf-29')!;
check('temperate: scorePlant(Mango) reports ineligible', !scorePlant(mango, temperate, emptyCanvas, EMPTY_RULE_INDEX).eligible);

// ── Mesoamerica site (lat 20.96 → USDA 11) ──
const meso: EngineSite = {
  lat: 20.96, lng: -89.62, bioregion: 'mesoamerica', usdaZone: 11, climate: 'tropical-humedo', moisture: 'medium', soil: null
};
const guamo = byId.get('pfaf-38')!;     // Inga edulis, Fabaceae n-fixer, mesoamerica
const manzano = byId.get('pfaf-1')!;    // apple — eligible at z11 but wrong bioregion
const guamoScore = scorePlant(guamo, meso, emptyCanvas, EMPTY_RULE_INDEX);
const manzanoScore = scorePlant(manzano, meso, emptyCanvas, EMPTY_RULE_INDEX);
check('mesoamerica: Guamo eligible', guamoScore.eligible);
check('mesoamerica: Guamo (native n-fixer) outranks Manzano (off-region)', guamoScore.total > manzanoScore.total);
check('mesoamerica: Guamo derived as nitrogen-fixer', guamo.fns.includes('nitrogen-fixer'));

// ── Layer-gap: with the shrub layer already filled, an empty stratum wins ──
const shrubCanvas: CanvasState = { placed: [], layerCounts: { shrub: 1 }, functionCounts: {} };
const frambuesa = byId.get('pfaf-5')!;  // shrub (now the occupied layer)
const manzanoTemp = byId.get('pfaf-1')!; // sub-canopy (empty layer)
const fScore = scorePlant(frambuesa, temperate, shrubCanvas, EMPTY_RULE_INDEX);
const mScore = scorePlant(manzanoTemp, temperate, shrubCanvas, EMPTY_RULE_INDEX);
check('layer-gap: empty stratum layerGap > already-filled shrub layerGap', mScore.layerGap > fScore.layerGap);

// ── Companion synergy via scientific name bridge ──
const ruleIndex = {
  companions: new Map([['inga edulis', new Set(['coffea arabica'])]]),
  antagonists: new Map<string, Set<string>>()
};
const cafePlaced: CanvasState = {
  placed: [{ speciesId: 'pfaf-31', sci: 'coffea arabica', lat: 20.96, lng: -89.62, layer: 'shrub', fns: ['edible'] }],
  layerCounts: { shrub: 1 }, functionCounts: { edible: 1 }
};
const withCompanion = scorePlant(guamo, meso, cafePlaced, ruleIndex);
check('companion: Guamo gets a companion bonus next to Café', withCompanion.companion > 0);

// ── Onboarding goals bias the score ──
const consuelda = byId.get('pfaf-16')!; // comfrey: med 5, edible 2 (medicinal/accumulator)
const medSite: EngineSite = { ...temperate, goals: ['medicinal'] };
const foodSite: EngineSite = { ...temperate, goals: ['alimento'] };
const medScore = scorePlant(consuelda, medSite, emptyCanvas, EMPTY_RULE_INDEX);
const foodScore = scorePlant(consuelda, foodSite, emptyCanvas, EMPTY_RULE_INDEX);
check('onboarding: medicinal goal scores Consuelda higher than food goal', medScore.total > foodScore.total);
check('onboarding: medicinal goal yields goalFit bonus', medScore.goalFit > 0 && foodScore.goalFit === 0);

// ── Performance ──
const t0 = performance.now();
for (let i = 0; i < 50; i++) recommendPlants({ site: meso, canvas: emptyCanvas });
const ms = (performance.now() - t0) / 50;
check(`performance: full pool ranked in < 5ms (got ${ms.toFixed(2)}ms)`, ms < 5);

console.log(failures === 0 ? '\nALL ENGINE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
