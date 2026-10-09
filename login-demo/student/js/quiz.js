import { PATHS } from './constants.js';
import { request, requireSuccess } from './api.js';
import { state, token } from './state.js';
import { $, render, renderQuiz, showRequest, notice } from './ui.js';

export async function loadQuiz() {
  const revision = state.revision;
  const response = await request(PATHS.quiz);
  const quiz = requireSuccess(response);
  if (revision !== state.revision) return;
  state.quiz = quiz;
  renderQuiz();
}

export async function loadResult(show = true) {
  const revision = state.revision;
  const response = await request(PATHS.result, { token: token() });
  if (revision !== state.revision) return;
  if (show) showRequest(response);
  const result = requireSuccess(response);
  if (result.student_id !== state.session?.user.id) throw Error('Unexpected result owner.');
  state.result = result;
  render();
}

export async function submitQuiz() {
  const answers = (state.quiz?.questions || []).map((_, index) => {
    const input = $('input[name="question-' + index + '"]:checked');
    if (!input) throw Error('Choose an answer for each question.');
    return Number(input.value);
  });
  if (answers.length !== 3) throw Error('Wait for the quiz to load.');
  const revision = state.revision;
  const response = await request(PATHS.submit, { token: token(), body: { p_answers: answers } });
  if (revision !== state.revision) return;
  showRequest(response);
  requireSuccess(response);
  await loadResult(false);
  notice('Quiz submitted. Your score was calculated by the database.');
}
