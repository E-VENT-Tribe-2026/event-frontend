# Implementation Plan — Admin Panel UI Overhaul

**Task:** Restyle the admin panel to match the shared HTML design + add missing user-view (read-only) toggle.

**Test preservation contract:**
All of the following must survive unchanged across every item:
- Text: `'Total Registered Users'`, `'150'`, `'Total Events'`, `'No audit entries'`, `'Open Reports'`
- Placeholder: `'Search users by username'` (substring match, case-insensitive OK)
- Roles: `role="tab"` on Events / Audit Log / Reports buttons
- Data-testids: `data-testid="user-role-badge"`, `data-testid="admin-role-badge"`
- Button aria-labels/names: `'Back to Users'`, `'Make Admin'`, `'Grant Admin'`

---

## Item 1 — Add `.adm` CSS scope to `src/index.css`

**What to do:**
Append a `.adm { }` block at the end of `src/index.css` (inside the existing `@layer utilities` block or after it — after the last closing `}` in the file). Define all `--adm-*` alias variables exactly as listed. These are named aliases, not a different palette; they mirror the existing `:root` values in most cases.

**File:** `src/index.css`

**Exact block to append:**
```css
.adm {
  --adm-bg:          hsl(213 61% 11%);
  --adm-bg-deep:     hsl(213 60% 8%);
  --adm-card:        hsl(213 50% 15%);
  --adm-card-2:      hsl(213 50% 13%);
  --adm-secondary:   hsl(213 40% 20%);
  --adm-muted:       hsl(213 30% 18%);
  --adm-muted-fg:    hsl(213 20% 64%);
  --adm-fg:          hsl(0 0% 95%);
  --adm-border:      hsl(213 30% 22%);
  --adm-primary:     hsl(271 76% 53%);
  --adm-primary-text:hsl(271 92% 76%);
  --adm-accent:      hsl(330 100% 59%);
  --adm-danger:      hsl(0 84% 60%);
  --adm-danger-text: hsl(0 92% 74%);
  --adm-warn:        hsl(38 92% 52%);
  --adm-warn-text:   hsl(38 95% 66%);
  --adm-ok:          hsl(152 60% 42%);
  --adm-ok-text:     hsl(152 62% 62%);
  --adm-info-text:   hsl(199 90% 70%);
  --adm-grad:        linear-gradient(135deg, hsl(271 76% 53%), hsl(330 100% 59%));
  --adm-grad-card:   linear-gradient(145deg, hsl(213 50% 17%), hsl(213 50% 13%));
  --adm-shadow-glow: 0 0 20px hsl(271 76% 53% / .3);
}
```

**Verify:** `npm run build` (or `npx tsc --noEmit`) passes without errors. No test run needed for CSS-only change.

---

## Item 2 — Restyle `AdminPanelPage.tsx` + add UserView state and Eye toggle

**What to do:**
Replace the JSX in `src/pages/AdminPanelPage.tsx` with the restyled version. Every test-required element must be preserved. Changes:

1. Add `className="adm"` to the root `<div>` (wraps everything, so all `--adm-*` vars are available).
2. Add `Eye` to the lucide-react import.
3. Add `userView` state:
   ```ts
   const [userView, setUserView] = useState<{
     active: boolean;
     screen: 'home' | 'map';
     eventId: string | null;
     categoryFilter: string;
     searchQuery: string;
   }>({ active: false, screen: 'home', eventId: null, categoryFilter: '', searchQuery: '' });
   ```
