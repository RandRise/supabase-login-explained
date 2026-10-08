// Static-server configuration. Only these explicit paths can be served.
export const DEFAULT_PORT = 8772;
export const SERVER_HOST = '127.0.0.1';
export const ALLOWED_HOST = /^(127\.0\.0\.1|localhost)(:\d+)?$/;
export const ALLOWED_METHODS = Object.freeze(['GET', 'HEAD']);
export const STATIC_FILES = Object.freeze([
  ['/', 'index.html'],
  ['/app.js', 'app.js'],
  ['/core.mjs', 'core.mjs'],
  ['/style.css', 'style.css'],
  ['/setup.sql', 'setup.sql'],
  ['/add-report-action.sql', 'add-report-action.sql'],
  ['/add-messaging.sql', 'add-messaging.sql'],
  ['/connection.public.json', 'connection.local.json'],
  ['/js/api.js', 'js/api.js'],
  ['/js/auth.js', 'js/auth.js'],
  ['/js/constants.js', 'js/constants.js'],
  ['/js/reports.js', 'js/reports.js'],
  ['/js/messaging.js', 'js/messaging.js'],
  ['/js/playground.js', 'js/playground.js'],
  ['/js/playground-request.js', 'js/playground-request.js'],
  ['/js/settings.js', 'js/settings.js'],
  ['/js/state.js', 'js/state.js'],
  ['/js/token-lab.js', 'js/token-lab.js'],
  ['/js/ui.js', 'js/ui.js'],
]);
export const CONTENT_TYPES = Object.freeze({
  html: 'text/html',
  js: 'text/javascript',
  mjs: 'text/javascript',
  css: 'text/css',
  sql: 'text/plain',
  json: 'application/json',
});
export const SECURITY_HEADERS = Object.freeze({
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://*.supabase.co; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
});
