<script lang="ts">
  import { onMount } from 'svelte';
  import { authUser } from '../../lib/api';
  import { apiFetch } from '../../lib/api';

  let unreadCount = $state(0);
  let notifications = $state<any[]>([]);
  let showDropdown = $state(false);

  onMount(async () => {
    if ($authUser) {
      await loadNotifications();
    }
  });

  async function loadNotifications(): Promise<void> {
    try {
      const data = await apiFetch('/notifications/');
      notifications = data.items;
      unreadCount = data.unread_count;
    } catch (e) {
      console.warn('Failed to load notifications', e);
    }
  }

  async function markAsRead(id: number): Promise<void> {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'POST' });
      notifications = notifications.map(n => n.id === id ? { ...n, read: true } : n);
      unreadCount = Math.max(0, unreadCount - 1);
    } catch (e) {
      console.warn('Failed to mark as read', e);
    }
  }

  async function markAllAsRead(): Promise<void> {
    try {
      await apiFetch('/notifications/read_all', { method: 'POST' });
      notifications = notifications.map(n => ({ ...n, read: true }));
      unreadCount = 0;
    } catch (e) {
      console.warn('Failed to mark all as read', e);
    }
  }
</script>

<button
  type="button"
  class="bell-btn"
  onclick={() => showDropdown = !showDropdown}
  aria-label="Notifications"
>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
  {#if unreadCount > 0}
    <span class="badge">{unreadCount}</span>
  {/if}
</button>

{#if showDropdown}
  <div class="dropdown">
    <div class="header">
      <h4>Notificaciones</h4>
      {#if unreadCount > 0}
        <button onclick={markAllAsRead} class="mark-all">Marcar todas como leídas</button>
      {/if}
    </div>
    <div class="list">
      {#each notifications as n}
        <div class="item {n.read ? 'read' : 'unread'}" onclick={() => markAsRead(n.id)} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') markAsRead(n.id); }}>
          <div class="title">{n.title}</div>
          <div class="body">{n.body}</div>
          <div class="date">{new Date(n.created_at).toLocaleDateString()}</div>
        </div>
      {/each}
      {#if notifications.length === 0}
        <div class="empty">No hay notificaciones</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .bell-btn {
    position: relative;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    border-radius: 4px;
    color: var(--text);
  }
  .bell-btn:hover {
    background: var(--hover);
  }
  .badge {
    position: absolute;
    top: 4px;
    right: 4px;
    background: var(--accent);
    color: white;
    border-radius: 10px;
    padding: 2px 6px;
    font-size: 12px;
    min-width: 18px;
    text-align: center;
  }
  .dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    width: 300px;
    max-height: 400px;
    overflow: hidden;
    z-index: 1000;
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
    font-size: 16px;
  }
  .mark-all {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    font-size: 14px;
  }
  .list {
    max-height: 300px;
    overflow-y: auto;
  }
  .item {
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
    cursor: pointer;
  }
  .item:hover {
    background: var(--hover);
  }
  .item.unread {
    background: rgba(var(--accent-rgb), 0.1);
  }
  .title {
    font-weight: 600;
    margin-bottom: 4px;
  }
  .body {
    font-size: 14px;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }
  .date {
    font-size: 12px;
    color: var(--text-secondary);
  }
  .empty {
    padding: 20px;
    text-align: center;
    color: var(--text-secondary);
  }
</style>