4. Import `AdminUserView` (new component from item 9).
5. **Header restyling** — keep the same HTML structure, update classNames:
   - Outer `<header>`: `style={{ background: 'hsl(213 61% 11% / .92)' }}` + `className="sticky top-0 z-40 border-b backdrop-blur-sm"` with `style={{ borderColor: 'var(--adm-border)' }}`.
   - Logo square: `34×34` (`h-[34px] w-[34px]`), `rounded-[10px]`, gradient via `style={{ background: 'var(--adm-grad)' }}`.
   - Title: `text-[18px] font-bold`, keep `'Administrator Panel'` text but wrap title in `<h1>` — preserve it. ⚠ Tests don't check the exact title text, but it must not break aria.
   - Subtitle: `text-[12px]`, `style={{ color: 'var(--adm-muted-fg)' }}`.
   - **Eye/User-view button** (add between logo block and Sign Out):
     ```tsx
     <button
       type="button"
       onClick={() => setUserView(v => ({ ...v, active: !v.active }))}
       aria-label="Toggle user view"
       style={userView.active ? {
         border: '1px solid var(--adm-primary)',
         boxShadow: 'var(--adm-shadow-glow)',
       } : {}}
       className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
         userView.active
           ? 'text-white'
           : 'border-[var(--adm-border)] text-[var(--adm-muted-fg)] hover:text-[var(--adm-fg)]'
       }`}
       style2={{ background: userView.active ? 'var(--adm-grad)' : 'var(--adm-secondary)' }}
     >
       <Eye className="h-3.5 w-3.5" />
       User view
     </button>
     ```
     Note: merge both style objects into one `style` prop. If `userView.active`, use `background: 'var(--adm-grad)'` else `background: 'var(--adm-secondary)'`. Combine with the conditional border/shadow.
   - Sign Out button: change `bg-secondary` → `style={{ background: 'var(--adm-secondary)', borderColor: 'var(--adm-border)' }}`.

6. **Tab bar restyling** (the `role="tablist"` div — keep `role="tablist"` and `role="tab"` attrs exactly):
   - Container: `style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}` + `className="mt-4 flex rounded-[14px] border p-1 gap-1"`.
   - Active tab: `style={{ background: 'var(--adm-grad)', boxShadow: 'var(--adm-shadow-glow)' }}` + `className="... text-white shadow"`.
   - Inactive tab: `style={{ color: 'var(--adm-muted-fg)' }}` + transparent bg.
   - Reports badge: keep the existing `<span>` absolutely positioned, change `bg-destructive` → `style={{ background: 'var(--adm-danger)' }}`.

7. **UserView mode** — when `userView.active` is true:
   - Hide the 4-tab segmented control (wrap it in `{showTabs && !userView.active && (...)}` or add a condition).
   - In the main `<main>` body: when `showTabs && userView.active`, render instead:
     ```tsx
     {/* Sticky warning banner */}
     <div
       className="sticky top-[60px] z-30 mb-4 flex items-center justify-between gap-3 rounded-[14px] border px-4 py-2.5 text-xs font-medium"
       style={{ background: 'hsl(38 92% 52% / .1)', borderColor: 'hsl(38 92% 52% / .35)', color: 'var(--adm-warn-text)' }}
     >
       <span>Read-only view — actions are disabled.</span>
       <button
         type="button"
         onClick={() => setUserView(v => ({ ...v, active: false }))}
         className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors"
         style={{ background: 'var(--adm-secondary)', color: 'var(--adm-fg)' }}
       >
         Back to panel
       </button>
     </div>
     <AdminUserView
       state={userView}
       onStateChange={setUserView}
       onBack={() => setUserView(v => ({ ...v, active: false }))}
     />
     ```
   - When `userView.active`, the four tab content blocks (`activeTab === 'users'` etc.) must not render. Guard them with `!userView.active`.

8. **Main container** bg: add `style={{ background: 'var(--adm-bg)' }}` to the root `<div className="adm ...">`.

**Invariants to double-check before committing:**
- The `role="tablist"` and all four `role="tab"` buttons are still rendered when `showTabs && !userView.active`.
- `'Administrator Panel'` title text is still present (tests don't check it but the DOM should not break).
- Sign Out button `aria-label="Sign out"` preserved.

**File:** `src/pages/AdminPanelPage.tsx`

**Verify:** `npx vitest run src/__tests__/pages/AdminPanelPage.test.tsx` — all tests pass.

---

## Item 3 — Restyle `AdminUsersTab.tsx`

**What to do:**
Restyle the component using `--adm-*` CSS variables via inline `style` props for values that aren't Tailwind-safe (arbitrary HSL). Tailwind utility classes remain where they work fine.

Changes by section:

**Total Registered Users card:**
- Outer div: `rounded-[16px] border p-5` + `style={{ background: 'var(--adm-grad-card)', borderColor: 'var(--adm-border)', boxShadow: '0 4px 20px hsl(213 61% 5% / .5)' }}`.
- Icon circle: `h-12 w-12 rounded-2xl` + `style={{ background: 'hsl(271 76% 53% / .18)', color: 'var(--adm-primary)' }}`.
- Label `text-xs`: `style={{ color: 'var(--adm-muted-fg)' }}`.
- Count `text-3xl font-extrabold`: `style={{ color: 'var(--adm-fg)' }}`.

**Search input:**
- Input: `rounded-[12px] h-11 border` + `style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)', color: 'var(--adm-fg)' }}`.
- Focus styles: add a CSS class or use Tailwind's `focus:` but inline focus border is tricky — use `onFocus`/`onBlur` handlers to toggle a `focused` boolean state and swap the inline style, OR use a wrapping `<div>` with focus-within trick. Simplest: add a `focused` state and set inline style conditionally:
  ```tsx
  const [searchFocused, setSearchFocused] = useState(false);
  // on input: onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
  // borderColor: searchFocused ? 'hsl(271 76% 53% / .7)' : 'var(--adm-border)'
  // boxShadow: searchFocused ? '0 0 0 3px hsl(271 76% 53% / .15)' : 'none'
  ```
- Keep `placeholder="Search users by username..."` and `aria-label="Search users by username"` exactly — tests use a substring match on the placeholder.

**Filter chips:**
- Default: `style={{ background: 'var(--adm-card)', borderColor: 'hsl(213 30% 28%)', color: 'hsl(213 20% 82%)' }}`.
- Active: `style={{ background: 'var(--adm-grad)', borderColor: 'var(--adm-primary)', color: 'white', boxShadow: 'var(--adm-shadow-glow)' }}`.

