import { tr, type TranslationKey } from '../i18n/translate';
import type { Bioregion } from '../climate/region';
import { allNormalizedPlants, type NormalizedPlant, type PlantFunction, type PlantLayer } from '../pfaf/pfafSchema';
import { scorePlant, recommendPlants } from './scorePlant';
import { EMPTY_RULE_INDEX, type CanvasState, type EngineSite, type RuleIndex } from './types';

export type GuildRole =
  | 'canopy' | 'sub-canopy' | 'n-fixer' | 'shrub'
  | 'groundcover' | 'vine' | 'accumulator' | 'herb' | 'staple';

export type GuildMember = { role: GuildRole; speciesIds: string[]; count?: number };

export type Guild = {
  id: string;
  bioregion: Bioregion;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  members: GuildMember[];
};

const ROLE_KEYS: Record<GuildRole, TranslationKey> = {
  canopy: 'guild_role_canopy',
  'sub-canopy': 'guild_role_subcanopy',
  'n-fixer': 'guild_role_nfixer',
  shrub: 'guild_role_shrub',
  groundcover: 'guild_role_groundcover',
  vine: 'guild_role_vine',
  accumulator: 'guild_role_accumulator',
  herb: 'guild_role_herb',
  staple: 'guild_role_staple'
};

/** Localized label for a guild role. */
export function roleLabel(role: GuildRole): string {
  return tr(ROLE_KEYS[role]);
}

/** Localized guild name / description. */
export function guildName(g: Guild): string {
  return tr(g.nameKey);
}
export function guildDescription(g: Guild): string {
  return tr(g.descKey);
}

/** Curated starter guilds. speciesIds are ordered by preference (first eligible wins). */
export const GUILDS: Guild[] = [
  {
    id: 'guild-temperate-orchard', bioregion: 'temperate', nameKey: 'guild_temperate_orchard_name',
    descKey: 'guild_temperate_orchard_desc',
    members: [
      { role: 'canopy', speciesIds: ['pfaf-1', 'pfaf-2'] },
      { role: 'n-fixer', speciesIds: ['pfaf-21'] },
      { role: 'shrub', speciesIds: ['pfaf-5', 'pfaf-7'] },
      { role: 'groundcover', speciesIds: ['pfaf-22'] },
      { role: 'vine', speciesIds: ['pfaf-24'] },
      { role: 'accumulator', speciesIds: ['pfaf-16'] }
    ]
  },
  {
    id: 'guild-nordic-berry', bioregion: 'nordic', nameKey: 'guild_nordic_berry_name',
    descKey: 'guild_nordic_berry_desc',
    members: [
      { role: 'canopy', speciesIds: ['pfaf-2', 'pfaf-1'] },
      { role: 'shrub', speciesIds: ['pfaf-7', 'pfaf-5', 'pfaf-6'] },
      { role: 'sub-canopy', speciesIds: ['pfaf-4'] },
      { role: 'accumulator', speciesIds: ['pfaf-16'] }
    ]
  },
  {
    id: 'guild-mediterranean', bioregion: 'mediterranean', nameKey: 'guild_mediterranean_name',
    descKey: 'guild_mediterranean_desc',
    members: [
      { role: 'canopy', speciesIds: ['pfaf-26', 'pfaf-25'] },
      { role: 'shrub', speciesIds: ['pfaf-23'] },
      { role: 'vine', speciesIds: ['pfaf-24'] },
      { role: 'n-fixer', speciesIds: ['pfaf-21'] }
    ]
  },
  {
    id: 'guild-mesoamerica-milpa', bioregion: 'mesoamerica', nameKey: 'guild_mesoamerica_milpa_name',
    descKey: 'guild_mesoamerica_milpa_desc',
    members: [
      { role: 'canopy', speciesIds: ['pfaf-540', 'pfaf-28', 'pfaf-544', 'pfaf-547'] },
      { role: 'n-fixer', speciesIds: ['pfaf-253', 'pfaf-542', 'pfaf-252', 'pfaf-38', 'pfaf-39'] },
      { role: 'sub-canopy', speciesIds: ['pfaf-541', 'pfaf-31', 'pfaf-30', 'pfaf-549'] },
      { role: 'groundcover', speciesIds: ['pfaf-22', 'pfaf-19'] },
      { role: 'vine', speciesIds: ['pfaf-20', 'pfaf-21'] },
      { role: 'herb', speciesIds: ['pfaf-275', 'pfaf-37'] }
    ]
  },
  {
    id: 'guild-tropical-agroforest', bioregion: 'tropical', nameKey: 'guild_tropical_agroforest_name',
    descKey: 'guild_tropical_agroforest_desc',
    members: [
      { role: 'canopy', speciesIds: ['pfaf-447', 'pfaf-38', 'pfaf-252'] },
      { role: 'sub-canopy', speciesIds: ['pfaf-30', 'pfaf-33', 'pfaf-172'] },
      { role: 'shrub', speciesIds: ['pfaf-32', 'pfaf-31'] },
      { role: 'n-fixer', speciesIds: ['pfaf-275', 'pfaf-253'] },
      { role: 'staple', speciesIds: ['pfaf-34', 'pfaf-19'] }
    ]
  },
  {
    id: 'guild-andes', bioregion: 'andes', nameKey: 'guild_andes_name',
    descKey: 'guild_andes_desc',
    members: [
      { role: 'canopy', speciesIds: ['pfaf-39', 'pfaf-596'] },
      { role: 'n-fixer', speciesIds: ['pfaf-21', 'pfaf-275'] },
      { role: 'staple', speciesIds: ['pfaf-9', 'pfaf-40'] },
      { role: 'herb', speciesIds: ['pfaf-588', 'pfaf-36'] }
    ]
  },
  {
    id: 'guild-subtropical', bioregion: 'subtropical', nameKey: 'guild_subtropical_name',
    descKey: 'guild_subtropical_desc',
    members: [
      { role: 'canopy', speciesIds: ['pfaf-27'] },
      { role: 'n-fixer', speciesIds: ['pfaf-21'] },
      { role: 'herb', speciesIds: ['pfaf-36', 'pfaf-35'] }
    ]
  }
];

