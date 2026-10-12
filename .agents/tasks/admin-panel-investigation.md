# Admin Panel Investigation — Findings Report

## Summary Answers

1. **Admin role string:** `'administrator'` — set explicitly in `AdminVerifyPage.tsx` line 122: `role: 'administrator'` and checked throughout as `u.role === 'administrator'`.

2. **After AdminVerifyPage completes:** It calls `destinationAfterSignIn(username)` which returns `/home` if the user has a username, or `/choose-username` if not. Admin lands on `/home`, then navigates to `/admin` via the BottomNav Shield icon. The `/admin` route is already wired in `App.tsx`.

3. **Admin panel already exists and is fully implemented** at `src/pages/AdminPanelPage.tsx` and route `/admin`, protected by `AdminGuard`. The Users tab is fully built; the Events tab is a placeholder stub.

4. **The `UserRole` type in `storage.ts`** only declares `'participant' | 'organizer'` — it does NOT include `'administrator'`. The admin role is cast with `as UserRole` in `setCurrentUserFromOAuth`. This is a latent typing gap but does not break runtime behavior.

5. **People You May Know bug:** A prior investigation (`.agents/tasks/investigate-people-you-may-know.md`) found and documented the fix. The fix needs to be applied to `src/pages/HomePage.tsx`.

---

## Detailed Evidence





































































































































 

### 1. Admin Role String

**File:** `src/pages/AdminVerifyPage.tsx`, line 122
```ts
setCurrentUserFromOAuth({
  id: me.id,
  email: me.email || '',
  role: 'administrator',   // <-- exact role string
});
```

**File:** `src/components/admin/AdminUsersTab.tsx`, line 214
```ts
const isAdmin = u.role === 'administrator';
```

**File:** `src/components/admin/AdminUserDetailsModal.tsx`, line 169
```ts
const isAdmin = Boolean(user?.is_admin || user?.role === 'administrator');
```

**File:** `src/lib/adminApi.ts`, line 127
```ts
return { isVerifiedAdmin: true, role: 'administrator', adminId: data.admin_id };
```

**`UserRole` type gap** — `src/lib/storage.ts`, line 4:
```ts
export type UserRole = 'participant' | 'organizer';
// 'administrator' is NOT in this union but is cast with `as UserRole` in setCurrentUserFromOAuth
```

---

### 2. Post-Verification Redirect

**File:** `src/pages/AdminVerifyPage.tsx`, lines 125–126:
```ts
const destination = destinationAfterSignIn(username);
navigate(destination, { replace: true });
```

**File:** `src/lib/username.ts`, line 64:
```ts
export function destinationAfterSignIn(username?: string | null): '/home' | '/choose-username' {
  return hasChosenUsername(username) ? '/home' : '/choose-username';
}
```

**Conclusion:** Admin lands on `/home` (assuming username exists), then accesses `/admin` through the Shield nav item that BottomNav adds for verified admins. This is the intended UX.

---

### 3. App.tsx Routes

**File:** `src/App.tsx`

All routes:
```
/                    → WelcomePage
/login               → LoginPage
/signup              → SignupPage
/forgot-password     → ForgotPasswordPage
/reset-password      → ResetPasswordPage
/auth/callback       → AuthCallbackPage
/choose-username     → ChooseUsernamePage
/admin-verify        → AdminVerifyPage          ← admin MFA gate
/home                → RequireUsername > HomePage
/event/:id/edit      → RequireUsername > EditEventPage
/event/:id           → RequireUsername > EventDetailsPage
/create              → RequireUsername > CreateEventPage
/map                 → RequireUsername > MapPage
/profile             → RequireUsername > ProfilePage
/user/:userId        → RequireUsername > UserProfilePage
/chat                → RequireUsername > ChatPage
/friends             → RequireUsername > FriendsPage
/notifications       → RequireUsername > NotificationsPage
/payment/:eventId    → RequireUsername > PaymentPage
/dashboard           → RequireUsername > OrganizerDashboardPage
/admin               → RequireUsername > AdminGuard > AdminPanelPage ← admin panel
/ticket/:ticketId    → RequireUsername > TicketPage
*                    → NotFound
```

