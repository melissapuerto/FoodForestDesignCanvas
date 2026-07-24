<script lang="ts">
  import { onMount } from 'svelte'
  import { authUser } from '../../lib/api'
  import { apiFetch } from '../../lib/api'
  import { t } from '../../lib/i18n/index.svelte'

  let unreadCount = $state(0)
  let notifications = $state<any[]>([])
  let showDropdown = $state(false)
  let wrapEl: HTMLElement | null = $state(null)
  let bellEl: HTMLButtonElement | null = $state(null)

  onMount(async () => {
    if ($authUser) {
      await loadNotifications()
    }
  })

  // Dismiss the dropdown on Escape (returning focus to the bell) or an
  // outside click — standard expectations for a popup.
  onMount(() => {
    const onDocClick = (e: MouseEvent) => {
      if (showDropdown && wrapEl && !wrapEl.contains(e.target as Node)) {
        showDropdown = false
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showDropdown) {
        e.preventDefault()
        showDropdown = false
        bellEl?.focus()
      }
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  })

  async function loadNotifications(): Promise<void> {
    try {
      const data = await apiFetch('/notifications/')
      notifications = data?.items ?? []
      unreadCount = data?.unread_count ?? 0
    } catch (e) {
      console.warn('Failed to load notifications', e)
    }
  }

  async function markAsRead(id: number): Promise<void> {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'POST' })
      notifications = notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      )
      unreadCount = Math.max(0, unreadCount - 1)
    } catch (e) {
      console.warn('Failed to mark as read', e)
    }
  }

  async function markAllAsRead(): Promise<void> {
    try {
      await apiFetch('/notifications/read_all', { method: 'POST' })
      notifications = notifications.map((n) => ({ ...n, read: true }))
      unreadCount = 0
    } catch (e) {
      console.warn('Failed to mark all as read', e)
    }
  }
</script>

<div
  class="nb-wrap"
  bind:this={wrapEl}
>
  <button
    bind:this={bellEl}
    type="button"
    class="bell-btn codex-card"
    onclick={() => (showDropdown = !showDropdown)}
    aria-label={unreadCount > 0
      ? `${t('notif_aria')}: ${unreadCount}`
      : t('notif_aria')}
    aria-haspopup="true"
    aria-expanded={showDropdown}
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
    {#if unreadCount > 0}
      <span
        class="badge"
        aria-hidden="true">{unreadCount}</span
      >
    {/if}
  </button>

  {#if showDropdown}
    <div
      class="dropdown"
      aria-label={t('notif_title')}
    >
      <div class="header">
        <h4>{t('notif_title')}</h4>
        {#if unreadCount > 0}
          <button
            type="button"
            onclick={markAllAsRead}
            class="mark-all">{t('notif_mark_read')}</button
          >
        {/if}
      </div>
      <div class="list">
        {#each notifications as n (n.id)}
          <button
            type="button"
            class="item {n.read ? 'read' : 'unread'}"
            onclick={() => markAsRead(n.id)}
          >
            <span class="title">{n.title}</span>
            <span class="body">{n.body}</span>
            <span class="date"
              >{new Date(n.created_at).toLocaleDateString()}</span
            >
          </button>
        {/each}
        {#if notifications.length === 0}
          <div class="empty">{t('notif_empty')}</div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  /* Replace custom background and shadow with pure codex-card inherited styles
     while keeping dimensions consistent with other icon-btn elements. */
  .nb-wrap {
    position: relative;
    display: inline-flex;
  }
  .bell-btn {
    position: relative;
    cursor: pointer;
    padding: 8px;
    color: var(--ink);
    min-width: 40px;
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--line-strong);
    background: var(--paper);
    transition: background 0.15s var(--ease-codex);
  }
  @media (pointer: coarse) {
    .bell-btn {
      min-height: 44px;
      min-width: 44px;
    }
  }
  .bell-btn svg {
    width: 18px;
    height: 18px;
  }
  .bell-btn:hover {
    background: var(--paper-warm);
  }
  @media (max-width: 420px) and (pointer: coarse) {
    .bell-btn {
      min-height: 30px;
      min-width: 36px;
      padding: 6px;
      svg {
        width: 16px;
        height: 16px;
      }
    }
  }
  .badge {
    position: absolute;
    top: 2px;
    right: 2px;
    background: var(--cinabrio);
    color: var(--paper);
    border-radius: 10px;
    padding: 1px 6px;
    font-size: calc(11px * var(--text-scale));
    font-weight: 600;
    min-width: 18px;
    text-align: center;
    line-height: 1.4;
  }
  .dropdown {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    background: var(--paper);
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    box-shadow: var(--shadow-lg);
    width: min(300px, calc(100vw - 24px));
    max-height: min(400px, 70dvh);
    overflow: hidden;
    z-index: var(--z-menu);
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
  }
  .header h4 {
    margin: 0;
    font-size: calc(16px * var(--text-scale));
    font-family: var(--serif);
    font-weight: var(--display-weight);
    color: var(--ink);
  }
  .mark-all {
    background: none;
    border: none;
    color: var(--ocre-deep);
    cursor: pointer;
    font-size: calc(13px * var(--text-scale));
    min-height: 32px;
  }
  .mark-all:hover {
    text-decoration: underline;
  }
  .list {
    max-height: min(300px, 56dvh);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .item {
    display: block;
    width: 100%;
    text-align: left;
    font: inherit;
    padding: 12px 16px;
    border: none;
    border-bottom: 1px solid var(--line);
    background: var(--paper);
    color: var(--ink);
    cursor: pointer;
  }
  .item:hover,
  .item:focus-visible {
    background: var(--paper-warm);
  }
  .item.unread {
    background: oklch(0.92 0.05 70);
  }
  .item .title {
    display: block;
    font-weight: 600;
    margin-bottom: 4px;
    color: var(--ink);
  }
  .item .body {
    display: block;
    font-size: calc(14px * var(--text-scale));
    color: var(--ink-soft);
    margin-bottom: 4px;
  }
  .item .date {
    display: block;
    font-size: calc(12px * var(--text-scale));
    color: var(--ink-soft);
  }
  .empty {
    padding: 20px;
    text-align: center;
    color: var(--ink-soft);
  }
</style>
