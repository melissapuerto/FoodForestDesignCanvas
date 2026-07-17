<script lang="ts">
  import { localRuleMessage, localSpeciesName, localAnimalName } from '../../lib/i18n/dataLocal';
  import {
    listAllRulesIncludingRetracted,
    upsertRule,
    retractRule,
    unretractRule,
    deleteUserRule,
    exportRulesAsJson,
    importRulesFromJson
  } from '../../lib/rules/store';
  import type { Rule, EntityKind, Relationship } from '../../lib/rules/types';
  import { species, type SpeciesRow, dbReady } from '../../lib/stores/appState';
  import { listAnimalSpecies, type AnimalSpeciesRow } from '../../lib/db/animals';
  import { showToast } from '../../lib/stores/toast';
  import { apiFetch, authToken } from '../../lib/api';
  import { get } from 'svelte/store';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { formatMeters } from '../../lib/utils/format';
  import SelectWithOther from '../Layout/SelectWithOther.svelte';
  import { t } from '../../lib/i18n/index.svelte';
  import { untrack } from 'svelte';

  let rules = $state<Rule[]>([]);
  const plantSpecies = $derived($species);
  let animalSpecies = $state<AnimalSpeciesRow[]>([]);

  let editing = $state<Partial<Rule> | null>(null);
  let importInputEl: HTMLInputElement | null = $state(null);
  let importResult = $state<string | null>(null);
  let selected = $state<Set<string>>(new Set());

  function toggleSelect(id: string): void {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }

  function selectAllVisible(): void {
    selected = new Set(rules.map((r) => r.id));
  }

  function clearSelection(): void {
    selected = new Set();
  }

  // Effect (auto-cleaned on unmount) instead of a leaked manual subscription.
  $effect(() => { if ($dbReady) untrack(refresh); });

  function refresh(): void {
    rules = listAllRulesIncludingRetracted();
    animalSpecies = listAnimalSpecies();
  }

  function newRule(): void {
    editing = {
      entity_a: '', entity_b: '',
      entity_a_kind: 'plant', entity_b_kind: 'plant',
      relationship: 'companion',
      trigger_distance_m: 2,
      message: '',
      attribution: '',
      provenance_tag: 'practica-campo',
      is_user_owned: 1
    };
    setTimeout(() => document.getElementById('rA')?.focus(), 50);
  }

  function saveEditing(): void {
    if (!editing) return;
    if (!editing.entity_a) { showToast({ message: t('rules_err_entity'), tone: 'warn' }); return; }
    if (!editing.message) { showToast({ message: t('rules_err_message'), tone: 'warn' }); return; }
    const isNew = !editing.id;
    upsertRule({
      id: editing.id,
      entity_a: editing.entity_a!,
      entity_b: editing.entity_b ?? null,
      entity_a_kind: (editing.entity_a_kind ?? 'plant') as EntityKind,
      entity_b_kind: (editing.entity_b_kind ?? null) as EntityKind | null,
      relationship: (editing.relationship ?? 'companion') as Relationship,
      trigger_distance_m: editing.trigger_distance_m ?? null,
      message: editing.message!,
      source: editing.source ?? 'usuario',
      provenance_tag: editing.provenance_tag ?? null,
      attribution: editing.attribution ?? null,
      is_user_owned: !editing.id || !!editing.is_user_owned
    });
    editing = null;
    refresh();
    showToast({ message: isNew ? t('rules_saved') : t('rules_updated'), tone: 'ok' });
  }

  function exportRules(onlyUser: boolean): void {
    const json = exportRulesAsJson({ onlyUser });
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kuxtal-reglas${onlyUser ? '-mias' : ''}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ message: t('rules_exported'), tone: 'ok' });
  }

  function applyImportText(text: string): void {
    const r = importRulesFromJson(text);
    importResult = t('rules_import_result', { added: String(r.added), updated: String(r.updated), errors: String(r.errors) });
    refresh();
    if (r.errors && !(r.added + r.updated)) {
      showToast({ message: t('rules_import_err'), tone: 'error' });
    } else {
      showToast({
        message: t('rules_imported', { n: String(r.added + r.updated) }) + (r.errors ? t('rules_import_errors', { n: String(r.errors) }) : ''),
        tone: r.errors ? 'warn' : 'ok'
      });
    }
  }

  async function shareRule(rule: Rule): Promise<void> {
    if (!get(authToken)) {
      showToast({ message: t('rules_share_login'), tone: 'warn' });
      return;
    }
    try {
      const title = `${t('her_rule_prefix')}: ${entityName(rule.entity_a, rule.entity_a_kind)} · ${entityName(rule.entity_b, rule.entity_b_kind)}`;
      const content = `${t('her_rel_label')}: ${rule.relationship}\n${t('her_dist_label')}: ${rule.trigger_distance_m != null ? formatMeters(rule.trigger_distance_m) : 'N/A'}\n\n${rule.message}\n\n${t('her_attr_label')}: ${rule.attribution || t('her_attr_own')}`;
      const payload = {
        entity_a: rule.entity_a,
        entity_b: rule.entity_b,
        entity_a_kind: rule.entity_a_kind,
        entity_b_kind: rule.entity_b_kind,
        relationship: rule.relationship,
        trigger_distance_m: rule.trigger_distance_m,
        message: rule.message,
        attribution: rule.attribution,
        provenance_tag: rule.provenance_tag,
      };
      await apiFetch('/posts', {
        method: 'POST',
        body: JSON.stringify({
          title,
          content,
          category: 'saberes',
          source_type: 'rule',
          source_payload: JSON.stringify(payload),
        })
      });
      showToast({ message: t('rules_shared'), tone: 'ok' });
    } catch (e: any) {
      showToast({ message: e.message || t('rules_share_err'), tone: 'warn' });
    }
  }


  function onImportFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      applyImportText(String(reader.result));
      input.value = '';
    };
    reader.readAsText(file);
  }

  function exportSelected(): void {
    if (selected.size === 0) {
      showToast({ message: t('rules_no_selection'), tone: 'warn' });
      return;
    }
    const ids = selected;
    const filtered = rules.filter((r) => ids.has(r.id));
    const blob = new Blob(
      [JSON.stringify({ format: 'kuxtal-rules', version: 1, rules: filtered }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kuxtal-reglas-seleccion-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ message: t('rules_exported_n', { n: String(selected.size) }), tone: 'ok' });
  }

  function entityName(id: string | null, kind: EntityKind | null): string {
    if (!id) return '—';
    if (kind === 'animal') {
      const a = animalSpecies.find((x) => x.id === id);
      return a ? localAnimalName(a.id, a.common_name) : id;
    }
    if (kind === 'plant') {
      const p = plantSpecies.find((x) => x.id === id);
      return p ? localSpeciesName(p.common_name, (p as any).scientific_name) : id;
    }
    return id;
  }
</script>


<section class="card-warm card">
  <div class="label">{t('rules_title')}</div>
  <p class="sub" style="margin-top: 6px;">
    {t('rules_sub')}
  </p>
  <div class="row wrap" style="margin-top: 10px;">
    <button class="btn btn-primary" onclick={newRule}><Glyph name="Plus" size={14} /> {t('rules_new')}</button>
    <button class="btn" onclick={() => exportRules(false)}><Glyph name="ArrowRight" size={14} /> {t('rules_export_all')}</button>
    <button class="btn" onclick={() => exportRules(true)}>{t('rules_export_mine')}</button>
    <button type="button" class="btn" onclick={() => importInputEl?.click()}>
      {t('rules_import_file')}
    </button>
    <input
      bind:this={importInputEl}
      type="file"
      accept="application/json"
      onchange={onImportFile}
      style="display: none;"
      tabindex="-1"
      aria-hidden="true"
    />
  </div>
  {#if importResult}
    <div class="banner ok" style="margin-top: 10px;">{importResult}</div>
  {/if}
</section>

<section class="card">
  <div class="row wrap" style="justify-content: space-between; gap: 8px;">
    <div class="label">{t('rules_select_export')}</div>
    <div class="row wrap" style="gap: 6px;">
      <span class="chip">{t('rules_selection_count', { sel: String(selected.size), total: String(rules.length) })}</span>
      <button class="btn btn-sm" onclick={selectAllVisible} disabled={rules.length === 0}>{t('rules_all')}</button>
      <button class="btn btn-sm" onclick={clearSelection} disabled={selected.size === 0}>{t('rules_none_select')}</button>
      <button class="btn btn-sm btn-accent" onclick={exportSelected} disabled={selected.size === 0}>
        <Glyph name="ArrowRight" size={12} /> {t('rules_export_selected')}
      </button>
    </div>
  </div>
</section>

{#if editing}
  <section class="card">
    <div class="label">{editing.id ? t('rules_edit_rule') : t('rules_new_rule')}</div>
    <div class="weave" style="margin: 8px 0;" aria-hidden="true"></div>
    <div class="field-row"><label for="rA">{t('rules_entity_a')}</label>
      {#if editing.entity_a_kind === 'plant'}
        <select id="rA" class="inp" bind:value={editing.entity_a}>
          <option value="">{t('rules_choose_plant')}</option>
          {#each plantSpecies as sp (sp.id)}
            <option value={sp.id}>{localSpeciesName(sp.common_name, sp.scientific_name)}</option>
          {/each}
        </select>
      {:else if editing.entity_a_kind === 'animal'}
        <select id="rA" class="inp" bind:value={editing.entity_a}>
          <option value="">{t('rules_choose_animal')}</option>
          {#each animalSpecies as a (a.id)}
            <option value={a.id}>{localAnimalName(a.id, a.common_name)}</option>
          {/each}
        </select>
      {:else}
        <input id="rA" class="inp" bind:value={editing.entity_a} placeholder={t('rules_entity_placeholder')} />
      {/if}
    </div>
    <SelectWithOther
      id="rAk"
      label={t('rules_type_a')}
      value={(editing.entity_a_kind ?? 'plant') as string}
      options={[
        { v: 'plant', l: t('rules_type_plant') },
        { v: 'animal', l: t('rules_type_animal') },
        { v: 'soil', l: t('rules_type_soil') },
        { v: 'zone', l: t('rules_type_zone') },
        { v: 'climate', l: t('rules_type_climate') }
      ]}
      otherLabel={t('rules_type_other')}
      placeholder={t('rules_type_placeholder')}
      onValueChange={(v) => { if (editing) editing.entity_a_kind = v as EntityKind; }}
    />
    <div class="field-row"><label for="rB">{t('rules_entity_b')}</label>
      {#if editing.entity_b_kind === 'plant'}
        <select id="rB" class="inp" bind:value={editing.entity_b}>
          <option value={null}>{t('rules_none_f')}</option>
          {#each plantSpecies as sp (sp.id)}
            <option value={sp.id}>{localSpeciesName(sp.common_name, sp.scientific_name)}</option>
          {/each}
        </select>
      {:else if editing.entity_b_kind === 'animal'}
        <select id="rB" class="inp" bind:value={editing.entity_b}>
          <option value={null}>{t('rules_none_m')}</option>
          {#each animalSpecies as a (a.id)}
            <option value={a.id}>{localAnimalName(a.id, a.common_name)}</option>
          {/each}
        </select>
      {:else}
        <input id="rB" class="inp" bind:value={editing.entity_b} placeholder={t('rules_entity_b_placeholder')} />
      {/if}
    </div>
    <SelectWithOther
      id="rBk"
      label={t('rules_type_b')}
      value={(editing.entity_b_kind ?? '') as string}
      options={[
        { v: 'plant', l: t('rules_type_plant') },
        { v: 'animal', l: t('rules_type_animal') },
        { v: 'soil', l: t('rules_type_soil') },
        { v: 'zone', l: t('rules_type_zone') },
        { v: 'climate', l: t('rules_type_climate') }
      ]}
      allowEmpty
      otherLabel={t('rules_type_other')}
      placeholder={t('rules_type_placeholder')}
      onValueChange={(v) => { if (editing) editing.entity_b_kind = (v || null) as EntityKind | null; }}
    />
    <SelectWithOther
      id="rRel"
      label={t('rules_relation_label')}
      value={(editing.relationship ?? 'companion') as string}
      options={[
        { v: 'companion', l: t('rules_rel_companion') },
        { v: 'incompatible', l: t('rules_rel_incompatible') },
        { v: 'beneficial', l: t('rules_rel_beneficial') },
        { v: 'harmful', l: t('rules_rel_harmful') },
        { v: 'unknown', l: t('rules_rel_unknown') },
        { v: 'neutral', l: t('rules_rel_neutral') }
      ]}
      otherLabel={t('rules_rel_other')}
      placeholder={t('rules_rel_placeholder')}
      onValueChange={(v) => { if (editing) editing.relationship = v as Relationship; }}
    />
    <div class="field-row"><label for="rDist">{t('rules_distance')}</label>
      <input id="rDist" class="inp" type="number" step="0.5" bind:value={editing.trigger_distance_m} />
    </div>
    <div class="field-row"><label for="rMsg">{t('rules_message_label')}</label>
      <textarea id="rMsg" class="inp" rows="2" bind:value={editing.message}></textarea>
    </div>
    <div class="field-row"><label for="rAttr">{t('rules_attribution')}</label>
      <input id="rAttr" class="inp" bind:value={editing.attribution} placeholder={t('rules_attribution_placeholder')} />
    </div>
    <div class="row" style="margin-top: 12px;">
      <button class="btn btn-primary" onclick={saveEditing}><Glyph name="Check" size={14} /> {t('common_save')}</button>
      <button class="btn" onclick={() => (editing = null)}>{t('common_cancel')}</button>
    </div>
  </section>
{/if}

<div class="list">
  {#each rules as rule}
    <article class="list-item" style="flex-direction: column; align-items: stretch; gap: 8px;">
      <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
        <label class="row" style="gap: 10px; align-items: flex-start; flex: 1; min-width: 0; cursor: pointer;">
          <input
            type="checkbox"
            checked={selected.has(rule.id)}
            onchange={() => toggleSelect(rule.id)}
            aria-label={t('rules_select_aria', { a: entityName(rule.entity_a, rule.entity_a_kind), b: entityName(rule.entity_b, rule.entity_b_kind) })}
            style="margin-top: 4px; accent-color: var(--ocre);"
          />
          <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(18px * var(--text-scale)); line-height: 1.2;">
            {entityName(rule.entity_a, rule.entity_a_kind)} <span class="coord">↔</span> {entityName(rule.entity_b, rule.entity_b_kind)}
          </div>
        </label>
        <div class="tag-row">
          <span class="chip {rule.relationship === 'incompatible' || rule.relationship === 'harmful' ? 'chip-cinabrio' : rule.relationship === 'companion' || rule.relationship === 'beneficial' ? 'chip-jade' : 'chip-ocre'}">
            {t(('rules_rel_' + rule.relationship) as any)}
          </span>
          {#if rule.is_user_owned}<span class="chip chip-jade">{t('rules_owned')}</span>{/if}
          {#if rule.retracted_at}<span class="chip chip-cinabrio">{t('rules_retracted_chip')}</span>{/if}
        </div>
      </div>
      <div class="sub" style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(14px * var(--text-scale));">{localRuleMessage(rule)}</div>
      <div class="coord">
        {rule.trigger_distance_m != null ? formatMeters(rule.trigger_distance_m) : t('rules_no_distance')} ·
        {rule.source ?? t('rules_no_source')} ·
        {rule.attribution ?? t('rules_no_attribution')}
      </div>
      <div class="row" style="justify-content: flex-end; gap: 6px;">
        <button class="btn btn-sm" onclick={() => { editing = { ...rule }; setTimeout(() => document.getElementById('rA')?.focus(), 50); }}>{t('common_edit')}</button>
        {#if rule.retracted_at}
          <button class="btn btn-sm" onclick={() => { unretractRule(rule.id); refresh(); }}>{t('rules_restore')}</button>
        {:else if rule.retractable}
          <button class="btn btn-danger btn-sm" onclick={() => { retractRule(rule.id); refresh(); }}>{t('rules_retract')}</button>
        {/if}
        {#if rule.is_user_owned}
          <button class="btn btn-danger btn-sm" aria-label={t('rules_delete_aria', { a: entityName(rule.entity_a, rule.entity_a_kind), b: entityName(rule.entity_b, rule.entity_b_kind) })} onclick={() => { deleteUserRule(rule.id); refresh(); }}><Glyph name="Trash" size={12} /></button>
        {/if}
        <button class="btn btn-sm" onclick={() => shareRule(rule)}><Glyph name="Sparkle" size={12} /> {t('rules_share_btn')}</button>
      </div>
    </article>
  {:else}
    <div class="empty">{t('rules_empty')}</div>
  {/each}
</div>
