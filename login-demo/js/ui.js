import { MAX_TRAIL_ENTRIES, MILLISECONDS_PER_SECOND } from './constants.js';
import { decode } from '../core.mjs';
import { state, getToken, getBaseline } from './state.js';

export function select(selector) {
  return document.querySelector(selector);
}

export function createElement(tag, text, cls) {
  const e = document.createElement(tag);
  if (text != null) {
    e.textContent = text;
  }
  if (cls) {
    e.className = cls;
  }
  return e;
}

export function showNotice(text, bad = false) {
  select('#notice').hidden = false;
  select('#notice').textContent = text;
  select('#notice').classList.toggle('error', bad);
}

export function logRequest(method, path, status) {
  if (!state.trailCount++) {
    select('#trail').textContent = '';
  }
  select('#trail').prepend(
    createElement(
      'li',
      new Date().toLocaleTimeString() + ' · ' + method + ' ' + path + ' → ' + status,
    ),
  );
  while (select('#trail').children.length > MAX_TRAIL_ENTRIES) {
    select('#trail').lastChild.remove();
  }
}

export async function runAction(fn) {
  if (state.busy) {
    return;
  }
  state.busy = true;
  renderApp();
  try {
    await fn();
  } catch (e) {
    showNotice(e.message, true);
  } finally {
    state.busy = false;
    renderApp();
  }
}

export function clearReport() {
  select('#report-preview').hidden = true;
  select('#report-json').textContent = '';
  select('#download-status').textContent = 'Ready when you are.';
}

export function renderApp() {
  select('#login-view').hidden = !!state.session;
  select('#dashboard').hidden = !state.session;
  select('#logout').hidden = !state.session;
  select('#connection').textContent = state.config ? 'Supabase connected' : 'Not configured';
  select('#identity').textContent = state.session?.user.email || '';
  document.querySelectorAll('button').forEach((b) => (b.disabled = state.busy));
  if (!state.busy) {
    select('#download').disabled = !state.session;
    select('#refresh').disabled = !state.session;
    select('#capture').disabled = !state.session;
    select('#tests').disabled = !state.session;
    select('#replay').disabled = !state.captured;
    select('#sign-in').disabled = !state.config;
    select('#anonymous').disabled = !state.config;
    select('#export-config').disabled = !state.config;
  }
  const b = getBaseline();
  select('#baseline-status').textContent = b
    ? 'Bob verified: ' + b.rows + ' note(s). Owner ID: ' + b.sub
    : 'Bob’s note has not been verified for this project.';
  select('#raw-token').value = state.session?.access_token || '';
  renderToken();
  updateTokenTimer();
}

export function updateTokenTimer() {
  try {
    const left = Math.max(
      0,
      decode(getToken()).payload.exp - Math.floor(Date.now() / MILLISECONDS_PER_SECOND),
    );
    select('#timer').textContent = left
      ? Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0')
      : 'expired';
  } catch {
    select('#timer').textContent = '—';
  }
}

export function renderToken() {
  document
    .querySelectorAll('[data-part]')
    .forEach((b) => b.classList.toggle('active', b.dataset.part === state.part));
  if (!state.session) {
    select('#decoded').textContent = 'No session stored. Sign in to inspect a token.';
    return;
  }
  try {
    const d = decode(state.session.access_token);
    select('#decoded').textContent =
      state.part === 'signature' ? d.signature : JSON.stringify(d[state.part], null, 2);
    select('#part-note').textContent =
      state.part === 'payload'
        ? 'Readable claims identify the user and expiry. There is no password here. The API must still verify the token.'
        : state.part === 'header'
          ? 'The API must enforce its signing algorithm and validate signature, issuer, audience and expiry.'
          : 'These are encoded signature bytes. Editing claims without a valid new signature does not create a trusted token.';
  } catch {
    select('#decoded').textContent = 'Stored token is malformed. Sign out and sign in again.';
  }
}

export function downloadFile(name, value) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' }),
  );
  const a = createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), MILLISECONDS_PER_SECOND);
}

export function displayResult(selector, text, tone = '') {
  const e = select(selector);
  e.textContent = text;
  e.className = 'result ' + tone;
}

export function appendVerdict(title, label, detail, tone = '') {
  const row = createElement('article', null, 'test');
  row.append(
    createElement('strong', title),
    createElement('span', label, 'verdict ' + tone),
    createElement('p', detail),
  );
  select('#test-results').append(row);
}

export function clearRequestLog() {
  select('#trail').textContent = '';
  state.trailCount = 0;
}

export function bindSubmit(selector, action) {
  select(selector).addEventListener('submit', (event) => {
    event.preventDefault();
    runAction(action);
  });
}

export function bindAction(selector, action) {
  select(selector).addEventListener('click', () => runAction(action));
}
