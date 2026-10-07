# Implementation Plan: Complete Admin Panel

## Overview
This plan implements a complete admin panel with 4 tabs (Users, Events, Audit Log, Reports), inline detail views using a navigation stack, moderation actions with confirmation modals, admin-only routing, and all supporting API functions. The work decomposes into 3 sequential features.

---

## FEAT-001: Foundation Layer (API & Types)

- [ ] 1. Fix UserRole type gap in src/lib/storage.ts
      Change line 4 from `export type UserRole = 'participant' | 'organizer'` to include `'administrator'`.
      Files: src/lib/storage.ts
      Verify: `npm run build` — no TypeScript errors.

- [ ] 2. Add 11 new admin endpoint constants to src/lib/apiUrls.ts
      After ADMIN_GRANT_ROLE, add: ADMIN_USER_WARN(userId), ADMIN_USER_SUSPEND(userId), ADMIN_USER_LIFT(userId), ADMIN_EVENTS, ADMIN_EVENT_DETAIL(eventId), ADMIN_EVENT_REMOVE(eventId), ADMIN_AUDIT, ADMIN_REPORTS, ADMIN_REPORT_DETAIL(reportId), ADMIN_REPORT_DISMISS(reportId), ADMIN_REPORT_ACTION(reportId).
      Files: src/lib/apiUrls.ts
      Verify: `npm run build` — no TypeScript errors.

- [ ] 3. Add TypeScript interfaces to src/lib/adminApi.ts
      Add before existing functions: AdminUserDetailsFull (extends AdminUserDetails with is_suspended, warning_count, warnings array, reports array), AdminEventParticipant, AdminEventDetail, AdminEventsResponse, AdminEventSummaryFull, AdminAuditEntry, AdminAuditResponse, AdminReportSummary, AdminReportsResponse, AdminReportDetail, WarnUserResponse, SuspendUserResponse, LiftSuspensionResponse, RemoveEventResponse, DismissReportResponse, ActionReportResponse. Also add ADMIN_USER_WITHDRAW_WARNING endpoint constant to apiUrls (discovered during planning: withdraw warning button needs POST /api/admin/users/:id/warnings/:warningId/withdraw).
      Files: src/lib/adminApi.ts, src/lib/apiUrls.ts
      Verify: `npm run build` — interfaces compile cleanly.

- [ ] 4. Add 11 admin API functions to src/lib/adminApi.ts
      Following the existing getAdminHeaders + handleAdminResponse pattern, add: warnUser(userId, reason), suspendUser(userId, reason), liftSuspension(userId, reason), withdrawWarning(userId, warningId), fetchAdminEvents(page, limit, status?, search?), fetchAdminEventDetail(eventId), removeEvent(eventId), fetchAdminAudit(page, limit), fetchAdminReports(page, limit, status?), fetchAdminReportDetail(reportId), dismissReport(reportId), actionReport(reportId, payload). Update fetchAdminUserDetails return type to AdminUserDetailsFull.
      Files: src/lib/adminApi.ts
      Verify: `npm run build` — all functions compile. `npm test` — existing tests pass.

---

## FEAT-002: Core Admin Panel UI

- [ ] 5. Rebuild src/pages/AdminPanelPage.tsx with navigation state machine
      Remove BottomNav. Define AdminView union type and AdminTab type. State: activeTab, stack array. Helpers: pushView, popView, clearStack, setTab. Sticky header: flex row with Shield icon, 'Admin Panel' h1, getCurrentUser().name, Sign Out button (logout + clearAuthToken + navigate('/login')). Below header: if stack empty show 4-tab segmented control, else show back button. Render correct tab or detail view based on stack/activeTab. Keep AppToast. Fetch openReportsCount from fetchAdminCounts for Reports badge (optional chaining if missing).
      Files: src/pages/AdminPanelPage.tsx
      Verify: `npm run build` — no errors.

