import { API_ACTIONS, SUBJECT_LIMIT, BODY_LIMIT } from './constants.js';

// Pure request construction: the browser panel and checks share these helpers.
export function buildPlaygroundRequest({
  action,
  attachToken,
  token = '',
  recipientId,
  targetId,
  senderId,
  subject = '',
  note = '',
}) {
  const operation = API_ACTIONS[action];
  if (!Object.hasOwn(API_ACTIONS, action)) {
    throw Error('Choose an available action.');
  }
  token = attachToken ? token.trim().replace(/^Bearer\s+/i, '') : '';
  if (attachToken && !token) {
    throw Error('Paste a test token, or choose Use signed-in token.');
  }

  const request = { method: operation.method, path: operation.path, token };
  if (action === 'inbox') {
    request.body = {};
  } else if (action === 'other-inbox') {
    if (!targetId) {
      throw Error('Sign in once to load Alice and Bob, then choose an inbox.');
    }
    request.path +=
      '?select=id,sender_id,recipient_id,subject,body&recipient_id=eq.' +
      encodeURIComponent(targetId);
  } else {
    if (!recipientId || (action === 'forge' && !senderId)) {
      throw Error('Sign in once to load Alice and Bob, then choose the accounts.');
    }
    if (
      !subject.trim() ||
      !note.trim() ||
      subject.trim().length > SUBJECT_LIMIT ||
      note.trim().length > BODY_LIMIT
    ) {
      throw Error('Add a subject and note within the displayed limits.');
    }
    request.body =
      action === 'send'
        ? { p_recipient_id: recipientId, p_subject: subject.trim(), p_body: note.trim() }
        : {
            sender_id: senderId,
            recipient_id: recipientId,
            subject: subject.trim(),
            body: note.trim(),
          };
  }
  return request;
}

export function previewPlaygroundRequest(request, projectUrl) {
  const headers = { apikey: '[public project key]' };
  if (request.token) {
    headers.Authorization = 'Bearer [hidden token]';
  }
  if (request.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  return [
    request.method + ' ' + (projectUrl || '[project URL]') + request.path,
    JSON.stringify(headers, null, 2),
    ...(request.body === undefined ? [] : [JSON.stringify(request.body, null, 2)]),
  ].join('\n\n');
}

export function describePlaygroundResponse(result, action, contacts = []) {
  const name = (id) =>
    contacts.find((contact) => contact.user_id === id)?.display_name || 'the token owner';
  if (result.status === 401) {
    return 'Supabase rejected authentication. The request needs a valid token and project settings.';
  }
  if (result.status === 403) {
    return 'Supabase refused this action. Being signed in does not grant another person’s permissions.';
  }
  if (!result.ok) {
    return 'The request failed. This response alone does not demonstrate the intended access rule.';
  }
  if (
    action === 'inbox' &&
    typeof result.data?.owner_id === 'string' &&
    Array.isArray(result.data.messages)
  ) {
    return (
      name(result.data.owner_id) +
      '’s inbox was returned: ' +
      result.data.messages.length +
      ' note(s). The token determines the inbox.'
    );
  }
  if (action === 'other-inbox' && Array.isArray(result.data)) {
    return result.data.length
      ? 'Supabase returned ' + result.data.length + ' matching note(s).'
      : 'No rows returned. Compare the same inbox with its owner’s token after confirming a note exists. An empty array is not HTTP denial.';
  }
  if ((action === 'send' || action === 'forge') && result.data?.sent === true) {
    return (
      'Note stored as ' + name(result.data.sender_id) + '. The recipient can refresh their inbox.'
    );
  }
  if (action === 'forge' && result.status === 201) {
    return 'The insert succeeded. Check whether the claimed sender matches the token owner; a different sender must be refused.';
  }
  return 'Response received. The expected response shape was not confirmed; inspect the body below.';
}
