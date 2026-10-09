import { CONFIG_KEY, SESSION_KEY, FORMAT } from './js/constants.js';
import { read, save, state } from './js/state.js';
import { validateConfig, decode } from '../core.mjs';
import { createSpec } from './js/openapi.js';

const status = document.querySelector('#auth-status');
const claims = document.querySelector('#claims');
let ui;
let activeToken = '';

function describeToken() {
  if (!activeToken) {
    status.textContent =
      'Project key attached · No bearer token. Protected calls should be denied.';
    claims.textContent = 'No token attached.';
    return;
  }
  try {
    const { payload } = decode(activeToken);
    status.textContent =
      'Bearer attached for ' +
      (payload.email || payload.sub) +
      '. This tab keeps its copy until you remove it or reload.';
    claims.textContent = JSON.stringify(
      {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        expires_at: new Date(payload.exp * 1000).toISOString(),
      },
      null,
      2,
    );
  } catch {
    status.textContent = 'A token is attached, but it could not be decoded locally.';
    claims.textContent = 'Invalid JWT format. The server decides whether to accept it.';
  }
}

function mount() {
  ui = window.SwaggerUIBundle({
    spec: createSpec(state.config.url),
    dom_id: '#swagger-ui',
    deepLinking: false,
    validatorUrl: null,
    queryConfigEnabled: false,
    persistAuthorization: false,
    displayRequestDuration: true,
    supportedSubmitMethods: ['get', 'post'],
    docExpansion: 'list',
    defaultModelsExpandDepth: -1,
    requestInterceptor: (req) => {
      // Use Swagger's normal Authorize state; keep the page indicator accurate.
      activeToken = ui.authSelectors.authorized().getIn(['BearerAuth', 'value']) || '';
      describeToken();
      return req;
    },
    onComplete: () => {
      ui.preauthorizeApiKey('ProjectKey', state.config.key);
      if (activeToken) ui.preauthorizeApiKey('BearerAuth', activeToken);
    },
  });
}

document.querySelector('#use-session').addEventListener('click', () => {
  const session = read(SESSION_KEY);
  if (!session || session.scope !== state.config?.url) {
    status.textContent =
      'Sign in on the portal first, then return here and click Use portal session.';
    return;
  }
  activeToken = session.access_token;
  ui.preauthorizeApiKey('BearerAuth', activeToken);
  describeToken();
});

document.querySelector('#clear-token').addEventListener('click', () => {
  activeToken = '';
  ui.authActions.logout(['BearerAuth']);
  describeToken();
});

document.querySelector('#clear-output').addEventListener('click', mount);

try {
  if (!state.config) {
    const response = await fetch('/connection.public.json', { credentials: 'omit' });
    if (!response.ok)
      throw Error('Open the portal and save your public connection settings first.');
    const data = await response.json();
    if (data.format !== FORMAT) throw Error('Invalid public settings format.');
    state.config = validateConfig(data.url, data.key);
    save(CONFIG_KEY, state.config);
  }
  // defer scripts finish before DOMContentLoaded; wait if the module raced the bundle.
  if (!window.SwaggerUIBundle)
    await new Promise((resolve) =>
      window.addEventListener('DOMContentLoaded', resolve, { once: true }),
    );
  mount();
  describeToken();
} catch (error) {
  status.textContent = error.message;
  for (const button of document.querySelectorAll('header button')) button.disabled = true;
}
