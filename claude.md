# DataClaus Project Assistant Instructions

## Role and Identity
You are a project management and development assistant agent for the **DataClaus** project. You operate heavily relying on the `memory-bank` directory to ensure current, consistent, and context-aware output.

## Memory Bank Workflow
Before beginning any task, you must read and consider the relevant context from the `memory-bank/` directory.

### 1. Core Project Context (Rules and Knowledge Access)
- **`memory-bank/activeContext.md`**: Your priority file. Contains critical tasks, current focus, recent changes (e.g., the NestJS backend migration), and active decisions.
- **`memory-bank/productContext.md`**: Contains the product's business goals, user journeys, data flow, and core platform entities.
- **`memory-bank/techContext.md`**: Contains the project's monorepo structure, technologies used, and infrastructure setup.
- **`memory-bank/projectbrief.md`**: The project's vision, capstone goals, and scope.

### 2. Development and Status Tracking (Dynamic Information)
- **`memory-bank/progress.md`**: Stores summaries of the latest meetings, completed work, and current status. Use for status reports.
- **`memory-bank/systemPatterns.md`**: Contains architectural decisions (Event-Driven Microservices), database patterns, and rules for Git output analysis.
- **`memory-bank/gitPolicy.md`**: Rules and policies regarding version control.
- **`memory-bank/implementation_plan.md`**: Step-by-step roadmap for ongoing tasks.

## Crucial Rule: Memory Bank Updates
As the project evolves, the memory bank must stay updated. When the user provides a new piece of information, a decision, or a status change:
1. Generate the updated information as a Markdown snippet that belongs in one of the memory bank files.
2. Present it under the heading **`[UPDATE SUGGESTION]`** at the end of your response.
3. **Do not update the file yourself**; only suggest the update for the user to review.
*Example:* If the user says 'The new API address is: example.com/v2', you will suggest the new content for the `techContext.md` file.

## Specific System Patterns
- **Git Output Formatting:** If the user provides `git status` or `git diff`, always respond with:
  1. `[Summary]`: One-sentence branch state summary.
  2. `[Changes]`: List of files and change types.
  3. `[Recommendation]`: Next step based on `gitPolicy.md`.
- **Architecture:** Keep in mind the Event-Driven microservice architecture (NestJS API -> Kafka -> Python Worker -> Postgres) and the platform's core focus on real-time data ingestion, fraud detection, and the "Quality = Money" financial model.

## Frontend Discipline (apps/dataclaus-web)

The web app is Next.js 14 (App Router) + React 18 + Radix + Tailwind + Socket.io + **TanStack Query 5** + **zod 4**. The codebase has been refactored to follow a strict pattern; deviations re-introduce the bug classes the user explicitly complained about ("auth bozuluyor", "API güncellenir state güncellenmez").

### Mandatory skills

- **`senior-frontend-flow`** — Invoke BEFORE writing or modifying ANY frontend feature that touches auth, server data, mutations, forms, sockets, or protected routes. Walks the eight-question pre-flight checklist and enforces three discipline rules: one server-state cache layer, every mutation co-locates its invalidations, every optimistic update has a rollback. Auth must implement the four-state machine (`unknown → authed | guest`, plus `refreshing`) — `unknown` is non-negotiable to prevent the login-flash-on-refresh bug.

- **`frontend-page-review`** — Invoke when reviewing pages/routes ("incele", "kontrol et", "review the platform"). Runs each page through eight axes (auth, state sync, race conditions, loading/error/empty triad, hydration, a11y, type safety, performance signals) and produces a severity-ranked report (CRITICAL / HIGH / MEDIUM / LOW) with `file:line` citations and concrete fixes.

### Required patterns — DO NOT bypass

These primitives exist; use them. Re-implementing the underlying logic at the page level is what made the platform brittle in the first place.

| When you need to… | Use | NOT |
|---|---|---|
| Read server data | `useX()` hooks from `src/lib/api-hooks.ts` | `useEffect` + `fetch` + `useState` |
| Mutate server data | `useDoX()` hooks (auto-invalidate cache keys) | direct `lib/api.ts` calls + manual `fetchData()` |
| Add a new API endpoint | export a function in `lib/api.ts` AND a hook in `lib/api-hooks.ts` AND a key in `lib/query-keys.ts` AND (for high-stakes shapes) a zod schema in `lib/schemas.ts` | three of the four |
| Gate a route by auth | `<RequireAuth>` (from `src/lib/route-guards.tsx`) | `useEffect` redirect inside the page |
| Gate by role (admin etc.) | `<RequireRole role="admin">` | hand-rolled `if (user?.role !== 'admin') router.push(...)` |
| Validate API response shape | pass `schema: SomeSchema` as the second arg to `request<T>(...)` | hope TypeScript types stay accurate |
| Boundary render errors | Next.js `error.tsx` per route segment + `<ErrorPanel>` from `src/components/layout/error-panel.tsx` | letting the whole app blank out |
| Patch cache from a socket event | `qc.setQueryData(queryKeys.X.Y(), updater)` AND `qc.invalidateQueries(...)` for safety | `setLocalState(...)` that shadows the cache |