`RequireUsername` checks `/api/profile/me` for a username; if missing, redirects to `/choose-username`. It also redirects to `/admin-verify` if `getPendingAdminVerification()` is set.

`AdminGuard` calls `useAdminAuth()` → `checkAdminVerified()` → `GET /api/admin/verify` (with fallback to `GET /api/auth/mfa/status`). Non-verified users are redirected to `/home`.

---

### 4. User Type Definition

**File:** `src/lib/storage.ts`

```ts
export type UserRole = 'participant' | 'organizer';  // NOTE: 'administrator' missing

export interface User {
  id: string;
  role: UserRole;        // Cast workaround used for admin
  name: string;
  username: string;
  email: string;
  password: string;
  avatar: string;
  profilePhoto: string;
  coverPhoto: string;
  bio?: string;
  interests: string[];
  dob: string;
  gender: string;
  isPremium: boolean;
  friends: string[];
  orgCategory?: string;  // organizer-only
  createdAt: string;
}
```

The `setCurrentUserFromOAuth` function accepts `role?: string` and casts it: `role: (data.role as UserRole) ?? existing.role`. So `'administrator'` survives at runtime as a string value despite the type not declaring it.

---

### 5. All Known API Endpoints

Gathered from `src/lib/apiUrls.ts`, `src/lib/friendsApi.ts`, `src/lib/notificationsApi.ts`, `src/lib/adminApi.ts`, and page-level fetch calls:

#### Auth
| Method | Path | Source |
|--------|------|--------|
| POST | `/api/auth/login` | `LoginPage.tsx`, `apiUrls.ts` |
| POST | `/api/auth/register` | `SignupPage.tsx`, `apiUrls.ts` |
| POST | `/api/auth/forgot-password` | `ForgotPasswordPage.tsx` |
| POST | `/api/auth/reset-password` | `ForgotPasswordPage.tsx`, `ProfilePage.tsx`, `ResetPasswordPage.tsx` |
| GET | `/api/auth/verify-reset-token?token=` | `ResetPasswordPage.tsx` |
| POST | `/api/auth/mfa/enroll` | `adminAuth.ts` |
| POST | `/api/auth/mfa/verify` | `adminAuth.ts` |
| GET | `/api/auth/mfa/status` | `adminAuth.ts`, `apiUrls.ts` |

#### Profile
| Method | Path | Source |
|--------|------|--------|
| GET | `/api/profile/me` | `apiUrls.ts` (PROFILE_ME), many pages |
| PUT | `/api/profile/me` | `ProfilePage.tsx`, `HomePage.tsx` |
| GET | `/api/profile/:userId` | `EventDetailsPage.tsx`, `MapPage.tsx`, `EventCard.tsx` |
| GET | `/api/profile/search?q=&page=&limit=` | `friendsApi.ts` |

#### Events
| Method | Path | Source |
|--------|------|--------|
| GET | `/api/events?...` | `queries.ts`, `MapPage.tsx` |
| GET | `/api/events/:id` | `EventDetailsPage.tsx` |
| GET | `/api/events/my-events` | `ProfilePage.tsx`, `queries.ts` |
| POST | `/api/events` | `CreateEventPage.tsx` |
| PUT/PATCH | `/api/events/:id` | `EditEventPage.tsx` |
| DELETE | `/api/events/:id` | `EditEventPage.tsx` |

#### Participants
| Method | Path | Source |
|--------|------|--------|
| GET | `/api/participants/:eventId/participants` | `EventDetailsPage.tsx` |
| POST | `/api/participants/:eventId/join` | `EventDetailsPage.tsx` |
| POST | `/api/participants/:eventId/leave` | `EventDetailsPage.tsx`, `ProfilePage.tsx` |
| GET | `/api/participants/:eventId/my-status` | `EventDetailsPage.tsx` |
| DELETE | `/api/participants/:eventId/participants/:userId` | `EventDetailsPage.tsx` |
| GET | `/api/participants/my/events` | `ProfilePage.tsx` |

