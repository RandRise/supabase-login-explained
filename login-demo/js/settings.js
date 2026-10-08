import {
  SESSION_KEY,
  CONFIG_KEY,
  CONNECTION_FILE_FORMAT,
  SETTINGS_FILENAME,
  PUBLIC_CONFIG_PATH,
  MAX_SETTINGS_FILE_BYTES,
} from './constants.js';
import { validateConfig } from '../core.mjs';
import { state, saveStorage, readStorage, isStoredSessionValid } from './state.js';
import { getApiError } from './api.js';
import { select, showNotice, renderApp, clearInbox, downloadFile } from './ui.js';

export function connectProject(next) {
  if (state.session) {
    throw Error('Sign out before changing connection settings.');
  }
  saveStorage(CONFIG_KEY, next);
  state.config = next;
  clearInbox();
  select('#project-url').value = next.url;
  select('#public-key').value = next.key;
  renderApp();
}

export async function checkConnection(api) {
  const result = await api.getInbox();
  const expectedDenial = result.status === 401 && result.data?.code === '42501';
  select('#setup-health').textContent = expectedDenial
    ? 'Inbox endpoint is available. Sign in to read your notes.'
    : 'Inbox check returned HTTP ' +
      result.status +
      ': ' +
      getApiError(result) +
      '. Check add-messaging.sql and your project settings.';
  showNotice(
    expectedDenial
      ? 'Connection saved. Sign in to open your inbox.'
      : 'Connection saved; the inbox endpoint needs checking.',
    !expectedDenial,
  );
}

export async function saveConnection(api) {
  connectProject(validateConfig(select('#project-url').value, select('#public-key').value));
  await checkConnection(api);
}

function parsePublicSettings(data) {
  if (
    data?.format !== CONNECTION_FILE_FORMAT ||
    Object.keys(data).some((key) => !['format', 'url', 'key'].includes(key))
  ) {
    throw Error('Import only public connection settings. Session exports are refused.');
  }
  return validateConfig(data.url, data.key);
}

export async function importSettings(api) {
  try {
    const file = select('#config-file').files[0];
    if (!file) {
      return;
    }
    if (file.size > MAX_SETTINGS_FILE_BYTES) {
      throw Error('Select the small public connection settings file.');
    }
    connectProject(parsePublicSettings(JSON.parse(await file.text())));
    await checkConnection(api);
  } finally {
    select('#config-file').value = '';
  }
}

export async function loadLocalConnection() {
  if (state.config) {
    return;
  }
  try {
    const result = await fetch(PUBLIC_CONFIG_PATH, { credentials: 'omit' });
    if (!result.ok) {
      return;
    }
    const data = await result.json();
    if (state.config || state.busy) {
      return;
    }
    connectProject(parsePublicSettings(data));
    showNotice('Test project connected. Sign in to open your inbox.');
  } catch {
    // A fresh clone can use the connection dialog instead.
  }
}

export function exportSettings() {
  if (!state.config) {
    return;
  }
  downloadFile(SETTINGS_FILENAME, {
    format: CONNECTION_FILE_FORMAT,
    ...validateConfig(state.config.url, state.config.key),
  });
  showNotice('Exported public settings only. Sign in separately on the other laptop.');
}

export function handleStorageChange(event) {
  if (![SESSION_KEY, CONFIG_KEY].includes(event.key) && event.key !== null) {
    return false;
  }
  if (event.key === CONFIG_KEY || event.key === null) {
    try {
      const stored = readStorage(CONFIG_KEY);
      state.config = stored ? validateConfig(stored.url, stored.key) : null;
    } catch {
      state.config = null;
    }
    select('#project-url').value = state.config?.url || '';
    select('#public-key').value = state.config?.key || '';
  }
  state.session = readStorage(SESSION_KEY);
  if (!isStoredSessionValid(state.session)) {
    state.session = null;
  }
  clearInbox();
  renderApp();
  showNotice('Session or settings changed in another tab. Refresh the inbox if needed.');
  return true;
}
