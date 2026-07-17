<script lang="ts">
  import { onMount, tick } from 'svelte';
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
  import { t } from '../../lib/i18n/index.svelte';
  import { announce } from '../../lib/stores/announce';
  import { modalA11y } from '../../lib/actions/modalA11y';

  type Tab = 'feed' | 'foro' | 'eventos' | 'compartidos' | 'consultores' | 'perfil';
  let tab = $state<Tab>('feed');
  let user = $derived($authUser);

  // ---- Tab strip: full ARIA tabs keyboard pattern ----
  // Arrow keys / Home / End move between sections so a screen-reader or
  // keyboard user can jump section-to-section without tabbing through content.
  function tabOrder(): Tab[] {
    const base: Tab[] = ['feed', 'foro', 'eventos', 'compartidos', 'consultores'];
    return user ? [...base, 'perfil'] : base;
  }
  /** Post category → translated label (falls back to the raw value). */
  function catLabel(cat: string): string {
    if (cat === 'experiencias') return t('comm_cat_experiences');
    if (cat === 'saberes') return t('comm_cat_saberes');
    if (cat === 'preguntas') return t('comm_cat_questions');
    return cat;
  }
  /** Event status → translated label. */
  function evStatusLabel(status: string): string {
    if (status === 'approved') return t('comm_event_approved');
    if (status === 'pending') return t('comm_event_pending');
    if (status === 'rejected') return t('comm_event_rejected');
    return status;
  }

  function tabLabel(id: Tab): string {
    switch (id) {
      case 'feed': return t('comm_tab_feed');
      case 'foro': return t('comm_tab_forum');
      case 'eventos': return t('comm_tab_events');
      case 'compartidos': return t('comm_tab_shared');
      case 'consultores': return t('comm_tab_consultants');
      case 'perfil': return t('comm_tab_profile');
    }
  }
  function setTab(id: Tab): void {
    tab = id;
    announce(t('a11y_now_in', { name: tabLabel(id) }));
  }
  function onTabKeydown(e: KeyboardEvent): void {
    const ids = tabOrder();
    const i = ids.indexOf(tab);
    let next = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % ids.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + ids.length) % ids.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ids.length - 1;
    else return;
    e.preventDefault();
    const id = ids[next];
    setTab(id);
    tick().then(() => document.getElementById(`comm-tab-${id}`)?.focus());
  }

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
    showToast({ message: t('comm_session_closed'), tone: 'info' });
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
      showToast({ message: t('comm_load_err', { msg: errors[0] }), tone: 'warn', durationMs: 6000 });
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
      showToast({ message: t('comm_welcome', { name: authUsername }), tone: 'ok' });
      loadData();
    } catch (e: any) {
      authError = e.message || t('comm_auth_err');
    } finally {
      authLoading = false;
    }
  }

  function requireAuth(fn: () => void): void {
    if (!user) {
      authMode = 'login';
      showToast({ message: t('comm_login_to_join'), tone: 'info' });
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
      showToast({ message: t('comm_post_required'), tone: 'warn' });
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
      showToast({ message: t('comm_published'), tone: 'ok' });
      // Refresh stats and full list
      void fetchMe();
      loadData();
    } catch (e: any) {
      showToast({ message: e.message || t('comm_publish_err'), tone: 'warn' });
    }
  }

  async function upvotePost(id: number): Promise<void> {
    requireAuth(async () => {
      try {
        const res = await apiFetch(`/posts/${id}/upvote`, { method: 'POST' });
        // Optimistically reflect change instead of a full reload
        posts = posts.map(p => p.id === id ? { ...p, upvotes: res.upvotes, has_upvoted: res.has_upvoted } : p);
      } catch {
        showToast({ message: t('comm_vote_err'), tone: 'warn' });
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
      showToast({ message: t('comm_comment_added'), tone: 'ok' });
    } catch {
      showToast({ message: t('comm_comment_err'), tone: 'warn' });
    }
  }

  async function deleteComment(c: any): Promise<void> {
    const ok = await dialogConfirm({ title: t('comm_delete_comment_q'), confirmLabel: t('common_delete'), danger: true });
    if (!ok) return;
    try {
      await apiFetch(`/comments/${c.id}`, { method: 'DELETE' });
      postComments = postComments.filter(x => x.id !== c.id);
    } catch {
      showToast({ message: t('comm_delete_err'), tone: 'warn' });
    }
  }

  async function deletePost(p: any): Promise<void> {
    const ok = await dialogConfirm({ title: t('comm_delete_post_q'), confirmLabel: t('common_delete'), danger: true });
    if (!ok) return;
    try {
      await apiFetch(`/posts/${p.id}`, { method: 'DELETE' });
      posts = posts.filter(x => x.id !== p.id);
      showToast({ message: t('comm_post_deleted'), tone: 'ok' });
    } catch {
      showToast({ message: t('comm_delete_err'), tone: 'warn' });
    }
  }

  async function submitEvent(): Promise<void> {
    if (!newEventTitle.trim() || !newEventDate) {
      showToast({ message: t('comm_event_required'), tone: 'warn' });
      return;
    }
    try {
      const created = await apiFetch('/events/', {
        method: 'POST',
        body: JSON.stringify({
          title: newEventTitle,
          description: newEventDesc || newEventTitle,
          location: newEventLoc || t('comm_event_tbc'),
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
          ? t('comm_event_published')
          : t('comm_event_in_review'),
        tone: 'ok'
      });
      void fetchMe();
      loadData();
    } catch (e: any) {
      showToast({ message: e.message || t('comm_event_err'), tone: 'warn' });
    }
  }

  async function rsvp(ev: any): Promise<void> {
    requireAuth(async () => {
      try {
        const res = await apiFetch(`/events/${ev.id}/rsvp`, { method: 'POST' });
        events = events.map(e => e.id === ev.id ? { ...e, attending: res.attending, attendee_count: res.attendee_count } : e);
      } catch (e: any) {
        showToast({ message: e.message || t('comm_rsvp_err'), tone: 'warn' });
      }
    });
  }

  async function deleteEvent(ev: any): Promise<void> {
    const ok = await dialogConfirm({ title: t('comm_delete_event_q'), confirmLabel: t('common_delete'), danger: true });
    if (!ok) return;
    try {
      await apiFetch(`/events/${ev.id}`, { method: 'DELETE' });
      events = events.filter(e => e.id !== ev.id);
      showToast({ message: t('comm_event_deleted'), tone: 'ok' });
    } catch {
      showToast({ message: t('comm_delete_err'), tone: 'warn' });
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
          title: `${t('her_rule_prefix')}: ${rule.entity_a}${rule.entity_b ? ' ↔ ' + rule.entity_b : ''}`,
          content: `${t('her_rel_label')}: ${rule.relationship}\n\n${rule.message}\n\n${t('her_attr_label')}: ${rule.attribution || t('her_attr_own')}`,
          category: 'saberes',
          source_type: 'rule',
          source_payload: JSON.stringify(payload),
        })
      });
      if (created?.id) posts = [created, ...posts];
      isSharePicker = false;
      showToast({ message: t('comm_rule_shared'), tone: 'ok' });
      void fetchMe();
      loadData();
    } catch (e: any) {
      showToast({ message: e.message || t('share_error'), tone: 'warn' });
    }
  }

  async function shareLocalSaber(s: any): Promise<void> {
    try {
      const payload = { title: s.title, body: s.body, recorded_at: s.recorded_at };
      const created = await apiFetch('/posts/', {
        method: 'POST',
        body: JSON.stringify({
          title: t('her_saber_title', { title: s.title || t('her_untitled') }),
          content: s.body || t('her_no_desc'),
          category: 'saberes',
          source_type: 'saber',
          source_payload: JSON.stringify(payload),
        })
      });
      if (created?.id) posts = [created, ...posts];
      isSharePicker = false;
      showToast({ message: t('comm_saber_shared'), tone: 'ok' });
      void fetchMe();
      loadData();
    } catch (e: any) {
      showToast({ message: e.message || t('share_error'), tone: 'warn' });
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
        showToast({ message: t('comm_rule_imported'), tone: 'ok' });
      } else if (p.source_type === 'saber') {
        addLog({
          landId: get(activeLandId),
          kind: 'saber',
          title: data.title || p.title,
          body: (data.body ?? p.content ?? '') + `\n\n— Por @${p.author_username}`,
        });
        showToast({ message: t('comm_saber_imported'), tone: 'ok' });
      }
      refreshLocal();
    } catch {
      showToast({ message: t('comm_import_err'), tone: 'warn' });
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
          showToast({ message: t('comm_confirm_pwd'), tone: 'warn' });
          return;
        }
        body.current_password = editCurrentPwd;
        body.new_password = editNewPwd;
      }
      await apiFetch('/users/me/', { method: 'PATCH', body: JSON.stringify(body) });
      await fetchMe();
      isEditingProfile = false;
      showToast({ message: t('comm_profile_updated'), tone: 'ok' });
    } catch (e: any) {
      showToast({ message: e.message || t('comm_profile_update_err'), tone: 'warn' });
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
  <div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) closeAllModals(); }} use:modalA11y={{ onClose: closeAllModals }} role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="auth-title">
    <div class="card" style="padding: 20px; width: 320px; max-width: 92vw;">
      <div class="row" style="justify-content: space-between; margin-bottom: 16px;">
        <div class="label" id="auth-title">{authMode === 'login' ? t('comm_login') : t('comm_register')}</div>
        <button type="button" class="btn-ghost btn btn-sm" aria-label={t('comm_close_aria')} onclick={() => (authMode = null)}><Glyph name="Close" size={16} /></button>
      </div>
      <div class="field-row">
        <label for="u-username">{t('community_user')}</label>
        <input id="u-username" class="inp" autocomplete="username" bind:value={authUsername} />
      </div>
      {#if authMode === 'register'}
        <div class="field-row" style="margin-top: 12px;">
          <label for="u-email">{t('comm_email_label')}</label>
          <input id="u-email" type="email" class="inp" autocomplete="email" bind:value={authEmail} />
        </div>
      {/if}
      <div class="field-row" style="margin-top: 12px;">
        <label for="u-password">{t('comm_pass_label')}</label>
        <input id="u-password" type="password" class="inp" autocomplete={authMode === 'register' ? 'new-password' : 'current-password'} bind:value={authPassword} />
      </div>
      {#if authError}
        <div class="banner warn" style="margin-top: 12px;" role="alert">{authError}</div>
      {/if}
      <div class="row" style="margin-top: 20px; gap: 8px;">
        <button type="button" class="btn btn-primary" style="flex: 1;" onclick={handleAuth} disabled={authLoading}>
          {authLoading ? '...' : (authMode === 'login' ? t('comm_submit_login') : t('comm_submit_register'))}
        </button>
      </div>
      <div style="text-align: center; margin-top: 16px;">
        <button type="button" class="btn btn-sm btn-ghost" onclick={() => (authMode = authMode === 'login' ? 'register' : 'login')}>
          {authMode === 'login' ? t('comm_switch_to_register') : t('comm_switch_to_login')}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ═══ POST COMPOSE ═══ -->
{#if isComposing}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
  <div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) closeAllModals(); }} use:modalA11y={{ onClose: closeAllModals }} role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="post-title">
    <div class="card" style="padding: 20px; width: 420px; max-width: 92vw;">
      <div class="row" style="justify-content: space-between; margin-bottom: 16px;">
        <div class="label" id="post-title">{t('comm_new_post')}</div>
        <button type="button" class="btn-ghost btn btn-sm" aria-label={t('comm_close_aria')} onclick={() => (isComposing = false)}><Glyph name="Close" size={16} /></button>
      </div>
      <div class="field-row">
        <label for="p-title">{t('comm_post_title')}</label>
        <input id="p-title" class="inp" bind:value={newPostTitle} />
      </div>
      <div class="field-row" style="margin-top: 12px;">
        <label for="p-cat">{t('comm_post_category')}</label>
        <select id="p-cat" class="inp" bind:value={newPostCategory}>
          <option value="experiencias">{t('comm_cat_experiences')}</option>
          <option value="saberes">{t('comm_cat_saberes')}</option>
          <option value="preguntas">{t('comm_cat_questions')}</option>
        </select>
      </div>
      <div class="field-row" style="margin-top: 12px;">
        <label for="p-body">{t('comm_post_content')}</label>
        <textarea id="p-body" class="inp" rows="4" bind:value={newPostBody}></textarea>
      </div>
      <div class="row" style="margin-top: 20px;">
        <button type="button" class="btn btn-primary" style="width: 100%;" onclick={submitPost}>{t('comm_publish')}</button>
      </div>
    </div>
  </div>
{/if}

