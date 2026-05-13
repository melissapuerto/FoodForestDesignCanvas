<script lang="ts">
  import { onMount } from 'svelte';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import type { GlyphName } from '../../lib/glyphs/glyph-data';
  import { showToast } from '../../lib/stores/toast';
  import { apiFetch, authUser, authToken, fetchMe } from '../../lib/api';
  import { upsertRule, listAllRulesIncludingRetracted } from '../../lib/rules/store';
  import type { Rule } from '../../lib/rules/types';
  import { addLog, listLogs } from '../../lib/db/log';
  import { dbReady, activeLandId } from '../../lib/stores/appState';
  import { dialogConfirm } from '../../lib/stores/dialog';
  import { get } from 'svelte/store';

  type Tab = 'feed' | 'foro' | 'eventos' | 'compartidos' | 'consultores' | 'perfil';
  let tab = $state<Tab>('feed');
  let user = $derived($authUser);

  // Auth state
  let authMode = $state<'login' | 'register' | null>(null);
  let authUsername = $state('');
  let authPassword = $state('');
  let authEmail = $state('');
  let authError = $state('');
  let authLoading = $state(false);

  // Data state
  let posts = $state<any[]>([]);
  let events = $state<any[]>([]);
  let consultants = $state<any[]>([]);
  let loading = $state(false);

  // Comments state
  let activePostForComments = $state<any>(null);
  let postComments = $state<any[]>([]);
  let newCommentContent = $state('');

  // Event compose state
  let isComposingEvent = $state(false);
  let newEventTitle = $state('');
  let newEventDesc = $state('');
  let newEventLoc = $state('');
  let newEventDate = $state('');

  // Share-from-Comunidad
  let isSharePicker = $state(false);
  let sharePickerTab = $state<'rules' | 'saberes'>('rules');
  let sharePickerSearch = $state('');
  let myRules = $state<Rule[]>([]);
  let mySaberes = $state<any[]>([]);

  // Profile editing
  let isEditingProfile = $state(false);
  let editEmail = $state('');
  let editBio = $state('');
  let editLocation = $state('');
  let editCurrentPwd = $state('');
  let editNewPwd = $state('');

  function logout() {
    authToken.set(null);
    authUser.set(null);
    showToast({ message: 'Sesión cerrada', tone: 'info' });
  }

  function closeAllModals(): void {
    authMode = null;
    isComposing = false;
    isComposingEvent = false;
    isSharePicker = false;
    isEditingProfile = false;
    activePostForComments = null;
  }

  function onGlobalKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    if (authMode || isComposing || isComposingEvent || isSharePicker || isEditingProfile) {
      e.preventDefault();
      closeAllModals();
    }
  }

  onMount(() => {
    void fetchMe().then(() => loadData());
    refreshLocal();
    const unsub = dbReady.subscribe(refreshLocal);
    document.addEventListener('keydown', onGlobalKey);
    return () => {
      document.removeEventListener('keydown', onGlobalKey);
      unsub();
    };
  });

  function refreshLocal() {
    if (!get(dbReady)) return;
    try {
      myRules = listAllRulesIncludingRetracted().filter(r => r.is_user_owned && !r.retracted_at);
      const landId = get(activeLandId);
      mySaberes = listLogs(landId).filter((e: any) => e.kind === 'saber');
    } catch { /* ignore */ }
  }

  let lastLoadError = $state<string | null>(null);

  async function loadData() {
    loading = true;
    lastLoadError = null;
    const eventsQS = user ? '?mine=1' : '';
    const errors: string[] = [];
    try {
      posts = await apiFetch('/posts/');
    } catch (e: any) { errors.push(`posts: ${e.message}`); posts = []; }
    try {
      events = await apiFetch('/events/' + eventsQS);
    } catch (e: any) { errors.push(`events: ${e.message}`); events = []; }
    try {
      consultants = await apiFetch('/consultants/');
    } catch (e: any) { errors.push(`consultants: ${e.message}`); consultants = []; }
    loading = false;
    if (errors.length) {
      lastLoadError = errors.join(' · ');
      showToast({ message: 'Error cargando comunidad: ' + errors[0], tone: 'warn', durationMs: 6000 });
    }
  }

  async function handleAuth() {
    authError = '';
    authLoading = true;
    try {
      if (authMode === 'register') {
        await apiFetch('/users/', {
          method: 'POST',
          body: JSON.stringify({ username: authUsername, email: authEmail, password: authPassword })
        });
      }
      const formData = new URLSearchParams();
      formData.append('username', authUsername);
      formData.append('password', authPassword);
      const res = await apiFetch('/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });
      $authToken = res.access_token;
      await fetchMe();
      authMode = null;
      showToast({ message: `Bienvenido, ${authUsername}`, tone: 'ok' });
      loadData();
    } catch (e: any) {
      authError = e.message || 'Error de autenticación';
    } finally {
      authLoading = false;
    }
  }

  function requireAuth(fn: () => void): void {
    if (!user) {
      authMode = 'login';
      showToast({ message: 'Inicia sesión para participar', tone: 'info' });
    } else {
      fn();
    }
  }

  // Sections filter for feed
  let feedSection = $state<'todo' | 'experiencias' | 'saberes' | 'preguntas'>('todo');
  let filteredPosts = $derived(
    feedSection === 'todo' ? posts : posts.filter(p => p.category === feedSection)
  );

  // Post compose state
  let isComposing = $state(false);
  let newPostTitle = $state('');
  let newPostBody = $state('');
  let newPostCategory = $state<'experiencias' | 'saberes' | 'preguntas'>('experiencias');

  async function submitPost(): Promise<void> {
    if (!newPostTitle.trim() || !newPostBody.trim()) {
      showToast({ message: 'Título y contenido son obligatorios', tone: 'warn' });
      return;
    }
    try {
      const created = await apiFetch('/posts/', {
        method: 'POST',
        body: JSON.stringify({ title: newPostTitle, content: newPostBody, category: newPostCategory })
      });
      // Insert immediately so the user sees their post (with their username)
      // even before loadData completes.
      if (created && created.id) {
        posts = [created, ...posts];
      }
      isComposing = false;
      newPostTitle = '';
      newPostBody = '';
      showToast({ message: 'Publicado con éxito', tone: 'ok' });
      // Refresh stats and full list
      void fetchMe();
      loadData();
    } catch (e: any) {
      showToast({ message: e.message || 'Error al publicar', tone: 'warn' });
    }
  }

  async function upvotePost(id: number): Promise<void> {
    requireAuth(async () => {
      try {
        const res = await apiFetch(`/posts/${id}/upvote`, { method: 'POST' });
        // Optimistically reflect change instead of a full reload
        posts = posts.map(p => p.id === id ? { ...p, upvotes: res.upvotes, has_upvoted: res.has_upvoted } : p);
      } catch {
        showToast({ message: 'Error al votar', tone: 'warn' });
      }
    });
  }

  async function openComments(post: any): Promise<void> {
    activePostForComments = activePostForComments?.id === post.id ? null : post;
    if (activePostForComments) {
      postComments = await apiFetch(`/posts/${post.id}/comments`).catch(() => []);
    }
  }

  async function submitComment(): Promise<void> {
    if (!user) { authMode = 'login'; return; }
    if (!newCommentContent.trim()) return;
    try {
      await apiFetch('/comments', {
        method: 'POST',
        body: JSON.stringify({ content: newCommentContent, post_id: activePostForComments.id })
      });
      newCommentContent = '';
      postComments = await apiFetch(`/posts/${activePostForComments.id}/comments`).catch(() => []);
      showToast({ message: 'Comentario añadido', tone: 'ok' });
    } catch {
      showToast({ message: 'Error al comentar', tone: 'warn' });
    }
  }

  async function deleteComment(c: any): Promise<void> {
    const ok = await dialogConfirm({ title: '¿Borrar comentario?', confirmLabel: 'Borrar', danger: true });
    if (!ok) return;
    try {
      await apiFetch(`/comments/${c.id}`, { method: 'DELETE' });
      postComments = postComments.filter(x => x.id !== c.id);
    } catch {
      showToast({ message: 'No pude borrar', tone: 'warn' });
    }
  }

  async function deletePost(p: any): Promise<void> {
    const ok = await dialogConfirm({ title: '¿Borrar publicación?', confirmLabel: 'Borrar', danger: true });
    if (!ok) return;
    try {
      await apiFetch(`/posts/${p.id}`, { method: 'DELETE' });
      posts = posts.filter(x => x.id !== p.id);
      showToast({ message: 'Publicación borrada', tone: 'ok' });
    } catch {
      showToast({ message: 'No pude borrar', tone: 'warn' });
    }
  }

  async function submitEvent(): Promise<void> {
    if (!newEventTitle.trim() || !newEventDate) {
      showToast({ message: 'Título y fecha son obligatorios', tone: 'warn' });
      return;
    }
    try {
      const created = await apiFetch('/events/', {
        method: 'POST',
        body: JSON.stringify({
          title: newEventTitle,
          description: newEventDesc || newEventTitle,
          location: newEventLoc || 'Por confirmar',
          event_date: new Date(newEventDate).toISOString()
        })
      });
      if (created && created.id) {
        events = [created, ...events];
      }
      isComposingEvent = false;
      newEventTitle = '';
      newEventDesc = '';
      newEventLoc = '';
      newEventDate = '';
      showToast({
        message: user?.role === 'admin' || user?.role === 'mod'
          ? 'Evento publicado'
          : 'Evento creado, en revisión por el equipo de moderación',
        tone: 'ok'
      });
      void fetchMe();
      loadData();
    } catch (e: any) {
      showToast({ message: e.message || 'Error al crear evento', tone: 'warn' });
    }
  }

  async function rsvp(ev: any): Promise<void> {
    requireAuth(async () => {
      try {
        const res = await apiFetch(`/events/${ev.id}/rsvp`, { method: 'POST' });
        events = events.map(e => e.id === ev.id ? { ...e, attending: res.attending, attendee_count: res.attendee_count } : e);
      } catch (e: any) {
        showToast({ message: e.message || 'Error al RSVP', tone: 'warn' });
      }
    });
  }

  async function deleteEvent(ev: any): Promise<void> {
    const ok = await dialogConfirm({ title: '¿Borrar evento?', confirmLabel: 'Borrar', danger: true });
    if (!ok) return;
    try {
      await apiFetch(`/events/${ev.id}`, { method: 'DELETE' });
      events = events.filter(e => e.id !== ev.id);
      showToast({ message: 'Evento borrado', tone: 'ok' });
    } catch {
      showToast({ message: 'No pude borrar', tone: 'warn' });
    }
  }

  // Share local rule/saber from Comunidad
  function openSharePicker(): void {
    requireAuth(() => {
      refreshLocal();
      isSharePicker = true;
    });
  }

  async function shareLocalRule(rule: Rule): Promise<void> {
    try {
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
      const created = await apiFetch('/posts/', {
        method: 'POST',
        body: JSON.stringify({
          title: `Regla: ${rule.entity_a}${rule.entity_b ? ' ↔ ' + rule.entity_b : ''}`,
          content: `Relación: ${rule.relationship}\n\n${rule.message}\n\nAtribución: ${rule.attribution || 'Propia'}`,
          category: 'saberes',
          source_type: 'rule',
          source_payload: JSON.stringify(payload),
        })
      });
      if (created?.id) posts = [created, ...posts];
      isSharePicker = false;
      showToast({ message: 'Regla compartida', tone: 'ok' });
      void fetchMe();
      loadData();
    } catch (e: any) {
      showToast({ message: e.message || 'Error al compartir', tone: 'warn' });
    }
  }

  async function shareLocalSaber(s: any): Promise<void> {
    try {
      const payload = { title: s.title, body: s.body, recorded_at: s.recorded_at };
      const created = await apiFetch('/posts/', {
        method: 'POST',
        body: JSON.stringify({
          title: `Saber: ${s.title || 'Sin título'}`,
          content: s.body || 'Sin descripción',
          category: 'saberes',
          source_type: 'saber',
          source_payload: JSON.stringify(payload),
        })
      });
      if (created?.id) posts = [created, ...posts];
      isSharePicker = false;
      showToast({ message: 'Saber compartido', tone: 'ok' });
      void fetchMe();
      loadData();
    } catch (e: any) {
      showToast({ message: e.message || 'Error al compartir', tone: 'warn' });
    }
  }

  // Import shared content back into local DB
  async function importToFinca(p: any): Promise<void> {
    if (!p.source_type || !p.source_payload) return;
    try {
      const data = JSON.parse(p.source_payload);
      if (p.source_type === 'rule') {
        upsertRule({
          entity_a: data.entity_a,
          entity_b: data.entity_b ?? null,
          entity_a_kind: data.entity_a_kind ?? 'plant',
          entity_b_kind: data.entity_b_kind ?? null,
          relationship: data.relationship,
          trigger_distance_m: data.trigger_distance_m ?? null,
          message: data.message,
          source: 'comunidad:' + (p.author_username || 'anon'),
          provenance_tag: data.provenance_tag ?? null,
          attribution: data.attribution ?? p.author_username ?? null,
          is_user_owned: true,
        });
        showToast({ message: 'Regla importada a tu finca', tone: 'ok' });
      } else if (p.source_type === 'saber') {
        addLog({
          landId: get(activeLandId),
          kind: 'saber',
          title: data.title || p.title,
          body: (data.body ?? p.content ?? '') + `\n\n— Por @${p.author_username}`,
        });
        showToast({ message: 'Saber añadido a tu cuaderno', tone: 'ok' });
      }
      refreshLocal();
    } catch {
      showToast({ message: 'No pude importar', tone: 'warn' });
    }
  }

  // Profile editing
  function openProfileEdit(): void {
    if (!user) return;
    editEmail = user.email || '';
    editBio = user.bio || '';
    editLocation = user.location || '';
    editCurrentPwd = '';
    editNewPwd = '';
    isEditingProfile = true;
  }

  async function saveProfile(): Promise<void> {
    try {
      const body: any = { email: editEmail, bio: editBio, location: editLocation };
      if (editNewPwd) {
        if (!editCurrentPwd) {
          showToast({ message: 'Confirma tu contraseña actual', tone: 'warn' });
          return;
        }
        body.current_password = editCurrentPwd;
        body.new_password = editNewPwd;
      }
      await apiFetch('/users/me/', { method: 'PATCH', body: JSON.stringify(body) });
      await fetchMe();
      isEditingProfile = false;
      showToast({ message: 'Perfil actualizado', tone: 'ok' });
    } catch (e: any) {
      showToast({ message: e.message || 'Error al actualizar', tone: 'warn' });
    }
  }

  let myPosts = $derived(user ? posts.filter(p => p.author_id === user.id) : []);
  let myEvents = $derived(user ? events.filter(e => e.organizer_id === user.id) : []);

  let filteredRules = $derived(
    sharePickerSearch.trim()
      ? myRules.filter(r =>
          (r.entity_a + ' ' + (r.entity_b || '') + ' ' + r.message)
            .toLowerCase().includes(sharePickerSearch.toLowerCase())
        )
      : myRules
  );
  let filteredSaberes = $derived(
    sharePickerSearch.trim()
      ? mySaberes.filter(s =>
          ((s.title || '') + ' ' + (s.body || ''))
            .toLowerCase().includes(sharePickerSearch.toLowerCase())
        )
      : mySaberes
  );
</script>

<!-- ═══ AUTH MODAL ═══ -->
{#if authMode}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
  <div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) closeAllModals(); }} role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="auth-title">
    <div class="card" style="padding: 20px; width: 320px; max-width: 92vw;">
      <div class="row" style="justify-content: space-between; margin-bottom: 16px;">
        <div class="label" id="auth-title">{authMode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</div>
        <button type="button" class="btn-ghost btn btn-sm" aria-label="Cerrar" onclick={() => (authMode = null)}><Glyph name="Close" size={16} /></button>
      </div>
      <div class="field-row">
        <label for="u-username">Usuario</label>
        <input id="u-username" class="inp" autocomplete="username" bind:value={authUsername} />
      </div>
      {#if authMode === 'register'}
        <div class="field-row" style="margin-top: 12px;">
          <label for="u-email">Correo</label>
          <input id="u-email" type="email" class="inp" autocomplete="email" bind:value={authEmail} />
        </div>
      {/if}
      <div class="field-row" style="margin-top: 12px;">
        <label for="u-password">Contraseña</label>
        <input id="u-password" type="password" class="inp" autocomplete={authMode === 'register' ? 'new-password' : 'current-password'} bind:value={authPassword} />
      </div>
      {#if authError}
        <div class="banner warn" style="margin-top: 12px;" role="alert">{authError}</div>
      {/if}
      <div class="row" style="margin-top: 20px; gap: 8px;">
        <button type="button" class="btn btn-primary" style="flex: 1;" onclick={handleAuth} disabled={authLoading}>
          {authLoading ? '...' : (authMode === 'login' ? 'Entrar' : 'Registrar')}
        </button>
      </div>
      <div style="text-align: center; margin-top: 16px;">
        <button type="button" class="btn btn-sm btn-ghost" onclick={() => (authMode = authMode === 'login' ? 'register' : 'login')}>
          {authMode === 'login' ? 'No tengo cuenta, registrarme' : 'Ya tengo cuenta, iniciar sesión'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ═══ POST COMPOSE ═══ -->
{#if isComposing}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
  <div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) closeAllModals(); }} role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="post-title">
    <div class="card" style="padding: 20px; width: 420px; max-width: 92vw;">
      <div class="row" style="justify-content: space-between; margin-bottom: 16px;">
        <div class="label" id="post-title">Nueva publicación</div>
        <button type="button" class="btn-ghost btn btn-sm" aria-label="Cerrar" onclick={() => (isComposing = false)}><Glyph name="Close" size={16} /></button>
      </div>
      <div class="field-row">
        <label for="p-title">Título</label>
        <input id="p-title" class="inp" bind:value={newPostTitle} />
      </div>
      <div class="field-row" style="margin-top: 12px;">
        <label for="p-cat">Categoría</label>
        <select id="p-cat" class="inp" bind:value={newPostCategory}>
          <option value="experiencias">Experiencias</option>
          <option value="saberes">Saberes</option>
          <option value="preguntas">Preguntas (Foro)</option>
        </select>
      </div>
      <div class="field-row" style="margin-top: 12px;">
        <label for="p-body">Contenido</label>
        <textarea id="p-body" class="inp" rows="4" bind:value={newPostBody}></textarea>
      </div>
      <div class="row" style="margin-top: 20px;">
        <button type="button" class="btn btn-primary" style="width: 100%;" onclick={submitPost}>Publicar</button>
      </div>
    </div>
  </div>
{/if}

<!-- ═══ EVENT COMPOSE ═══ -->
{#if isComposingEvent}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
  <div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) closeAllModals(); }} role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="ev-title">
    <div class="card" style="padding: 20px; width: 420px; max-width: 92vw;">
      <div class="row" style="justify-content: space-between; margin-bottom: 16px;">
        <div class="label" id="ev-title">Nuevo Evento</div>
        <button type="button" class="btn-ghost btn btn-sm" aria-label="Cerrar" onclick={() => (isComposingEvent = false)}><Glyph name="Close" size={16} /></button>
      </div>
      <div class="banner" style="margin-bottom: 12px;">
        Tu evento quedará en revisión hasta que un moderador lo apruebe.
      </div>
      <div class="field-row"><label for="ev-t">Título</label>
        <input id="ev-t" class="inp" bind:value={newEventTitle} /></div>
      <div class="field-row" style="margin-top: 8px;"><label for="ev-d">Descripción</label>
        <textarea id="ev-d" class="inp" rows="3" bind:value={newEventDesc}></textarea></div>
      <div class="field-row" style="margin-top: 8px;"><label for="ev-l">Ubicación</label>
        <input id="ev-l" class="inp" bind:value={newEventLoc} /></div>
      <div class="field-row" style="margin-top: 8px;"><label for="ev-dt">Fecha</label>
        <input id="ev-dt" class="inp" type="datetime-local" bind:value={newEventDate} /></div>
      <div class="row" style="margin-top: 20px;">
        <button type="button" class="btn btn-primary" style="width: 100%;" onclick={submitEvent}>Crear evento</button>
      </div>
    </div>
  </div>
{/if}