#### Friends
| Method | Path | Source |
|--------|------|--------|
| GET | `/api/friends?page=&limit=` | `friendsApi.ts` |
| GET | `/api/friends/requests/incoming?page=&limit=` | `friendsApi.ts` |
| GET | `/api/friends/requests/sent?page=&limit=` | `friendsApi.ts` |
| GET | `/api/friends/requests/count` | `friendsApi.ts` |
| POST | `/api/friends/requests` | `friendsApi.ts`, `HomePage.tsx` |
| POST | `/api/friends/requests/:id/accept` | `friendsApi.ts` |
| POST | `/api/friends/requests/:id/decline` | `friendsApi.ts` |
| DELETE | `/api/friends/requests/:id` | `friendsApi.ts` (cancel) |
| DELETE | `/api/friends/:friendId` | `friendsApi.ts` (unfriend) |
| GET | `/api/friends/suggestions` | `HomePage.tsx` (People You May Know) |

#### Notifications
| Method | Path | Source |
|--------|------|--------|
| GET | `/api/notifications/all?limit=&page=` | `notificationsApi.ts` |
| PATCH | `/api/notifications/:id/read` | `notificationsApi.ts` |
| PATCH | `/api/notifications/mark-all-read` | `notificationsApi.ts` |
| DELETE | `/api/notifications/:id` | `notificationsApi.ts` |
| DELETE | `/api/notifications/bulk-delete` | `notificationsApi.ts` |

#### Favorites
| Method | Path | Source |
|--------|------|--------|
| GET | `/api/favorites/all` | `ProfilePage.tsx`, `queries.ts` |
| DELETE | `/api/favorites/unsave-events/:eventId` | `ProfilePage.tsx` |

#### Admin
| Method | Path | Source |
|--------|------|--------|
| GET | `/api/admin/verify` | `adminApi.ts`, `apiUrls.ts` |
| GET | `/api/admin/counts` | `adminApi.ts`, `apiUrls.ts` |
| GET | `/api/admin/users?page=&limit=&search=` | `adminApi.ts`, `apiUrls.ts` |
| GET | `/api/admin/users/:userId` | `adminApi.ts`, `apiUrls.ts` |
| POST | `/api/admin/users/:userId/grant-admin` | `adminApi.ts`, `apiUrls.ts` |

---

### 6. BottomNav Component

**File:** `src/components/BottomNav.tsx`

The nav adapts based on `user.role` and `isVerifiedAdmin`:

- **Organizer nav:** Home, Dashboard, Create (FAB), Chat, Friends
- **Participant nav:** Home, Map, Create (FAB), Chat, Friends
- **Admin shield item:** conditionally appended after base items when `isVerifiedAdmin === true`
- **Profile:** always last

The admin item:
```ts
const adminItem = isVerifiedAdmin
  ? [{ path: '/admin', icon: Shield, label: 'Admin' }]
  : [];
const navItems = [...baseItems, ...adminItem, ...profileItem];
```

`isVerifiedAdmin` comes from `useAdminAuth()` which calls `GET /api/admin/verify` on mount and on `eventapp:user-updated`.

Friends badge shows pending incoming request count from `GET /api/friends/requests/count`.

---

### 7. AdminVerifyPage Flow

**File:** `src/pages/AdminVerifyPage.tsx`

1. On mount: checks `getPendingAdminVerification()` from sessionStorage. If missing → redirect to `/login`.
2. If `hasMfaLinked === false`: calls `enrollMfa(token)` → `POST /api/auth/mfa/enroll` → shows QR code + secret.
3. User enters 6-digit code → `handleVerify()` → `verifyMfaCode()` → `POST /api/auth/mfa/verify`.
4. On success: sets auth token, calls `GET /api/profile/me`, calls `setCurrentUserFromOAuth({..., role: 'administrator'})`.
5. Navigates to `destinationAfterSignIn(username)` → `/home` or `/choose-username`.

---

### 8. Existing Admin Pages and Components

