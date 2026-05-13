import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { registerSW } from 'virtual:pwa-register';
import { bindInstallEvents } from './lib/stores/install';

bindInstallEvents();

const app = mount(App, { target: document.getElementById('app')! });

registerSW({ immediate: true });

export default app;