<!-- ═══ SHARE-LOCAL PICKER ═══ -->
{#if isSharePicker}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
  <div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) closeAllModals(); }} role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="sh-title">
    <div class="card" style="padding: 20px; width: 480px; max-width: 92vw; max-height: 85vh; overflow-y: auto;">
      <div class="row" style="justify-content: space-between; margin-bottom: 12px;">
        <div class="label" id="sh-title">Compartir desde mi finca</div>
        <button type="button" class="btn-ghost btn btn-sm" aria-label="Cerrar" onclick={() => (isSharePicker = false)}><Glyph name="Close" size={16} /></button>
      </div>
      <div class="row" style="gap: 6px;" role="tablist" aria-label="Tipo de contenido">
        <button type="button" class="chip {sharePickerTab === 'rules' ? 'chip-ocre' : ''}" role="tab" aria-selected={sharePickerTab === 'rules'} onclick={() => (sharePickerTab = 'rules')}>Reglas ({myRules.length})</button>
        <button type="button" class="chip {sharePickerTab === 'saberes' ? 'chip-ocre' : ''}" role="tab" aria-selected={sharePickerTab === 'saberes'} onclick={() => (sharePickerTab = 'saberes')}>Saberes ({mySaberes.length})</button>
      </div>
      <div class="row" style="margin-top: 10px;">
        <input class="inp" type="search" placeholder="Buscar..." bind:value={sharePickerSearch} aria-label="Buscar" />
      </div>
      <div class="list" style="margin-top: 12px;">
        {#if sharePickerTab === 'rules'}
          {#each filteredRules as r (r.id)}
            <article class="list-item" style="flex-direction: column; align-items: stretch; gap: 6px;">
              <div style="font-family: var(--serif); font-size: 15px;"><strong>{r.entity_a}</strong> ↔ {r.entity_b ?? '—'}</div>
              <div class="coord">{r.relationship} · {r.message.slice(0, 90)}</div>
              <div class="row" style="justify-content: flex-end;"><button type="button" class="btn btn-sm btn-primary" onclick={() => shareLocalRule(r)}>Compartir</button></div>
            </article>
          {:else}
            <div class="empty">No tienes reglas propias. Crea una en Saberes.</div>
          {/each}
        {:else}
          {#each filteredSaberes as s (s.id)}
            <article class="list-item" style="flex-direction: column; align-items: stretch; gap: 6px;">
              <div style="font-family: var(--serif); font-size: 15px;">{s.title || 'Sin título'}</div>
              <div class="coord">{(s.body || '').slice(0, 110)}</div>
              <div class="row" style="justify-content: flex-end;"><button type="button" class="btn btn-sm btn-primary" onclick={() => shareLocalSaber(s)}>Compartir</button></div>
            </article>
          {:else}
            <div class="empty">No tienes saberes registrados aún.</div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- ═══ PROFILE EDIT MODAL ═══ -->
{#if isEditingProfile}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
  <div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) closeAllModals(); }} role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="prof-title">
    <div class="card" style="padding: 20px; width: 420px; max-width: 92vw;">
      <div class="row" style="justify-content: space-between; margin-bottom: 14px;">
        <div class="label" id="prof-title">Editar perfil</div>
        <button type="button" class="btn-ghost btn btn-sm" aria-label="Cerrar" onclick={() => (isEditingProfile = false)}><Glyph name="Close" size={16} /></button>
      </div>
      <div class="field-row"><label for="pe-em">Correo</label><input id="pe-em" class="inp" type="email" bind:value={editEmail} /></div>
      <div class="field-row" style="margin-top: 10px;"><label for="pe-loc">Ubicación</label><input id="pe-loc" class="inp" bind:value={editLocation} /></div>
      <div class="field-row" style="margin-top: 10px;"><label for="pe-bio">Bio</label><textarea id="pe-bio" class="inp" rows="3" bind:value={editBio}></textarea></div>
      <div class="weave" style="margin: 14px 0;" aria-hidden="true"></div>
      <div class="label" style="margin-bottom: 6px;">Cambiar contraseña</div>
      <div class="field-row"><label for="pe-cp">Contraseña actual</label><input id="pe-cp" class="inp" type="password" autocomplete="current-password" bind:value={editCurrentPwd} /></div>
      <div class="field-row" style="margin-top: 10px;"><label for="pe-np">Nueva contraseña</label><input id="pe-np" class="inp" type="password" autocomplete="new-password" bind:value={editNewPwd} /></div>
      <div class="row" style="margin-top: 18px;">
        <button type="button" class="btn btn-primary" style="flex: 1;" onclick={saveProfile}>Guardar</button>
      </div>
    </div>
  </div>
{/if}

<!-- ═══ MAIN ═══ -->
{#if lastLoadError}
  <div class="banner warn" style="margin-bottom: 12px;" role="alert">
    <strong>No pude conectar con la comunidad.</strong>
    <div style="margin-top: 4px; font-family: var(--mono); font-size: 11px; word-break: break-all;">{lastLoadError}</div>
    <button type="button" class="btn btn-sm" style="margin-top: 8px;" onclick={() => loadData()}>Reintentar</button>
  </div>
{/if}

{#if !user}
  <div class="banner" style="margin-bottom: 12px;" role="status">
    <strong>Modo anónimo:</strong> Puedes leer la comunidad, pero necesitas
    <button type="button" class="btn btn-sm btn-accent" style="margin: 0 4px;" onclick={() => (authMode = 'login')}>iniciar sesión</button>
    para participar.
  </div>
{/if}

<!-- Code of Conduct -->
<section class="card-warm card">
  <div class="label">Código de conducta</div>
  <div style="font-family: var(--serif); font-size: 14px; line-height: 1.6; margin-top: 6px; color: var(--ink-soft);">
    Esta comunidad practica el respeto, la reciprocidad y el cuidado mutuo.
    Compartimos saberes con autoría, valoramos el conocimiento ancestral y
    construimos juntos un futuro regenerativo.
  </div>
</section>

<!-- Tab bar -->
<section class="card" style="padding: 10px 14px;">
  <div class="row wrap" style="gap: 4px;" role="tablist" aria-label="Comunidad">
    {#each [
      { id: 'feed', l: 'Feed', icon: 'Book' },
      { id: 'foro', l: 'Foro', icon: 'Help' },
      { id: 'eventos', l: 'Eventos', icon: 'Sun' },
      { id: 'compartidos', l: 'Compartidos', icon: 'Sparkle' },
      { id: 'consultores', l: 'Consultores', icon: 'People' },
    ] as t}
      <button
        type="button"
        class="chip {tab === t.id ? 'chip-jade' : ''}"
        role="tab"
        aria-selected={tab === t.id}
        onclick={() => (tab = t.id as Tab)}
        style="font-size: 11px;"
      >
        <Glyph name={t.icon as GlyphName} size={12} /> {t.l}
      </button>
    {/each}
    {#if user}
      <button
        type="button"
        class="chip {tab === 'perfil' ? 'chip-ocre' : ''}"
        role="tab"
        aria-selected={tab === 'perfil'}
        onclick={() => (tab = 'perfil')}
        style="font-size: 11px;"
      >
        <Glyph name="People" size={12} /> Mi Perfil
      </button>
    {/if}
  </div>
</section>

{#if loading}
  <div class="empty" role="status">Cargando…</div>
{/if}

<!-- ═══ FEED ═══ -->
{#if tab === 'feed'}
  <section class="card" style="padding: 10px 14px;">
    <div class="row wrap" style="gap: 4px;" role="tablist" aria-label="Filtros del feed">
      {#each [{v:'todo',l:'Todo'},{v:'experiencias',l:'Experiencias'},{v:'saberes',l:'Saberes'},{v:'preguntas',l:'Preguntas'}] as s}
        <button type="button" class="chip {feedSection === s.v ? 'chip-ocre' : ''}" role="tab" aria-selected={feedSection === s.v} onclick={() => (feedSection = s.v as any)} style="font-size: 10px;">{s.l}</button>
      {/each}
    </div>
  </section>

  <div class="list">
    {#each filteredPosts as post (post.id)}
      <article class="list-item" style="flex-direction: column; gap: 8px; align-items: stretch;">
        <div class="row" style="gap: 10px;">
          <div class="avatar" aria-hidden="true">{(post.author_username || '?').charAt(0).toUpperCase()}</div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-family: var(--serif); font-size: 16px; font-weight: 600;">@{post.author_username}</div>
            <div class="coord">{new Date(post.created_at).toLocaleDateString()} · <span class="chip" style="font-size: 9px;">{post.category}</span>
              {#if post.source_type}<span class="chip chip-jade" style="font-size: 9px;">de {post.source_type}</span>{/if}
            </div>
          </div>
        </div>
        <div style="font-family: var(--serif); font-size: 15px; line-height: 1.55; word-wrap: break-word;"><strong>{post.title}</strong><br/>{post.content}</div>
        <div class="row wrap" style="gap: 8px;">
          <button type="button" class="btn btn-sm" aria-pressed={!!post.has_upvoted} onclick={() => upvotePost(post.id)}>
            <span aria-hidden="true">{post.has_upvoted ? '♥' : '♡'}</span> {post.upvotes}
          </button>
          <button type="button" class="btn btn-sm" onclick={() => openComments(post)}>
            <Glyph name="Help" size={12} /> Comentarios
          </button>
          {#if post.source_type && user}
            <button type="button" class="btn btn-sm btn-accent" onclick={() => importToFinca(post)}>
              <Glyph name="ArrowRight" size={12} /> Importar a mi finca
            </button>
          {/if}
          {#if user && (post.author_id === user.id || user.role === 'admin' || user.role === 'mod')}
            <button type="button" class="btn btn-sm btn-danger" onclick={() => deletePost(post)} aria-label="Borrar publicación">
              <Glyph name="Trash" size={12} />
            </button>
          {/if}
        </div>

        {#if activePostForComments?.id === post.id}
          <div class="card-soft" style="margin-top: 8px; padding: 12px;">
            <div class="label" style="font-size: 12px; margin-bottom: 8px;">Comentarios</div>
            <div class="list" style="max-height: 220px; overflow-y: auto; margin-bottom: 10px;">
              {#each postComments as c (c.id)}
                <div style="font-size: 13px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid var(--paper-warm); display: flex; gap: 6px; align-items: flex-start;">
                  <div style="flex: 1;"><strong>@{c.author_username}:</strong> {c.content}</div>
                  {#if user && (c.author_id === user.id || user.role === 'admin' || user.role === 'mod')}
                    <button type="button" class="btn btn-sm btn-ghost" aria-label="Borrar" onclick={() => deleteComment(c)}><Glyph name="Trash" size={10} /></button>
                  {/if}
                </div>
              {:else}
                <div class="coord">No hay comentarios aún.</div>
              {/each}
            </div>
            {#if user}
              <div class="row" style="gap: 8px;">
                <input class="inp" placeholder="Escribe un comentario..." aria-label="Comentario" bind:value={newCommentContent} />
                <button type="button" class="btn btn-sm btn-primary" onclick={submitComment}>Enviar</button>
              </div>
            {:else}
              <button type="button" class="btn btn-sm btn-accent" onclick={() => (authMode = 'login')}>Inicia sesión para comentar</button>
            {/if}
          </div>
        {/if}
      </article>
    {:else}
      <div class="empty">No hay publicaciones aquí todavía.</div>
    {/each}
  </div>

  <div style="padding: 16px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
    <button type="button" class="btn btn-primary" onclick={() => requireAuth(() => (isComposing = true))}>
      <Glyph name="Plus" size={14} /> Nueva publicación
    </button>
    <button type="button" class="btn btn-accent" onclick={openSharePicker}>
      <Glyph name="Sparkle" size={14} /> Compartir desde mi finca
    </button>
  </div>

<!-- ═══ FORO ═══ -->
{:else if tab === 'foro'}
  <div class="list">
    {#each posts.filter(p => p.category === 'preguntas') as topic (topic.id)}
      <article class="list-item" style="flex-direction: column; gap: 6px; align-items: stretch;">
        <div style="font-family: var(--serif); font-size: 16px; line-height: 1.3;">{topic.title}</div>
        <div class="coord">@{topic.author_username} · {new Date(topic.created_at).toLocaleDateString()} · {topic.upvotes} votos</div>
        <div class="row wrap" style="gap: 6px;">
          <button type="button" class="btn btn-sm" onclick={() => openComments(topic)}>Ver respuestas</button>
        </div>
        {#if activePostForComments?.id === topic.id}
          <div class="card-soft" style="padding: 10px;">
            {#each postComments as c (c.id)}
              <div style="font-size: 13px; margin-bottom: 6px;"><strong>@{c.author_username}:</strong> {c.content}</div>
            {:else}
              <div class="coord">Aún sin respuestas.</div>
            {/each}
            {#if user}
              <div class="row" style="gap: 8px; margin-top: 8px;">
                <input class="inp" placeholder="Tu respuesta..." aria-label="Respuesta" bind:value={newCommentContent} />
                <button type="button" class="btn btn-sm btn-primary" onclick={submitComment}>Enviar</button>
              </div>
            {:else}
              <button type="button" class="btn btn-sm btn-accent" style="margin-top: 8px;" onclick={() => (authMode = 'login')}>Inicia sesión para responder</button>
            {/if}
          </div>
        {/if}
      </article>
    {:else}
      <div class="empty">No hay preguntas en el foro todavía.</div>
    {/each}
  </div>
  <div style="padding: 16px; text-align: center;">
    <button type="button" class="btn btn-primary" onclick={() => requireAuth(() => { isComposing = true; newPostCategory = 'preguntas'; })}>
      <Glyph name="Plus" size={14} /> Nueva pregunta
    </button>
  </div>

<!-- ═══ EVENTOS ═══ -->
{:else if tab === 'eventos'}
  <div class="list">
    {#each events as ev (ev.id)}
      <article class="list-item" style="flex-direction: column; gap: 8px; align-items: stretch;">
        <div class="row" style="justify-content: space-between; gap: 8px; flex-wrap: wrap;">
          <div style="font-family: var(--serif); font-size: 17px; flex: 1; min-width: 0;">{ev.title}</div>
          {#if ev.status === 'pending'}<span class="chip chip-ocre" style="font-size: 10px;">en revisión</span>{/if}
          {#if ev.status === 'rejected'}<span class="chip chip-cinabrio" style="font-size: 10px;">rechazado</span>{/if}
        </div>
        {#if ev.description}<div style="font-family: var(--serif); font-size: 14px; line-height: 1.5;">{ev.description}</div>{/if}
        <div class="coord">{new Date(ev.event_date).toLocaleString()} · {ev.location} · @{ev.organizer_username}</div>
        <div class="coord">{ev.attendee_count} asistente{ev.attendee_count === 1 ? '' : 's'}</div>
        <div class="row wrap" style="gap: 6px;">
          {#if ev.status === 'approved'}
            <button type="button" class="btn btn-sm {ev.attending ? 'btn-primary' : 'btn-accent'}" aria-pressed={!!ev.attending} onclick={() => rsvp(ev)}>
              {ev.attending ? '✓ Asistiré' : 'Asistir'}
            </button>
          {/if}
          {#if user && (ev.organizer_id === user.id || user.role === 'admin' || user.role === 'mod')}
            <button type="button" class="btn btn-sm btn-danger" onclick={() => deleteEvent(ev)} aria-label="Borrar evento">
              <Glyph name="Trash" size={12} />
            </button>
          {/if}
        </div>
      </article>
    {:else}
      <div class="empty">No hay eventos todavía.</div>
    {/each}
  </div>
  <div style="padding: 16px; text-align: center;">
    <button type="button" class="btn btn-primary" onclick={() => requireAuth(() => (isComposingEvent = true))}>
      <Glyph name="Plus" size={14} /> Crear evento
    </button>
  </div>

<!-- ═══ COMPARTIDOS (Heredado/Saberes only) ═══ -->
{:else if tab === 'compartidos'}
  <section class="card-warm card">
    <div class="label">Saberes y Reglas compartidos</div>
    <p class="sub" style="margin-top: 6px;">
      Conocimiento que la comunidad ha decidido compartir. Puedes traerlo a tu finca.
    </p>
  </section>
  <div class="list">
    {#each posts.filter(p => p.source_type === 'rule' || p.source_type === 'saber') as post (post.id)}
      <article class="list-item" style="flex-direction: column; gap: 8px; align-items: stretch;">
        <div class="row" style="gap: 10px;">
          <div class="avatar" aria-hidden="true">{post.source_type === 'rule' ? '⚖' : '✦'}</div>
          <div style="flex: 1;">
            <div style="font-family: var(--serif); font-size: 15px; font-weight: 600;">{post.title}</div>
            <div class="coord">@{post.author_username} · {new Date(post.created_at).toLocaleDateString()}</div>
          </div>
          <span class="chip {post.source_type === 'rule' ? 'chip-jade' : 'chip-ocre'}" style="font-size: 9px;">{post.source_type === 'rule' ? 'Regla' : 'Saber'}</span>
        </div>
        <div style="font-family: var(--serif); font-size: 14px; line-height: 1.55;">{post.content}</div>
        <div class="row wrap" style="gap: 6px;">
          <button type="button" class="btn btn-sm" onclick={() => upvotePost(post.id)} aria-pressed={!!post.has_upvoted}>
            <span aria-hidden="true">{post.has_upvoted ? '♥' : '♡'}</span> {post.upvotes}
          </button>
          {#if user}
            <button type="button" class="btn btn-sm btn-accent" onclick={() => importToFinca(post)}>
              <Glyph name="ArrowRight" size={12} /> Importar a mi finca
            </button>
          {/if}
        </div>
      </article>
    {:else}
      <div class="empty">Aún nadie ha compartido saberes ni reglas.</div>
    {/each}
  </div>
  <div style="padding: 16px; text-align: center;">
    <button type="button" class="btn btn-primary" onclick={openSharePicker}>
      <Glyph name="Sparkle" size={14} /> Compartir desde mi finca
    </button>
  </div>

<!-- ═══ CONSULTORES ═══ -->
{:else if tab === 'consultores'}
  <div class="list">
    {#each consultants as c (c.id)}
      <article class="list-item" style="gap: 14px;">
        <div class="avatar avatar-large" aria-hidden="true">👨‍🌾</div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-family: var(--serif); font-size: 17px;">{c.name}</div>
          <div class="coord">{c.contact}</div>
          <div class="tag-row" style="margin-top: 4px;">
            <span class="chip chip-ocre" style="font-size: 10px;">{c.specialty}</span>
            <span class="chip chip-jade" style="font-size: 10px;">{c.endorsements} avales</span>
          </div>
        </div>
      </article>
    {:else}
      <div class="empty">No hay consultores todavía.</div>
    {/each}
  </div>

<!-- ═══ PERFIL ═══ -->
{:else if tab === 'perfil' && user}
  <section class="card-warm card">
    <div class="row" style="gap: 16px; align-items: flex-start; flex-wrap: wrap;">
      <div class="avatar avatar-xl" aria-hidden="true">{user.username.charAt(0).toUpperCase()}</div>
      <div style="flex: 1; min-width: 200px;">
        <div style="font-family: var(--serif); font-size: 22px; font-weight: 600; line-height: 1.1;">@{user.username}</div>
        <div class="coord">{user.email}</div>
        {#if user.role && user.role !== 'user'}
          <span class="chip chip-jade" style="margin-top: 6px; font-size: 10px;">{user.role}</span>
        {/if}
        {#if user.location}
          <div class="coord" style="margin-top: 6px;">📍 {user.location}</div>
        {/if}
        {#if user.bio}
          <div style="margin-top: 8px; font-family: var(--serif); font-size: 14px; line-height: 1.5;">{user.bio}</div>
        {/if}
      </div>
    </div>
    <div class="row wrap" style="gap: 8px; margin-top: 16px;">
      <button type="button" class="btn btn-sm" onclick={openProfileEdit}>Editar perfil</button>
      <button type="button" class="btn btn-sm btn-danger" onclick={logout}>Cerrar sesión</button>
    </div>
  </section>

  {#if user.stats}
    <section class="card">
      <div class="label">Mis estadísticas</div>
      <div class="stats-grid" style="margin-top: 10px;">
        <div class="stat-card"><div class="stat-num">{user.stats.posts}</div><div class="stat-lbl">Publicaciones</div></div>
        <div class="stat-card"><div class="stat-num">{user.stats.comments}</div><div class="stat-lbl">Comentarios</div></div>
        <div class="stat-card"><div class="stat-num">{user.stats.events}</div><div class="stat-lbl">Eventos</div></div>
        <div class="stat-card"><div class="stat-num">{user.stats.shared}</div><div class="stat-lbl">Compartidos</div></div>
        <div class="stat-card"><div class="stat-num">{user.stats.attending}</div><div class="stat-lbl">Asistencias</div></div>
      </div>
    </section>
  {/if}

  <section class="card">
    <div class="label">Mis publicaciones</div>
    <div class="list" style="margin-top: 8px;">
      {#each myPosts as p (p.id)}
        <div class="list-item" style="font-size: 14px;">
          <strong style="flex: 1;">{p.title}</strong>
          <span class="chip" style="font-size: 9px;">{p.category}</span>
          <button type="button" class="btn btn-sm btn-danger" aria-label="Borrar" onclick={() => deletePost(p)}><Glyph name="Trash" size={10} /></button>
        </div>
      {:else}
        <div class="empty">No has publicado nada aún.</div>
      {/each}
    </div>
  </section>

  <section class="card">
    <div class="label">Mis eventos</div>
    <div class="list" style="margin-top: 8px;">
      {#each myEvents as e (e.id)}
        <div class="list-item" style="font-size: 14px;">
          <strong style="flex: 1;">{e.title}</strong>
          <span class="chip {e.status === 'approved' ? 'chip-jade' : e.status === 'pending' ? 'chip-ocre' : 'chip-cinabrio'}" style="font-size: 9px;">{e.status}</span>
          <button type="button" class="btn btn-sm btn-danger" aria-label="Borrar" onclick={() => deleteEvent(e)}><Glyph name="Trash" size={10} /></button>
        </div>
      {:else}
        <div class="empty">No has creado eventos aún.</div>
      {/each}
    </div>
  </section>
{/if}

<style>
  .modal-backdrop {
    position: fixed; inset: 0;
    background: oklch(0.20 0.04 60 / 0.32);
    display: flex; align-items: center; justify-content: center;
    z-index: 110;
    padding: 16px;
  }
  .avatar {
    width: 36px; height: 36px;
    border-radius: 50%;
    background: var(--ocre);
    color: var(--paper);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--serif);
    font-weight: 600;
    flex-shrink: 0;
  }
  .avatar-large { width: 56px; height: 56px; font-size: 22px; }
  .avatar-xl    { width: 72px; height: 72px; font-size: 30px; }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 10px;
  }
  .stat-card {
    background: var(--paper-warm);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 12px 14px;
    text-align: center;
  }
  .stat-num {
    font-family: var(--serif);
    font-size: 26px;
  }
  .stat-lbl {
    font-family: var(--mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--ink-soft);
  }
  @media (max-width: 480px) {
    .stat-num { font-size: 22px; }
  }
</style>
