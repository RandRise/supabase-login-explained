import { REPORT_FILENAME } from './constants.js';
import { decode, reportValid, actionVerdict } from '../core.mjs';
import { state, getToken } from './state.js';
import { getApiError } from './api.js';
import { select, showNotice, displayResult, downloadFile } from './ui.js';

export async function downloadReport(api) {
  const expected = state.session;
  const target = state.config;
  const accessToken = getToken();
  select('#download-status').textContent = 'Requesting your report…';
  try {
    const result = await api.getReport(accessToken, target);
    if (state.session !== expected || state.config !== target) {
      return;
    }
    if (!result.ok) {
      select('#download-status').textContent =
        'HTTP ' + result.status + ' · Report was not downloaded.';
      throw Error(getApiError(result));
    }
    if (!reportValid(result.data, decode(accessToken).payload.sub)) {
      throw Error(
        'Report content is missing or has an unexpected owner. Check setup and RLS before presenting.',
      );
    }
    select('#report-json').textContent = JSON.stringify(result.data, null, 2);
    select('#report-preview').hidden = false;
    downloadFile(REPORT_FILENAME, result.data);
    select('#download-status').textContent =
      'HTTP ' + result.status + ' · Access granted. Your report was downloaded.';
    showNotice('Your report is ready.');
  } catch (error) {
    if (state.session === expected && state.config === target) {
      select('#download-status').textContent = 'Download failed. ' + error.message;
      throw error;
    }
  }
}

export async function requestAnonymousReport(api) {
  displayResult('#anonymous-result', 'Sending the report request with no Authorization header…');
  try {
    const result = await api.getReport();
    const v = actionVerdict(result);
    displayResult(
      '#anonymous-result',
      v === 'DENIED'
        ? 'ACCESS DENIED · HTTP ' +
            result.status +
            ' · ' +
            getApiError(result) +
            ' No report was returned.'
        : v === 'ACCEPTED'
          ? 'UNEXPECTED · HTTP ' +
            result.status +
            ' · Anonymous request succeeded. Check the report function.'
          : 'INCONCLUSIVE · HTTP ' +
            result.status +
            ' · ' +
            getApiError(result) +
            ' Check configuration; this is not proof of secure access.',
      v === 'DENIED' ? 'denied' : '',
    );
  } catch (error) {
    displayResult('#anonymous-result', 'INCONCLUSIVE · ' + error.message);
  }
}
