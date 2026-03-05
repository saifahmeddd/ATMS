# TMS — Progress Update & Deployment Readiness

**Project:** Almnfthen Training Management System (TMS)  
**Last updated:** March 2025  
**Status:** Phase 1 complete; Authentication feature (FR-2.x) implemented, tested, and ready for deployment.

---

## 1. What Has Been Done

### 1.1 Foundation (Phase 1)

| Item | Status | Notes |
|------|--------|--------|
| Next.js 14 (App Router) | ✅ Done | TypeScript, Tailwind CSS, ESLint |
| Prisma 6 + PostgreSQL | ✅ Done | Schema, migrations, seed |
| NextAuth v5 (Credentials) | ✅ Done | JWT sessions, callbacks, RBAC |
| Environment & scripts | ✅ Done | `.env.example`, `db:generate`, `db:migrate`, `db:seed`, `db:studio` |
| Design system | ✅ Done | CSS variables (primary, accent, destructive, etc.), Tailwind theme |

### 1.2 Database

- **Schema:** 11 models — User, Course, Module, Quiz, Question, Enrollment, QuizResult, Notification, Certificate, UserProgress, AuditLog, PasswordResetToken.
- **Migrations:** `init`, `add_password_reset_tokens` (all applied).
- **Seed:** Admin, Manager, 2 Employees, 1 Course with Module/Quiz/Questions, 1 Enrollment.

### 1.3 Authentication Feature (FR-2.x)

| Requirement | Implementation | Tested |
|-------------|----------------|--------|
| **FR-2.1** Login with email/password | NextAuth Credentials, bcrypt | ✅ 6 tests |
| **FR-2.2** RBAC (Admin / Manager / Employee) | Middleware + `requireAdmin` / `requireAuth` | ✅ 9 tests |
| **FR-2.3** Password reset via email | Forgot → token → Reset API + email util | ✅ 7 tests |
| **FR-2.4** Configurable session duration | `SESSION_MAX_AGE` env, JWT maxAge | ✅ 3 tests |
| **FR-2.5** Login audit logging | AuditLog for success/failure + reset/change | ✅ 5 tests |
| **FR-2.6** Change password (current required) | `/api/auth/change-password` PATCH | ✅ 6 tests |

**Test suite:** `tests/auth.test.ts` — 36 integration tests, all passing (run with dev server: `npx tsx tests/auth.test.ts`).

### 1.4 API Routes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| *NextAuth* | `/api/auth/*` | signIn, signOut, session, csrf, callback | Public (callback protected by NextAuth) |
| POST | `/api/auth/forgot-password` | Request password reset email | Public |
| POST | `/api/auth/reset-password` | Set new password with token | Public |
| PATCH | `/api/auth/change-password` | Change password (current + new) | Authenticated |
| GET / POST | `/api/users` | List / create users | Admin |
| GET / PATCH / DELETE | `/api/users/[id]` | Get / update / delete user | Admin |
| GET / POST | `/api/courses` | List / create courses | Admin |
| GET / PATCH / DELETE | `/api/courses/[id]` | Get / update / delete course | Admin |
| GET / POST | `/api/enrollments` | List / create enrollments | Auth (role-scoped) |

### 1.5 Frontend Screens (Integrated)

| Route | Purpose | Design |
|-------|---------|--------|
| `/` | Landing / redirect | Simple |
| `/login` | Sign in | Split-panel, ATMS branding, forgot-password link |
| `/forgot-password` | Request reset link | Split-panel, success state |
| `/reset-password?token=...` | Set new password (from email link) | Split-panel, invalid/success states |
| `/settings/security` | Change password (logged-in) | Card layout, dashboard style |
| `/admin` | Admin dashboard | Placeholder |
| `/manager` | Manager dashboard | Placeholder |
| `/employee` | Employee dashboard | Placeholder |

Dashboard layout: nav bar with sign-out; role-based redirect from `/dashboard` to `/admin`, `/manager`, or `/employee`.

### 1.6 Middleware & Security

- **Middleware:** Protects non-public routes; unauthenticated **page** requests → redirect to `/login`; unauthenticated **API** requests → `401` JSON (no redirect).
- **Public paths:** `/`, `/login`, `/forgot-password`, `/reset-password`; `/api/auth/*` allowed.
- **RBAC:** Admin-only (`/admin`, `/api/users`, `/api/courses`); Manager/Employee access per route logic (e.g. enrollments).

---

## 2. What Is Functional and Ready

