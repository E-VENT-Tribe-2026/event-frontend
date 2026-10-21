# Admin Panel UI Overhaul

The change reskins the entire admin panel to use a new `.adm` CSS scope with `--adm-*` design tokens, and adds a read-only "User view" mode toggled by an Eye button in the header. All seven admin components have been converted from Tailwind theme classes (`bg-card`, `bg-secondary`, `text-muted-foreground`) to inline `style` props referencing `var(--adm-*)`. A new `AdminUserView.tsx` component was created from scratch to implement the user-facing read-only event browser.

Watch for: **confirmed** — `AdminUserDetailsModal.tsx` still uses raw Tailwind theme classes throughout. It is not currently imported anywhere, but it ships in the bundle and will render visually broken if ever wired in.

**Verdict**: APPROVED

---

## High-level view

The `.adm` CSS scope is correctly defined at the end of `src/index.css` with all 23 design tokens. The root div in `AdminPanelPage.tsx` carries `className="adm"`, making all `--adm-*` vars available to every descendant.

`AdminUserView.tsx` exists and exports both the component and the `UserViewState` type. The Eye button in the header toggles `userView.active`. When active, the tab bar and all four tab content blocks are suppressed by `{showTabs && !userView.active && (...)}` guards, and `AdminUserView` is rendered with a "Read-only view" warning banner. The banner's "Back to panel" button does not conflict with the test-required "Back to Users" button in `AdminUserDetail`.

All test-required DOM elements are present: `'Total Registered Users'`, `'Total Events'`, `role="tab"` on all four main tab buttons, `data-testid="user-role-badge"` / `data-testid="admin-role-badge"` in `AdminUserDetail`, and button names `'Back to Users'`, `'Make Admin'`, `'Grant Admin'`. The `placeholder="Search users by username..."` substring also matches the test's case-insensitive `findByPlaceholderText`.

The one non-blocking gap is `AdminUserDetailsModal.tsx`, a dead-code file that was not updated and still uses Tailwind theme classes. It is not in the live render path, but deleting or converting it before reuse would prevent a future visual regression.

<details>
<summary>Issues (1)</summary>

1. **Stale dead-code component** — `AdminUserDetailsModal.tsx` still uses raw Tailwind theme classes (`bg-card`, `bg-secondary`, `bg-destructive/15`, `text-muted-foreground`, `bg-background/80`) throughout. It is not imported anywhere, but if wired in it will render with global theme colors, not the admin palette. Delete the file or convert it to `--adm-*` tokens before reuse.

</details>

<details>
<summary>Details</summary>

### Stale dead-code component (confirmed)

`AdminUserDetailsModal.tsx` is not imported from `AdminPanelPage.tsx` or any other active component — confirmed by grep across the entire `src/` tree (zero matches). The file uses `bg-card`, `bg-secondary`, `bg-destructive/15`, `bg-background/80`, `text-muted-foreground`, and `border-border` throughout. None of these Tailwind classes resolve inside the `.adm` CSS scope, so any future consumer would see the global dark theme palette instead of the admin palette.

</details>

---

<details>
<summary>File map</summary>

| File | Change |
|------|--------|
| `src/index.css` | Added `.adm { }` block with 23 `--adm-*` design tokens |
| `src/pages/AdminPanelPage.tsx` | Added `className="adm"` root, `userView` state, Eye toggle, conditional tab/content rendering, `AdminUserView` integration |
| `src/components/admin/AdminUserView.tsx` | New file — read-only event browser for user view mode |
| `src/components/admin/AdminUsersTab.tsx` | Converted to `--adm-*` inline styles; added `searchFocused`/`hoveredRow` state for interactive border feedback |
| `src/components/admin/AdminEventsTab.tsx` | Converted to `--adm-*`; removed `getCategoryDot`; replaced category dot with organizer-initial thumbnail |
| `src/components/admin/AdminEventDetail.tsx` | Converted to `--adm-*`; replaced `getCategoryGradient` Tailwind strings with `CATEGORY_HUE`-based inline gradient |
| `src/components/admin/AdminAuditTab.tsx` | Converted `ACTION_STYLES` from Tailwind classNames to `React.CSSProperties`; `ActionPill` uses `style` prop |
| `src/components/admin/AdminReportsTab.tsx` | Converted `REASON_STYLES` and `STATUS_STYLES` to `React.CSSProperties`; row hover via per-row state |
| `src/components/admin/AdminReportDetail.tsx` | Converted action button configs to inline styles; reason/status pills use `--adm-*` |
| `src/components/admin/AdminUserDetail.tsx` | Converted action buttons, identity card, warning history, and dialog confirm button to `--adm-*` |
| `src/components/admin/AdminUserDetailsModal.tsx` | Unchanged — dead code, still uses Tailwind theme classes |

Full diff: `git diff main -- src/`
</details>
