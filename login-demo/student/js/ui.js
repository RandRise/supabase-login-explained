import { state } from './state.js';
export const $ = (selector) => document.querySelector(selector);

export function notice(text, error = false) {
  $('#notice').textContent = text;
  for (const id of ['#login-error', '#settings-error']) $(id).textContent = error ? text : '';
  $('#notice').classList.toggle('error', error);
}

export function render() {
  const signedIn = !!state.session;
  $('#identity').textContent = signedIn ? state.session.user.email : 'Guest';
  $('#sign-in').hidden = signedIn;
  $('#sign-out').hidden = !signedIn;
  $('#session-status').textContent = signedIn
    ? 'Session saved in this browser'
    : 'No student session';
  $('#result-name').textContent =
    state.result?.student_name || (signedIn ? 'Your result' : 'Private result');
  const latest = state.result?.latest;
  $('#score').textContent = latest ? latest.score + ' / ' + latest.total : '—';
  $('#result-detail').textContent = latest
    ? state.result.attempt_count +
      ' attempt(s) · Latest: ' +
      new Date(latest.submitted_at).toLocaleString()
    : signedIn
      ? 'Take the quiz to record your first result.'
      : 'Sign in to access your result.';
  $('#score-ring').style.setProperty(
    '--progress',
    latest ? (latest.score / latest.total) * 100 + '%' : '0%',
  );
  for (const button of document.querySelectorAll('button')) button.disabled = state.busy;
}

export function renderQuiz() {
  const container = $('#questions');
  container.replaceChildren();
  for (const [index, question] of (state.quiz?.questions || []).entries()) {
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = (index + 1).toString().padStart(2, '0') + '   ' + question.text;
    fieldset.append(legend);
    question.options.forEach((text, value) => {
      const label = document.createElement('label');
      label.className = 'choice';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'question-' + index;
      input.value = value;
      input.required = true;
      const span = document.createElement('span');
      span.textContent = text;
      label.append(input, span);
      fieldset.append(label);
    });
    container.append(fieldset);
  }
}

export function showRequest(response) {
  $('#request-path').textContent = response.method + ' ' + response.path;
  $('#request-token').textContent = response.attached
    ? 'Bearer token attached (hidden)'
    : 'No bearer token';
  $('#request-status').textContent = 'HTTP ' + response.status;
  $('#request-status').classList.toggle('denied', !response.ok);
  $('#request-body').textContent = JSON.stringify(response.data, null, 2);
  $('#request-details').open = true;
}

export function clearRequest() {
  $('#request-details').open = false;
  $('#request-body').textContent = '';
  $('#request-status').textContent = 'Ready';
  $('#request-path').textContent = 'No request yet';
  $('#request-token').textContent = '';
}
