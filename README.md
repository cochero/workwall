# Workwall

One wall per client project — updates, files, and discussion in one place.
Built for agencies running mixed work (social media management, AP/AR processing, software/web builds) across many clients and a shared team.

**Production:** https://wwall.klickevents.in (see [DEPLOYMENT.md](DEPLOYMENT.md))

## What it does
- **Clients → projects → members.** Team members belong to many projects; client users see only their own company's projects.
- **The wall.** A feed of posts per project: text + attached files (image / pdf / doc / excel), comments under every post, pinned briefs on top.
- **Files as first-class objects.** Every file has its own page: versions (v1 → v2…), a status workflow (draft → in review → approved → final), and its own comment thread. The Files tab is a filterable library.
- **Internal vs client-visible.** Every post and file carries a visibility flag. Client logins can never see internal content — enforced in every backend query, not just hidden in the UI. Client posts are forced client-visible.
- **@mentions + notifications.** Mention picker in the composer; bell with unread count; per-project unread badges; "My feed" aggregates all projects.
- **Three roles.** `super` (admin: manage clients/users/projects/members), `team`, `client`.

## Stack
React 18 + Vite + TypeScript + Tailwind · Express (Node 20) · MySQL 8 · Contabo S3 (prod) / local disk (dev) · JWT in an httpOnly cookie.

## Dev quick start
```bash
# backend  (http://127.0.0.1:5300)
cd backend
cp .env.example .env       # dev defaults: local MySQL + STORAGE_DRIVER=local
npm install
npm run migrate
npm run seed -- --demo     # prints generated credentials — save them
npm run dev

# frontend (http://localhost:5301, proxies /api to 5300)
cd frontend
npm install
npm run dev
```
On Windows, `frontend/dev.cmd` starts Vite with the correct working directory (the folder name contains a space, which breaks some launchers).

## Repo layout
```
backend/    Express API: routes/, middleware/auth.js, lib/storage.js (local|s3), migrations/*.sql, seed.js
frontend/   React app: src/pages, src/components, src/lib, src/context
deploy/     nginx vhost + PM2 ecosystem
```

## Roadmap
- **Phase 1 (done):** auth + 3 roles, wall, comments on posts & files, file library, versions, statuses, visibility, mentions, notifications, unread, my feed, admin CRUD.
- **Phase 2:** search, email digests, SSE live updates, approvals workflow, tasks with due dates, drag-drop uploads.
- **Phase 3:** type lenses (SMM content calendar, AP/AR monthly cycles + audit views, dev task board + GitHub webhook), OnlyOffice doc/xlsx preview, WhatsApp notifications.