- [ ] 6. Create src/components/admin/AdminUserDetail.tsx
      Props: userId, onBack, onNavigateToEvent, onErrorToast, onSuccessToast. Fetch fetchAdminUserDetails on mount and after actions. Render: back chevron, identity block (UserAvatar lg, name, username, member since, role pill, status pill, warning pill), action buttons for non-admins (Warn, Suspend/Lift, Make Admin) each with AlertDialog + reason textarea, organized events (clickable→onNavigateToEvent), joined events (display only), warning history with Withdraw button (AlertDialog + calls withdrawWarning, shows toast on 404 fail), report history. Refresh on success.
      Files: src/components/admin/AdminUserDetail.tsx
      Verify: `npm run build` — compiles cleanly.

- [ ] 7. Refactor src/components/admin/AdminUsersTab.tsx for inline navigation
      Change props: remove modal state, add onOpenUser(userId). Add filter chips: All | Administrators | Suspended | With warnings. Each filters the list (role=administrator query param if backend supports, else client filter). Chip counts from fetchAdminCounts or loaded array. Remove AdminUserDetailsModal import/usage. Call onOpenUser instead of opening modal.
      Files: src/components/admin/AdminUsersTab.tsx
      Verify: `npm run build` — no errors.

- [ ] 8. Update src/components/RequireUsername.tsx for admin redirect
      Add second state variable `role`. In useEffect, capture role from profile fetch. After token/pending checks, if state === 'ok' && role === 'administrator' && pathname not in ['/admin', '/admin-verify', '/choose-username'], return `<Navigate to="/admin" replace />`. Use useLocation().pathname.
      Files: src/components/RequireUsername.tsx
      Verify: `npm run build` — compiles. Manual test: admin user on /home redirects to /admin.

- [ ] 9. Update src/__tests__/pages/AdminPanelPage.test.tsx
      Update 'switches between Users and Events tabs' test to expect AdminEventsTab content (stat cards or loading) instead of 'Ticket #249' stub. Add fetchAdminEvents mock to beforeEach. Adjust user detail tests if needed for inline view (should still pass if aria-label unchanged). All existing tests must pass.
      Files: src/__tests__/pages/AdminPanelPage.test.tsx
      Verify: `npm test` — all tests pass.

- [ ] 10. Wire AdminUsersTab and AdminUserDetail into AdminPanelPage
      When activeTab === 'users' and stack empty, render AdminUsersTab with onOpenUser = (id) => pushView({view:'user', id}). When stack.at(-1)?.view === 'user', render AdminUserDetail with onBack = popView, onNavigateToEvent = (id) => pushView({view:'event', id}).
      Files: src/pages/AdminPanelPage.tsx
      Verify: `npm run build` && `npm test` — no errors, tests pass.

---

## FEAT-003: Events, Audit, Reports Tabs

- [ ] 11. Create src/components/admin/AdminEventsTab.tsx
      Props: onOpenEvent, onErrorToast, onSuccessToast. On mount: fetchAdminCounts for 4 stat cards (Total/Upcoming/Past/Cancelled from AdminCountsResponse.events). Sub-tabs: All | Upcoming | Past | Cancelled (filter by status). Debounced search (350ms) on title. Paginated list with fetchAdminEvents. Rows: category color dot (stable hash from category string), title, date+time, organizer UserAvatar sm + name, status pill. Click row → onOpenEvent(id). Load More button.
      Files: src/components/admin/AdminEventsTab.tsx
      Verify: `npm run build` — compiles.

- [ ] 12. Create src/components/admin/AdminEventDetail.tsx
      Props: eventId, onBack, onNavigateToUser, onErrorToast, onSuccessToast. Fetch fetchAdminEventDetail on mount. Render: back chevron, hero band (category color + icon + label), title, organizer (UserAvatar + clickable name→onNavigateToUser), description, facts grid (date, location, participants, price, status), moderation buttons ('Open Event Chat' navigate to /chat, 'Remove Event' AlertDialog with reason→removeEvent→toast→onBack), participants list (UserAvatar + name + username).
      Files: src/components/admin/AdminEventDetail.tsx
      Verify: `npm run build` — compiles.

