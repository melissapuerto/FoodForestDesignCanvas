<script lang="ts">
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

  let rules = $state<Rule[]>([]);
  let plantSpecies = $state<SpeciesRow[]>([]);
  let animalSpecies = $state<AnimalSpeciesRow[]>([]);

  let editing = $state<Partial<Rule> | null>(null);
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

  species.subscribe((rows) => (plantSpecies = rows));
  dbReady.subscribe((ready) => { if (ready) refresh(); });

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
  }

  function saveEditing(): void {
    if (!editing) return;
    if (!editing.entity_a) { showToast({ message: 'Falta indicar la entidad A.', tone: 'warn' }); return; }
    if (!editing.message) { showToast({ message: 'Escribe un mensaje claro para la regla.', tone: 'warn' }); return; }
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
    showToast({ message: isNew ? 'Regla agregada.' : 'Regla actualizada.', tone: 'ok' });
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
    showToast({ message: 'Archivo exportado.', tone: 'ok' });
  }

  function applyImportText(text: string): void {
    const r = importRulesFromJson(text);
    importResult = `${r.added} agregadas, ${r.updated} actualizadas, ${r.errors} con error.`;
    refresh();
    if (r.errors && !(r.added + r.updated)) {
      showToast({ message: 'No pude leer ese archivo.', tone: 'error' });
    } else {
      showToast({
        message: `${r.added + r.updated} reglas importadas${r.errors ? `, ${r.errors} con error` : ''}.`,
        tone: r.errors ? 'warn' : 'ok'
      });
    }
  }

  async function shareRule(rule: Rule): Promise<void> {
    if (!get(authToken)) {
      showToast({ message: 'Inicia sesión en Comunidad para compartir', tone: 'warn' });
      return;
    }
    try {
      const title = `Regla: ${entityName(rule.entity_a, rule.entity_a_kind)} y ${entityName(rule.entity_b, rule.entity_b_kind)}`;
      const content = `Relación: ${rule.relationship}\nDistancia: ${rule.trigger_distance_m != null ? formatMeters(rule.trigger_distance_m) : 'N/A'}\n\n${rule.message}\n\nAtribución: ${rule.attribution || 'Propia'}`;
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
      showToast({ message: 'Compartido en la Comunidad', tone: 'ok' });
    } catch (e: any) {
      showToast({ message: e.message || 'Error al compartir', tone: 'warn' });
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
      showToast({ message: 'No hay reglas seleccionadas para exportar.', tone: 'warn' });
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
    showToast({ message: `Exporté ${selected.size} reglas.`, tone: 'ok' });
  }

  function entityName(id: string | null, kind: EntityKind | null): string {
    if (!id) return '—';
    if (kind === 'animal') return animalSpecies.find((a) => a.id === id)?.common_name ?? id;
    if (kind === 'plant') return plantSpecies.find((p) => p.id === id)?.common_name ?? id;
    return id;
  }
</script>


<section class="card-warm card">
  <div class="label">Conocimiento heredado</div>
  <p class="sub" style="margin-top: 6px;">
    Reglas de relación entre plantas, animales, suelo y zonas. Puedes editar, retractar, importar y compartir — siempre con tu autoría.
  </p>
  <div class="row wrap" style="margin-top: 10px;">
    <button class="btn btn-primary" onclick={newRule}><Glyph name="Plus" size={14} /> Nueva regla</button>
    <button class="btn" onclick={() => exportRules(false)}><Glyph name="ArrowRight" size={14} /> Exportar todas</button>
    <button class="btn" onclick={() => exportRules(true)}>Exportar las mías</button>
    <label class="btn">
      Importar archivo
      <input type="file" accept="application/json" hidden onchange={onImportFile} />
    </label>
  </div>
  {#if importResult}
    <div class="banner ok" style="margin-top: 10px;">{importResult}</div>
  {/if}
</section>

<section class="card">
  <div class="row wrap" style="justify-content: space-between; gap: 8px;">
    <div class="label">Seleccionar para exportar</div>
    <div class="row wrap" style="gap: 6px;">
      <span class="chip">{selected.size} de {rules.length}</span>
      <button class="btn btn-sm" onclick={selectAllVisible} disabled={rules.length === 0}>Todo</button>
      <button class="btn btn-sm" onclick={clearSelection} disabled={selected.size === 0}>Ninguna</button>
      <button class="btn btn-sm btn-accent" onclick={exportSelected} disabled={selected.size === 0}>
        <Glyph name="ArrowRight" size={12} /> Exportar seleccionadas
      </button>
    </div>
  </div>
</section>

{#if editing}
  <section class="card">
    <div class="label">{editing.id ? 'Editar regla' : 'Nueva regla'}</div>
    <div class="weave" style="margin: 8px 0;" aria-hidden="true"></div>
    <div class="field-row"><label for="rA">Entidad A</label>
      {#if editing.entity_a_kind === 'plant'}
        <select id="rA" class="inp" bind:value={editing.entity_a}>
          <option value="">— elegir planta —</option>
          {#each plantSpecies as sp (sp.id)}
            <option value={sp.id}>{sp.common_name}</option>
          {/each}
        </select>
      {:else if editing.entity_a_kind === 'animal'}
        <select id="rA" class="inp" bind:value={editing.entity_a}>
          <option value="">— elegir animal —</option>
          {#each animalSpecies as a (a.id)}
            <option value={a.id}>{a.common_name}</option>
          {/each}
        </select>
      {:else}
        <input id="rA" class="inp" bind:value={editing.entity_a} placeholder="ej. agua, suelo arcilloso" />
      {/if}
    </div>
    <SelectWithOther
      id="rAk"
      label="Tipo A"
      value={(editing.entity_a_kind ?? 'plant') as string}
      options={[
        { v: 'plant', l: 'planta' },
        { v: 'animal', l: 'animal' },
        { v: 'soil', l: 'suelo' },
        { v: 'zone', l: 'zona' },
        { v: 'climate', l: 'clima' }
      ]}
      otherLabel="Otro tipo…"
      placeholder="agua, hongos, cerca…"
      onValueChange={(v) => { if (editing) editing.entity_a_kind = v as EntityKind; }}
    />
    <div class="field-row"><label for="rB">Entidad B (opcional)</label>
      {#if editing.entity_b_kind === 'plant'}
        <select id="rB" class="inp" bind:value={editing.entity_b}>
          <option value={null}>— ninguna —</option>
          {#each plantSpecies as sp (sp.id)}
            <option value={sp.id}>{sp.common_name}</option>
          {/each}
        </select>
      {:else if editing.entity_b_kind === 'animal'}
        <select id="rB" class="inp" bind:value={editing.entity_b}>
          <option value={null}>— ninguno —</option>
          {#each animalSpecies as a (a.id)}
            <option value={a.id}>{a.common_name}</option>
          {/each}
        </select>
      {:else}
        <input id="rB" class="inp" bind:value={editing.entity_b} placeholder="ej. agua, suelo, abeja" />
      {/if}
    </div>
    <SelectWithOther
      id="rBk"
      label="Tipo B"
      value={(editing.entity_b_kind ?? '') as string}
      options={[
        { v: 'plant', l: 'planta' },
        { v: 'animal', l: 'animal' },
        { v: 'soil', l: 'suelo' },
        { v: 'zone', l: 'zona' },
        { v: 'climate', l: 'clima' }
      ]}
      allowEmpty
      otherLabel="Otro tipo…"
      placeholder="agua, hongos, cerca…"
      onValueChange={(v) => { if (editing) editing.entity_b_kind = (v || null) as EntityKind | null; }}
    />
    <SelectWithOther
      id="rRel"
      label="Relación"
      value={(editing.relationship ?? 'companion') as string}
      options={[
        { v: 'companion', l: 'se ayudan' },
        { v: 'incompatible', l: 'no se llevan' },
        { v: 'beneficial', l: 'beneficia' },
        { v: 'harmful', l: 'daña' },
        { v: 'unknown', l: 'se desconoce' },
        { v: 'neutral', l: 'neutral' }
      ]}
      otherLabel="Otra relación…"
      placeholder="indica el tipo de relación"
      onValueChange={(v) => { if (editing) editing.relationship = v as Relationship; }}
    />
    <div class="field-row"><label for="rDist">Distancia para activar (m)</label>
      <input id="rDist" class="inp" type="number" step="0.5" bind:value={editing.trigger_distance_m} />
    </div>
    <div class="field-row"><label for="rMsg">Mensaje</label>
      <textarea id="rMsg" class="inp" rows="2" bind:value={editing.message}></textarea>
    </div>
    <div class="field-row"><label for="rAttr">Atribución</label>
      <input id="rAttr" class="inp" bind:value={editing.attribution} placeholder="Tu nombre o sabedor/a" />
    </div>
    <div class="row" style="margin-top: 12px;">
      <button class="btn btn-primary" onclick={saveEditing}><Glyph name="Check" size={14} /> Guardar</button>
      <button class="btn" onclick={() => (editing = null)}>Cancelar</button>
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
            aria-label={`Seleccionar regla entre ${entityName(rule.entity_a, rule.entity_a_kind)} y ${entityName(rule.entity_b, rule.entity_b_kind)}`}
            style="margin-top: 4px; accent-color: var(--ocre);"
          />
          <div style="font-family: var(--serif); font-size: 18px; line-height: 1.2;">
            {entityName(rule.entity_a, rule.entity_a_kind)} <span class="coord">↔</span> {entityName(rule.entity_b, rule.entity_b_kind)}
          </div>
        </label>
        <div class="tag-row">
          <span class="chip {rule.relationship === 'incompatible' || rule.relationship === 'harmful' ? 'chip-cinabrio' : rule.relationship === 'companion' || rule.relationship === 'beneficial' ? 'chip-jade' : 'chip-ocre'}">
            {rule.relationship}
          </span>
          {#if rule.is_user_owned}<span class="chip chip-jade">tuya</span>{/if}
          {#if rule.retracted_at}<span class="chip chip-cinabrio">retractada</span>{/if}
        </div>
      </div>
      <div class="sub" style="font-family: var(--serif); font-size: 14px;">{rule.message}</div>
      <div class="coord">
        {rule.trigger_distance_m != null ? formatMeters(rule.trigger_distance_m) : 'sin distancia'} ·
        {rule.source ?? 'sin fuente'} ·
        {rule.attribution ?? 'sin atribución'}
      </div>
      <div class="row" style="justify-content: flex-end; gap: 6px;">
        <button class="btn btn-sm" onclick={() => (editing = { ...rule })}>Editar</button>
        {#if rule.retracted_at}
          <button class="btn btn-sm" onclick={() => { unretractRule(rule.id); refresh(); }}>Restaurar</button>
        {:else if rule.retractable}
          <button class="btn btn-danger btn-sm" onclick={() => { retractRule(rule.id); refresh(); }}>Retractar</button>
        {/if}
        {#if rule.is_user_owned}
          <button class="btn btn-danger btn-sm" onclick={() => { deleteUserRule(rule.id); refresh(); }}><Glyph name="Trash" size={12} /></button>
        {/if}
        <button class="btn btn-sm" onclick={() => shareRule(rule)}><Glyph name="Sparkle" size={12} /> Compartir</button>
      </div>
    </article>
  {:else}
    <div class="empty">Sin reglas registradas.</div>
  {/each}
</div>
