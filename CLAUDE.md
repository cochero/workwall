# Workwall (CRM-Communication panel)

Client-project communication panel for KlickEvents — "one wall per project" (Basecamp-style feed, NOT chat). Deployed at **wall.klickevents.in**. Unrelated to CELSE LMS / celselabs-cms.

## Stack & layout
- **backend/** — Express (ESM, plain JS), MySQL via `mysql2` (`db.js` exports `q()`), JWT auth in httpOnly cookie `ww_token` (`middleware/auth.js`), file storage driver in `lib/storage.js` (`STORAGE_DRIVER=local` for dev → `backend/uploads/`; `s3` for prod → Contabo, path-style, presigned GETs).
- **frontend/** — React 18 + Vite + TS + Tailwind 3. Dev server 5301 proxies `/api` → backend 5300 (cookie stays same-origin). `lib/api.ts` is the only fetch wrapper.
- **DB `workwall`** — 10 tables; plain SQL migrations in `backend/migrations/*.sql`, applied in filename order by `npm run migrate`, tracked in `schema_migrations`. New schema change = NEW numbered file, never edit an applied one.

## Commands
```bash
cd backend  && npm run dev      # API on 5300 (node --watch)
cd frontend && npm run dev      # Vite on 5301  (Windows: frontend/dev.cmd)
cd backend  && npm run migrate  # create/upgrade DB
cd backend  && npm run seed -- --demo   # admin + demo data (passwords printed once)
cd frontend && npm run typecheck
```

## Domain rules (do not break these)
1. **Visibility is a security boundary, not a UI filter.** Every query that returns posts/files MUST include `visibilityWhere(user)` and every item access goes through `getMembership()` / `loadFileWithAccess()`. Client-role users: only `visibility='client'` rows, only projects of their own `client_id`. Client posts/comments/uploads are FORCED client-visible server-side.
2. **Roles:** `super` (sees everything, admin CRUD), `team` (member projects, internal+client content, can pin + change file status), `client` (client-visible only, no pin/status). Project membership lives in `project_members`; client users may only be members of their own client's projects (enforced on member-add).
3. **File versions:** rows in `files` share `version_group_id` (first version's id), `version_no` increments; the library lists only the latest version per group. New versions reset status to `review` and inherit visibility.
4. **Comments are polymorphic:** `comments.parent_type` ∈ `post|file` + `parent_id` (no FK — clean up manually when deleting parents, see `routes/posts.js` DELETE).
5. **Deleting a post keeps its files** (post_id set NULL) so the library never loses documents.

## Gotchas
- **The folder path contains a space** (`CRM-Communication panel`). Spawners that don't quote args break — that's why `frontend/dev.cmd` exists (cd's to the long path) and why launch configs use the 8.3 short path `C:/Projects/CRM-CO~1`. Mixing short/long paths as Vite roots loads React twice ("Invalid hook call") — always run Vite with the LONG path as cwd.
- **Local MySQL root password** is the post-June-2026 one (see `backend/.env`), not the old `11`.
- `mysql2` `pool.query` expands array params for `IN (?)` — works only with `.query`, not `.execute`.
- Dates come back as `"YYYY-MM-DD HH:mm:ss"` strings (`dateStrings: true`); frontend parses via `parseDbDate()`.
- Uploads are multer memoryStorage capped by `MAX_UPLOAD_MB` (default 50); the multer error is mapped to a 400 in `server.js`.
- Image/PDF inline previews use `/api/files/:id/download?inline=1` — auth rides on the cookie, so plain `<img src>` works; in s3 mode the route 302s to a presigned URL.

## Roadmap snapshot
Phase 1 (shipped): wall, per-file threads, versions, statuses, visibility, mentions, notifications, unread, my feed, admin CRUD.
Phase 2 next: search, email digests, SSE, approvals, tasks, drag-drop. Phase 3: SMM calendar, AP/AR cycles + audit, dev board + GitHub webhook, OnlyOffice previews, WhatsApp.