All fully implemented:
- `src/pages/AdminPanelPage.tsx` — main page (Users tab + Events tab stub)
- `src/pages/AdminVerifyPage.tsx` — MFA verification gate
- `src/components/AdminGuard.tsx` — route guard
- `src/components/admin/AdminUsersTab.tsx` — users list with search, pagination, count card
- `src/components/admin/AdminUserDetailsModal.tsx` — user detail modal with grant-admin action
- `src/lib/adminApi.ts` — all admin API calls (verify, counts, users list, user detail, grant role)
- `src/lib/adminAuth.ts` — MFA enrollment/verification, pending-verification state
- `src/hooks/useAdminAuth.ts` — React hook wrapping `checkAdminVerified`

---

### 9. TopBar Component

**File:** `src/components/TopBar.tsx`

Props: `{ search: string; onSearchChange: (v: string) => void }`

Structure: Logo → Search input → Notifications bell (with unread dot) → Settings dropdown (Profile, Manage Account, Logout)

Uses `glass-card`, `gradient-primary`, `shadow-glow`, `rounded-2xl` / `rounded-xl` pattern — consistent with overall app style.

---

### 10. UI Patterns (from ProfilePage.tsx, FriendsPage.tsx, AdminPanelPage.tsx)

Consistent patterns across the app:
- **Container:** `min-h-screen bg-background text-foreground pb-24`
- **Cards:** `rounded-2xl border border-border bg-card p-5 shadow-sm` or `glass-card` for modal overlays
- **Gradient buttons/icons:** `gradient-primary` class (CSS variable-based), `shadow-glow`
- **Muted text:** `text-muted-foreground`, `text-xs`
- **Sticky header:** `sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-lg`
- **Motion:** `framer-motion` `motion.div` with `initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}`
- **Toast:** `AppToast` component with `show`, `message`, `type` props
- **Bottom nav:** always `<BottomNav />` at the bottom of every authenticated page
- **Loading spinner:** `<Loader2 className="h-8 w-8 animate-spin text-primary" />`
- **Empty states:** dashed border card with centered icon + text

---

## People You May Know Bug (Original Task #1)

**Status:** Already investigated in `.agents/tasks/investigate-people-you-may-know.md`.

**Root cause confirmed:** `src/pages/HomePage.tsx` `REQUEST_PATHS` array uses wrong paths:
- `'/api/friendships/requests/sent'` → should be `'/api/friends/requests/sent'`  
- `'/api/friendships/requests/received'` → should be `'/api/friends/requests/incoming'`

Also `handleAddFriend` POSTs to `'/api/friendships/requests'` instead of `'/api/friends/requests'`.

**Note:** Looking at the current `HomePage.tsx` source, these paths have already been fixed to `'/api/friends/requests/sent'` and `'/api/friends/requests/incoming'`, and `handleAddFriend` correctly uses `'/api/friends/requests'`. The prior investigation documented the bug and the fix appears to have been applied. The unit tests need to be updated to reflect the corrected exclusion behavior.

---

## Conclusions and Recommendations

### Admin Panel Routing (Task #4)

The admin panel is **fully implemented**. The routing is already correct in `App.tsx`:
- `/admin-verify` → MFA gate
- `/admin` → `RequireUsername` > `AdminGuard` > `AdminPanelPage`
- `BottomNav` already shows the Shield icon for verified admins
- `AdminGuard` already redirects non-admins to `/home`

**Nothing needs to be added for the admin routing task.** The feature is complete.

### People You May Know Exclusions (Task #1)

The bug fix paths are already correct in the current `HomePage.tsx` source. If tests are failing, the test mocks for `REQUEST_PATHS` / `fetchExcludedIds` need to be updated to match the corrected paths. The fix required:
1. `REQUEST_PATHS` updated to `['/api/friends/requests/sent', '/api/friends/requests/incoming']`
2. `handleAddFriend` updated to POST to `'/api/friends/requests'`

### UserRole Type Gap

`src/lib/storage.ts` declares `UserRole = 'participant' | 'organizer'` but `'administrator'` is used at runtime via cast. Recommend adding `'administrator'` to the union type to fix TypeScript errors and make the intent explicit.

### Events Tab in Admin Panel

`AdminPanelPage.tsx` has a stub Events tab labeled "Ticket #249 Integration Point". This is intentionally incomplete and out of scope for the current tasks.