**User rows:**
- Row button: `rounded-[12px] border` + `style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}`.
- Hover (use `onMouseEnter`/`onMouseLeave` state OR Tailwind arbitrary hover — prefer a `hoveredId` state for precision):
  ```tsx
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  // on each li: onMouseEnter={() => setHoveredRow(u.id)} onMouseLeave={() => setHoveredRow(null)}
  // borderColor: hoveredRow === u.id ? 'hsl(271 76% 53% / .55)' : 'var(--adm-border)'
  // background: hoveredRow === u.id ? 'hsl(213 50% 17%)' : 'var(--adm-card)'
  ```

**Role pills — CRITICAL (test checks testid on AdminUserDetail, but these pills appear in the list too):**
- Admin pill: `style={{ background: 'hsl(271 76% 53% / .18)', color: 'var(--adm-primary-text)', borderColor: 'hsl(271 76% 53% / .4)' }}` — keep `<ShieldCheck>` icon.
- User pill: `style={{ background: 'var(--adm-secondary)', color: 'hsl(213 20% 78%)' }}` — keep `<UserCheck>` icon.
- These pills do NOT carry `data-testid`. The testid pills are in `AdminUserDetail.tsx` (item 7). No change needed to testids here.

**UserAvatar:** leave unchanged.

**File:** `src/components/admin/AdminUsersTab.tsx`

**Verify:** `npx vitest run src/__tests__/pages/AdminPanelPage.test.tsx` — tests that check `'Total Registered Users'`, `'150'`, `'Search users by username'`, user names all pass.

---

## Item 4 — Restyle `AdminEventsTab.tsx`

**What to do:**
Apply `--adm-*` styling. Remove the broken `getCategoryDot(event.category)` call. Replace it with an organizer-initial thumbnail.

**Stat cards (grid of 4):**
- Each card div: `rounded-[16px] border p-4` + `style={{ background: 'var(--adm-grad-card)', borderColor: 'var(--adm-border)', boxShadow: '0 4px 20px hsl(213 61% 5% / .5)' }}`.
- Icon circles: `h-[42px] w-[42px] rounded-xl flex items-center justify-center`.
  - Total Events icon: `style={{ background: 'hsl(271 76% 53% / .18)', color: 'var(--adm-primary)' }}`.
  - Upcoming icon: `style={{ background: 'hsl(199 90% 70% / .15)', color: 'var(--adm-info-text)' }}`.
  - Past icon: `style={{ background: 'var(--adm-secondary)', color: 'var(--adm-muted-fg)' }}`.
  - Cancelled icon: `style={{ background: 'hsl(0 84% 60% / .15)', color: 'var(--adm-danger-text)' }}`.
- Label text: `style={{ color: 'var(--adm-muted-fg)' }}`.
- Value text: `style={{ color: 'var(--adm-fg)' }}`.
- Keep `'Total Events'` label text exactly.

**Search input:** same pattern as item 3 (adm-card bg, adm-border, focus state via onFocus/onBlur).

**Sub-tabs:**
- Container: `rounded-[14px] border p-1 gap-1.5` + `style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}`.
- Active: `style={{ background: 'var(--adm-grad)', boxShadow: 'var(--adm-shadow-glow)' }}` + `className="... text-white"`.
- Inactive: `style={{ color: 'var(--adm-muted-fg)' }}`.
- Keep `role="tablist"`, `role="tab"`, `aria-selected` on each sub-tab button (they are not the 4 main tabs tested, but follow the same pattern).

**Event rows:**
- Same row style as user rows (item 3): `rounded-[12px] border` + adm-card bg, adm-border, hover via state.

**Category thumbnail — replace `getCategoryDot`:**
- Remove the `getCategoryDot` call and the `<div className={... getCategoryDot(event.category)} />` dot.
- Replace with a 48×48 px square thumbnail showing the organizer's first letter:
  ```tsx
  {/* Organizer initial thumbnail */}
  <div
    className="h-12 w-12 shrink-0 rounded-xl flex items-center justify-center text-sm font-bold text-white select-none"
    style={{ background: 'linear-gradient(135deg, hsl(213 50% 22%), hsl(213 50% 17%))' }}
    aria-hidden="true"
  >
    {(event.organizer_name?.[0] ?? '?').toUpperCase()}
  </div>
  ```
- The `CATEGORY_COLORS` record and `getCategoryDot` function can be removed from the file entirely since `AdminEventSummaryFull` has no `category` field. This avoids a TypeScript error from `event.category` not existing on the type.

**StatusPill:** update colors to adm vars:
- Cancelled: `style={{ background: 'hsl(0 84% 60% / .15)', color: 'var(--adm-danger-text)', borderColor: 'hsl(0 84% 60% / .3)' }}` + border class.
- Upcoming: `style={{ background: 'hsl(199 90% 70% / .12)', color: 'var(--adm-info-text)', borderColor: 'hsl(199 90% 70% / .3)' }}`.
- Past: `style={{ background: 'var(--adm-secondary)', color: 'var(--adm-muted-fg)' }}`.

