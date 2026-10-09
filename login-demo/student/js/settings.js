import { CONFIG_KEY, FORMAT } from './constants.js';
import { validateConfig } from '../../core.mjs';
import { state, save } from './state.js';
import { $, notice, clearRequest } from './ui.js';

export async function bootstrapConnection() {
  if (state.config) return;
  try {
    const response = await fetch('/connection.public.json', { credentials: 'omit' });
    if (!response.ok) return;
    const data = await response.json();
    if (data.format !== FORMAT) return;
    setConnection(data);
  } catch {
    /* A fresh clone can enter public settings in the dialog. */
  }
}

function setConnection(data) {
  if (state.session) throw Error('Sign out before changing projects.');
  const config = validateConfig(data.url, data.key);
  save(CONFIG_KEY, config);
  state.config = config;
  state.result = null;
  state.quiz = null;
  state.revision++;
  clearRequest();
}

export function saveConnection() {
  setConnection({ url: $('#project-url').value, key: $('#project-key').value });
  $('#settings-dialog').close();
  notice('Public connection settings saved.');
}

export function openSettings() {
  $('#project-url').value = state.config?.url || '';
  $('#project-key').value = state.config?.key || '';
  $('#settings-dialog').showModal();
}

export function exportConnection() {
  if (!state.config) throw Error('Connect a project first.');
  const data = { format: FORMAT, url: state.config.url, key: state.config.key };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'student-connection.public.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notice('Public connection settings exported. No session or password is included.');
}

export async function importConnection() {
  const input = $('#settings-file');
  try {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 16000) throw Error('Select the small public connection settings file.');
    const data = JSON.parse(await file.text());
    if (
      data.format !== FORMAT ||
      Object.keys(data).some((key) => !['format', 'url', 'key'].includes(key))
    ) {
      throw Error('Import only public connection settings. Session exports are refused.');
    }
    setConnection(data);
    $('#settings-dialog').close();
    notice('Public connection settings imported.');
  } finally {
    input.value = '';
  }
}
