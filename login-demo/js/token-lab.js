import {
  BASE_KEY,
  ALICE_EMAIL,
  BOB_EMAIL,
  LOGIN_PATH,
  LOGOUT_PATH,
  MILLISECONDS_PER_SECOND,
  TAMPERED_EXPIRY_EXTENSION_SECONDS,
} from './constants.js';
import { decode, mutate, boundary, reportValid } from '../core.mjs';
import { state, saveStorage, getToken, getBaseline } from './state.js';
import { getApiError } from './api.js';
import { select, showNotice, renderApp, displayResult, appendVerdict } from './ui.js';

export async function captureToken() {
  const accessToken = getToken();
  const claims = decode(accessToken).payload;
  if (claims.exp <= Date.now() / MILLISECONDS_PER_SECOND) {
    throw Error('This token has expired. Refresh or sign in again.');
  }
  state.captured = {
    token: accessToken,
    config: { ...state.config },
    sub: claims.sub,
    exp: claims.exp,
  };
  displayResult(
    '#replay-state',
    'Copy captured in page memory. Sign out, then replay it. Expiry: ' +
      new Date(claims.exp * MILLISECONDS_PER_SECOND).toLocaleTimeString(),
  );
}

export async function replayCopiedToken(api) {
  if (!state.captured) {
    throw Error('Capture a token while signed in first.');
  }
  const copy = state.captured;
  try {
    const result = await api.getReport(copy.token, copy.config);
    if (state.captured !== copy) {
      return;
    }
    const accepted = result.ok && reportValid(result.data, copy.sub);
    displayResult(
      '#replay-state',
      accepted
        ? 'ACCESS GRANTED · HTTP ' +
            result.status +
            ' · The copied token returned ' +
            result.data.notes.length +
            ' owner note(s), even without the login form. Logout does not immediately invalidate an existing access JWT.'
        : result.status === 401 || result.status === 403
          ? 'ACCESS DENIED · HTTP ' +
            result.status +
            ' · ' +
            getApiError(result) +
            ' Read the error before claiming it expired.'
          : 'INCONCLUSIVE · HTTP ' +
            result.status +
            ' · Unexpected response or configuration error.',
      accepted ? 'accepted' : [401, 403].includes(result.status) ? 'denied' : '',
    );
  } catch (error) {
    displayResult('#replay-state', 'INCONCLUSIVE · ' + error.message);
  }
}

export async function verifyBobNote(api) {
  let issued = null;
  const target = state.config;
  try {
    const result = await api.request(LOGIN_PATH, {
      method: 'POST',
      body: { email: BOB_EMAIL, password: select('#bob-password').value },
      target,
    });
    select('#bob-password').value = '';
    if (!result.ok) {
      throw Error('Bob login failed: ' + getApiError(result));
    }
    issued = result.data;
    const claims = decode(issued.access_token).payload;
    if (claims.email?.toLowerCase() !== BOB_EMAIL || !claims.sub) {
      throw Error('Returned account is not Bob.');
    }
    const rows = await api.request(api.notePath(), { token: issued.access_token, target });
    if (state.config !== target) {
      return;
    }
    if (!rows.ok || !Array.isArray(rows.data) || !rows.data.length) {
      throw Error('Bob’s seeded note was not returned. Check setup.');
    }
    if (rows.data.some((row) => row.user_id !== claims.sub)) {
      throw Error('DATA EXPOSED: Bob received another owner’s note. Check RLS.');
    }
    saveStorage(BASE_KEY, {
      scope: target.url,
      sub: claims.sub,
      rows: rows.data.length,
      at: Date.now(),
    });
    showNotice('Bob’s own note is confirmed. His token was not stored.');
  } finally {
    select('#bob-password').value = '';
    if (issued) {
      const result = await api.request(LOGOUT_PATH, {
        method: 'POST',
        token: issued.access_token,
        target,
      });
      if (!result.ok) {
        showNotice('Bob’s provider logout was not confirmed: ' + getApiError(result), true);
      }
    }
  }
}

export async function runEvidenceChecks(api) {
  select('#test-results').textContent = '';
  const expected = state.session;
  const target = state.config;
  try {
    const accessToken = getToken();
    const claims = decode(accessToken).payload;
    const baseline = getBaseline();
    if (claims.email?.toLowerCase() !== ALICE_EMAIL) {
      throw Error('Use Alice’s account for the two-user checks.');
    }
    const own = await api.getReport(accessToken, target);
    if (state.session !== expected || state.config !== target) {
      return;
    }
    if (!own.ok || !reportValid(own.data, claims.sub)) {
      throw Error(
        'First confirm the unchanged token downloads Alice’s known report. HTTP ' +
          own.status +
          ': ' +
          getApiError(own),
      );
    }
    appendVerdict(
      'Genuine token',
      'ACCEPTED',
      'HTTP ' + own.status + ' · Alice’s owner report was returned.',
    );
    const edited = await api.getReport(
      mutate(accessToken, {
        exp: Math.floor(Date.now() / MILLISECONDS_PER_SECOND) + TAMPERED_EXPIRY_EXTENSION_SECONDS,
      }),
      target,
    );
    if (state.session !== expected || state.config !== target) {
      return;
    }
    appendVerdict(
      'Edit expiry without signing',
      edited.status === 401 ? 'REJECTED' : edited.ok ? 'UNEXPECTED' : 'INCONCLUSIVE',
      'HTTP ' +
        edited.status +
        ' · ' +
        getApiError(edited) +
        '. This checks signature tampering, not natural token expiry.',
      edited.ok ? 'bad' : edited.status === 401 ? '' : 'warn',
    );
    if (!baseline) {
      appendVerdict(
        'Bob’s owner boundary',
        'NEEDS BASELINE',
        'Verify Bob’s seeded note first. Zero rows alone is insufficient.',
        'warn',
      );
      return;
    }
    const identity = await api.getReport(mutate(accessToken, { sub: baseline.sub }), target);
    if (state.session !== expected || state.config !== target) {
      return;
    }
    appendVerdict(
      'Edit identity to Bob',
      identity.status === 401 ? 'REJECTED' : identity.ok ? 'UNEXPECTED' : 'INCONCLUSIVE',
      'HTTP ' + identity.status + ' · ' + getApiError(identity),
      identity.ok ? 'bad' : identity.status === 401 ? '' : 'warn',
    );
    const other = await api.request(api.notePath(baseline.sub), { token: accessToken, target });
    if (state.session !== expected || state.config !== target) {
      return;
    }
    const label = boundary(other, baseline, target.url, baseline.sub);
    appendVerdict(
      'Read Bob’s confirmed note',
      label,
      label === 'BOUNDARY HELD'
        ? 'HTTP 200 · Zero notes returned to Alice. Bob previously read ' +
            baseline.rows +
            ' note(s) in the same project.'
        : label === 'DATA EXPOSED'
          ? 'Bob’s note was returned. Check RLS and grants.'
          : 'HTTP ' + other.status + ' · ' + getApiError(other),
      label === 'DATA EXPOSED' ? 'bad' : label === 'BOUNDARY HELD' ? '' : 'warn',
    );
  } catch (error) {
    if (state.session === expected && state.config === target) {
      appendVerdict('Checks incomplete', 'INCONCLUSIVE', error.message, 'warn');
    }
  }
}

export function clearCapturedToken() {
  state.captured = null;
  displayResult('#replay-state', 'Copy cleared from memory.');
  renderApp();
}
