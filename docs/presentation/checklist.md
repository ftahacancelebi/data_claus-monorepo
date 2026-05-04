# Demo Day Checklist

Print or pin this on a second monitor during the demo. Tick items off as
you go — running through the same list every dry-run is what makes the
real run boring.

## T-24 hours

- [ ] Pull latest `develop` on every machine that will be in the room.
- [ ] `pnpm install` from repo root + each app.
- [ ] `docker compose up -d` and confirm Postgres is reachable.
- [ ] `pnpm run demo:reset` — fresh seed, idempotent verified.
- [ ] `psql -c "SELECT SUM(amount) FROM ledger_transactions WHERE status='completed'"` returns `0`.
- [ ] Slide deck exported to PDF and PPTX.
- [ ] `demo.mp4` rendered to 1080p, ≤3 minutes, plays without network.
- [ ] Backup laptop synced (clone, deps, demo:seed run).
- [ ] Capstone submission folder ready (`/submission/`).

## T-2 hours

- [ ] Test venue Wi-Fi — `curl https://google.com` succeeds.
- [ ] Bring a phone hotspot in case the Wi-Fi dies.
- [ ] `pnpm run dev:all` — confirm API, web, tiktok-be, tiktok-mb all green.
- [ ] Open all five demo tabs:
  1. Slide deck (Reveal/Marp/PowerPoint).
  2. `/jury` console (logged out).
  3. Backend log terminal (`pnpm --filter dataclaus-nestjs-api start:dev`).
  4. `/admin/health/full` JSON view OR `/dashboard/admin/health`.
  5. `pnpm run demo:replay` ready to fire.
- [ ] Mobile phone at 100% battery, TikTok Clone build current, plugged in.
- [ ] Mic check, audio levels, presenter mode toggle.

## T-15 minutes

- [ ] OBS or screen recorder running (and visible recording indicator off-screen).
- [ ] `demo.mp4` open behind the slide deck as fallback.
- [ ] Final invariant check: `curl http://localhost:3000/admin/health/full | jq .status`.
- [ ] Walk-up dry-run of slide 5 → 7 (the live moments).

## During the demo

- [ ] Slide 1–4: vision, problem, solution, philosophy.
- [ ] Slide 5: dashboard tour. **Don't click randomly** — follow the rehearsed path.
- [ ] Slide 6: hand the phone to the volunteer. Smile.
- [ ] Slide 7: switch back to dashboard, point at the wallet ticker.
- [ ] Slide 8–11: deep-dive, fraud, roadmap, stack.
- [ ] Slide 12: open the floor for Q&A. Have `qa-prep.md` open on the second monitor.

## Post-demo

- [ ] Stop OBS, save the recording.
- [ ] Snap photos of the jury ledger SUM=0 view (proof for `progress.md`).
- [ ] Note any unexpected behavior in `memory-bank/post-capstone.md`.
- [ ] Push the demo branch + tag (`git tag v0.7.0-capstone`).

## Hard rules

- Do **not** push code changes during the demo — even "tiny" fixes.
- Do **not** alt-tab to email/Slack while sharing the screen.
- Do **not** improvise the click path — use rehearsed routes.
- If something breaks, **show the recorded `demo.mp4`** and continue.
