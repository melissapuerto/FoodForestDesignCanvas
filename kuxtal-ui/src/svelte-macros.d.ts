// Svelte 5 rune stubs for plain TypeScript (non-Svelte-LS) tooling.
// The Svelte compiler transforms rune calls in .svelte and .svelte.ts files before
// TypeScript sees them, so these declarations only affect editors / tools that bypass
// the Svelte language server. Returning bare T (not T & { value: T }) matches the
// Svelte 5 stable API where state variables are accessed directly without .value.

declare function $state<T = undefined>(value?: T): T;

declare function $derived<T>(value: T): T;
declare namespace $derived {
  function by<T>(fn: () => T): T;
}

declare function $effect(fn: () => void | (() => void)): void;
declare function $props<T extends Record<string, unknown>>(): T;