- [ ] 13. Wire Events tab into AdminPanelPage
      When activeTab === 'events' and stack empty, render AdminEventsTab with onOpenEvent = (id) => pushView({view:'event', id}). When stack.at(-1)?.view === 'event', render AdminEventDetail with onBack, onNavigateToUser = (id) => pushView({view:'user', id}).
      Files: src/pages/AdminPanelPage.tsx
      Verify: `npm run build` — no errors.

- [ ] 14. Create src/components/admin/AdminAuditTab.tsx
      Props: onNavigateToUser, onNavigateToEvent, onErrorToast. Fetch fetchAdminAudit(page, limit) on mount. Render div-based table: When | Administrator | Action | Target | Details. Action column: pill with colour: warn→amber bg-amber-500/15 text-amber-400, suspend→red bg-red-500/15 text-red-400, lift→green bg-green-500/15 text-green-400, remove→pink bg-pink-500/15 text-pink-400, dismiss→muted bg-muted, grant-admin→purple bg-purple-500/15 text-purple-400 (case-insensitive contains check). Target: button calling onNavigateToUser or onNavigateToEvent based on target_type. Load More button.
      Files: src/components/admin/AdminAuditTab.tsx
      Verify: `npm run build` — compiles.

- [ ] 15. Create src/components/admin/AdminReportsTab.tsx
      Props: onOpenReport, onErrorToast. Fetch fetchAdminReports. Two sections: 'Open reports · N' (status='open'), 'All reports · N' (all). Rows: item label, reason pill (stable color hash), source chip, date, status pill (open=amber, dismissed=muted, actioned=green). Click row → onOpenReport(id).
      Files: src/components/admin/AdminReportsTab.tsx
      Verify: `npm run build` — compiles.

- [ ] 16. Create src/components/admin/AdminReportDetail.tsx
      Props: reportId, onBack, onNavigateToUser, onNavigateToEvent, onErrorToast, onSuccessToast. Fetch fetchAdminReportDetail on mount. Render: back chevron, report summary (item button→navigate, reason, reporter button→navigate, date, status). Action buttons if status==='open': Dismiss (AlertDialog→dismissReport), Warn (AlertDialog+reason→actionReport action='warn'), Remove content (AlertDialog+reason→actionReport action='remove'), Suspend (AlertDialog+reason→actionReport action='suspend'). Refetch on success.
      Files: src/components/admin/AdminReportDetail.tsx
      Verify: `npm run build` — compiles.

- [ ] 17. Wire Audit and Reports tabs into AdminPanelPage
      When activeTab==='audit' and stack empty, render AdminAuditTab with onNavigateToUser/onNavigateToEvent pushing views. When activeTab==='reports' and stack empty, render AdminReportsTab with onOpenReport. When stack.at(-1)?.view==='report', render AdminReportDetail with onNavigateToUser/onNavigateToEvent/onBack.
      Files: src/pages/AdminPanelPage.tsx
      Verify: `npm run build` — no errors.

- [ ] 18. Final build and test pass
      Run full build and test suite. Fix any remaining issues.
      Files: all above
      Verify: `npm run build` succeeds with zero errors. `npm test` passes all tests.

---

## Notes

- **Dependencies**: FEAT-001 → FEAT-002 → FEAT-003 (strictly sequential).
- **API graceful failure**: If any endpoint returns 404/not-implemented, show error toast and continue (do not crash).
- **No BottomNav**: AdminPanelPage must not render BottomNav anywhere.
- **All moderation actions**: Use AlertDialog confirmation before calling API.
- **TypeScript strict**: No `any` unless unavoidable.
- **Existing tests**: Must continue to pass after changes.
