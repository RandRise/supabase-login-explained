export const CONFIG_KEY = 'team3-supabase-config-v1';
export const SESSION_KEY = 'team3-student-session-v1';
export const FORMAT = 'folio-public-connection-v1';
export const PATHS = Object.freeze({
  login: '/auth/v1/token?grant_type=password',
  logout: '/auth/v1/logout?scope=local',
  quiz: '/rest/v1/rpc/team3_get_quiz',
  result: '/rest/v1/rpc/team3_get_result',
  submit: '/rest/v1/rpc/team3_submit_quiz',
  roster: '/rest/v1/team3_quiz_students?select=user_id,display_name',
});
export const TIMEOUT_MS = 12000;