**File:** `src/components/admin/AdminEventsTab.tsx`

**Verify:** `npx vitest run src/__tests__/pages/AdminPanelPage.test.tsx` — `'Total Events'` text check passes; Events tab switch test passes.

---

## Item 5 — Restyle `AdminEventDetail.tsx`

**What to do:**
Restyle the hero band and all cards. The category field IS available on `AdminEventDetail` (the full type), so `getCategoryGradient` is valid here — replace its Tailwind color classes with inline HSL gradients using a hue lookup.

**Hero band — replace `getCategoryGradient` Tailwind strings with inline style:**
- Add a `CATEGORY_HUE` record:
  ```ts
  const CATEGORY_HUE: Record<string, number> = {
    music: 290, tech: 200, technology: 200, food: 18,
    sports: 150, sport: 150, art: 330, arts: 330,
    gaming: 255, health: 175, education: 55,
    social: 340, business: 230,
  };
  function getCategoryHue(category?: string): number {
    if (!category) return 271;
    return CATEGORY_HUE[category.toLowerCase()] ?? 271;
  }
  ```
- Hero band outer div: height `h-[120px]`, `rounded-t-2xl overflow-hidden` (rounded-t only), no `rounded-b`. Use inline style for gradient:
  ```tsx
  const H = getCategoryHue(event.category);
  style={{ background: `linear-gradient(135deg, hsl(${H} 70% 40%), hsl(${(H + 45) % 360} 70% 25%))` }}
  ```
