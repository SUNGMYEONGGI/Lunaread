// App-wide dialogs and toasts are opened through window events, so any component can trigger them.
export const APP_NAME = 'Lunaread';
export const toast = (msg: string) => window.dispatchEvent(new CustomEvent('toast', { detail: msg }));
export const openSettings = () => window.dispatchEvent(new Event('open-settings'));
export const openThemePicker = () => window.dispatchEvent(new Event('theme-picker'));
export const openSetup = () => window.dispatchEvent(new Event('open-setup'));
export const openGetStarted = () => window.dispatchEvent(new Event('get-started'));
export const isDesktop = () => typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
export const docsChanged = () => window.dispatchEvent(new Event('docs-changed'));
