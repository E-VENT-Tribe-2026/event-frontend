export const API_ENDPOINTS = {
  LOGIN: '/api/auth/login',
  SIGNUP: '/api/auth/register',
  EVENTS: '/api/events',
  PROFILE_ME: '/api/profile/me',
  NOTIFICATIONS: '/api/notifications',
  ADMIN_VERIFY: '/api/admin/verify',
  ADMIN_COUNTS: '/api/admin/counts',
  ADMIN_USERS: '/api/admin/users',
  ADMIN_USER_DETAIL: (userId: string) => `/api/admin/users/${encodeURIComponent(userId)}`,
  ADMIN_GRANT_ROLE: (userId: string) => `/api/admin/users/${encodeURIComponent(userId)}/grant-admin`,
  MFA_STATUS: '/api/auth/mfa/status',
} as const;


