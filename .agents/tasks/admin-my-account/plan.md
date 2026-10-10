# Implementation Plan — Admin My Account + Styling Fix

## Key findings from codebase exploration

- **CSS variables**: All required `--adm-*` variables ARE already defined in `src/index.css` inside `.adm {}`, including `--adm-grad-card`. No variables are missing — nothing to add.
- **AdminPanelPage**: Fetches profile via `API_ENDPOINTS.PROFILE_ME`. The profile response is normalised to extract `name`/`full_name` but the `id` / `user_id` field is NOT currently captured — it must be added.
- **AdminUserDetail back button**: Uses `className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"` — needs to change to borderless, bg-transparent, font-medium, correct padding.
- **AdminReportDetail back button**: Same problem, same fix needed.
- **Tab labels**: `<span className="hidden sm:inline">` — should be `inline` always.
- **Tab padding**: `py-2` (8px top+bottom) — should be `py-2.5` to approximate `10px`.
- **Header buttons**: `background: 'var(--adm-secondary)'` on inactive User-view button — should be `var(--adm-card)`. Height is `py-1.5` (not 36px fixed) — should add `height: 36` inline. Font is `text-xs` (12px) — should be `text-[12.5px]`.
- **Filter chips** (AdminUsersTab): inactive chips use `text-xs font-semibold` — should be `text-[12.5px] font-medium`.
- **Warning items**: The `rounded-xl p-3` container needs `borderRadius: 12` and `p-3` → explicit `px-3.5 py-3`.
- **Test constraints**: Tests check `role="tab"` with names `/Events/i`, `/Audit Log/i`, `/Reports/i`, `aria-label="Back to Users"` (button), `aria-label="Sign out"`, `aria-label="Toggle user view"`. All must be preserved. The new My Account button must NOT break tab role/name lookups.

---

## Implementation Plan

- [ ] 1. **Verify and add any missing CSS variables in `src/index.css`**
      All `--adm-*` variables are already present in the `.adm {}` block. Nothing to change.
      Files: `src/index.css` (no edit required — verification only)
      Verify: `npm run build` exits 0 (no CSS import errors).