- Inside the hero band, add a large faded category icon bottom-right:
  ```tsx
  <div className="relative h-[120px] overflow-hidden rounded-t-2xl" style={{...gradient...}}>
    {/* Faded icon */}
    <Calendar className="absolute bottom-2 right-3 h-20 w-20 opacity-[0.28] text-white pointer-events-none" />
    {/* Content */}
    <div className="relative z-10 p-5 flex items-start justify-between gap-3">
      <div className="flex gap-2 flex-wrap">
        {event.price === 0 || event.price === null || event.price === undefined ? (
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
            style={{ background: 'var(--adm-accent)', color: 'white' }}>Free</span>
        ) : null}
        {event.category && (
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ background: 'hsl(271 76% 53% / .35)', color: 'var(--adm-primary-text)' }}>
            {event.category}
          </span>
        )}
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${getStatusLabel(event).className}`}>
        {getStatusLabel(event).label}
      </span>
    </div>
    <div className="relative z-10 px-5 pb-4">
      <h2 className="text-lg font-bold text-white leading-tight">{event.title}</h2>
      {event.description && (
        <p className="mt-1 text-sm text-white/80 leading-relaxed line-clamp-2">{event.description}</p>
      )}
    </div>
  </div>
  ```
  Note: `event.price` may not exist on the type — guard with `'price' in event` or simply omit the Free pill if not in the type. Check `AdminEventDetail` type in `adminApi.ts` before adding the price check. If no `price` field, omit the Free pill.

**All cards (Facts Grid, Organizer, Participants, Danger Zone):**
- Outer div: `rounded-[16px] border` + `style={{ background: 'var(--adm-grad-card)', borderColor: 'var(--adm-border)' }}`.
- Section headings: `style={{ color: 'var(--adm-fg)' }}`.
- Labels: `style={{ color: 'var(--adm-muted-fg)' }}`.
- Values: `style={{ color: 'var(--adm-fg)' }}`.

**Organizer row:**
- Inner button/div: `style={{ background: 'hsl(213 40% 20% / .5)', borderColor: 'var(--adm-border)' }}`.

**Participant rows:** same inner style.

**Remove Event (Danger Zone):**
- Card border: `style={{ borderColor: 'hsl(0 84% 60% / .3)', background: 'hsl(0 84% 60% / .07)' }}`.
- Button: `style={{ borderColor: 'hsl(0 84% 60% / .4)', background: 'hsl(0 84% 60% / .12)', color: 'var(--adm-danger-text)' }}`.

**File:** `src/components/admin/AdminEventDetail.tsx`

**Verify:** `npm run build` passes (TypeScript must not error on `event.category` — it exists on `AdminEventDetail`). The Events tab test still passes.

---

## Item 6 — Restyle `AdminAuditTab.tsx`

**What to do:**
Apply `--adm-*` to the table card and action pills.

**Table card:**
- Outer div: `rounded-[16px] border overflow-hidden` + `style={{ background: 'var(--adm-grad-card)', borderColor: 'var(--adm-border)' }}`.
- Table header row: `style={{ background: 'hsl(213 40% 18% / .6)', borderBottomColor: 'var(--adm-border)' }}`.
- Row dividers: `style={{ borderColor: 'var(--adm-border)' }}` on the `<ul>` `divide-y`.

**ActionPill — update COLOR MAP to use adm vars (via inline style):**
Replace all the `bg-amber-*/text-amber-*` Tailwind classes in `ACTION_STYLES` with inline-style equivalents. Change `ActionStyle.className: string` to `ActionStyle.style: React.CSSProperties` and update the `<span>` in `ActionPill`:

```ts
interface ActionStyle {
  label: string;
  style: React.CSSProperties;
}
const ACTION_STYLES: Record<string, ActionStyle> = {
  warn:             { label: 'Warn',             style: { background: 'hsl(38 92% 52% / .15)', color: 'var(--adm-warn-text)', borderColor: 'hsl(38 92% 52% / .35)' } },
  suspend:          { label: 'Suspend',           style: { background: 'hsl(0 84% 60% / .15)',  color: 'var(--adm-danger-text)', borderColor: 'hsl(0 84% 60% / .35)' } },
  lift:             { label: 'Lift Suspension',   style: { background: 'hsl(152 60% 42% / .15)', color: 'var(--adm-ok-text)', borderColor: 'hsl(152 60% 42% / .35)' } },
  'lift-suspension':{ label: 'Lift Suspension',   style: { background: 'hsl(152 60% 42% / .15)', color: 'var(--adm-ok-text)', borderColor: 'hsl(152 60% 42% / .35)' } },
  remove:           { label: 'Remove',            style: { background: 'hsl(330 100% 59% / .15)', color: 'hsl(330 100% 78%)', borderColor: 'hsl(330 100% 59% / .35)' } },
  dismiss:          { label: 'Dismiss',           style: { background: 'var(--adm-secondary)',    color: 'var(--adm-muted-fg)', borderColor: 'var(--adm-border)' } },
  'grant-admin':    { label: 'Grant Admin',        style: { background: 'hsl(271 76% 53% / .18)', color: 'var(--adm-primary-text)', borderColor: 'hsl(271 76% 53% / .4)' } },
  'withdraw-warning':{ label: 'Withdraw Warning', style: { background: 'hsl(38 92% 52% / .1)',  color: 'var(--adm-warn-text)', borderColor: 'hsl(38 92% 52% / .25)' } },
};
```
```tsx
function ActionPill({ action }: { action: string }) {
  const s = getActionStyle(action);
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={s.style}>
      {s.label}
    </span>
  );
}
```

**Empty state card:** `style={{ background: 'hsl(213 50% 15% / .5)', borderColor: 'var(--adm-border)' }}`.

**File:** `src/components/admin/AdminAuditTab.tsx`

**Verify:** `npx vitest run src/__tests__/pages/AdminPanelPage.test.tsx` — `'No audit entries'` test passes.

---

## Item 7 — Restyle `AdminReportsTab.tsx` and `AdminReportDetail.tsx`

**What to do (AdminReportsTab.tsx):**
- Section header label: `style={{ color: 'var(--adm-muted-fg)' }}`.
- Loading/empty card: `style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}`.
- Report rows: `rounded-[12px] border` + `style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}` + hover state via `onMouseEnter`/`onMouseLeave` (same pattern as items 3–4).

**Reason pills** — replace `getReasonStyle` Tailwind strings with inline styles:
```ts
const REASON_STYLES: Record<string, React.CSSProperties> = {
  spam:          { background: 'hsl(38 92% 52% / .15)',  color: 'var(--adm-warn-text)',    borderColor: 'hsl(38 92% 52% / .35)' },
  harassment:    { background: 'hsl(0 84% 60% / .15)',   color: 'var(--adm-danger-text)',  borderColor: 'hsl(0 84% 60% / .35)' },
  inappropriate: { background: 'hsl(330 100% 59% / .14)',color: 'hsl(330 100% 78%)',       borderColor: 'hsl(330 100% 59% / .35)' },
  misinformation:{ background: 'hsl(55 92% 52% / .15)',  color: 'hsl(55 95% 70%)',         borderColor: 'hsl(55 92% 52% / .35)' },
  other:         { background: 'var(--adm-secondary)',   color: 'var(--adm-muted-fg)',     borderColor: 'var(--adm-border)' },
};
```
Update `<span style={getReasonStyle(report.reason)}>` in `ReportRow`.

**Status pills** — similarly update `STATUS_STYLES` to use adm vars:
```ts
const STATUS_STYLES: Record<string, React.CSSProperties> = {
  pending:   { background: 'hsl(38 92% 52% / .15)', color: 'var(--adm-warn-text)',  borderColor: 'hsl(38 92% 52% / .35)' },
  dismissed: { background: 'var(--adm-secondary)',  color: 'var(--adm-muted-fg)',   borderColor: 'var(--adm-border)' },
  actioned:  { background: 'hsl(152 60% 42% / .15)',color: 'var(--adm-ok-text)',    borderColor: 'hsl(152 60% 42% / .35)' },
};
```

**Keep `'Open Reports'` heading text exactly** — the test checks for it. It comes from `title="Open Reports"` prop passed to `ReportSection` — do not change that string.

**What to do (AdminReportDetail.tsx):**
- Summary card: `style={{ background: 'var(--adm-grad-card)', borderColor: 'var(--adm-border)' }}`.
- Reason pill: `style={{ background: 'hsl(330 100% 59% / .14)', color: 'hsl(330 100% 78%)', borderColor: 'hsl(330 100% 59% / .35)' }}` — this is the universal "report reason" accent style matching the spec.
- Same `REASON_STYLES` and `STATUS_STYLES` conversion as above (or import a shared helper — keeping inline is fine).
- Moderate card: `style={{ background: 'var(--adm-grad-card)', borderColor: 'var(--adm-border)' }}`.
- Action button styles update `ACTION_CONFIGS[...].btnClass` — convert to `btnStyle: React.CSSProperties` and use `style={c.btnStyle}` on the button. Values:
  - dismiss: `{ background: 'var(--adm-secondary)', borderColor: 'var(--adm-border)', color: 'var(--adm-fg)' }`.
  - warn:    `{ background: 'hsl(38 92% 52% / .12)', borderColor: 'hsl(38 92% 52% / .35)', color: 'var(--adm-warn-text)' }`.
  - remove:  `{ background: 'hsl(330 100% 59% / .12)', borderColor: 'hsl(330 100% 59% / .35)', color: 'hsl(330 100% 78%)' }`.
  - suspend: `{ background: 'hsl(0 84% 60% / .12)', borderColor: 'hsl(0 84% 60% / .35)', color: 'var(--adm-danger-text)' }`.
- Description text field bg: `style={{ background: 'hsl(213 40% 18% / .5)', borderColor: 'var(--adm-border)' }}`.
- "Resolved" banner: `style={{ borderColor: 'hsl(152 60% 42% / .35)', background: 'hsl(152 60% 42% / .07)', color: 'var(--adm-ok-text)' }}`.

**Files:** `src/components/admin/AdminReportsTab.tsx`, `src/components/admin/AdminReportDetail.tsx`

**Verify:** `npx vitest run src/__tests__/pages/AdminPanelPage.test.tsx` — `'Open Reports'` text check passes.

---

## Item 8 — Restyle `AdminUserDetail.tsx`

**What to do:**
Apply `--adm-*` to identity card, action buttons, and warning history. Preserve all testids and button names.

**Identity card:**
- Outer div: `rounded-[16px] border p-5` + `style={{ background: 'var(--adm-grad-card)', borderColor: 'var(--adm-border)' }}`.
- Name: `style={{ color: 'var(--adm-fg)' }}`.
- Admin badge (`data-testid="admin-role-badge"`): `style={{ background: 'hsl(271 76% 53% / .2)', color: 'var(--adm-primary-text)', borderColor: 'hsl(271 76% 53% / .4)' }}`. Keep `data-testid="admin-role-badge"` exactly.
- User badge (`data-testid="user-role-badge"`): `style={{ background: 'var(--adm-secondary)', color: 'hsl(213 20% 78%)', borderColor: 'var(--adm-border)' }}`. Keep `data-testid="user-role-badge"` exactly.
- Suspended badge: `style={{ background: 'hsl(0 84% 60% / .15)', color: 'var(--adm-danger-text)', borderColor: 'hsl(0 84% 60% / .35)' }}`.
- Username/email: `style={{ color: 'var(--adm-muted-fg)' }}`.

**Action buttons:**
- Warn button: `inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold` + `style={{ borderColor: 'hsl(38 92% 52% / .4)', background: 'hsl(38 92% 52% / .12)', color: 'var(--adm-warn-text)' }}`. Icon remains `<AlertTriangle>` but remove the Tailwind `text-warn-text` class (not a real Tailwind var) — the color comes from the parent `style`.
- Lift Suspension button: `style={{ borderColor: 'hsl(152 60% 42% / .4)', background: 'hsl(152 60% 42% / .12)', color: 'var(--adm-ok-text)' }}`. Remove `text-ok-text` from the icon class.
- Suspend button: keep destructive-ish but use adm vars: `style={{ borderColor: 'hsl(0 84% 60% / .4)', background: 'hsl(0 84% 60% / .12)', color: 'var(--adm-danger-text)' }}`.
- Make Admin button (`aria-label` not set; test finds it by name `'Make Admin'`): use gradient: `style={{ background: 'var(--adm-grad)', boxShadow: 'var(--adm-shadow-glow)', color: 'white' }}` + `className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"`. Remove `gradient-primary` Tailwind class since that relies on the utility class defined globally — inline style is more explicit.