- **Login / logout** — Email + password, session with `id` and `role`.
- **Role-based access** — Correct dashboards and API access by role; unauthenticated gets 401 on API, redirect on pages.
- **Forgot password** — Request reset; generic response (no email enumeration); token created and emailed (or logged if SMTP not set).
- **Reset password** — Valid token → new password; invalid/expired/used token → 400.
- **Change password** — Authenticated user; current password required; audit log written.
- **Audit logging** — LOGIN_SUCCESS, LOGIN_FAILURE, PASSWORD_RESET_REQUESTED, PASSWORD_RESET_COMPLETED, PASSWORD_CHANGED.
- **User CRUD** — Admin-only; list, create, get, update, delete.
- **Course CRUD** — Admin-only; list, create, get, update, delete.
- **Enrollments** — List/create with role-appropriate scoping.
- **Build & lint** — `npm run build` and `npm run lint` pass.

---

## 3. Deployment Readiness

### 3.1 Railway (Database / Backend)

Suitable for:

- **PostgreSQL** — Create a PostgreSQL service; use the provided `DATABASE_URL` in your app env.
- Optionally run **migrations and seed** via a one-off job or in your app’s build/start (e.g. `prisma migrate deploy` and `prisma db seed`).

**Required env on Railway (if app runs there):**

- `DATABASE_URL` — From Railway Postgres.
- `AUTH_SECRET` — e.g. `openssl rand -base64 32`.
- `AUTH_URL` — Your public app URL (e.g. `https://your-app.railway.app`).
- `SESSION_MAX_AGE` — Optional; default 86400.
- `SMTP_*` — Optional; for real password-reset emails.

### 3.2 Vercel (Next.js App)

The app is a standard Next.js 14 App Router app and is **ready to deploy on Vercel**.

**Steps:**

1. Connect the repo to Vercel (GitHub/GitLab/Bitbucket).
2. Set **Environment Variables** in the Vercel project:
   - `DATABASE_URL` — PostgreSQL URL (e.g. from Neon, Supabase, or Railway).
   - `AUTH_SECRET` — Generate with `npx auth secret` or `openssl rand -base64 32`.
   - `AUTH_URL` — Production URL (e.g. `https://your-app.vercel.app`).
   - `SESSION_MAX_AGE` — Optional (default 86400).
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` — Optional; for password-reset emails.
3. **Build command:** `npm run build` (or leave default).
4. **Install command:** `npm install`.
5. Run migrations against the production DB **once** (from your machine or a script):
   - `DATABASE_URL="your-production-url" npx prisma migrate deploy`
   - Optionally: `DATABASE_URL="your-production-url" npm run db:seed` for initial data.

**Note:** Prisma runs at build time on Vercel (`prisma generate` via postinstall). Ensure `DATABASE_URL` is set for build if you have build-time DB usage; for runtime-only DB access, migrations are usually run externally.

### 3.3 Suggested Split: Database vs App

- **Railway:** PostgreSQL instance; optionally run the Next.js app there if you prefer.
- **Vercel:** Next.js app (recommended for serverless and edge).
- **Database:** Neon, Supabase, or Railway Postgres — use the same `DATABASE_URL` in Vercel (and Railway if you run the app there).

### 3.4 Pre-Deploy Checklist

- [ ] Production `DATABASE_URL` set (Neon/Supabase/Railway).
- [ ] `AUTH_SECRET` set (unique, kept secret).
- [ ] `AUTH_URL` set to production URL (no trailing slash).
- [ ] Run `npx prisma migrate deploy` against production DB once.
- [ ] Optionally run `npm run db:seed` for initial users/courses.
- [ ] SMTP configured if you want real password-reset emails (otherwise link is logged).
- [ ] After deploy: test login, forgot/reset password, change password, and one admin API (e.g. GET `/api/users` with admin cookie).

---

## 4. Not Yet Implemented (From Plan)

- Phase 2: Shared components (Card, Button, Table, etc.), 404/403/500 pages, full UI migration from HTML prototypes.
- Phase 3: Admin user management UI, course management UI, bulk/CSV.
- Phase 4+: Manager/Employee features (approvals, reports, learning content, certificates, notifications UI).
- Rate limiting on login (NFR-2.5).
- Remaining HTML screens from `html-pages/` not yet integrated.

---

## 5. Quick Reference

| Action | Command |
|--------|--------|
| Run tests (dev server must be running) | `npx tsx tests/auth.test.ts` |
| Build | `npm run build` |
| Start production | `npm run start` |
| Migrate DB | `npm run db:migrate` (dev) / `npx prisma migrate deploy` (prod) |
| Seed DB | `npm run db:seed` |

**Seed logins:**  
Admin `admin@almnfthen.com` / `Admin123!`  
Manager `manager@almnfthen.com` / `Manager123!`  
Employee `employee1@almnfthen.com` / `Employee123!`

---

*This document reflects the state of the TMS codebase as of the last update. For full product scope and phases, see the TMS Implementation Plan.*