const ROLE_LAYER: Partial<Record<GuildRole, PlantLayer>> = {
  canopy: 'canopy', 'sub-canopy': 'sub-canopy', shrub: 'shrub',
  groundcover: 'groundcover', vine: 'vine', herb: 'herb', staple: 'root'
};
const ROLE_FUNCTION: Partial<Record<GuildRole, PlantFunction>> = {
  'n-fixer': 'nitrogen-fixer', accumulator: 'dynamic-accumulator'
};

export type RealizedMember = { role: GuildRole; plant: NormalizedPlant; fallback: boolean };

/** Guilds whose bioregion matches the site. */
export function pickGuildForSite(site: EngineSite): Guild[] {
  if (!site.bioregion) return [];
  return GUILDS.filter((g) => g.bioregion === site.bioregion);
}

/**
 * Resolve each guild role to a concrete, site-eligible species. Preferred ids
 * win; if none are eligible at this site, fall back to the engine's best plant
 * for that role's layer/function so the guild still completes.
 */
export function realizeGuild(
  guild: Guild,
  site: EngineSite,
  canvas: CanvasState,
  ruleIndex: RuleIndex = EMPTY_RULE_INDEX
): RealizedMember[] {
  const byId = new Map(allNormalizedPlants().map((p) => [p.id, p]));
  const out: RealizedMember[] = [];

  for (const member of guild.members) {
    const preferred = member.speciesIds
      .map((id) => byId.get(id))
      .find((p): p is NormalizedPlant => !!p && scorePlant(p, site, canvas, ruleIndex).eligible);

    if (preferred) {
      out.push({ role: member.role, plant: preferred, fallback: false });
      continue;
    }

    const wantLayer = ROLE_LAYER[member.role];
    const wantFn = ROLE_FUNCTION[member.role];
    const ranked = recommendPlants({ site, canvas, ruleIndex });
    const sub = ranked.find(({ plant }) =>
      (wantLayer ? plant.layer === wantLayer : true) &&
      (wantFn ? plant.fns.includes(wantFn) : true)
    );
    if (sub) out.push({ role: member.role, plant: sub.plant, fallback: true });
  }

  return out;
}
