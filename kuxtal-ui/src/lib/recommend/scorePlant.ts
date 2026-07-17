import { tr, type TranslationKey } from '../i18n/translate';
import { stratumName } from '../permaculture/engine';
import { plantFitsUsdaZone } from '../climate/hardiness';
import { speciesMatchesBioregion } from '../climate/region';
import { haversineMeters } from '../map/geometry';
import { allNormalizedPlants, type NormalizedPlant } from '../pfaf/pfafSchema';
import type { Goal } from '../permaculture/types';
import { challengeFit, budgetFit, goalFit, moistureFit, soilFit, sunRequirement, sunSiteFit } from './fieldMap';
import { EMPTY_RULE_INDEX, type CanvasState, type EngineSite, type PlacedPlant, type RuleIndex, type ScoreBreakdown } from './types';

const WEIGHTS = {
  climateFit: 30,
  moistureFit: 20,
  soilFit: 15,
  goalFit: 18,
  sunFit: 8,
  layerGap: 15,
  functionGap: 10,
  companion: 10,
  conflict: 25,
  invasive: 40,
  challengeFit: 12,
  budgetFit: 6
} as const;

const GOAL_REASON: Record<string, TranslationKey> = {
  alimento: 'rec_goal_alimento',
  medicinal: 'rec_goal_medicinal',
  'sanar-suelo': 'rec_goal_sanar_suelo',
  biodiversidad: 'rec_goal_biodiversidad',
  comercio: 'rec_goal_comercio'
};

const NEIGHBOR_RADIUS_M = 30;
const COMPANION_CAP = 3;

function ineligible(reason: string): ScoreBreakdown {
  return {
    total: -Infinity,
    climateFit: 0, moistureFit: 0, soilFit: 0, goalFit: 0, sunFit: 0, layerGap: 0,
    functionGap: 0, companion: 0, conflict: 0, invasive: 0, challengeFit: 0, budgetFit: 0,
    eligible: false, reasons: [reason]
  };
}

function relevantNeighbors(canvas: CanvasState): PlacedPlant[] {
  const pt = canvas.candidatePoint;
  if (!pt) return canvas.placed;
  return canvas.placed.filter(
    (p) => haversineMeters({ lat: pt.lat, lng: pt.lng }, { lat: p.lat, lng: p.lng }) <= NEIGHBOR_RADIUS_M
  );
}

/** Returns a localized reason string if the plant is disqualified, else null. */
function disqualify(p: NormalizedPlant, site: EngineSite): string | null {
  if (site.usdaZone != null && !plantFitsUsdaZone(p.hard, site.usdaZone, !!p.annual)) {
    return tr('rec_dq_cold', { zone: String(site.usdaZone) });
  }
  if (p.frostTender && (site.frostRisk === true || site.climate === 'frio')) {
    return tr('rec_dq_frost');
  }
  if (site.sun === 'shade' && sunRequirement(p.sun) === 'full') {
    return tr('rec_dq_shade');
  }
  return null;
}

/** The first onboarding goal this plant fully satisfies, as a reason string. */
function matchedGoalReason(p: NormalizedPlant, goals: Goal[] | undefined): string | null {
  if (!goals?.length) return null;
  const g = goals.find((goal) => GOAL_REASON[goal] && goalFit(p, [goal]) === 1);
  return g ? tr(GOAL_REASON[g]) : null;
}

function countCompanionConflict(
  sci: string,
  canvas: CanvasState,
  ruleIndex: RuleIndex
): { companion: number; conflict: number } {
  const companions = ruleIndex.companions.get(sci);
  const antagonists = ruleIndex.antagonists.get(sci);
  if (!companions && !antagonists) return { companion: 0, conflict: 0 };
  let companion = 0;
  let conflict = 0;
  for (const n of relevantNeighbors(canvas)) {
    if (!n.sci) continue;
    if (companions?.has(n.sci)) companion++;
    if (antagonists?.has(n.sci)) conflict++;
  }
  return {
    companion: Math.min(COMPANION_CAP, companion),
    conflict: Math.min(COMPANION_CAP, conflict)
  };
}