- [ ] 2. **Create `src/components/admin/AdminMyAccount.tsx`**
      New component. Props: `{ adminId: string; onClose: () => void }`.

      Data fetching:
      - `useEffect` → call `fetchAdminUserDetails(adminId)` from `@/lib/adminApi`, store result in `user` state.
      - Also call `fetchAdminCounts()` to attempt `open_reports` but it is not needed for the main UI.
      - Loading skeleton and error state identical in style to AdminUserDetail.

      Render shape (when loaded):
      ```
      <div className="space-y-5">
        {/* Back button */}
        <button type="button" onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: 'var(--adm-muted-fg)',
                   fontWeight: 500, padding: '6px 8px 6px 0', cursor: 'pointer' }}
          className="inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> ← Back to panel
        </button>

        {/* Card */}
        <div style={{ background: 'var(--adm-grad-card)', border: '1px solid var(--adm-border)',
                      borderRadius: 16, boxShadow: '0 4px 20px hsl(213 61% 5% / .5)', padding: 18 }}>

          {/* Avatar + name + username row */}
          <div style={{ display:'flex', alignItems:'center', gap: 16 }}>
            {/* Avatar: 84px circle, gradient, white initials */}
            <div style={{ width:84, height:84, borderRadius:'50%', background:'var(--adm-grad)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          color:'white', fontSize:28, fontWeight:700, flexShrink:0 }}>
              {initials}   {/* first letter first name + first letter last name */}
            </div>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:18, fontWeight:700, color:'var(--adm-fg)' }}>{user.full_name}</span>
                {/* Admin badge — same as AdminUserDetail admin badge */}
                <span style={{ background:'hsl(271 76% 53% / .2)', color:'var(--adm-primary-text)',
                               borderColor:'hsl(271 76% 53% / .4)', ... }}>
                  <ShieldCheck /> Admin
                </span>
              </div>
              <p style={{ color:'var(--adm-muted-fg)', fontSize:13 }}>@{user.username}</p>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop:'1px solid var(--adm-border)', margin:'14px 0' }} />

          {/* Stat row 1: Shield icon + "Administrator since [date]" */}
          <div style={{ display:'flex', alignItems:'center', gap:12, paddingBottom:10 }}>
            <div style={{ width:24, height:24, background:'hsl(271 76% 53% / .16)',
                          borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Shield className="h-3.5 w-3.5" style={{ color:'var(--adm-primary)' }} />
            </div>
            <span style={{ color:'var(--adm-fg)', fontSize:13 }}>
              Administrator since {formatDate(user.created_at)}  {/* "November 5, 2025" format */}
            </span>
          </div>

          {/* Stat row 2: Flag icon + "Reports closed by you · N" */}
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:24, height:24, background:'hsl(271 76% 53% / .16)',
                          borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Flag className="h-3.5 w-3.5" style={{ color:'var(--adm-primary)' }} />
            </div>
            <span style={{ color:'var(--adm-fg)', fontSize:13 }}>
              Reports closed by you · {closedCount}
            </span>
          </div>

          {/* Info banner */}
          <div style={{ background:'hsl(213 40% 20% / .7)', border:'1px solid var(--adm-border)',
                        borderRadius:12, color:'hsl(213 20% 82%)', padding:'12px 14px', marginTop:14,
                        fontSize:12 }}>
            Administrator account. It cannot be changed in the panel; changes are made outside the application.
          </div>
        </div>
      </div>
      ```

      `formatDate` for "Administrator since": use `toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })` — produces "November 5, 2025".

      `closedCount`: compute as `user.warnings?.length ?? 0` — no, that is wrong. The user detail has no "reports closed" field. Default to 0 unless the `AdminUserDetailsFull` type has a `closed_reports_count` field (it does not in the current type). Show 0.

      Files: `src/components/admin/AdminMyAccount.tsx` (create new)
      Verify: `npm run build` exits 0.

