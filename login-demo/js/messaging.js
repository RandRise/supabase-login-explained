import { updatePlayground } from './playground.js';
import { inboxValid } from '../core.mjs';
import { CONTACTS_PATH } from './constants.js';
import { state, getToken } from './state.js';
import { getApiError } from './api.js';
import { select, createElement, renderContacts, renderInbox, showNotice } from './ui.js';

export async function loadInbox(api) {
  const expected = state.session;
  const target = state.config;
  if (!expected) {
    return;
  }

  select('#inbox-status').textContent = 'Checking for notes…';
  // Remove stale contents before a new access check.
  state.messages = [];
  state.inboxLoaded = false;
  renderInbox();

  try {
    const [contacts, inbox] = await Promise.all([
      api.request(CONTACTS_PATH, { token: expected.access_token, target }),
      api.getInbox(expected.access_token, target),
    ]);

    if (state.session !== expected || state.config !== target) {
      return;
    }

    if (!contacts.ok || !inbox.ok) {
      throw Error(
        getApiError(!inbox.ok ? inbox : contacts) +
          ' Sign out and sign in again if your session expired.',
      );
    }

    if (
      !Array.isArray(contacts.data) ||
      !contacts.data.every(
        (contact) =>
          typeof contact.user_id === 'string' &&
          typeof contact.email === 'string' &&
          typeof contact.display_name === 'string',
      )
    ) {
      throw Error('The contact response was incomplete.');
    }

    if (!inboxValid(inbox.data, expected.user.id)) {
      throw Error('The inbox response did not match this account. No messages were displayed.');
    }

    state.contacts = contacts.data;
    state.messages = inbox.data.messages;
    state.inboxLoaded = true;
    renderContacts();
    updatePlayground();
    renderInbox();
    select('#inbox-status').textContent = 'Updated just now.';
  } catch (error) {
    if (state.session !== expected || state.config !== target) {
      return;
    }
    select('#inbox-status').textContent = 'Inbox could not be loaded.';
    select('#message-list').replaceChildren(
      createElement(
        'p',
        'Your inbox is unavailable. Try refreshing, or sign out and sign in again.',
        'empty-state',
      ),
    );
    throw error;
  }
}

export async function sendNote(api) {
  const expected = state.session;
  const target = state.config;
  const body = {
    p_recipient_id: select('#recipient').value,
    p_subject: select('#subject').value.trim(),
    p_body: select('#body').value.trim(),
  };
  if (!body.p_subject || !body.p_body) {
    throw Error('Add a subject and a note before sending.');
  }

  const result = await api.sendMessage(getToken(), body, target);
  if (state.session !== expected || state.config !== target) {
    return;
  }
  if (!result.ok) {
    throw Error(getApiError(result));
  }
  if (
    result.data?.sent !== true ||
    result.data.sender_id !== expected.user.id ||
    result.data.recipient_id !== body.p_recipient_id
  ) {
    throw Error(
      'The send response was incomplete. Check the recipient inbox before sending again.',
    );
  }

  select('#subject').value = '';
  select('#body').value = '';
  const recipient = state.contacts.find((contact) => contact.user_id === body.p_recipient_id);
  select('#send-status').textContent =
    'Note sent to ' + (recipient?.display_name || 'the recipient') + '.';
  showNotice('Note sent. The recipient can read it in their inbox.');
}