**Organized / Joined Events cards:**
- Card div: `style={{ background: 'var(--adm-grad-card)', borderColor: 'var(--adm-border)' }}`.
- Inner event rows (`EventSubList`): `style={{ background: 'hsl(213 40% 18% / .5)', borderColor: 'var(--adm-border)' }}`.

**Warning History card:**
- Card div: `style={{ background: 'var(--adm-grad-card)', borderColor: 'var(--adm-border)' }}`.
- Active warning item: `style={{ background: 'hsl(213 40% 20% / .45)', borderLeft: '3px solid var(--adm-warn)', borderColor: 'var(--adm-border)' }}`. Change `rounded-xl border border-border/60 bg-secondary/40 p-3` to use inline style + keep `rounded-xl p-3`.
- Withdrawn warnings (none in current implementation — warnings are removed on withdraw, not marked): no additional style needed unless the API returns `withdrawn: true`. If in future it does, a dashed border pattern would apply. Skip this sub-case for now.
- Withdraw button: `style={{ background: 'var(--adm-secondary)', borderColor: 'var(--adm-border)', color: 'var(--adm-muted-fg)' }}`.

**AlertDialog `confirmClass` for the main action dialog:**
The dialog's confirm button currently uses `className="rounded-lg gradient-primary text-xs font-semibold text-white"`. Replace with `style={{ background: 'var(--adm-grad)', color: 'white' }}` + `className="rounded-lg text-xs font-semibold"`.