<!-- ═══ EVENT COMPOSE ═══ -->
{#if isComposingEvent}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
  <div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) closeAllModals(); }} use:modalA11y={{ onClose: closeAllModals }} role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="ev-title">
    <div class="card" style="padding: 20px; width: 420px; max-width: 92vw;">
      <div class="row" style="justify-content: space-between; margin-bottom: 16px;">
        <div class="label" id="ev-title">{t('comm_new_event')}</div>
        <button type="button" class="btn-ghost btn btn-sm" aria-label={t('comm_close_aria')} onclick={() => (isComposingEvent = false)}><Glyph name="Close" size={16} /></button>
      </div>
      <div class="banner" style="margin-bottom: 12px;">
        {t('comm_event_pending_note')}
      </div>
      <div class="field-row"><label for="ev-t">{t('comm_event_title')}</label>
        <input id="ev-t" class="inp" bind:value={newEventTitle} /></div>
      <div class="field-row" style="margin-top: 8px;"><label for="ev-d">{t('comm_event_desc')}</label>
        <textarea id="ev-d" class="inp" rows="3" bind:value={newEventDesc}></textarea></div>
      <div class="field-row" style="margin-top: 8px;"><label for="ev-l">{t('comm_event_location')}</label>
        <input id="ev-l" class="inp" bind:value={newEventLoc} /></div>
      <div class="field-row" style="margin-top: 8px;"><label for="ev-dt">{t('comm_event_date')}</label>
        <input id="ev-dt" class="inp" type="datetime-local" bind:value={newEventDate} /></div>
      <div class="row" style="margin-top: 20px;">
        <button type="button" class="btn btn-primary" style="width: 100%;" onclick={submitEvent}>{t('comm_event_create')}</button>
      </div>
    </div>
  </div>
{/if}