/** Score one plant for a site + current canvas. Pure & synchronous. */
export function scorePlant(
  p: NormalizedPlant,
  site: EngineSite,
  canvas: CanvasState,
  ruleIndex: RuleIndex
): ScoreBreakdown {
  const dq = disqualify(p, site);
  if (dq) return ineligible(dq);

  const reasons: string[] = [];

  // ---- climateFit (0..1) ----
  let climate = 0.5;
  const inBio = site.bioregion ? speciesMatchesBioregion(p.regions ?? [], site.bioregion) : false;
  if (inBio) { climate += 0.3; reasons.push(tr('rec_reason_bioregion')); }
  if (p.origin === 'native') { climate += 0.2; reasons.push(tr('rec_reason_native')); }
  climate = Math.min(1, climate);

  // ---- moistureFit / soilFit ----
  const moisture = moistureFit(p.moisture, site.moisture);
  const soil = soilFit(p.soil, site.soil);

  // ---- onboarding intent: goals + site-wide sun ----
  const goal = goalFit(p, site.goals);
  const sun = sunSiteFit(p.sun, site.sunExposure);
  const goalReason = matchedGoalReason(p, site.goals);
  if (goalReason) reasons.push(goalReason);

  // ---- layer gap (reward filling an empty stratum) ----
  const layerCount = canvas.layerCounts[p.layer] ?? 0;
  const layerGap = 1 / (1 + layerCount);
  if (layerCount === 0) reasons.push(tr('rec_reason_layer', { layer: stratumName(p.layer) }));

  // ---- function gap ----
  const functionGap = p.fns.length
    ? p.fns.reduce((acc, fn) => acc + 1 / (1 + (canvas.functionCounts[fn] ?? 0)), 0) / p.fns.length
    : 0;
  if (p.fns.includes('nitrogen-fixer') && (canvas.functionCounts['nitrogen-fixer'] ?? 0) === 0) {
    reasons.push(tr('rec_reason_nfixer'));
  }

  // ---- companion / conflict via scientific name ----
  const { companion, conflict } = countCompanionConflict(p.sci.toLowerCase(), canvas, ruleIndex);
  if (companion > 0) reasons.push(tr('rec_reason_companion'));
  if (conflict > 0) reasons.push(tr('rec_reason_conflict'));

  // ---- invasive penalty (only outside its native bioregion) ----
  const invasive = p.invasive && !inBio ? 1 : 0;
  if (invasive) reasons.push(tr('rec_reason_invasive'));

  // ---- onboarding context: challenges + budget ----
  const challenge = challengeFit(p, site.challenges);
  const budget = budgetFit(p, site.budget);
  if (challenge > 0.7 && (site.challenges?.length ?? 0) > 0) {
    reasons.push(tr('rec_reason_challenges'));
  }
  if (budget > 0.7 && site.budget === 'ninguno') {
    reasons.push(tr('rec_reason_propagate'));
  }

  const total =
    climate * WEIGHTS.climateFit +
    moisture * WEIGHTS.moistureFit +
    soil * WEIGHTS.soilFit +
    goal * WEIGHTS.goalFit +
    sun * WEIGHTS.sunFit +
    layerGap * WEIGHTS.layerGap +
    functionGap * WEIGHTS.functionGap +
    companion * WEIGHTS.companion -
    conflict * WEIGHTS.conflict -
    invasive * WEIGHTS.invasive +
    challenge * WEIGHTS.challengeFit +
    budget * WEIGHTS.budgetFit;

  return {
    total,
    climateFit: climate * WEIGHTS.climateFit,
    moistureFit: moisture * WEIGHTS.moistureFit,
    soilFit: soil * WEIGHTS.soilFit,
    goalFit: goal * WEIGHTS.goalFit,
    sunFit: sun * WEIGHTS.sunFit,
    layerGap: layerGap * WEIGHTS.layerGap,
    functionGap: functionGap * WEIGHTS.functionGap,
    companion: companion * WEIGHTS.companion,
    conflict: -conflict * WEIGHTS.conflict,
    invasive: -invasive * WEIGHTS.invasive,
    challengeFit: challenge * WEIGHTS.challengeFit,
    budgetFit: budget * WEIGHTS.budgetFit,
    eligible: true,
    reasons
  };
}

export type Recommendation = { plant: NormalizedPlant; score: ScoreBreakdown };

export type RecommendOptions = {
  site: EngineSite;
  canvas: CanvasState;
  ruleIndex?: RuleIndex;
  pool?: NormalizedPlant[];
  limit?: number;
};

/** Rank the plant pool for the given site + canvas, eligible plants only. */
export function recommendPlants(opts: RecommendOptions): Recommendation[] {
  const pool = opts.pool ?? allNormalizedPlants();
  const ruleIndex = opts.ruleIndex ?? EMPTY_RULE_INDEX;
  const out: Recommendation[] = [];
  for (const plant of pool) {
    const score = scorePlant(plant, opts.site, opts.canvas, ruleIndex);
    if (score.eligible) out.push({ plant, score });
  }
  out.sort((a, b) => b.score.total - a.score.total);
  return typeof opts.limit === 'number' ? out.slice(0, opts.limit) : out;
}
