import { SESSION_KEY, CONFIG_KEY, BASE_KEY } from './constants.js';
import { decode, validateConfig } from '../core.mjs';

export function saveStorage(key, value) {
  try {
    value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw Error('Browser storage is blocked. Allow local site storage to use this demo.');
  }
}

export function isStoredSessionValid(s) {
  try {
    return (
      !!state.config &&
      s?.scope === state.config.url &&
      typeof s.refresh_token === 'string' &&
      s.user?.id === decode(s.access_token).payload.sub
    );
  } catch {
    return false;
  }
}

export function readStorage(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

export const state = {
  config: readStorage(CONFIG_KEY),
  session: readStorage(SESSION_KEY),
  captured: null,
  part: 'payload',
  busy: false,
  trailCount: 0,
};

try {
  if (state.config) {
    state.config = validateConfig(state.config.url, state.config.key);
  }
} catch {
  state.config = null;
}
if (!isStoredSessionValid(state.session)) {
  state.session = null;
}

export function getToken() {
  if (!state.session) {
    throw Error('Sign in first.');
  }
  return state.session.access_token;
}

export function getBaseline() {
  const baseline = readStorage(BASE_KEY);
  return baseline?.scope === state.config?.url ? baseline : null;
}
