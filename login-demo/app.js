// Entry point: connect the page controls to the functions in js/.
import { TOKEN_TIMER_INTERVAL_MS } from './js/constants.js';
import { state } from './js/state.js';
import { createApi } from './js/api.js';
import {
  select,
  renderApp,
  renderToken,
  updateTokenTimer,
  showNotice,
  logRequest,
  clearRequestLog,
  runAction,
  bindSubmit,
  bindAction,
} from './js/ui.js';
import { signIn, signOut, refreshSession } from './js/auth.js';
import { downloadReport, requestAnonymousReport } from './js/reports.js';
import {
  captureToken,
  replayCopiedToken,
  clearCapturedToken,
  verifyBobNote,
  runEvidenceChecks,
} from './js/token-lab.js';
import {
  saveConnection,
  importSettings,
  exportSettings,
  loadLocalConnection,
  handleStorageChange,
} from './js/settings.js';

const api = createApi(() => state.config, logRequest);
const restored = Boolean(state.session);

// Forms and protected actions.
bindSubmit('#login-form', () => signIn(api));
bindSubmit('#config-form', () => saveConnection(api));
bindSubmit('#baseline-form', () => verifyBobNote(api));
bindAction('#logout', () => signOut(api));
bindAction('#download', () => downloadReport(api));
bindAction('#anonymous', () => requestAnonymousReport(api));
bindAction('#refresh', () => refreshSession(api));
bindAction('#capture', captureToken);
bindAction('#replay', () => replayCopiedToken(api));
bindAction('#tests', () => runEvidenceChecks(api));

// Local controls do not send any Supabase request.
select('#reload-page').addEventListener('click', () => location.reload());
select('#clear-capture').addEventListener('click', clearCapturedToken);
select('#clear-log').addEventListener('click', clearRequestLog);
select('#setup-open').addEventListener('click', () => select('#setup').showModal());
select('#setup-close').addEventListener('click', () => select('#setup').close());
select('#export-config').addEventListener('click', exportSettings);
select('#import-config').addEventListener('click', () => select('#config-file').click());
select('#config-file').addEventListener('change', () => runAction(() => importSettings(api)));

document.querySelectorAll('[data-part]').forEach((button) => {
  button.addEventListener('click', () => {
    state.part = button.dataset.part;
    renderToken();
  });
});
window.addEventListener('storage', handleStorageChange);

// Restore this browser's connection/session and initialize the page.
select('#project-url').value = state.config?.url || '';
select('#public-key').value = state.config?.key || '';
select('#restore-state').textContent = restored
  ? 'Session restored from localStorage on this page load. Report access still requires a new Supabase check.'
  : 'No saved session was loaded on this page.';
renderApp();
setInterval(updateTokenTimer, TOKEN_TIMER_INTERVAL_MS);
if (!state.config) {
  showNotice('Connect your Supabase test project in Connection settings to get started.');
}
loadLocalConnection();
