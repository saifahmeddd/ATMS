# TMS Backend Architecture & Data Flow

> Almnfthen Training Management System - Backend Documentation

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Database Schema (ERD)](#database-schema-erd)
3. [Table Descriptions](#table-descriptions)
4. [Relationships & Foreign Keys](#relationships--foreign-keys)
5. [Data Flow: Key Workflows](#data-flow-key-workflows)
   - [User Authentication](#1-user-authentication)
   - [Course Creation](#2-course-creation)
   - [Enrollment & Approval](#3-enrollment--approval-workflow)
   - [Learning & Progress Tracking](#4-learning--progress-tracking)
   - [Quiz Evaluation](#5-quiz-evaluation)
   - [Certificate Issuance](#6-certificate-issuance)
   - [Password Reset](#7-password-reset)
6. [API Architecture](#api-architecture)
7. [Role-Based Access Control](#role-based-access-control)
8. [Audit Trail](#audit-trail)

---

## Tech Stack

| Layer          | Technology              |
|----------------|------------------------|
| Framework      | Next.js 14 (App Router) |
| Language       | TypeScript              |
| Database       | PostgreSQL 15           |
| ORM            | Prisma 6                |
| Authentication | NextAuth v5 (JWT)       |
| Validation     | Zod                     |
| Password Hash  | bcryptjs (12 rounds)    |

---

## Database Schema (ERD)

![TMS Entity-Relationship Diagram](./tms-erd-diagram.png)

The system consists of **12 tables** split into two groups:

- **Core Tables (7):** User, Course, Module, Quiz, Question, Enrollment, QuizResult
- **Extended Tables (5):** Notification, Certificate, UserProgress, AuditLog, PasswordResetToken

---

## Table Descriptions

### Core Tables

#### `users`

Central identity table. Every person in the system is a User with one of three roles.

| Column        | Type       | Description                                     |
|---------------|------------|-------------------------------------------------|
| id            | String (PK)| CUID primary key                                |
| name          | String     | Full name                                        |
| email         | String     | Unique email, used for login                     |
| password_hash | String     | bcrypt hash (12 salt rounds)                     |
| role          | Enum       | `ADMIN` / `MANAGER` / `EMPLOYEE`                 |
| status        | Enum       | `ACTIVE` / `INACTIVE`                            |
| manager_id    | String (FK)| Self-reference to User; links Employee to Manager |
| created_at    | DateTime   | Auto-set on creation                             |

Self-referencing relationship: a Manager supervises many Employees via `manager_id`.

---

#### `courses`

Training courses created and managed by Admins.

| Column        | Type       | Description                              |
|---------------|------------|------------------------------------------|
| id            | String (PK)| CUID primary key                         |
| title         | String     | Course title                             |
| description   | String?    | Optional description                     |
| thumbnail_url | String?    | Cover image URL                          |
| status        | Enum       | `DRAFT` / `PUBLISHED` / `ARCHIVED`       |
| category      | String?    | Grouping category                        |
| created_by    | String (FK)| References User who created the course   |
| created_at    | DateTime   | Auto-set on creation                     |

---

#### `modules`

Individual learning units within a course (videos, PDFs, documents). Ordered by `sequence`.

| Column      | Type       | Description                                 |
|-------------|------------|---------------------------------------------|
| id          | String (PK)| CUID primary key                            |
| course_id   | String (FK)| Parent course                               |
| title       | String     | Module title                                |
| type        | Enum       | `VIDEO` / `PDF` / `DOCUMENT`                |
| content_url | String     | URL to the content (YouTube, Vimeo, S3 PDF) |
| sequence    | Int        | Ordering within the course                  |

---

#### `quizzes`

Assessment attached 1:1 to a Module. Employees must pass to unlock the next module.

| Column           | Type       | Description                        |
|------------------|------------|------------------------------------|
| id               | String (PK)| CUID primary key                   |
| module_id        | String (FK)| One quiz per module (unique)       |
| passing_score    | Int        | Minimum % to pass (0-100)         |
| duration_minutes | Int        | Time limit in minutes              |
| max_attempts     | Int        | Maximum retake attempts (default 3)|

---

#### `questions`

MCQ questions belonging to a Quiz.

| Column         | Type       | Description                        |
|----------------|------------|------------------------------------|
| id             | String (PK)| CUID primary key                   |
| quiz_id        | String (FK)| Parent quiz                        |
| question_text  | String     | The question                       |
| options        | JSON       | Array of option strings            |
| correct_answer | String     | The correct option value           |

---

#### `enrollments`

The bridge between Users and Courses. Tracks lifecycle from request to completion.

| Column       | Type       | Description                                                              |
|--------------|------------|--------------------------------------------------------------------------|
| id           | String (PK)| CUID primary key                                                         |
| user_id      | String (FK)| The enrolled employee                                                    |
| course_id    | String (FK)| The target course                                                        |
| status       | Enum       | `PENDING` → `APPROVED` / `REJECTED` → `IN_PROGRESS` → `COMPLETED`       |
| progress_pct | Int        | 0-100, computed from module completions                                  |
| enrolled_at  | DateTime   | When the enrollment was created                                          |
| approved_by  | String (FK)| Manager/Admin who approved (nullable)                                    |
| deadline     | DateTime?  | Optional completion deadline                                             |

Unique constraint on `(user_id, course_id)` — one enrollment per user per course.

---

#### `quiz_results`

Records every quiz attempt by an employee within an enrollment.

| Column        | Type       | Description                       |
|---------------|------------|-----------------------------------|
| id            | String (PK)| CUID primary key                  |
| enrollment_id | String (FK)| The enrollment context            |
| quiz_id       | String (FK)| Which quiz was attempted          |
| score         | Int        | Score achieved (0-100)            |
| passed        | Boolean    | Whether score >= passing_score    |
| completed_at  | DateTime   | When the attempt was submitted    |

---

### Extended Tables

#### `user_progress`

Tracks module-level completion within an enrollment. Used to calculate `enrollment.progress_pct`.

| Column        | Type       | Description                    |
|---------------|------------|--------------------------------|
| id            | String (PK)| CUID primary key               |
| enrollment_id | String (FK)| The enrollment context         |
| module_id     | String (FK)| Which module was completed     |
| completed_at  | DateTime   | Completion timestamp           |

Unique on `(enrollment_id, module_id)` — each module completed at most once per enrollment.

---

#### `certificates`

Auto-generated when an enrollment reaches `COMPLETED` status.

| Column            | Type       | Description                        |
|-------------------|------------|------------------------------------|
| id                | String (PK)| CUID primary key                   |
| enrollment_id     | String (FK)| 1:1 link to the completed enrollment |
| verification_code | String     | Unique code for external verification |
| issued_at         | DateTime   | When the certificate was generated   |

---

#### `notifications`

In-app notification inbox for each user.

| Column     | Type       | Description                                                |
|------------|------------|------------------------------------------------------------|
| id         | String (PK)| CUID primary key                                           |
| user_id    | String (FK)| Recipient                                                  |
| title      | String     | Notification headline                                      |
| body       | String?    | Detail text                                                |
| read       | Boolean    | Read/unread flag                                           |
| type       | Enum       | `APPROVAL` / `REJECTION` / `REMINDER` / `CERTIFICATE` / `GENERAL` |
| created_at | DateTime   | When the notification was created                          |

---

#### `audit_logs`

Immutable log of all significant actions for compliance (NFR-8.2).

| Column     | Type       | Description                            |
|------------|------------|----------------------------------------|
| id         | String (PK)| CUID primary key                       |
| user_id    | String (FK)| Who performed the action (nullable)    |
| action     | String     | Action type (e.g., "LOGIN", "CREATE")  |
| entity     | String     | Target entity type (e.g., "User")      |
| entity_id  | String?    | ID of the affected record              |
| metadata   | JSON?      | Additional context                     |
| created_at | DateTime   | Timestamp                              |

---

#### `password_reset_tokens`

Time-limited tokens for the forgot-password flow.

| Column     | Type       | Description                           |
|------------|------------|---------------------------------------|
| id         | String (PK)| CUID primary key                      |
| user_id    | String (FK)| The user requesting reset             |
| token_hash | String     | Hashed token (never store raw)        |
| expires_at | DateTime   | Expiry time                           |
| used_at    | DateTime?  | Set once token is consumed            |
| created_at | DateTime   | When the token was generated          |

---

## Relationships & Foreign Keys

```
User (self-ref)
  └── manager_id → User.id              (Manager supervises Employees)

User ──1:M──> Course                     (via created_by)
User ──1:M──> Enrollment                 (via user_id — enrolled employee)
User ──1:M──> Enrollment                 (via approved_by — approving manager)
User ──1:M──> Notification
User ──1:M──> AuditLog
User ──1:M──> PasswordResetToken

Course ──1:M──> Module
Course ──1:M──> Enrollment

Module ──1:1──> Quiz
Module ──1:M──> UserProgress

Quiz ──1:M──> Question
Quiz ──1:M──> QuizResult

Enrollment ──1:M──> QuizResult
Enrollment ──1:M──> UserProgress
Enrollment ──1:1──> Certificate
```

---

## Data Flow: Key Workflows

### 1. User Authentication

```
┌─────────┐      POST /api/auth         ┌───────────┐
│ Browser  │ ─── email + password ─────> │ NextAuth  │
└─────────┘                              │ Credentials│
                                         └─────┬─────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │   users table        │
                                    │   bcrypt.compare()   │
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │   JWT issued with:   │
                                    │   { id, role, email }│
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │   audit_logs         │
                                    │   action: "LOGIN"    │
                                    └─────────────────────┘
```

**Flow:**
1. User submits email + password to NextAuth Credentials provider
2. System queries `users` table by email
3. `bcrypt.compare()` validates the password against `password_hash`
4. On success: JWT token issued containing `id`, `role`, `email`
5. Middleware reads JWT on every request to enforce role-based access
6. Login event recorded in `audit_logs`

---

### 2. Course Creation

```
┌─────────┐   POST /api/courses    ┌────────────┐
│  Admin   │ ───────────────────>   │  courses   │
└─────────┘                         └──────┬─────┘
                                           │
                                    ┌──────▼─────┐
                                    │  modules   │  (1:M — added sequentially)
                                    └──────┬─────┘
                                           │
                                    ┌──────▼─────┐
                                    │  quizzes   │  (1:1 per module, optional)
                                    └──────┬─────┘
                                           │
                                    ┌──────▼─────┐
                                    │ questions  │  (1:M per quiz)
                                    └────────────┘
```

**Flow:**
1. Admin creates a course (status: `DRAFT`) → row in `courses`
2. Admin adds modules in sequence → rows in `modules` with `course_id` FK
3. For each module, Admin optionally attaches a quiz → row in `quizzes` with `module_id` FK
4. Admin adds MCQ questions to each quiz → rows in `questions` with `quiz_id` FK
5. Admin publishes the course (status → `PUBLISHED`), making it visible in the catalog

**Data written:** `courses` → `modules` → `quizzes` → `questions` (cascading 1:M)

---

### 3. Enrollment & Approval Workflow

```
                    ┌──────────────────────────────────────────────────────────┐
                    │                  ENROLLMENT LIFECYCLE                     │
                    │                                                          │
  ┌──────────┐     │   ┌─────────┐     ┌──────────┐     ┌─────────────┐      │
  │ Employee │─────│──>│ PENDING │────>│ APPROVED │────>│ IN_PROGRESS │      │
  │ requests │     │   └─────────┘     └──────────┘     └──────┬──────┘      │
  │enrollment│     │        │                                   │             │
  └──────────┘     │        │          ┌──────────┐     ┌──────▼──────┐      │
                    │        └────────>│ REJECTED │     │  COMPLETED  │      │
                    │                  └──────────┘     └─────────────┘      │
                    └──────────────────────────────────────────────────────────┘
```

**Flow:**
1. **Employee requests enrollment:**
   - `POST /api/enrollments` with `userId` + `courseId`
   - Creates row in `enrollments` with `status: PENDING`
   - Notification sent to the employee's Manager → row in `notifications` (type: `GENERAL`)

2. **Manager approves/rejects:**
   - `PATCH /api/enrollments/[id]` with `status: APPROVED` or `REJECTED`
   - `approved_by` set to the Manager's user ID
   - Notification sent to Employee → row in `notifications` (type: `APPROVAL` or `REJECTION`)

3. **Admin/Manager direct assignment (bypass approval):**
   - `POST /api/enrollments` from Admin/Manager account
   - Creates row with `status: APPROVED` directly, `approved_by` set immediately

**Tables touched:** `enrollments`, `notifications`, `audit_logs`

---

### 4. Learning & Progress Tracking

```
┌──────────┐     Fetch modules      ┌──────────┐
│ Employee │ ──────────────────────> │ modules  │  (ordered by sequence)
└────┬─────┘                         └──────────┘
     │
     │  Complete module
     │
     ▼
┌──────────────┐                     ┌──────────────┐
│user_progress │ ──────────────────> │ enrollments  │
│ (new row)    │   recalculate       │ progress_pct │
└──────────────┘   progress_pct      └──────────────┘
```

**Flow:**
1. Employee opens a course → system fetches `modules` ordered by `sequence`
2. Modules are unlocked sequentially; next module only available after current is complete
3. On module completion → row created in `user_progress` (`enrollment_id` + `module_id`)
4. System recalculates `progress_pct` on `enrollments`:
   ```
   progress_pct = (completed_modules / total_modules) * 100
   ```
5. If module has a quiz, Employee must pass the quiz before the module counts as complete

**Tables touched:** `modules` (read), `user_progress` (write), `enrollments` (update progress_pct)

---

### 5. Quiz Evaluation

```
┌──────────┐   Load quiz      ┌─────────┐    ┌───────────┐
│ Employee │ ───────────────> │ quizzes │───>│ questions │
└────┬─────┘                  └─────────┘    └───────────┘
     │
     │  Submit answers
     ▼
┌─────────────────────────────────────────────────────┐
│                  AUTO-GRADING                         │
│                                                       │
│  For each question:                                   │
│    compare submitted_answer vs correct_answer         │
│                                                       │
│  score = (correct / total) * 100                      │
│  passed = score >= quiz.passing_score                 │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
              ┌──────────────┐
              │ quiz_results │  (new row per attempt)
              └──────┬───────┘
                     │
           ┌─────────┴─────────┐
           │                   │
     passed = true        passed = false
           │                   │
           ▼                   ▼
   ┌──────────────┐   ┌────────────────────┐
   │user_progress │   │ Retry (if attempts │
   │ module done  │   │ < max_attempts)    │
   └──────────────┘   └────────────────────┘
```

**Flow:**
1. Employee starts a quiz → system loads `quizzes` + `questions` for the module
2. Timer starts (`duration_minutes`)
3. Employee submits answers → server compares each answer against `questions.correct_answer`
4. Score calculated: `(correct_count / total_questions) * 100`
5. New row in `quiz_results` with `score`, `passed` flag
6. If `passed = true` → module marked complete in `user_progress`
7. If `passed = false` → employee can retry if `attempts < quiz.max_attempts`
8. System checks: `COUNT(quiz_results WHERE enrollment_id AND quiz_id) < max_attempts`

**Tables touched:** `quizzes` (read), `questions` (read), `quiz_results` (write), `user_progress` (conditional write)

---

### 6. Certificate Issuance

```
┌──────────────┐    All modules     ┌──────────────┐
│user_progress │ ── completed? ───> │ enrollments  │
│              │                    │status=COMPLETED│
└──────────────┘                    └──────┬───────┘
                                           │
                                    ┌──────▼───────┐
                                    │ certificates │
                                    │ auto-issued  │
                                    │ + verify code│
                                    └──────┬───────┘
                                           │
                                    ┌──────▼────────┐
                                    │ notifications │
                                    │type=CERTIFICATE│
                                    └───────────────┘
```

**Flow:**
1. When the last module's `user_progress` row is created, system checks if all modules are done
2. If all modules complete → `enrollment.status` updated to `COMPLETED`, `progress_pct` = 100
3. System auto-generates a `certificates` row:
   - Links to the enrollment via `enrollment_id` (1:1)
   - Generates a unique `verification_code` for external validation
4. Notification sent → row in `notifications` (type: `CERTIFICATE`)
5. Employee can download the certificate as PDF with course title, name, date, score, and verification code

**Tables touched:** `user_progress` (trigger), `enrollments` (update), `certificates` (create), `notifications` (create)

---

### 7. Password Reset

```
┌──────────┐  POST /api/auth/       ┌─────────────────────┐
│  User    │  forgot-password ────> │ password_reset_tokens│
└──────────┘  (email)               │ token_hash + expiry  │
                                    └──────────┬──────────┘
                                               │
                                        Email with link
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │ POST /api/auth/     │
                                    │ reset-password      │
                                    │ token + new_password│
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │   users table       │
                                    │ password_hash update │
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │password_reset_tokens│
                                    │ used_at = now()     │
                                    └─────────────────────┘
```

**Flow:**
1. User submits email to `/api/auth/forgot-password`
2. System generates a random token, stores `token_hash` + `expires_at` in `password_reset_tokens`
3. Email sent with a reset link containing the raw token
4. User clicks link, submits new password to `/api/auth/reset-password`
5. System verifies: token matches hash, not expired, not already used
6. `users.password_hash` updated with new bcrypt hash
7. `password_reset_tokens.used_at` set to prevent reuse

**Tables touched:** `password_reset_tokens` (create + update), `users` (update password_hash)

---

## API Architecture

All API routes live under `src/app/api/` using Next.js App Router conventions.

```
src/app/api/
├── auth/
│   ├── [...nextauth]/route.ts     # NextAuth handler (login/session)
│   ├── forgot-password/route.ts   # Initiate password reset
│   ├── reset-password/route.ts    # Complete password reset
│   └── change-password/route.ts   # Authenticated password change
├── users/
│   ├── route.ts                   # GET (list) + POST (create) — Admin only
│   └── [id]/route.ts             # GET + PATCH + DELETE single user — Admin only
├── courses/
│   ├── route.ts                   # GET (list) + POST (create) — Admin only
│   └── [id]/route.ts             # GET + PATCH + DELETE single course — Admin only
├── enrollments/
│   └── route.ts                   # GET (list) + POST (create) — Role-dependent
└── admin/
    └── stats/route.ts             # GET dashboard statistics — Admin only
```

### Request Lifecycle

```
Request → Middleware (JWT check + role redirect)
       → API Route Handler
       → Zod validation (request body)
       → Auth check (requireAdmin / requireAuth)
       → Prisma query (database operation)
       → JSON response
```

---

## Role-Based Access Control

| Action                    | Admin | Manager | Employee |
|---------------------------|:-----:|:-------:|:--------:|
| Manage users (CRUD)       |  Yes  |   No    |    No    |
| Create/edit courses       |  Yes  |   No    |    No    |
| View all enrollments      |  Yes  |  Team   |   Own    |
| Approve/reject enrollment |  Yes  |  Team   |    No    |
| Assign training directly  |  Yes  |  Team   |    No    |
| Request enrollment        |  No   |   No    |   Yes    |
| Take courses/quizzes      |  No   |   No    |   Yes    |
| View dashboard stats      |  Yes  |  Team   |   Own    |
| View reports              |  Yes  |  Team   |   Own    |
| Download certificates     |  No   |   No    |   Yes    |

**Enforcement:**
- `requireAdmin()` — blocks non-Admin roles (returns 403)
- `requireAuth()` — blocks unauthenticated requests (returns 401), then role-specific filtering in query logic
- Middleware redirects users to their role-specific dashboard on login

---

## Audit Trail

Every significant operation writes to `audit_logs`:

| Action           | Entity         | Triggered By          |
|------------------|----------------|-----------------------|
| LOGIN            | User           | Successful auth       |
| CREATE_USER      | User           | Admin creates user    |
| UPDATE_USER      | User           | Admin edits user      |
| DELETE_USER      | User           | Admin deletes user    |
| CREATE_COURSE    | Course         | Admin creates course  |
| PUBLISH_COURSE   | Course         | Admin publishes       |
| ENROLL           | Enrollment     | Employee/Manager      |
| APPROVE_ENROLL   | Enrollment     | Manager/Admin         |
| REJECT_ENROLL    | Enrollment     | Manager/Admin         |
| COMPLETE_COURSE  | Enrollment     | System (auto)         |
| QUIZ_ATTEMPT     | QuizResult     | Employee              |
| ISSUE_CERT       | Certificate    | System (auto)         |
| PASSWORD_RESET   | User           | User request          |

Each log entry stores `user_id` (who), `entity` + `entity_id` (what), `action` (did what), `metadata` (extra context as JSON), and `created_at` (when).

---

## End-to-End Data Flow Summary

```
Admin creates:  User → Course → Module → Quiz → Question
                                                    │
Employee enrolls:  Enrollment (PENDING) ────────────┘
                        │
Manager approves:  Enrollment (APPROVED → IN_PROGRESS)
                        │
Employee learns:   UserProgress (per module)
                        │
Employee quizzes:  QuizResult (per attempt)
                        │
All modules done:  Enrollment (COMPLETED) → Certificate
                        │
Throughout:        Notification (to relevant user)
                   AuditLog (every action)
```
