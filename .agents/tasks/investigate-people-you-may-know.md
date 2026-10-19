# Investigation: People You May Know — Findings Report

## Summary Answer

The "People You May Know" section is rendered inside **`src/pages/HomePage.tsx`** (line 548).
It is populated by a call to `GET /api/friends/suggestions` and then front-end filtered to
exclude users that should not appear.

**The bug:** the front-end exclusion logic in `fetchExcludedIds` (HomePage.tsx lines 79–100)
calls the **wrong API paths** for sent and incoming requests. It guesses
`/api/friendships/requests`, `/api/friendships/requests/sent`, and
`/api/friendships/requests/received`, none of which are real routes.
The real routes (established everywhere else in the codebase) are
`/api/friends/requests/incoming` and `/api/friends/requests/sent`.
Because every wrong path returns a 404, the `fetchExcludedIds` helper returns an empty
set for requests, so friends who already have a pending request either direction appear in
suggestions. Additionally, the `handleAddFriend` function (line 213) calls
`POST /api/friendships/requests` instead of the correct `POST /api/friends/requests`.

---

## Evidence

### 1. Rendering component

**File:** `src/pages/HomePage.tsx`  
**Line 548:**
```tsx
{/* People You May Know */}
{user && (
  <div className="rounded-2xl ...">
    <h3 ...>People You May Know</h3>
    {suggestedUsers.length > 0 ? (
      <div className="space-y-2.5">
        {suggestedUsers.map((person) => { ... })}
      </div>
    ) : ( ... )}
  </div>
)}
```
The section lives in the **left sidebar** of `HomePage`'s two-column layout (inside `<aside>`).

---

### 2. Data source / API call

**File:** `src/pages/HomePage.tsx`  
**Line 24:** `const SUGGESTIONS_PATH = '/api/friends/suggestions';`  
**Lines 170–199 (`loadSuggestions`):**

```ts
const [res, excluded] = await Promise.all([
  fetch(getApiUrl(SUGGESTIONS_PATH), { headers: { Authorization: `Bearer ${token}` } }),
  fetchExcludedIds(token, user?.id),      // <-- should build the blocked set
]);
```

The suggestions endpoint returns an array (or paged object) of candidate users. The raw
response is normalised by `toArray()` and `.map(item => item.user ?? item)` to handle both
plain-user and wrapped-user shapes.

---

### 3. How the suggested-user list is determined

The backend (`GET /api/friends/suggestions`) decides the candidate pool; the front-end applies
an additional client-side exclusion pass:

```ts
const blocked = new Set<string>(excluded);   // from fetchExcludedIds
if (user?.id) blocked.add(user.id);          // self
friendsKey.split(',').filter(Boolean).forEach((id) => blocked.add(id)); // local user.friends[]

const users = toArray(body)
  .map(...)
  .filter((u) => !blocked.has(u.id))
  .filter((u) => Boolean(u.display_name || u.full_name || u.username));
setSuggestedUsers(users.slice(0, MAX_SUGGESTIONS));
```

So the **frontend is supposed to exclude** friends, sent-request targets, and
incoming-request senders — but fails to do so because `fetchExcludedIds` uses the wrong
paths (see §4 below).

---

### 4. Root cause — wrong API paths in `fetchExcludedIds`

**File:** `src/pages/HomePage.tsx`  
**Lines 40–45:**

```ts
// ASSUMPTION: adjust these to your real routes …
const FRIEND_LIST_PATHS = ['/api/friends'];        // ✓ correct
const REQUEST_PATHS = [
  '/api/friendships/requests',          // ✗ wrong — 404s
  '/api/friendships/requests/sent',     // ✗ wrong — 404s
  '/api/friendships/requests/received', // ✗ wrong — 404s
];
```

The **correct paths** used everywhere else in the codebase (`src/lib/friendsApi.ts`, the
test handlers in `src/__tests__/pages/FriendsPage.test.tsx`) are:

| Purpose | Correct path |
|---|---|
| Friends list | `/api/friends` |
| Sent requests | `/api/friends/requests/sent` |
| Incoming requests | `/api/friends/requests/incoming` |