**File:** `src/components/admin/AdminUserDetail.tsx`

**Verify:** `npx vitest run src/__tests__/pages/AdminPanelPage.test.tsx` — all user detail tests pass: `data-testid="user-role-badge"`, `data-testid="admin-role-badge"`, `'Back to Users'`, `'Make Admin'`, `'Grant Admin'` buttons all found.

---

## Item 9 — Create `src/components/admin/AdminUserView.tsx`

**What to do:**
Create a new file from scratch. This is the read-only user-facing view shown when the admin toggles "User view".

**Type definition** (declare at top of file or import from a shared types file — inline is fine):
```ts
export interface UserViewState {
  active: boolean;
  screen: 'home' | 'map';
  eventId: string | null;
  categoryFilter: string;
  searchQuery: string;
}
```

**Props:**
```ts
interface AdminUserViewProps {
  state: UserViewState;
  onStateChange: (s: UserViewState) => void;
  onBack: () => void;
}
```

**Event type** (minimal, for the fetch):
```ts
interface PublicEvent {
  id: string;
  title: string;
  date: string;
  category?: string;
  organizer_name?: string;
  location?: string;
  description?: string;
  participants_count?: number;
  is_free?: boolean;
  price?: number;
}
```

**Structure:**
```
AdminUserView
├── If state.eventId → EventDetailView (inline)
└── Else
    ├── Sub-tabs: Home | Map
    ├── If screen === 'home'
    │   ├── Category filter chips (horizontal scroll)
    │   ├── Search input
    │   └── Event card grid (2-col on sm)
    └── If screen === 'map'
        ├── Grey placeholder box (h-48, rounded-2xl, centered text)
        └── Compact event list below
```

**Data fetching:**
```tsx
const [events, setEvents] = useState<PublicEvent[]>([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  if (state.eventId) return; // don't fetch list when in detail
  setLoading(true);
  const token = getAuthToken(); // import from @/lib/auth
  const headers: HeadersInit = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  fetch(getApiUrl('/api/events?status=upcoming&limit=50'), { headers })  // import getApiUrl from @/lib/api
    .then(r => r.ok ? r.json() : Promise.reject())
    .then((data: unknown) => {
      // API shape: { data: { items: PublicEvent[] } } or { items: PublicEvent[] } — handle both
      const raw = data as Record<string, unknown>;
      const items = (raw.data as Record<string, unknown>)?.items
        ?? (raw.items as PublicEvent[] | undefined)
        ?? [];
      setEvents(items as PublicEvent[]);
    })
    .catch(() => {})
    .finally(() => setLoading(false));
}, [state.eventId]);
```

**Category filter chips:**
- Derive unique categories from fetched events: `const categories = [...new Set(events.map(e => e.category).filter(Boolean))] as string[]`.
- Render chips with "All" first. Active = `state.categoryFilter === cat` (or `''` for All).
- Click: `onStateChange({ ...state, categoryFilter: cat === 'All' ? '' : cat })`.
- Styles: same active/inactive pattern as UsersTab filter chips (adm-grad active, adm-card inactive).

**Event card grid (filtered by category + search):**
```tsx
const filtered = events
  .filter(e => !state.categoryFilter || e.category === state.categoryFilter)
  .filter(e => !state.searchQuery || e.title.toLowerCase().includes(state.searchQuery.toLowerCase()));
```

