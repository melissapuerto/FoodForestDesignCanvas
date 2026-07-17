import './app.css';
import { registerSW } from 'virtual:pwa-register';
import { bindInstallEvents } from './lib/stores/install';
import { ensureLocaleLoaded, initialLocale } from './lib/i18n/translate';

bindInstallEvents();

// Load the active language's dictionary before the app module (and its locale
// store) initializes, so an English browser never flashes Spanish. The app
// shell itself is a lazy chunk for the same reason the modules are: the entry
// stays tiny and paints fast on slow connections.
ensureLocaleLoaded(initialLocale())
  .catch(() => {}) // offline + cold cache: fall back to the base language
  .then(async () => {
    const [{ mount }, { default: App }] = await Promise.all([
      import('svelte'),
      import('./App.svelte')
    ]);
    mount(App, { target: document.getElementById('app')! });
  });

registerSW({ immediate: true });