Because the three `REQUEST_PATHS` entries all 404, the `fetchExcludedIds` helper returns an
empty set for request-related users. The `FRIEND_LIST_PATHS` entry is correct, so existing
friends **are** excluded — but users with a pending request in either direction are **not**.

**Secondary bug — wrong mutation path in `handleAddFriend`:**  
**File:** `src/pages/HomePage.tsx`  
**Line 213:**
```ts
const res = await fetch(getApiUrl('/api/friendships/requests'), {  // ✗ wrong
  method: 'POST',
  ...
});
```
The correct mutation endpoint (used everywhere else, including `src/lib/friendsApi.ts`
line 179 and the test mock at line 58 of `FriendsPage.test.tsx`) is
`POST /api/friends/requests`.

---

### 5. Supporting evidence from codebase

| File | Symbol / route | Value | Notes |
|---|---|---|---|
| `src/lib/friendsApi.ts:138` | `fetchFriends` | `GET /api/friends` | Confirmed correct friends path |
| `src/lib/friendsApi.ts:143` | `fetchIncomingRequests` | `GET /api/friends/requests/incoming` | Confirmed correct incoming path |
| `src/lib/friendsApi.ts:148` | `fetchSentRequests` | `GET /api/friends/requests/sent` | Confirmed correct sent path |
| `src/lib/friendsApi.ts:179` | `sendFriendRequest` | `POST /api/friends/requests` | Confirmed correct POST path |
| `src/__tests__/pages/FriendsPage.test.tsx:69` | mock handler | `GET /api/friends` | Test uses same correct paths |
| `src/__tests__/pages/FriendsPage.test.tsx:70` | mock handler | `GET /api/friends/requests/incoming` | Test uses same correct paths |
| `src/__tests__/pages/FriendsPage.test.tsx:76` | mock handler | `GET /api/friends/requests/sent` | Test uses same correct paths |
| `src/__tests__/pages/UserProfilePage.test.tsx:58` | mock handler | `POST /api/friends/requests` | Test uses same correct POST path |

---

## Conclusions

1. **Friends are excluded correctly** (the `/api/friends` path is right). This matches the user
   report that friends still appear — they do not, but request targets do.

2. **Sent requests are NOT excluded** because `/api/friendships/requests/sent` 404s. A user who
   has already sent a friend request to someone still sees them in suggestions.

3. **Incoming requests are NOT excluded** because `/api/friendships/requests/received` 404s.
   A user who has received a friend request from someone still sees them in suggestions.

4. **"Add Friend" from the suggestions card always fails** (or silently succeeds via the wrong
   endpoint) because `handleAddFriend` POSTs to `/api/friendships/requests` instead of
   `/api/friends/requests`.

---

## Recommended Fix

All four changes are in **`src/pages/HomePage.tsx`** only. No backend changes are needed.

### Fix 1 — Correct the `REQUEST_PATHS` constant (lines 42–45)

```ts
// BEFORE
const REQUEST_PATHS = [
  '/api/friendships/requests',
  '/api/friendships/requests/sent',
  '/api/friendships/requests/received',
];

// AFTER
const REQUEST_PATHS = [
  '/api/friends/requests/sent',
  '/api/friends/requests/incoming',
];
```

This ensures `fetchExcludedIds` actually gets data back for both sent and incoming requests,
and the `collectUserIds` helper extracts user IDs from the `{ user: { id } }` rows those
endpoints return.

### Fix 2 — Correct `handleAddFriend` mutation path (line 213)

```ts
// BEFORE
const res = await fetch(getApiUrl('/api/friendships/requests'), {

// AFTER
const res = await fetch(getApiUrl('/api/friends/requests'), {
```

### Optional improvement — reuse `friendsApi.ts` functions

Instead of the ad-hoc `fetchExcludedIds` helper, `loadSuggestions` could call the already-
correct, cached `fetchFriends`, `fetchIncomingRequests`, and `fetchSentRequests` from
`src/lib/friendsApi.ts`. This removes the duplicated fetching logic and benefits from the
existing cache, but it is not strictly required; fixing the path strings alone resolves the
bug.

### Fix 3 (optional) — remove stale `FRIEND_LIST_PATHS` / `REQUEST_PATHS` constants

Once the paths are correct the comment block starting "ASSUMPTION: adjust these to your real
routes" can be removed, since the routes are now known.