### Specifically forbidden patterns (these existed and caused the user's reported bugs)

1. **`router.push(...)` during render** — must be inside `useEffect`. Login page used to do this; React 19 will hard-error.
2. **`localStorage.parse(...)` to figure out role/state after `await login()`** — `login()` returns the user; use the return value.
3. **Silent error → empty state** — `if (!response.ok) { setUsers([]); return }` is a CRITICAL bug. Distinguish 401/403/network/server errors with explicit UI + retry.
4. **Mutation without `invalidateQueries`** — every mutation in `api-hooks.ts` co-locates the invalidation; never write a mutation hook that doesn't.
5. **Auto-logout on every 401** — DON'T. The user explicitly asked for "insancıl" UX. 401 just throws `ApiError` and the page handles it (toast / error state). Logout is reserved for the explicit logout button.
6. **Two writes to the same server data** — server state lives in the React Query cache, full stop. Don't `useState` a copy of cache data; read it from `useX()`.

### Auth state machine

```
status: 'unknown' | 'authed' | 'guest'
```

- `unknown` — AuthProvider is hydrating from localStorage. Render a skeleton; **do NOT redirect**. Treating `unknown` as `guest` causes the login-flash-on-refresh bug.
- `authed` — render the protected content.
- `guest` — `<RequireAuth>` redirects to `/`.

`isLoading` is kept as a derived backwards-compat alias (`status === 'unknown'`); new code should use `status`.

### Realtime → cache pattern

WebSocket / Socket.io events MUST write to the React Query cache, not to local `useState`. Example from `src/components/user/LiveTicker.tsx`:

```ts
qc.setQueryData<EarningsSummary | undefined>(
  queryKeys.earnings.summary(),
  (prev) => prev ? { ...prev, balance: prev.balance + amount, totalEarned: prev.totalEarned + amount } : prev,
);
qc.invalidateQueries({ queryKey: queryKeys.ledger.all });  // safety net
```

This is THE fix for "API güncellenir, state güncellenmez". The ticker, the hero card, the by-app card, and the withdraw page all read the same cache key — one socket event updates all of them in the same render cycle.

### Cookie auth + server-side middleware (now wired, additive)

The backend (`apps/dataclaus-nestjs-api`) now sets a `dc_session` httpOnly cookie on `/auth/login`, `/auth/register`, `/auth/user/verify-otp`, and `/auth/user/refresh`. The cookie is `httpOnly`, `sameSite: 'lax'`, `secure` in production, and lives 15 minutes (matches access-token TTL). `/auth/logout` clears it.

The Nest JWT strategy reads the token from the cookie first, then falls back to the `Authorization: Bearer …` header — so old SDKs / mobile clients keep working unchanged.

The Next.js `src/middleware.ts` reads the same cookie and gates `/dashboard/*` and `/u/*` server-side. Unauthed direct-URL hits get redirected to `/?next=<original-path>` BEFORE any client tree renders. The login page (`safeNext()` guard against open-redirect) honors `?next=` after successful auth.

`lib/api.ts` `request()` now sends `credentials: 'include'`, so the cookie is forwarded on every same-origin call. `auth-context.logout()` calls `apiLogout()` (POST `/auth/logout`) before clearing localStorage.

**Coexistence status:** the access token still travels in localStorage AND the cookie. This is intentional during the rollout — the cookie path is non-breaking and unlocks server-side gating, but localStorage remains the primary token store on the frontend until we migrate every Bearer call. **Do not assume cookie-only**; the JWT extractor reads either source.

### Outstanding gaps (in priority order)

1. **Retire localStorage tokens** — once we're confident the cookie path is healthy, remove `localStorage.setItem('dataclaus_token', …)` calls in `auth-context` and stop reading the token in `lib/api.ts:request()`. The Authorization header gets dropped; the cookie does the work. Closes the XSS exposure that lets a malicious script exfiltrate the token.
2. **Refresh token flow on the password path** — currently only the OTP login mints a refresh token. Add refresh issuance to `/auth/login` so the access token can be silently rotated when it nears expiry, instead of forcing the user to re-login every 15 minutes.
3. **Schema coverage** — extend `src/lib/schemas.ts` to cover ad-tracking, webhook secrets, and remaining transaction admin endpoints.
4. **Lower-traffic page conversions** — `dashboard/admin/{reports,analytics}` (currently 100% mock data), `dashboard/apps`, `dashboard/faq`, `dashboard/my-apps/logs`, `jury`. Mechanical when those pages get real backends.

### When in doubt

- Writing code → invoke `senior-frontend-flow`.
- Auditing code → invoke `frontend-page-review`.
- Adding a new endpoint → schema in `lib/schemas.ts`, exported function in `lib/api.ts`, hook in `lib/api-hooks.ts`, key factory in `lib/query-keys.ts`. All four, every time.
