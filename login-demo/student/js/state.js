import { CONFIG_KEY, SESSION_KEY } from './constants.js';
import { validateConfig, decode } from '../../core.mjs';

export function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

export function save(key, value) {
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(value));
}

export const state = {
  config: null,
  session: null,
  quiz: null,
  result: null,
  busy: false,
  revision: 0,
};

try {
  const config = read(CONFIG_KEY);
  if (config) state.config = validateConfig(config.url, config.key);
  const session = read(SESSION_KEY);
  if (
    session?.scope === state.config?.url &&
    session.user?.id === decode(session.access_token).payload.sub
  ) {
    state.session = session;
  }
} catch {
  state.session = null;
}

export function token() {
  return state.session?.access_token || '';
}

export function replaceSession(session) {
  save(SESSION_KEY, session);
  state.session = session;
  state.result = null;
  state.revision++;
}
