// Keep storage keys compatible with existing public settings and sessions.
export const SESSION_KEY = 'team3-supabase-session-v1';
export const CONFIG_KEY = 'team3-supabase-config-v1';

// Earlier report exercise constants are retained for its pure verification helpers.
export const BASE_KEY = 'team3-supabase-bob-v1';
export const TABLE = 'team3_supabase_demo_notes';
export const REPORT_PATH = '/rest/v1/rpc/team3_download_private_report';

export const CONTACTS_PATH =
  '/rest/v1/team3_demo_contacts?select=user_id,email,display_name&order=display_name';
export const INBOX_PATH = '/rest/v1/rpc/team3_read_inbox';
export const SEND_PATH = '/rest/v1/rpc/team3_send_message';
export const MESSAGES_PATH = '/rest/v1/team3_demo_messages';
export const LOGIN_PATH = '/auth/v1/token?grant_type=password';
export const REFRESH_PATH = '/auth/v1/token?grant_type=refresh_token';
export const LOGOUT_PATH = '/auth/v1/logout?scope=local';

export const ALICE_EMAIL = 'alice@test.invalid';
export const BOB_EMAIL = 'bob@test.invalid';
export const CONNECTION_FILE_FORMAT = 'folio-public-connection-v1';
export const PUBLIC_CONFIG_PATH = '/connection.public.json';
export const SETTINGS_FILENAME = 'inbox-connection.public.json';
export const MAX_SETTINGS_FILE_BYTES = 20_000;
export const REQUEST_TIMEOUT_MS = 10_000;
export const SUBJECT_LIMIT = 120;
export const BODY_LIMIT = 4000;
export const MILLISECONDS_PER_SECOND = 1000;

// Only fixed demo endpoints are available in the in-page API client.
export const API_ACTIONS = Object.freeze({
  inbox: { method: 'POST', path: INBOX_PATH },
  send: { method: 'POST', path: SEND_PATH },
  'other-inbox': { method: 'GET', path: MESSAGES_PATH },
  forge: { method: 'POST', path: MESSAGES_PATH },
});