Each event card:
- `rounded-[16px] border overflow-hidden` + `style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}`.
- Hero band: `h-20` gradient using category hue (use the same `CATEGORY_HUE` lookup from item 5 — extract it to a shared utility or duplicate it here). Inline style: `background: \`linear-gradient(135deg, hsl(${H} 70% 40%), hsl(${(H+45)%360} 70% 25%))\``.
- Category chip top-left in hero: `style={{ background: 'hsl(271 76% 53% / .35)', color: 'var(--adm-primary-text)' }}`.
- Content below hero: `p-3 space-y-1`.
- Title: `text-sm font-bold`, `style={{ color: 'var(--adm-fg)' }}`.
- Organizer: `text-xs`, `style={{ color: 'var(--adm-muted-fg)' }}`.
- Date: `text-xs`, `style={{ color: 'var(--adm-muted-fg)' }}`.
- Location: `text-xs flex items-center gap-1`, `style={{ color: 'var(--adm-muted-fg)' }}` with `<MapPin className="h-3 w-3" />`.
- Action buttons row (Join / Favourite / Report): render but disabled + opacity-50 + cursor-not-allowed. Add `title="Actions disabled in admin view"`.
- Card is clickable → `onStateChange({ ...state, eventId: e.id })`.

**Map screen:**
```tsx
{/* Placeholder map area */}
<div
  className="h-48 rounded-[16px] flex flex-col items-center justify-center gap-2 border"
  style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
>
  <MapPin className="h-8 w-8 opacity-30" style={{ color: 'var(--adm-muted-fg)' }} />
  <p className="text-xs font-medium" style={{ color: 'var(--adm-muted-fg)' }}>Map view — read-only</p>
</div>
{/* Compact list below */}
<div className="mt-4 space-y-2">
  {events.slice(0, 10).map(e => (
    <button key={e.id} type="button" onClick={() => onStateChange({ ...state, eventId: e.id })}
      className="w-full flex items-center gap-3 rounded-[12px] border p-3 text-left"
      style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--adm-fg)' }}>{e.title}</p>
        <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>{e.organizer_name}</p>
      </div>
    </button>
  ))}
</div>
```

**Event detail view (when `state.eventId` is set):**
- Fetch from `/api/events/${state.eventId}` (or the admin detail endpoint) on mount.
- Show: Back button → `onStateChange({ ...state, eventId: null })`.
- Hero band (same 120px gradient as AdminEventDetail hero — use the same CATEGORY_HUE logic).
- Title, organizer, description, date, location (with icons), participants count.
- All action buttons (Join, Favourite, Report) rendered but disabled.
- Style all cards with `--adm-grad-card` bg + `--adm-border`.

**Sub-tabs:**
```tsx
<div className="flex rounded-[14px] border p-1 gap-1 mb-4"
  style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}>
  {(['home', 'map'] as const).map(s => (
    <button key={s} type="button"
      onClick={() => onStateChange({ ...state, screen: s })}
      className="flex-1 rounded-xl py-2 text-xs font-semibold capitalize transition-all"
      style={state.screen === s
        ? { background: 'var(--adm-grad)', color: 'white', boxShadow: 'var(--adm-shadow-glow)' }
        : { color: 'var(--adm-muted-fg)' }}>
      {s === 'home' ? 'Home' : 'Map'}
    </button>
  ))}
</div>
```

**File:** `src/components/admin/AdminUserView.tsx` (new file)

**Verify:**
1. `npm run build` (or `npx tsc --noEmit`) — no TypeScript errors.
2. `npx vitest run src/__tests__/pages/AdminPanelPage.test.tsx` — all existing tests still pass (the Eye toggle does not affect them since `userView.active` starts as `false`).

---

## Item 10 — Update `AdminPanelPage.tsx` to import `UserViewState` from `AdminUserView.tsx`

**What to do:**
In item 2 you added a local `userView` state. Now that `UserViewState` is exported from `AdminUserView.tsx`, update the import so both files use the same type:

```ts
import AdminUserView, { type UserViewState } from '@/components/admin/AdminUserView';
```

Replace the inline type declaration in `AdminPanelPage.tsx` with this import.

**File:** `src/pages/AdminPanelPage.tsx`

**Verify:** `npx vitest run src/__tests__/pages/AdminPanelPage.test.tsx` — full test suite passes. Also run `npm run build` to confirm no TypeScript errors across all changed files.

---

## Final end-to-end verification

After all items are complete, run:

```
npx vitest run src/__tests__/pages/AdminPanelPage.test.tsx
```

Expected: all tests pass with 0 failures.

Then run:
```
npm run build
```

Expected: build completes without TypeScript errors or missing module errors.

**Known constraints:**
- `event.category` is available in `AdminEventDetail` (full type) but NOT in `AdminEventSummaryFull` (list type). The organizer-initial thumbnail in item 4 handles this correctly.
- CSS variables like `var(--adm-*)` are only defined inside `.adm { }`, so they only work in DOM nodes that are descendants of an element with `className="adm"`. The root `<div className="adm ...">` in `AdminPanelPage` covers all admin components.
- `gradient-primary` and `shadow-glow` Tailwind utility classes remain valid globally (defined in index.css `@layer utilities`) — but in items 7–8 we switch to inline `style={{ background: 'var(--adm-grad)' }}` for the admin context to keep consistency with the `--adm-*` system.
- The Eye/UserView button does NOT affect any tab role or aria attributes. Tests that check `role="tab"` will still find them because the tab bar is hidden only when `userView.active === true`, and no test toggles user view.
