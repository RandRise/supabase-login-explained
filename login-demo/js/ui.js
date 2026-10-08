import { state } from './state.js';
import { MILLISECONDS_PER_SECOND, SUBJECT_LIMIT } from './constants.js';

export function select(selector) {
  return document.querySelector(selector);
}

export function createElement(tag, text, className = '') {
  const element = document.createElement(tag);
  if (text !== undefined) {
    element.textContent = text;
  }
  element.className = className;
  return element;
}

export function showNotice(message, error = false) {
  const notice = select('#notice');
  notice.textContent = message;
  notice.className = error ? 'notice error' : 'notice';
  notice.hidden = false;
}

export function clearInbox() {
  state.messages = [];
  state.contacts = [];
  state.inboxLoaded = false;
  select('#message-list').replaceChildren();
  select('#recipient').replaceChildren();
  select('#compose-form').reset();
  select('#send-status').textContent = '';
  select('#inbox-status').textContent = '';
}

export function renderApp() {
  const signedIn = Boolean(state.session);
  select('#login-view').hidden = signedIn;
  select('#dashboard').hidden = !signedIn;
  select('#logout').hidden = !signedIn;
  select('#identity').textContent = state.session?.user.email || '';
  select('#connection').textContent = state.config ? 'Connected' : 'Not configured';

  document.querySelectorAll('button').forEach((button) => {
    button.disabled = state.busy;
  });
  select('#sign-in').disabled = state.busy || !state.config;
  select('#send').disabled = state.busy || !signedIn || !state.contacts.length;
  select('#export-config').disabled = state.busy || !state.config;
  select('#config-form')
    .querySelectorAll('input, button')
    .forEach((element) => {
      element.disabled = state.busy || signedIn;
    });
  select('#import-config').disabled = state.busy || signedIn;
}

export function renderContacts() {
  const recipient = select('#recipient');
  const previous = recipient.value;
  recipient.replaceChildren();
  const available = state.contacts.filter((contact) => contact.user_id !== state.session?.user.id);
  for (const contact of available) {
    const option = createElement('option', contact.display_name + ' · ' + contact.email);
    option.value = contact.user_id;
    recipient.append(option);
  }
  if (available.some((contact) => contact.user_id === previous)) {
    recipient.value = previous;
  }
}

export function prepareReply(message) {
  if (!state.session || !state.contacts.some((contact) => contact.user_id === message.sender_id)) {
    showNotice('This sender is not in the demo contact list.', true);
    return;
  }
  select('#recipient').value = message.sender_id;
  select('#subject').value = (
    /^Re: /i.test(message.subject) ? message.subject : 'Re: ' + message.subject
  ).slice(0, SUBJECT_LIMIT);
  select('#body').value = '';
  select('#send-status').textContent = 'Replying to ' + message.sender_name + '.';
  select('#body').focus();
}

export function renderInbox() {
  const list = select('#message-list');
  list.replaceChildren();
  select('#message-count').textContent =
    state.messages.length + (state.messages.length === 1 ? ' note' : ' notes');

  if (!state.messages.length) {
    list.append(
      createElement(
        'p',
        state.inboxLoaded
          ? 'Your inbox is empty. A note will appear here when someone sends you one.'
          : 'Loading your inbox…',
        'empty-state',
      ),
    );
    return;
  }

  for (const message of state.messages) {
    const card = createElement('article', undefined, 'message');
    const heading = createElement('div', undefined, 'message-heading');
    const sender = createElement('div');
    sender.append(
      createElement('strong', message.sender_name),
      createElement('span', message.sender_email, 'muted small'),
    );
    const time = createElement(
      'time',
      new Date(message.created_at).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      'small muted',
    );
    time.dateTime = message.created_at;
    heading.append(sender, time);
    const reply = createElement('button', 'Reply', 'quiet reply');
    reply.type = 'button';
    reply.addEventListener('click', () => prepareReply(message));
    // textContent keeps notes as text, including strings that look like HTML.
    card.append(
      heading,
      createElement('h3', message.subject),
      createElement('p', message.body, 'message-body'),
      reply,
    );
    list.append(card);
  }
}

export async function runAction(action) {
  if (state.busy) {
    return;
  }
  state.busy = true;
  renderApp();
  try {
    await action();
  } catch (error) {
    showNotice(error.message || 'The request could not be completed.', true);
  } finally {
    state.busy = false;
    renderApp();
  }
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

export function downloadFile(name, value) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' }),
  );
  const anchor = createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), MILLISECONDS_PER_SECOND);
}