- [ ] 3. **Update `AdminPanelPage.tsx` — capture adminId + add showAccount state + My Account button**

      3a. Add two new state variables directly after the existing state declarations:
      ```tsx
      const [showAccount, setShowAccount] = useState(false);
      const [adminId, setAdminId] = useState<string>('');
      ```

      3b. In the profile-fetch `useEffect`, after setting `setAdminName(name)`, also capture the id:
      ```tsx
      const id =
        (profile.id as string | undefined) ||
        (profile.user_id as string | undefined) ||
        '';
      setAdminId(id);
      ```

      3c. Update `switchTab` to also close account view:
      ```tsx
      const switchTab = (tab: AdminTab) => {
        setStack([]);
        setActiveTab(tab);
        setShowAccount(false);   // ADD THIS LINE
      };
      ```

      3d. In the header right-side controls div, insert the "My account" button BETWEEN the User-view toggle and Sign Out:
      ```tsx
      {/* My account */}
      {adminName && (
        <button
          type="button"
          onClick={() => {
            setShowAccount((prev) => !prev);
            if (userView.active) setUserView((v) => ({ ...v, active: false }));
          }}
          aria-label="My account"
          className="inline-flex items-center gap-2 rounded-full border transition-all"
          style={{
            height: 36,
            paddingLeft: 6,
            paddingRight: 12,
            fontSize: 12.5,
            fontWeight: 600,
            background: showAccount ? 'var(--adm-card)' : 'var(--adm-card)',
            borderColor: showAccount ? 'var(--adm-primary)' : 'var(--adm-border)',
            boxShadow: showAccount ? 'var(--adm-shadow-glow)' : 'none',
            color: showAccount ? 'var(--adm-fg)' : 'var(--adm-muted-fg)',
          }}
        >
          {/* 28px avatar circle */}
          <div
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--adm-grad)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}
          >
            {adminName.trim().split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase()}
          </div>
          My account
        </button>
      )}
      ```

      3e. Update the header button height/font for the existing User-view and Sign Out buttons:
      - Add `height: 36, fontSize: 12.5` to their inline style objects.
      - Change `background: 'var(--adm-secondary)'` on the inactive user-view button to `background: 'var(--adm-card)'`.

      3f. Add hover state for User-view and Sign Out buttons using `onMouseEnter`/`onMouseLeave` + a single `useState<string|null>(null)` called `hoveredBtn`:
      ```tsx
      const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
      ```
      On hover: border `hsl(271 76% 53% / .6)`, background `hsl(213 50% 17%)`.

      3g. In the main content area, add the account view branch. The render order in `<main>` should be:
      ```tsx
      {/* My Account view */}
      {showAccount && !userView.active && topOfStack === null && (
        <AdminMyAccount adminId={adminId} onClose={() => setShowAccount(false)} />
      )}

      {/* Stack: user-detail (existing) */}
      {topOfStack?.type === 'user-detail' && ( ... )}
      ... (all existing stack branches unchanged) ...

      {/* User view mode (existing) */}
      {showTabs && userView.active && ( ... )}

      {/* Tab content — only when stack empty, not user view, not account view */}
      {showTabs && !userView.active && !showAccount && (
        <> ... existing tab content ... </>
      )}
      ```

      3h. Add import at top:
      ```tsx
      import AdminMyAccount from '@/components/admin/AdminMyAccount';
      ```

      Files: `src/pages/AdminPanelPage.tsx`
      Verify: `npm run build` exits 0; `npm test` — all existing tests pass (the new button has `aria-label="My account"` which doesn't conflict with any tab role lookup).

- [ ] 4. **Styling fix — AdminPanelPage.tsx tab segment control**

      In the TABS `.map()` button:
      - Change `className="... py-2 text-xs ..."` to `py-2.5 text-sm` (both active and inactive).
      - Change `<span className="hidden sm:inline">` to `<span className="inline">` so labels always show.
      - Inactive style: add `fontWeight: 600` to the inline style object (it is already `font-semibold` on the class but the active/inactive branch only sets background+color — add fontWeight explicitly).

      Files: `src/pages/AdminPanelPage.tsx`
      Verify: `npm run build` exits 0.

- [ ] 5. **Styling fix — AdminUsersTab.tsx filter chips + user row padding**

      Filter chips (inactive):
      - Change `text-xs font-semibold` → `text-[12.5px] font-medium` on the inactive branch.
      - Active branch: keep `font-semibold`, update font-size class to `text-[12.5px]`.

      User rows:
      - Change `p-3.5` → `px-3.5 py-3` on the row button.

      Files: `src/components/admin/AdminUsersTab.tsx`
      Verify: `npm run build` exits 0.

- [ ] 6. **Styling fix — back buttons in AdminUserDetail.tsx and AdminReportDetail.tsx**

      Both files have a back button with:
      ```
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
      style={{ color: 'var(--adm-muted-fg)' }}
      ```

      Change to:
      ```tsx
      className="inline-flex items-center gap-2 transition-colors"
      style={{
        background: 'transparent',
        border: 'none',
        color: hoveredBack ? 'var(--adm-fg)' : 'var(--adm-muted-fg)',
        fontWeight: 500,
        fontSize: 13,
        padding: '6px 8px 6px 0',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHoveredBack(true)}
      onMouseLeave={() => setHoveredBack(false)}
      ```

      Add `const [hoveredBack, setHoveredBack] = useState(false);` near top of each component.

      IMPORTANT: The test checks `screen.getByRole('button', { name: /Back to Users/i })` in AdminUserDetail. The aria name comes from the button's text content ("Back to Users" with ArrowLeft icon). Do NOT change the text. Keep `<ArrowLeft className="h-4 w-4" /> Back to Users` unchanged.
      Similarly AdminReportDetail has "Back to Reports" text — keep it.

      Files: `src/components/admin/AdminUserDetail.tsx`, `src/components/admin/AdminReportDetail.tsx`
      Verify: `npm test -- --reporter=verbose` — existing "navigates to inline user detail" test still passes.

- [ ] 7. **Styling fix — warning history items in AdminUserDetail.tsx**

      Warning item container (inside `user.warnings.map`):
      Current:
      ```
      className="flex items-start justify-between gap-3 rounded-xl p-3"
      style={{ background: 'hsl(213 40% 20% / .45)', border: '1px solid var(--adm-border)', borderLeft: '3px solid var(--adm-warn)' }}
      ```
      Change `p-3` → remove from className; add `padding: '12px 14px'` to the inline style:
      ```tsx
      className="flex items-start justify-between gap-3 rounded-xl"
      style={{
        background: 'hsl(213 40% 20% / .45)',
        border: '1px solid var(--adm-border)',
        borderLeft: '3px solid var(--adm-warn)',
        borderRadius: 12,
        padding: '12px 14px',
      }}
      ```

      Files: `src/components/admin/AdminUserDetail.tsx`
      Verify: `npm run build` exits 0.

- [ ] 8. **Final verification — full test suite + TypeScript**

      Run `npx tsc --noEmit` — must exit 0 (no type errors).
      Run `npm test` — all tests must pass.

      Files: none
      Verify:
      - `npx tsc --noEmit` exits 0
      - `npm test` exits 0 with all suites green

---

## Summary of exact changes per file

### `src/index.css`
No changes needed — all `--adm-*` variables already present and correct.

### `src/components/admin/AdminMyAccount.tsx` (NEW)
- Props: `{ adminId: string; onClose: () => void }`
- Imports: `ArrowLeft`, `Shield`, `Flag`, `ShieldCheck`, `Loader2`, `AlertCircle` from lucide-react; `fetchAdminUserDetails` from `@/lib/adminApi`; `useState`, `useEffect` from react
- State: `user: AdminUserDetailsFull | null`, `loading: boolean`, `error: string`
- useEffect fetches `fetchAdminUserDetails(adminId)` on mount
- Initials computed as: `adminName.trim().split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase()` from `user.full_name`
- Date format: `new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })`
- `closedCount`: 0 (field does not exist on AdminUserDetailsFull)

### `src/pages/AdminPanelPage.tsx`
1. Add import: `import AdminMyAccount from '@/components/admin/AdminMyAccount';`
2. Add `import { ArrowLeft }` is NOT needed — just the component
3. New state: `showAccount`, `adminId`, `hoveredBtn`
4. Profile useEffect: also capture `id`/`user_id` → `setAdminId`
5. `switchTab`: add `setShowAccount(false)`
6. Header: add My Account button between User-view and Sign Out; fix heights/fonts on all three header buttons; change inactive user-view bg to `var(--adm-card)`; add hover states via `hoveredBtn`
7. Tab segment: `py-2` → `py-2.5`, `text-xs` → `text-sm`, `hidden sm:inline` → `inline`
8. Main: add `showAccount` branch before stack entries; add `&& !showAccount` to tab-content condition

### `src/components/admin/AdminUsersTab.tsx`
1. Filter chip className: `text-xs font-semibold` → `text-[12.5px] font-medium` (inactive); active: keep semibold, fix font-size to `text-[12.5px]`
2. Row button: `p-3.5` → `px-3.5 py-3`

### `src/components/admin/AdminUserDetail.tsx`
1. Back button: remove `rounded-lg px-3 py-2 text-xs font-semibold`; use transparent/borderless style with hover; add `hoveredBack` state
2. Warning item: `p-3` → explicit `padding: '12px 14px'`; add `borderRadius: 12` to inline style

### `src/components/admin/AdminReportDetail.tsx`
1. Back button: same borderless style as AdminUserDetail; add `hoveredBack` state

### `src/components/admin/AdminEventsTab.tsx`
No changes required — sub-tab chips and cards already use correct variables.

### `src/components/admin/AdminAuditTab.tsx`
No changes required.

### `src/components/admin/AdminReportsTab.tsx`
No changes required.
