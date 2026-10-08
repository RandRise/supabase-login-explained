import {
  SESSION_KEY,
  CONFIG_KEY,
  BASE_KEY,
  CONNECTION_FILE_FORMAT,
  SETTINGS_FILENAME,
  PUBLIC_CONFIG_PATH,
  MAX_SETTINGS_FILE_BYTES,
} from './constants.js';
import { validateConfig, actionVerdict } from '../core.mjs';
import { state, saveStorage, readStorage, isStoredSessionValid } from './state.js';
import { getApiError } from './api.js';
import { select, showNotice, renderApp, clearReport, displayResult, downloadFile } from './ui.js';

export function connectProject(next) {
  if (state.session) {
    throw Error('Sign out before changing connection settings.');
  }
  saveStorage(CONFIG_KEY, next);
  saveStorage(BASE_KEY, null);
  state.config = next;
  state.captured = null;
  displayResult('#replay-state', 'No copy captured.');
  select('#test-results').textContent = '';
  select('#anonymous-result').textContent = 'No request sent yet.';
  select('#project-url').value = state.config.url;
  select('#public-key').value = state.config.key;
  renderApp();
}

export async function checkConnection(api) {
  const result = await api.getReport();
  const verdict = actionVerdict(result);
  select('#setup-health').textContent =
    verdict === 'DENIED'
      ? 'Report endpoint responded HTTP ' +
        result.status +
        ' to an anonymous request. Sign in to confirm the report can be downloaded.'
      : result.ok
        ? 'Unexpected anonymous response. Check the report function before presenting.'
        : 'Connection saved. Report check returned HTTP ' +
          result.status +
          ': ' +
          getApiError(result) +
          '. Run the SQL in this project and recheck.';
  showNotice(
    verdict === 'DENIED'
      ? 'Connection saved. Sign in to access your report.'
      : 'Connection saved; the report endpoint needs checking.',
    verdict !== 'DENIED',
  );
}

export async function saveConnection(api) {
  connectProject(validateConfig(select('#project-url').value, select('#public-key').value));
  await checkConnection(api);
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
    const data = JSON.parse(await file.text());
    if (
      data.format !== CONNECTION_FILE_FORMAT ||
      Object.keys(data).some((k) => !['format', 'url', 'key'].includes(k))
    ) {
      throw Error('Import only a public connection settings file. Session exports are refused.');
    }
    connectProject(validateConfig(data.url, data.key));
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
    if (
      state.config ||
      state.busy ||
      data.format !== CONNECTION_FILE_FORMAT ||
      Object.keys(data).some((k) => !['format', 'url', 'key'].includes(k))
    ) {
      return;
    }
    connectProject(validateConfig(data.url, data.key));
    showNotice('Test project connected. Sign in to access your report.');
  } catch {
    /* A clone without local settings uses the normal connection dialog. */
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
  if (![SESSION_KEY, CONFIG_KEY, BASE_KEY].includes(event.key) && event.key !== null) {
    return;
  }
  if (event.key === CONFIG_KEY || event.key === null) {
    try {
      const storedConfig = readStorage(CONFIG_KEY);
      state.config = storedConfig ? validateConfig(storedConfig.url, storedConfig.key) : null;
    } catch {
      state.config = null;
    }
    state.captured = null;
    select('#project-url').value = state.config?.url || '';
    select('#public-key').value = state.config?.key || '';
  }
  if ([SESSION_KEY, CONFIG_KEY].includes(event.key) || event.key === null) {
    state.session = readStorage(SESSION_KEY);
    if (!isStoredSessionValid(state.session)) {
      state.session = null;
    }
    clearReport();
  }
  renderApp();
  showNotice('Session or settings changed in another tab.');
}
