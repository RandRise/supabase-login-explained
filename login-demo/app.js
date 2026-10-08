import {
  useSignedInToken,
  clearPlaygroundToken,
  updatePlayground,
  sendPlaygroundRequest,
} from './js/playground.js';
// Entry point: startup and page event wiring. Behavior lives in js/.
import { state } from './js/state.js';
import { createApi } from './js/api.js';
import {
  select,
  renderApp,
  clearApiResponse,
  showNotice,
  runAction,
  bindSubmit,
  bindAction,
} from './js/ui.js';
import { signIn, signOut } from './js/auth.js';
import { loadInbox, sendNote } from './js/messaging.js';
import {
  saveConnection,
  importSettings,
  exportSettings,
  loadLocalConnection,
  handleStorageChange,
} from './js/settings.js';

const api = createApi(() => state.config);

bindSubmit('#login-form', () => signIn(api));
bindSubmit('#compose-form', () => sendNote(api));
bindSubmit('#api-form', () => sendPlaygroundRequest(api));
select('#api-use-session').addEventListener('click', useSignedInToken);
select('#api-clear-token').addEventListener('click', clearPlaygroundToken);
select('#api-open').addEventListener('click', () => {
  select('#api-playground').open = true;
  select('#api-playground').scrollIntoView?.({ behavior: 'smooth', block: 'start' });
});
for (const event of ['input', 'change']) {
  select('#api-form').addEventListener(event, () => {
    clearApiResponse();
    updatePlayground();
  });
}
bindSubmit('#config-form', () => saveConnection(api));
bindAction('#logout', () => signOut(api));
bindAction('#reload-inbox', () => loadInbox(api));

select('#setup-open').addEventListener('click', () => select('#setup').showModal());
select('#setup-close').addEventListener('click', () => select('#setup').close());
select('#export-config').addEventListener('click', exportSettings);
select('#import-config').addEventListener('click', () => select('#config-file').click());
select('#config-file').addEventListener('change', () => runAction(() => importSettings(api)));

window.addEventListener('storage', (event) => {
  if (handleStorageChange(event) && state.session && !state.busy) {
    runAction(() => loadInbox(api));
  }
});

select('#project-url').value = state.config?.url || '';
select('#public-key').value = state.config?.key || '';
renderApp();

if (!state.config) {
  showNotice('Open Connection settings to connect your Supabase test project.');
}
await loadLocalConnection();
if (state.session) {
  await runAction(() => loadInbox(api));
}

updatePlayground();
