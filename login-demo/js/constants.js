// Browser storage keys stay unchanged so existing sessions still load.
export const SESSION_KEY = 'team3-supabase-session-v1';
export const CONFIG_KEY = 'team3-supabase-config-v1';
export const BASE_KEY = 'team3-supabase-bob-v1';

// Supabase routes and invented demo identities.
export const TABLE = 'team3_supabase_demo_notes';
export const REPORT_PATH = '/rest/v1/rpc/team3_download_private_report';
export const LOGIN_PATH = '/auth/v1/token?grant_type=password';
export const REFRESH_PATH = '/auth/v1/token?grant_type=refresh_token';
export const LOGOUT_PATH = '/auth/v1/logout?scope=local';
export const ALICE_EMAIL = 'alice@test.invalid';
export const BOB_EMAIL = 'bob@test.invalid';

// Keep the old file-format identifier so previously exported settings still work.
export const CONNECTION_FILE_FORMAT = 'folio-public-connection-v1';
export const PUBLIC_CONFIG_PATH = '/connection.public.json';
export const REPORT_FILENAME = 'private-report.json';
export const SETTINGS_FILENAME = 'reports-connection.public.json';

// Limits and timing. Passwords and live tokens never belong in this file.
export const MAX_SETTINGS_FILE_BYTES = 20_000;
export const REQUEST_TIMEOUT_MS = 10_000;
export const MAX_TRAIL_ENTRIES = 18;
export const MILLISECONDS_PER_SECOND = 1_000;
export const TOKEN_TIMER_INTERVAL_MS = 1_000;
export const TAMPERED_EXPIRY_EXTENSION_SECONDS = 31_536_000;
