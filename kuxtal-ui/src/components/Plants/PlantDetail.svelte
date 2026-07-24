<script lang="ts">
  /**
   * The expanded body of a plant row (details, provenance, companion rules,
   * add-to-canvas). Extracted from PlantGuide.svelte.
   */
  import type { SpeciesRow } from '../../lib/stores/appState';
  import { addRecentPlant } from '../../lib/stores/recents';
  import { listRulesForSpecies } from '../../lib/rules/engine';
  import { formatMeters } from '../../lib/utils/format';
  import { parseList } from '../../lib/plants/guide';
  import {
    localSpeciesName, localSpeciesNotes, localPfafField, localFunction,
    localEdiblePart, localRuleMessage
  } from '../../lib/i18n/dataLocal';
  import { t, type TranslationKey } from '../../lib/i18n/index.svelte';
  import { dialogAlert } from '../../lib/stores/dialog';
  import {
    classifyProvenance, provenanceLabelKey, provenanceGlyph, isCommunityKnowledge
  } from '../../lib/pfaf/provenance';
  import { plantGlyph } from '../../lib/glyphs/mapping';
  import type { GlyphName } from '../../lib/glyphs/glyph-data';
  import Glyph from '../../lib/glyphs/Glyph.svelte';

  let { sp, onPick }: { sp: SpeciesRow; onPick?: (id: string) => void } = $props();

  const provLabel = (s: string | null) => t(provenanceLabelKey(classifyProvenance(s)) as TranslationKey);
  const provIcon = (s: string | null) => provenanceGlyph(classifyProvenance(s)) as GlyphName;
  const explainProvenance = () => dialogAlert({ title: t('prov_explain_title'), body: t('prov_explain_body') });

  function uploadPhoto(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        import('../../lib/db/sqlite').then(({ exec }) => {
          exec('UPDATE plant_species SET image_url = ? WHERE id = ?', [dataUrl, sp.id]);
          import('../../lib/stores/appState').then((m) => m.reloadFromDb('land-default'));
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }
</script>

<div class="plant-body">
  <div class="row" style="gap: 12px; margin-bottom: 12px; align-items: flex-start;">
    {#if sp.image_url}
      <img src={sp.image_url} alt={localSpeciesName(sp.common_name, sp.scientific_name)}
        style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid var(--line);" />
    {:else}
      <button type="button" aria-label={t('a11y_add_photo')}
        style="width: 80px; height: 80px; border-radius: 8px; border: 1px dashed var(--line); display: flex; align-items: center; justify-content: center; background: var(--paper-warm); cursor: pointer;"
        onclick={uploadPhoto}>
        <Glyph name={plantGlyph(sp.id)} size={32} />
      </button>
    {/if}
    <div style="flex: 1;">
      <h3 style="margin: 0; font-family: var(--serif); font-weight: var(--display-weight); color: var(--ink);">
        {localSpeciesName(sp.common_name, sp.scientific_name)}
      </h3>
      <div class="coord" style="color: var(--ink-soft);">{sp.scientific_name || t('plant_unknown_sci')}</div>
    </div>
  </div>
  <div class="detail-row" style="align-items: center;">
    <span class="detail-label">{t('prov_source_label')}</span>
    <span class="detail-value" style="display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap;">
      <Glyph name={provIcon(sp.source)} size={13} />
      {provLabel(sp.source)}
      {#if isCommunityKnowledge(sp.source)}
        <span class="chip chip-jade">{t('prov_community_tag')}</span>
      {/if}
      <button type="button" class="prov-q" onclick={explainProvenance} aria-label={t('prov_explain_aria')}>
        {t('prov_explain_btn')}
      </button>
    </span>
  </div>
  {#if sp.aliases}
    {@const aliases = parseList(sp.aliases)}
    {#if aliases.length > 0}
      <div class="detail-row"><span class="detail-label">{t('pg_aka')}</span><span class="detail-value">{aliases.join(', ')}</span></div>
    {/if}
  {/if}
  {#if sp.plant_type}
    <div class="detail-row"><span class="detail-label">Tipo:</span><span class="detail-value">{sp.plant_type}</span></div>
  {/if}
  {#if sp.spacing_m}
    <div class="detail-row"><span class="detail-label">Espacio:</span><span class="detail-value">{formatMeters(sp.spacing_m)} entre plantas</span></div>
  {/if}
  {#if sp.edible_parts}
    {@const parts = parseList(sp.edible_parts)}
    {#if parts.length > 0}
      <div class="detail-row"><span class="detail-label">{t('pg_edible_parts')}</span><span class="detail-value">{parts.map(localEdiblePart).join(', ')}</span></div>
    {/if}
  {/if}
  {#if sp.notes}
    <p class="plant-note">{localSpeciesNotes(sp.id, sp.notes)}</p>
  {/if}
  <div class="tag-row">
    {#if sp.origin}
      <span class="chip {sp.origin === 'native' ? 'chip-jade' : sp.origin === 'invasive' ? 'chip-cinabrio' : 'chip-ocre'}">
        {sp.origin === 'native' ? t('pg_origin_native') : sp.origin === 'adapted' ? t('pg_origin_adapted') : t('pg_origin_invasive')}
      </span>
    {/if}
    {#if sp.sun}
      <span class="chip"><Glyph name="Sun" size={12} /> {localPfafField(sp.sun)}</span>
    {/if}
    {#each parseList(sp.functions) as fn}
      <span class="chip chip-jade">{localFunction(fn)}</span>
    {/each}
  </div>
  {#each listRulesForSpecies(sp.id, 'plant') as rule}
    <div class="banner {rule.relationship === 'incompatible' || rule.relationship === 'harmful' ? 'warn' : 'ok'}">
      {localRuleMessage(rule)}
    </div>
  {/each}
  {#if onPick}
    <button class="btn btn-accent" style="align-self: flex-start;"
      onclick={() => { addRecentPlant(sp.id); onPick?.(sp.id); }}>
      <Glyph name="Plus" size={14} /> {t('plant_pick_btn')}
    </button>
  {/if}
</div>

<style>
  .plant-body { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; border-top: 1px dashed var(--line); }
  .plant-note { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(14px * var(--text-scale)); line-height: 1.5; color: var(--ink-soft); }
  .detail-row { display: flex; gap: 6px; align-items: baseline; font-size: calc(13px * var(--text-scale)); }
  .detail-label { font-family: var(--mono); font-size: calc(10px * var(--text-scale)); text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-soft); white-space: nowrap; }
  .detail-value { font-family: var(--serif); font-weight: var(--display-weight); color: var(--ink); }
  .prov-q { background: transparent; border: 1px solid var(--line-strong); color: var(--ocre-deep); border-radius: 999px; font-family: var(--mono); font-size: calc(10px * var(--text-scale)); padding: 2px 8px; cursor: pointer; min-height: 28px; }
  .prov-q:hover { background: var(--paper-warm); }
</style>
