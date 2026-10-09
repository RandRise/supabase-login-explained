import { SESSION_KEY } from './js/constants.js';
import { state } from './js/state.js';
import { $, render, notice, clearRequest } from './js/ui.js';
import {
  bootstrapConnection,
  openSettings,
  saveConnection,
  exportConnection,
  importConnection,
} from './js/settings.js';
import { signIn, signOut } from './js/auth.js';
import { loadQuiz, loadResult, submitQuiz } from './js/quiz.js';

async function run(action) {
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    await action();
  } catch (error) {
    notice(error.message || 'Request could not reach the server.', true);
  } finally {
    state.busy = false;
    render();
  }
}

$('#settings-export').addEventListener('click', () => run(exportConnection));
$('#settings-import').addEventListener('click', () => $('#settings-file').click());
$('#settings-file').addEventListener('change', () =>
  run(async () => {
    await importConnection();
    await loadQuiz();
  }),
);
$('#sign-in').addEventListener('click', () => $('#login-dialog').showModal());
$('#sign-out').addEventListener('click', () => run(signOut));
$('#settings-open').addEventListener('click', openSettings);
$('#read-result').addEventListener('click', () => run(loadResult));
$('#login-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run(signIn);
});
$('#quiz-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run(submitQuiz);
});
$('#settings-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run(async () => {
    saveConnection();
    await loadQuiz();
  });
});
for (const button of document.querySelectorAll('[data-close]')) {
  button.addEventListener('click', () => button.closest('dialog').close());
}
// Do not keep showing one student's result after another tab changes identity.
window.addEventListener('storage', (event) => {
  if (event.key === SESSION_KEY) {
    state.revision++;
    state.session = null;
    state.result = null;
    clearRequest();
    render();
    notice('Session changed in another tab. Reload to continue.');
  }
});

await run(async () => {
  await bootstrapConnection();
  if (!state.config) {
    openSettings();
    return;
  }
  await loadQuiz();
  notice('Quiz ready. Sign in to save your result.');
  if (state.session) await loadResult(false);
});
