import { SESSION_KEY, CONFIG_KEY } from './constants.js';
import { decode, validateConfig } from '../core.mjs';

export function readStorage(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveStorage(key, value) {
  try {
    if (value == null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    throw Error('Browser storage is blocked. Allow local site storage to use this demo.');
  }
}

export const state = {
  config: readStorage(CONFIG_KEY),
  session: readStorage(SESSION_KEY),
  contacts: [],
  messages: [],
  busy: false,
  inboxLoaded: false,
};

export function isStoredSessionValid(session) {
  try {
    return (
      !!state.config &&
      session?.scope === state.config.url &&
      typeof session.refresh_token === 'string' &&
      !!session.refresh_token &&
      session.user?.id === decode(session.access_token).payload.sub
    );
  } catch {
    return false;
  }
}

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
