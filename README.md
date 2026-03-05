# ATMS — Almnfthen Training Management System

A full-stack Training Management System built for **Almnfthen Business Services**, enabling organisations to manage employee training, course enrolments, quiz assessments, and certification — all from a single platform.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Default Login Credentials](#default-login-credentials)
- [User Roles & Capabilities](#user-roles--capabilities)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Testing](#testing)
- [Scripts Reference](#scripts-reference)

---

## Tech Stack


| Layer            | Technology                                          |
| ---------------- | --------------------------------------------------- |
| Framework        | Next.js 14 (App Router)                             |
| Language         | TypeScript 5                                        |
| Database         | PostgreSQL 15 (hosted on [Neon](https://neon.tech)) |
| ORM              | Prisma 6                                            |
| Authentication   | NextAuth v5 (JWT, Credentials provider)             |
| Validation       | Zod 4                                               |
| Styling          | Tailwind CSS 3 + shadcn/ui                          |
| Email            | Nodemailer (SMTP)                                   |
| PDF Certificates | jsPDF                                               |
| Video Player     | react-player                                        |


---

## Prerequisites

- **Node.js** 18.17 or later — [Download](https://nodejs.org)
- **npm** 9+ (bundled with Node.js)
- A **PostgreSQL** database — the project is pre-configured to use the hosted Neon database included in the `.env` file. No local database installation is required.

---

## Quick Start

Follow these four steps to get the application running locally.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

A ready-to-use `.env` file is already included in the project with a live hosted database connection. No changes are needed to run the project locally.

> If you need to use your own database, copy `.env.example` to `.env` and fill in your values (see [Environment Variables](#environment-variables)).

### 3. Set up the database

```bash
npm run db:generate   # Generate the Prisma client
npm run db:migrate    # Apply database migrations
npm run db:seed       # Seed demo accounts and sample data
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

You will be redirected to the login page. Use the credentials below to sign in.

---

## Environment Variables


| Variable          | Required | Description                                                        |
| ----------------- | -------- | ------------------------------------------------------------------ |
| `DATABASE_URL`    | Yes      | PostgreSQL connection string                                       |
| `AUTH_SECRET`     | Yes      | Secret key for signing JWT tokens. Generate with `npx auth secret` |
| `AUTH_URL`        | Yes      | Base URL of the application (e.g. `http://localhost:3000`)         |
| `SESSION_MAX_AGE` | No       | Session lifetime in seconds. Defaults to `86400` (24 hours)        |
| `SMTP_HOST`       | No       | SMTP server host for sending emails                                |
| `SMTP_PORT`       | No       | SMTP port (typically `587` for TLS)                                |
| `SMTP_USER`       | No       | SMTP username / email address                                      |
| `SMTP_PASSWORD`   | No       | SMTP password                                                      |
| `SMTP_FROM`       | No       | Sender address shown on outgoing emails                            |
| `CRON_SECRET`     | No       | Bearer token to protect the deadline-reminder cron endpoint        |


> **Note on emails:** If SMTP variables are not configured, all email notifications fall back to `console.log` output in the terminal. The application functions fully without email.

---

## Database Setup

The project uses **Prisma** for database management. All migrations are already applied to the hosted Neon database included in the `.env` file.

If you are connecting to a fresh database, run the following commands in order:

```bash
npm run db:generate   # Compile the Prisma client from schema.prisma
npm run db:migrate    # Create all tables by running the migration history
npm run db:seed       # Insert demo users, a sample course, quiz, and enrolment
```

To inspect the database visually:

```bash
npm run db:studio     # Opens Prisma Studio at http://localhost:5555
```

---

## Running the Application

**Development mode** (hot-reload, detailed errors):

```bash
npm run dev
```

**Production build** (optimised, minified):

```bash
npm run build
npm run start
```

The application listens on **port 3000** by default.

---

## Default Login Credentials

After running `npm run db:seed`, the following accounts are available:


| Role     | Email                                                     | Password     |
| -------- | --------------------------------------------------------- | ------------ |
| Admin    | [admin@almnfthen.com](mailto:admin@almnfthen.com)         | Admin123!    |
| Manager  | [manager@almnfthen.com](mailto:manager@almnfthen.com)     | Manager123!  |
| Employee | [employee1@almnfthen.com](mailto:employee1@almnfthen.com) | Employee123! |
| Employee | [employee2@almnfthen.com](mailto:employee2@almnfthen.com) | Employee123! |


> Each role is automatically redirected to its own dashboard after login. You cannot access another role's pages — the middleware enforces strict role-based routing.

---

## User Roles & Capabilities

### Administrator

- Full user management: create, edit, deactivate, bulk import via CSV
- Course management: create, publish, archive, duplicate courses with modules and quizzes
- Module types: Video, PDF, and Document
- Quiz builder: configurable passing score, time limit, and attempt limits
- View and manage all enrolment requests system-wide
- System-wide analytics and reports
- Certificate issuance oversight

### Manager

- View team members and their training progress
- Approve or reject enrolment requests from direct reports
- Assign courses to team members directly
- Team training reports with date-range filtering

### Employee

- Browse the published course catalogue
- Request enrolment or self-enrol in available courses
- Watch video lessons and read course materials
- Take timed quizzes with instant feedback
- Track progress per course with a visual progress bar
- Download PDF certificates upon course completion
- View a full learning transcript
- Manage profile and notification preferences
- Password reset via email (or console log if SMTP is not configured)

---

## Project Structure

```
.
├── prisma/
│   ├── schema.prisma          # Database schema (all 14 models)
│   ├── seed.ts                # Demo data seed script
│   └── migrations/            # Migration history
├── src/
│   ├── app/
│   │   ├── (dashboard)/       # Protected dashboard pages
│   │   │   ├── admin/         # Admin pages
│   │   │   ├── manager/       # Manager pages
│   │   │   └── employee/      # Employee pages
│   │   ├── api/               # REST API route handlers
│   │   ├── login/             # Login page
│   │   ├── forgot-password/   # Password reset request page
│   │   ├── reset-password/    # Password reset confirmation page
│   │   ├── globals.css        # Global styles and Tailwind tokens
│   │   └── layout.tsx         # Root layout with session provider
│   ├── auth.ts                # NextAuth v5 configuration
│   ├── middleware.ts           # Auth guard and role-based routing
│   ├── components/
│   │   ├── AppSidebar.tsx     # Role-aware collapsible sidebar
│   │   ├── DashboardShell.tsx # Page layout wrapper
│   │   ├── providers.tsx      # Client-side session provider
│   │   ├── admin/             # Admin-specific UI components
│   │   └── ui/                # Shared UI primitives (shadcn/ui)
│   └── lib/
│       ├── prisma.ts          # Prisma client singleton
│       ├── auth-utils.ts      # Role-checking helpers for API routes
│       ├── email.ts           # Nodemailer email helpers
│       ├── notifications.ts   # In-app notification creator
│       └── utils.ts           # Tailwind class utility (cn)
├── tests/                     # Integration test suites
├── docs/                      # Documentation and ERD diagram
├── html-pages/                # Original HTML/CSS mockups (reference only)
├── .env                       # Environment variables (live DB included)
├── .env.example               # Environment variable template
└── package.json
```

---

## API Reference

All API routes are under `/api`. Protected routes require a valid session cookie. The middleware returns `401 Unauthorized` for unauthenticated API requests and `403 Forbidden` for insufficient role access.

### Authentication


| Method     | Endpoint                    | Description                                  | Auth   |
| ---------- | --------------------------- | -------------------------------------------- | ------ |
| GET / POST | `/api/auth/[...nextauth]`   | NextAuth session, CSRF, and callback handler | Public |
| POST       | `/api/auth/forgot-password` | Send a password reset email                  | Public |
| POST       | `/api/auth/reset-password`  | Reset password using a valid token           | Public |
| PATCH      | `/api/auth/change-password` | Change password (requires current password)  | Any    |


### Users


| Method | Endpoint          | Description                                      | Auth  |
| ------ | ----------------- | ------------------------------------------------ | ----- |
| GET    | `/api/users`      | List users with search, role, and status filters | Admin |
| POST   | `/api/users`      | Create a new user account                        | Admin |
| GET    | `/api/users/[id]` | Get a single user                                | Admin |
| PATCH  | `/api/users/[id]` | Update name, role, status, or manager            | Admin |
| DELETE | `/api/users/[id]` | Delete a user                                    | Admin |
| POST   | `/api/users/bulk` | Bulk import users from a CSV file                | Admin |
| PATCH  | `/api/users/bulk` | Bulk update user status                          | Admin |


### Courses


| Method | Endpoint                               | Description                                      | Auth  |
| ------ | -------------------------------------- | ------------------------------------------------ | ----- |
| GET    | `/api/courses`                         | List courses with search and status filters      | Admin |
| POST   | `/api/courses`                         | Create a course                                  | Admin |
| GET    | `/api/courses/[id]`                    | Get a course with its modules                    | Admin |
| PATCH  | `/api/courses/[id]`                    | Update a course                                  | Admin |
| DELETE | `/api/courses/[id]`                    | Delete a course                                  | Admin |
| POST   | `/api/courses/[id]/duplicate`          | Duplicate a course including modules and quizzes | Admin |
| GET    | `/api/courses/[id]/modules`            | List modules for a course                        | Admin |
| POST   | `/api/courses/[id]/modules`            | Add a module to a course                         | Admin |
| GET    | `/api/courses/[id]/modules/[moduleId]` | Get a single module                              | Admin |
| PATCH  | `/api/courses/[id]/modules/[moduleId]` | Update a module                                  | Admin |
| DELETE | `/api/courses/[id]/modules/[moduleId]` | Delete a module                                  | Admin |
| GET    | `/api/courses/[id]/prerequisites`      | Get course prerequisites                         | Admin |
| POST   | `/api/courses/[id]/prerequisites`      | Set prerequisites for a course                   | Admin |
| DELETE | `/api/courses/[id]/prerequisites`      | Clear all prerequisites                          | Admin |


### Quizzes & Questions


| Method | Endpoint                               | Description                       | Auth  |
| ------ | -------------------------------------- | --------------------------------- | ----- |
| GET    | `/api/modules/[moduleId]/quiz`         | Get the quiz attached to a module | Admin |
| POST   | `/api/modules/[moduleId]/quiz`         | Create a quiz for a module        | Admin |
| PATCH  | `/api/modules/[moduleId]/quiz`         | Update quiz settings              | Admin |
| DELETE | `/api/modules/[moduleId]/quiz`         | Delete a quiz                     | Admin |
| GET    | `/api/quizzes/[quizId]/questions`      | List all questions in a quiz      | Admin |
| POST   | `/api/quizzes/[quizId]/questions`      | Add a question                    | Admin |
| PATCH  | `/api/quizzes/[quizId]/questions/[id]` | Update a question                 | Admin |
| DELETE | `/api/quizzes/[quizId]/questions/[id]` | Delete a question                 | Admin |


### Enrolments


| Method | Endpoint                | Description                                           | Auth            |
| ------ | ----------------------- | ----------------------------------------------------- | --------------- |
| GET    | `/api/enrollments`      | List enrolments with status and user filters          | Admin / Manager |
| POST   | `/api/enrollments`      | Request or assign a course enrolment                  | Any             |
| GET    | `/api/enrollments/[id]` | Get enrolment detail                                  | Authenticated   |
| PATCH  | `/api/enrollments/[id]` | Approve / reject (Manager/Admin) or cancel (Employee) | Authenticated   |


### Employee


| Method | Endpoint                                 | Description                                     | Auth     |
| ------ | ---------------------------------------- | ----------------------------------------------- | -------- |
| GET    | `/api/employee/catalogue`                | Browse published courses                        | Employee |
| GET    | `/api/employee/catalogue/[courseId]`     | Course detail with modules and enrolment status | Employee |
| GET    | `/api/employee/stats`                    | Personal dashboard statistics                   | Employee |
| GET    | `/api/employee/progress`                 | Get module progress for an enrolment            | Employee |
| POST   | `/api/employee/progress`                 | Save video position or mark a module complete   | Employee |
| GET    | `/api/employee/quiz/[quizId]`            | Load a quiz (correct answers hidden)            | Employee |
| POST   | `/api/employee/quiz/[quizId]/submit`     | Submit quiz answers and receive score           | Employee |
| GET    | `/api/employee/profile`                  | Get own profile                                 | Employee |
| PATCH  | `/api/employee/profile`                  | Update name and phone number                    | Employee |
| PATCH  | `/api/employee/notification-preferences` | Update email / in-app notification preferences  | Employee |
| GET    | `/api/employee/certificates`             | List earned certificates                        | Employee |
| GET    | `/api/employee/certificates/[id]`        | Get certificate detail                          | Employee |
| GET    | `/api/employee/transcript`               | Full learning transcript                        | Employee |


### Manager


| Method | Endpoint               | Description                                 | Auth    |
| ------ | ---------------------- | ------------------------------------------- | ------- |
| GET    | `/api/manager/stats`   | Team training statistics                    | Manager |
| GET    | `/api/manager/team`    | List team members with search               | Manager |
| POST   | `/api/manager/assign`  | Assign a course to one or more team members | Manager |
| GET    | `/api/manager/reports` | Team training report with date-range filter | Manager |


### Admin Analytics


| Method | Endpoint                    | Description                      | Auth  |
| ------ | --------------------------- | -------------------------------- | ----- |
| GET    | `/api/admin/stats`          | System-wide statistics           | Admin |
| GET    | `/api/admin/reports`        | Enrolment and completion reports | Admin |
| GET    | `/api/admin/quiz-analytics` | Quiz performance analytics       | Admin |


### Notifications


| Method | Endpoint                   | Description                                               | Auth |
| ------ | -------------------------- | --------------------------------------------------------- | ---- |
| GET    | `/api/notifications`       | List notifications (supports `unreadOnly` and pagination) | Any  |
| PATCH  | `/api/notifications`       | Mark one or all notifications as read                     | Any  |
| GET    | `/api/notifications/count` | Get unread notification count                             | Any  |


### System


| Method | Endpoint                       | Description                                           | Auth                       |
| ------ | ------------------------------ | ----------------------------------------------------- | -------------------------- |
| POST   | `/api/cron/deadline-reminders` | Trigger deadline reminder emails (for scheduled jobs) | `CRON_SECRET` bearer token |
| GET    | `/api/verify-certificate`      | Publicly verify a certificate by its code             | Public                     |


---

## Troubleshooting

### Port 3000 is already in use

The application **must** run on the same port that is set in `AUTH_URL` inside `.env`. By default this is port `3000`. If port 3000 is already occupied by another process, Next.js will silently start on port `3001`, but NextAuth will still send callbacks to port `3000` — causing login to fail with a redirect loop or "invalid callback URL" error.

**Step 1 — Find and stop the process using port 3000:**

```bash
lsof -iTCP:3000 -sTCP:LISTEN
```

Note the `PID` from the output, then kill it:

```bash
kill -9 <PID>
```

Then start the app normally:

```bash
npm run dev
```

**Step 2 (alternative) — Run on a different port:**

If you cannot free port 3000, run on another port (e.g. `3001`) and update `AUTH_URL` to match:

1. Open `.env` and change `AUTH_URL`:

```
AUTH_URL="http://localhost:3001"
```

1. Start the dev server on that port:

```bash
npm run dev -- -p 3001
```

1. Open [http://localhost:3001](http://localhost:3001) in your browser.

> **Important:** `AUTH_URL` and the port you run the server on must always match. If they differ, authentication will not work.

---

### Login redirects back to the login page

This is almost always caused by an `AUTH_URL` mismatch (see above). Verify that the port in `AUTH_URL` inside `.env` matches the port shown in your terminal after running `npm run dev`.

---

### `npm run db:migrate` fails or Prisma client errors

If you see a Prisma client error like `PrismaClientInitializationError`, run:

```bash
npm run db:generate
```

This regenerates the Prisma client. Always run `db:generate` after any schema change or after cloning the project for the first time.

---

### `Cannot find module` errors on startup

Dependencies may not be installed. Run:

```bash
npm install
```

---

## Testing

The project includes comprehensive integration test suites that run against a live dev server.

**Prerequisites:** The dev server must be running (`npm run dev`) and the database must be seeded (`npm run db:seed`).

```bash
npm test                             # Run all test suites
npm run test:auth                    # Authentication tests
npm run test:admin                   # Admin module tests
npm run test:full                    # User management & auth tests
npx tsx tests/employee.test.ts       # Employee module tests
npx tsx tests/manager.test.ts        # Manager module tests
```

---

## Scripts Reference


| Command               | Description                                               |
| --------------------- | --------------------------------------------------------- |
| `npm run dev`         | Start the development server with hot-reload              |
| `npm run build`       | Create an optimised production build                      |
| `npm run start`       | Start the production server (requires `build` first)      |
| `npm run lint`        | Run ESLint across all source files                        |
| `npm run db:generate` | Generate the Prisma client from `schema.prisma`           |
| `npm run db:migrate`  | Apply pending database migrations                         |
| `npm run db:push`     | Push schema changes directly without creating a migration |
| `npm run db:seed`     | Seed the database with demo data                          |
| `npm run db:studio`   | Open Prisma Studio (visual database browser)              |


---

*© 2025 Almnfthen Business Services. All rights reserved.*