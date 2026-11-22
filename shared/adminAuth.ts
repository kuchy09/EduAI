export const ADMIN_LOGIN_EMAIL = 'eduai.platform@admin.com';

export const ADMIN_EMAILS = [
  ADMIN_LOGIN_EMAIL,
  'dicksonskello09@gmail.com',
] as const;

const ADMIN_EMAIL_SET = new Set(ADMIN_EMAILS.map((e) => e.toLowerCase()));

/**
 * Checks strictly for the configured platform admin login email (`eduai.platform@admin.com`).
 */
export function isAdminLoginEmail(email?: string | null): boolean {
  return String(email || '').trim().toLowerCase() === ADMIN_LOGIN_EMAIL;
}

/**
 * Checks whether an email belongs to the backend/database authorized admin allowlist.
 */
export function isAuthorizedAdminEmail(email?: string | null): boolean {
  const normalized = String(email || '').trim().toLowerCase();
  return Boolean(normalized && ADMIN_EMAIL_SET.has(normalized));
}