<!-- ═══ SHARE-LOCAL PICKER ═══ -->
{#if isSharePicker}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
  <div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) closeAllModals(); }} use:modalA11y={{ onClose: closeAllModals }} role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="sh-title">
    <div class="card" style="padding: 20px; width: 480px; max-width: 92vw; max-height: 85vh; overflow-y: auto;">
      <div class="row" style="justify-content: space-between; margin-bottom: 12px;">
        <div class="label" id="sh-title">{t('comm_share_title')}</div>
        <button type="button" class="btn-ghost btn btn-sm" aria-label={t('comm_close_aria')} onclick={() => (isSharePicker = false)}><Glyph name="Close" size={16} /></button>
      </div>
      <div class="row" style="gap: 6px;" role="group" aria-label={t('a11y_comm_share_type')}>
        <button type="button" class="chip {sharePickerTab === 'rules' ? 'chip-ocre' : ''}" aria-pressed={sharePickerTab === 'rules'} onclick={() => (sharePickerTab = 'rules')}>{t('comm_my_rules', { n: String(myRules.length) })}</button>
        <button type="button" class="chip {sharePickerTab === 'saberes' ? 'chip-ocre' : ''}" aria-pressed={sharePickerTab === 'saberes'} onclick={() => (sharePickerTab = 'saberes')}>{t('comm_my_saberes', { n: String(mySaberes.length) })}</button>
      </div>
      <div class="row" style="margin-top: 10px;">
        <input class="inp" type="search" placeholder={t('comm_search')} bind:value={sharePickerSearch} aria-label={t('common_search')} />
      </div>
      <div class="list" style="margin-top: 12px;">
        {#if sharePickerTab === 'rules'}
          {#each filteredRules as r (r.id)}
            <article class="list-item" style="flex-direction: column; align-items: stretch; gap: 6px;">
              <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(15px * var(--text-scale));"><strong>{r.entity_a}</strong> ↔ {r.entity_b ?? '—'}</div>
              <div class="coord">{t(('rules_rel_' + r.relationship) as any)} · {r.message.slice(0, 90)}</div>
              <div class="row" style="justify-content: flex-end;"><button type="button" class="btn btn-sm btn-primary" onclick={() => shareLocalRule(r)}>{t('rules_share_btn')}</button></div>
            </article>
          {:else}
            <div class="empty">{t('comm_no_rules')}</div>
          {/each}
        {:else}
          {#each filteredSaberes as s (s.id)}
            <article class="list-item" style="flex-direction: column; align-items: stretch; gap: 6px;">
              <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(15px * var(--text-scale));">{s.title || t('community_no_title')}</div>
              <div class="coord">{(s.body || '').slice(0, 110)}</div>
              <div class="row" style="justify-content: flex-end;"><button type="button" class="btn btn-sm btn-primary" onclick={() => shareLocalSaber(s)}>{t('rules_share_btn')}</button></div>
            </article>
          {:else}
            <div class="empty">{t('comm_no_saberes')}</div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- ═══ PROFILE EDIT MODAL ═══ -->
{#if isEditingProfile}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
  <div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) closeAllModals(); }} use:modalA11y={{ onClose: closeAllModals }} role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="prof-title">
    <div class="card" style="padding: 20px; width: 420px; max-width: 92vw;">
      <div class="row" style="justify-content: space-between; margin-bottom: 14px;">
        <div class="label" id="prof-title">{t('comm_edit_profile')}</div>
        <button type="button" class="btn-ghost btn btn-sm" aria-label={t('comm_close_aria')} onclick={() => (isEditingProfile = false)}><Glyph name="Close" size={16} /></button>
      </div>
      <div class="field-row"><label for="pe-em">{t('comm_email_label')}</label><input id="pe-em" class="inp" type="email" bind:value={editEmail} /></div>
      <div class="field-row" style="margin-top: 10px;"><label for="pe-loc">{t('comm_profile_location')}</label><input id="pe-loc" class="inp" bind:value={editLocation} /></div>
      <div class="field-row" style="margin-top: 10px;"><label for="pe-bio">{t('comm_profile_bio')}</label><textarea id="pe-bio" class="inp" rows="3" bind:value={editBio}></textarea></div>
      <div class="weave" style="margin: 14px 0;" aria-hidden="true"></div>
      <div class="label" style="margin-bottom: 6px;">{t('comm_change_pass')}</div>
      <div class="field-row"><label for="pe-cp">{t('comm_current_pass')}</label><input id="pe-cp" class="inp" type="password" autocomplete="current-password" bind:value={editCurrentPwd} /></div>
      <div class="field-row" style="margin-top: 10px;"><label for="pe-np">{t('comm_new_pass')}</label><input id="pe-np" class="inp" type="password" autocomplete="new-password" bind:value={editNewPwd} /></div>
      <div class="row" style="margin-top: 18px;">
        <button type="button" class="btn btn-primary" style="flex: 1;" onclick={saveProfile}>{t('comm_save')}</button>
      </div>
    </div>
  </div>
{/if}

<!-- ═══ MAIN ═══ -->
{#if lastLoadError}
  <div class="banner warn" style="margin-bottom: 12px;" role="alert">
    <strong>{t('comm_error')}</strong>
    <div style="margin-top: 4px; font-family: var(--mono); font-size: calc(11px * var(--text-scale)); word-break: break-all;">{lastLoadError}</div>
    <button type="button" class="btn btn-sm" style="margin-top: 8px;" onclick={() => loadData()}>{t('comm_retry')}</button>
  </div>
{/if}

{#if !user}
  <div class="banner" style="margin-bottom: 12px;" role="status">
    {t('comm_anon_notice')}
    <button type="button" class="btn btn-sm btn-accent" style="margin: 0 4px;" onclick={() => (authMode = 'login')}>{t('comm_anon_login_btn')}</button>
  </div>
{/if}

<!-- Code of Conduct -->
<section class="card-warm card">
  <div class="label">{t('comm_code_of_conduct')}</div>
  <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(14px * var(--text-scale)); line-height: 1.6; margin-top: 6px; color: var(--ink-soft);">
    {t('comm_coc_text')}
  </div>
</section>

<!-- Tab bar -->
<section class="card" style="padding: 10px 14px;">
  <div class="row wrap" style="gap: 4px;" role="tablist" aria-label={t('a11y_comm_tabs')}>
    {#each [
      { id: 'feed', l: t('comm_tab_feed'), icon: 'Book' },
      { id: 'foro', l: t('comm_tab_forum'), icon: 'Help' },
      { id: 'eventos', l: t('comm_tab_events'), icon: 'Sun' },
      { id: 'compartidos', l: t('comm_tab_shared'), icon: 'Sparkle' },
      { id: 'consultores', l: t('comm_tab_consultants'), icon: 'People' },
    ] as tb}
      <button
        type="button"
        id={`comm-tab-${tb.id}`}
        class="chip {tab === tb.id ? 'chip-jade' : ''}"
        role="tab"
        aria-selected={tab === tb.id}
        tabindex={tab === tb.id ? 0 : -1}
        onclick={() => setTab(tb.id as Tab)}
        onkeydown={onTabKeydown}
        style="font-size: calc(11px * var(--text-scale));"
      >
        <Glyph name={tb.icon as GlyphName} size={12} /> {tb.l}
      </button>
    {/each}
    {#if user}
      <button
        type="button"
        id="comm-tab-perfil"
        class="chip {tab === 'perfil' ? 'chip-ocre' : ''}"
        role="tab"
        aria-selected={tab === 'perfil'}
        tabindex={tab === 'perfil' ? 0 : -1}
        onclick={() => setTab('perfil')}
        onkeydown={onTabKeydown}
        style="font-size: calc(11px * var(--text-scale));"
      >
        <Glyph name="People" size={12} /> {t('comm_tab_profile')}
      </button>
    {/if}
  </div>
</section>

{#if loading}
  <div class="empty" role="status">{t('comm_loading')}</div>
{/if}

<!-- ═══ FEED ═══ -->
{#if tab === 'feed'}
  <section class="card" style="padding: 10px 14px;">
    <div class="row wrap" style="gap: 4px;" role="group" aria-label={t('a11y_comm_feed_filters')}>
      {#each [
        {v:'todo', l: t('comm_filter_all')},
        {v:'experiencias', l: t('comm_filter_experiences')},
        {v:'saberes', l: t('comm_filter_saberes')},
        {v:'preguntas', l: t('comm_filter_questions')}
      ] as s}
        <button type="button" class="chip {feedSection === s.v ? 'chip-ocre' : ''}" aria-pressed={feedSection === s.v} onclick={() => (feedSection = s.v as any)} style="font-size: calc(10px * var(--text-scale));">{s.l}</button>
      {/each}
    </div>
  </section>

  <div class="list">
    {#each filteredPosts as post (post.id)}
      <article class="list-item" style="flex-direction: column; gap: 8px; align-items: stretch;">
        <div class="row" style="gap: 10px;">
          <div class="avatar" aria-hidden="true">{(post.author_username || '?').charAt(0).toUpperCase()}</div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(16px * var(--text-scale)); font-weight: 600;">@{post.author_username}</div>
            <div class="coord">{new Date(post.created_at).toLocaleDateString()} · <span class="chip" style="font-size: calc(9px * var(--text-scale));">{catLabel(post.category)}</span>
              {#if post.source_type}<span class="chip chip-jade" style="font-size: calc(9px * var(--text-scale));">{t('comm_from_source', { source: post.source_type === 'rule' ? t('chip_rule') : t('chip_saber') })}</span>{/if}
            </div>
          </div>
        </div>
        <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(15px * var(--text-scale)); line-height: 1.55; word-wrap: break-word;"><strong>{post.title}</strong><br/>{post.content}</div>
        <div class="row wrap" style="gap: 8px;">
          <button type="button" class="btn btn-sm" aria-pressed={!!post.has_upvoted} aria-label={t('comm_upvote_aria', { n: String(post.upvotes) })} onclick={() => upvotePost(post.id)}>
            <span aria-hidden="true">{post.has_upvoted ? '♥' : '♡'}</span> {post.upvotes}
          </button>
          <button type="button" class="btn btn-sm" onclick={() => openComments(post)}>
            <Glyph name="Help" size={12} /> {t('community_comments')}
          </button>
          {#if post.source_type && user}
            <button type="button" class="btn btn-sm btn-accent" onclick={() => importToFinca(post)}>
              <Glyph name="ArrowRight" size={12} /> {t('comm_import_btn')}
            </button>
          {/if}
          {#if user && (post.author_id === user.id || user.role === 'admin' || user.role === 'mod')}
            <button type="button" class="btn btn-sm btn-danger" onclick={() => deletePost(post)} aria-label={t('a11y_comm_delete_post')}>
              <Glyph name="Trash" size={12} />
            </button>
          {/if}
        </div>

        {#if activePostForComments?.id === post.id}
          <div class="card-soft" style="margin-top: 8px; padding: 12px;">
            <div class="label" style="font-size: calc(12px * var(--text-scale)); margin-bottom: 8px;">{t('community_comments')}</div>
            <div class="list" style="max-height: 220px; overflow-y: auto; margin-bottom: 10px;">
              {#each postComments as c (c.id)}
                <div style="font-size: calc(13px * var(--text-scale)); margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid var(--paper-warm); display: flex; gap: 6px; align-items: flex-start;">
                  <div style="flex: 1;"><strong>@{c.author_username}:</strong> {c.content}</div>
                  {#if user && (c.author_id === user.id || user.role === 'admin' || user.role === 'mod')}
                    <button type="button" class="btn btn-sm btn-ghost" aria-label={t('a11y_comm_delete_comment')} onclick={() => deleteComment(c)}><Glyph name="Trash" size={10} /></button>
                  {/if}
                </div>
              {:else}
                <div class="coord">{t('comm_no_replies')}</div>
              {/each}
            </div>
            {#if user}
              <div class="row" style="gap: 8px;">
                <input class="inp" placeholder={t('comm_reply_placeholder')} aria-label={t('a11y_comm_comment_field')} bind:value={newCommentContent} />
                <button type="button" class="btn btn-sm btn-primary" onclick={submitComment}>{t('comm_send')}</button>
              </div>
            {:else}
              <button type="button" class="btn btn-sm btn-accent" onclick={() => (authMode = 'login')}>{t('comm_login_to_reply')}</button>
            {/if}
          </div>
        {/if}
      </article>
    {:else}
      <div class="empty">{t('comm_no_posts')}</div>
    {/each}
  </div>

  <div style="padding: 16px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
    <button type="button" class="btn btn-primary" onclick={() => requireAuth(() => (isComposing = true))}>
      <Glyph name="Plus" size={14} /> {t('comm_new_post')}
    </button>
    <button type="button" class="btn btn-accent" onclick={openSharePicker}>
      <Glyph name="Sparkle" size={14} /> {t('comm_share_title')}
    </button>
  </div>

<!-- ═══ FORO ═══ -->
{:else if tab === 'foro'}
  <div class="list">
    {#each posts.filter(p => p.category === 'preguntas') as topic (topic.id)}
      <article class="list-item" style="flex-direction: column; gap: 6px; align-items: stretch;">
        <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(16px * var(--text-scale)); line-height: 1.3;">{topic.title}</div>
        <div class="coord">@{topic.author_username} · {new Date(topic.created_at).toLocaleDateString()} · {topic.upvotes} votos</div>
        <div class="row wrap" style="gap: 6px;">
          <button type="button" class="btn btn-sm" onclick={() => openComments(topic)}>{t('comm_view_replies')}</button>
        </div>
        {#if activePostForComments?.id === topic.id}
          <div class="card-soft" style="padding: 10px;">
            {#each postComments as c (c.id)}
              <div style="font-size: calc(13px * var(--text-scale)); margin-bottom: 6px;"><strong>@{c.author_username}:</strong> {c.content}</div>
            {:else}
              <div class="coord">{t('comm_no_replies')}</div>
            {/each}
            {#if user}
              <div class="row" style="gap: 8px; margin-top: 8px;">
                <input class="inp" placeholder={t('comm_reply_placeholder')} aria-label={t('a11y_comm_reply_field')} bind:value={newCommentContent} />
                <button type="button" class="btn btn-sm btn-primary" onclick={submitComment}>{t('comm_send')}</button>
              </div>
            {:else}
              <button type="button" class="btn btn-sm btn-accent" style="margin-top: 8px;" onclick={() => (authMode = 'login')}>{t('comm_login_to_reply')}</button>
            {/if}
          </div>
        {/if}
      </article>
    {:else}
      <div class="empty">{t('comm_no_forum')}</div>
    {/each}
  </div>
  <div style="padding: 16px; text-align: center;">
    <button type="button" class="btn btn-primary" onclick={() => requireAuth(() => { isComposing = true; newPostCategory = 'preguntas'; })}>
      <Glyph name="Plus" size={14} /> {t('comm_new_question')}
    </button>
  </div>

<!-- ═══ EVENTOS ═══ -->
{:else if tab === 'eventos'}
  <div class="list">
    {#each events as ev (ev.id)}
      <article class="list-item" style="flex-direction: column; gap: 8px; align-items: stretch;">
        <div class="row" style="justify-content: space-between; gap: 8px; flex-wrap: wrap;">
          <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(17px * var(--text-scale)); flex: 1; min-width: 0;">{ev.title}</div>
          {#if ev.status === 'pending'}<span class="chip chip-ocre" style="font-size: calc(10px * var(--text-scale));">{t('comm_event_pending')}</span>{/if}
          {#if ev.status === 'rejected'}<span class="chip chip-cinabrio" style="font-size: calc(10px * var(--text-scale));">{t('comm_event_rejected')}</span>{/if}
        </div>
        {#if ev.description}<div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(14px * var(--text-scale)); line-height: 1.5;">{ev.description}</div>{/if}
        <div class="coord">{new Date(ev.event_date).toLocaleString()} · {ev.location} · @{ev.organizer_username}</div>
        <div class="coord">{ev.attendee_count} {ev.attendee_count === 1 ? t('comm_attendee') : t('comm_attendees')}</div>
        <div class="row wrap" style="gap: 6px;">
          {#if ev.status === 'approved'}
            <button type="button" class="btn btn-sm {ev.attending ? 'btn-primary' : 'btn-accent'}" aria-pressed={!!ev.attending} onclick={() => rsvp(ev)}>
              {ev.attending ? t('comm_will_attend') : t('comm_attend')}
            </button>
          {/if}
          {#if user && (ev.organizer_id === user.id || user.role === 'admin' || user.role === 'mod')}
            <button type="button" class="btn btn-sm btn-danger" onclick={() => deleteEvent(ev)} aria-label={t('a11y_comm_delete_event')}>
              <Glyph name="Trash" size={12} />
            </button>
          {/if}
        </div>
      </article>
    {:else}
      <div class="empty">{t('comm_no_events')}</div>
    {/each}
  </div>
  <div style="padding: 16px; text-align: center;">
    <button type="button" class="btn btn-primary" onclick={() => requireAuth(() => (isComposingEvent = true))}>
      <Glyph name="Plus" size={14} /> {t('comm_create_event')}
    </button>
  </div>

<!-- ═══ COMPARTIDOS (Heredado/Saberes only) ═══ -->
{:else if tab === 'compartidos'}
  <section class="card-warm card">
    <div class="label">{t('comm_shared_title')}</div>
    <p class="sub" style="margin-top: 6px;">
      {t('comm_shared_sub')}
    </p>
  </section>
  <div class="list">
    {#each posts.filter(p => p.source_type === 'rule' || p.source_type === 'saber') as post (post.id)}
      <article class="list-item" style="flex-direction: column; gap: 8px; align-items: stretch;">
        <div class="row" style="gap: 10px;">
          <div class="avatar" aria-hidden="true">{post.source_type === 'rule' ? '⚖' : '✦'}</div>
          <div style="flex: 1;">
            <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(15px * var(--text-scale)); font-weight: 600;">{post.title}</div>
            <div class="coord">@{post.author_username} · {new Date(post.created_at).toLocaleDateString()}</div>
          </div>
          <span class="chip {post.source_type === 'rule' ? 'chip-jade' : 'chip-ocre'}" style="font-size: calc(9px * var(--text-scale));">{post.source_type === 'rule' ? t('chip_rule') : t('chip_saber')}</span>
        </div>
        <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(14px * var(--text-scale)); line-height: 1.55;">{post.content}</div>
        <div class="row wrap" style="gap: 6px;">
          <button type="button" class="btn btn-sm" onclick={() => upvotePost(post.id)} aria-pressed={!!post.has_upvoted} aria-label={t('comm_upvote_aria', { n: String(post.upvotes) })}>
            <span aria-hidden="true">{post.has_upvoted ? '♥' : '♡'}</span> {post.upvotes}
          </button>
          {#if user}
            <button type="button" class="btn btn-sm btn-accent" onclick={() => importToFinca(post)}>
              <Glyph name="ArrowRight" size={12} /> {t('comm_import_btn')}
            </button>
          {/if}
        </div>
      </article>
    {:else}
      <div class="empty">{t('comm_no_shared')}</div>
    {/each}
  </div>
  <div style="padding: 16px; text-align: center;">
    <button type="button" class="btn btn-primary" onclick={openSharePicker}>
      <Glyph name="Sparkle" size={14} /> {t('comm_share_title')}
    </button>
  </div>

<!-- ═══ CONSULTORES ═══ -->
{:else if tab === 'consultores'}
  <div class="list">
    {#each consultants as c (c.id)}
      <article class="list-item" style="gap: 14px;">
        <div class="avatar avatar-large" aria-hidden="true">👨‍🌾</div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(17px * var(--text-scale));">{c.name}</div>
          <div class="coord">{c.contact}</div>
          <div class="tag-row" style="margin-top: 4px;">
            <span class="chip chip-ocre" style="font-size: calc(10px * var(--text-scale));">{c.specialty}</span>
            <span class="chip chip-jade" style="font-size: calc(10px * var(--text-scale));">{t('comm_endorsements', { n: String(c.endorsements) })}</span>
          </div>
        </div>
      </article>
    {:else}
      <div class="empty">{t('comm_no_consultants')}</div>
    {/each}
  </div>

<!-- ═══ PERFIL ═══ -->
{:else if tab === 'perfil' && user}
  <section class="card-warm card">
    <div class="row" style="gap: 16px; align-items: flex-start; flex-wrap: wrap;">
      <div class="avatar avatar-xl" aria-hidden="true">{user.username.charAt(0).toUpperCase()}</div>
      <div style="flex: 1; min-width: 200px;">
        <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(22px * var(--text-scale)); font-weight: 600; line-height: 1.1;">@{user.username}</div>
        <div class="coord">{user.email}</div>
        {#if user.role && user.role !== 'user'}
          <span class="chip chip-jade" style="margin-top: 6px; font-size: calc(10px * var(--text-scale));">{user.role}</span>
        {/if}
        {#if user.location}
          <div class="coord" style="margin-top: 6px;">📍 {user.location}</div>
        {/if}
        {#if user.bio}
          <div style="margin-top: 8px; font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(14px * var(--text-scale)); line-height: 1.5;">{user.bio}</div>
        {/if}
      </div>
    </div>
    <div class="row wrap" style="gap: 8px; margin-top: 16px;">
      <button type="button" class="btn btn-sm" onclick={openProfileEdit}>{t('comm_edit_profile')}</button>
      <button type="button" class="btn btn-sm btn-danger" onclick={logout}>{t('comm_logout')}</button>
    </div>
  </section>

  {#if user.stats}
    <section class="card">
      <div class="label">{t('comm_my_stats')}</div>
      <div class="stats-grid" style="margin-top: 10px;">
        <div class="stat-card"><div class="stat-num">{user.stats.posts}</div><div class="stat-lbl">{t('comm_stat_posts')}</div></div>
        <div class="stat-card"><div class="stat-num">{user.stats.comments}</div><div class="stat-lbl">{t('comm_stat_comments')}</div></div>
        <div class="stat-card"><div class="stat-num">{user.stats.events}</div><div class="stat-lbl">{t('comm_stat_events')}</div></div>
        <div class="stat-card"><div class="stat-num">{user.stats.shared}</div><div class="stat-lbl">{t('comm_stat_shared')}</div></div>
        <div class="stat-card"><div class="stat-num">{user.stats.attending}</div><div class="stat-lbl">{t('comm_stat_attendance')}</div></div>
      </div>
    </section>
  {/if}

  <section class="card">
    <div class="label">{t('comm_my_posts')}</div>
    <div class="list" style="margin-top: 8px;">
      {#each myPosts as p (p.id)}
        <div class="list-item" style="font-size: calc(14px * var(--text-scale));">
          <strong style="flex: 1;">{p.title}</strong>
          <span class="chip" style="font-size: calc(9px * var(--text-scale));">{catLabel(p.category)}</span>
          <button type="button" class="btn btn-sm btn-danger" aria-label={t('a11y_comm_delete_post')} onclick={() => deletePost(p)}><Glyph name="Trash" size={10} /></button>
        </div>
      {:else}
        <div class="empty">{t('comm_no_my_posts')}</div>
      {/each}
    </div>
  </section>

  <section class="card">
    <div class="label">{t('comm_my_events')}</div>
    <div class="list" style="margin-top: 8px;">
      {#each myEvents as e (e.id)}
        <div class="list-item" style="font-size: calc(14px * var(--text-scale));">
          <strong style="flex: 1;">{e.title}</strong>
          <span class="chip {e.status === 'approved' ? 'chip-jade' : e.status === 'pending' ? 'chip-ocre' : 'chip-cinabrio'}" style="font-size: calc(9px * var(--text-scale));">{evStatusLabel(e.status)}</span>
          <button type="button" class="btn btn-sm btn-danger" aria-label={t('a11y_comm_delete_event')} onclick={() => deleteEvent(e)}><Glyph name="Trash" size={10} /></button>
        </div>
      {:else}
        <div class="empty">{t('comm_no_my_events')}</div>
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
  .avatar-large { width: 56px; height: 56px; font-size: calc(22px * var(--text-scale)); }
  .avatar-xl    { width: 72px; height: 72px; font-size: calc(30px * var(--text-scale)); }
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
    font-family: var(--serif); font-weight: var(--display-weight);
    font-size: calc(26px * var(--text-scale));
  }
  .stat-lbl {
    font-family: var(--mono);
    font-size: calc(10px * var(--text-scale));
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--ink-soft);
  }
  @media (max-width: 480px) {
    .stat-num { font-size: calc(22px * var(--text-scale)); }
  }
</style>
