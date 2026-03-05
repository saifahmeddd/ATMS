# TMS Manual Testing Guide

**Almnfthen Training Management System (ATMS)**  
Complete step-by-step instructions to manually test every feature.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Test Credentials](#test-credentials)
3. [Environment Setup](#environment-setup)
4. [Authentication Testing](#1-authentication-testing)
5. [Admin Features](#2-admin-features)
6. [Manager Features](#3-manager-features)
7. [Employee Features](#4-employee-features)
8. [Shared Features](#5-shared-features)
9. [Password Reset Flow](#6-password-reset-flow)
10. [Negative / Edge Cases](#7-negative--edge-cases)

---

## Prerequisites

- **Node.js** 18.17+
- **PostgreSQL** 15+ (local, Neon, Supabase, or similar)
- **Browser** (Chrome, Firefox, Safari, or Edge)
- **Terminal** for running commands

---

## Test Credentials

After running `npm run db:seed`, use these accounts:

| Role     | Email                    | Password     | Purpose                          |
|----------|--------------------------|--------------|----------------------------------|
| **Admin**    | `admin@almnfthen.com`     | `Admin123!`  | Full system access               |
| **Manager**  | `manager@almnfthen.com`  | `Manager123!`| Team management, approvals       |
| **Employee 1** | `employee1@almnfthen.com` | `Employee123!` | Has pre-seeded enrollment      |
| **Employee 2** | `employee2@almnfthen.com` | `Employee123!` | No enrollments (for requests) |

**Password rules:** Minimum 8 characters. Seed passwords use uppercase, lowercase, numbers, and `!`.

---

## Environment Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and set:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/TMS_DB"
AUTH_SECRET="<generate with: npx auth secret>"
AUTH_URL="http://localhost:3000"
```

### 3. Initialize database

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 4. Start the application

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## 1. Authentication Testing

### 1.1 Login – Valid credentials

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to http://localhost:3000/login | Login form visible |
| 2 | Enter `admin@almnfthen.com` / `Admin123!` | — |
| 3 | Click **Sign In** | Redirect to `/admin` dashboard |
| 4 | Sign out, repeat with `manager@almnfthen.com` / `Manager123!` | Redirect to `/manager` |
| 5 | Sign out, repeat with `employee1@almnfthen.com` / `Employee123!` | Redirect to `/employee` |

### 1.2 Login – Invalid credentials

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to /login | — |
| 2 | Enter `admin@almnfthen.com` / `WrongPassword123!` | Error: "Invalid email or password" |
| 3 | Enter `nobody@almnfthen.com` / `Whatever123!` | Same error (no user enumeration) |

### 1.3 Role-based redirect

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as Admin | Redirect to `/admin` |
| 2 | Manually go to http://localhost:3000/manager | Redirect to `/login` (403) |
| 3 | Log in as Employee | Redirect to `/employee` |
| 4 | Manually go to http://localhost:3000/admin | Redirect to `/login` (403) |

### 1.4 Protected routes (unauthenticated)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Sign out (or use incognito) | — |
| 2 | Go to http://localhost:3000/admin | Redirect to `/login?callbackUrl=/admin` |
| 3 | Go to http://localhost:3000/employee/my-courses | Redirect to `/login?callbackUrl=/employee/my-courses` |

### 1.5 Change password (authenticated)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as Admin | — |
| 2 | Go to http://localhost:3000/settings/security | Change password form |
| 3 | Enter current: `Admin123!`, new: `Admin456!`, confirm: `Admin456!` | Success message |
| 4 | Sign out and log in with `Admin456!` | Login succeeds |
| 5 | Change password back to `Admin123!` for later tests | — |

---

## 2. Admin Features

Log in as **admin@almnfthen.com** / **Admin123!**.

### 2.1 Dashboard

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to /admin | Dashboard with stats (users, courses, enrollments) |
| 2 | Check sidebar | Links: Dashboard, User Management, Course Management, Reports & Analytics, Settings |

### 2.2 User Management

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to /admin/users | User list (Admin, Manager, Employee 1, Employee 2) |
| 2 | Click **Add User** | Modal with name, email, role, password, manager |
| 3 | Create user: Name `Test User`, Email `test@almnfthen.com`, Role `EMPLOYEE`, Password `Test123!`, Manager `Manager User` | User appears in list |
| 4 | Click **Edit** on Test User | Edit modal |
| 5 | Change name to `Test User Updated` | Name updates in list |
| 6 | Change status to **Inactive** | User marked inactive |
| 7 | Change status back to **Active** | — |
| 8 | Click **Delete** on Test User | Confirmation; user removed |

### 2.3 Bulk user import

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to /admin/users | — |
| 2 | Click **Bulk Import** | CSV upload modal |
| 3 | Create CSV: `name,email,role,password` and `Bulk1,bulk1@almnfthen.com,EMPLOYEE,Bulk123!,manager@almnfthen.com` | — |
| 4 | Upload and confirm | New user appears |
| 5 | Delete bulk user for cleanup | — |

### 2.4 Course Management

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to /admin/courses | Course list (e.g. "Introduction to Web Development") |
| 2 | Click **New Course** | Course form |
| 3 | Create: Title `Manual Test Course`, Description `For testing`, Category `Technical`, Status `DRAFT` | Course created |
| 4 | Open the new course | Course detail page |
| 5 | Add module: Title `Module 1`, Type `VIDEO`, URL `https://www.youtube.com/watch?v=dQw4w9WgXcQ`, Sequence `1` | Module added |
| 6 | Add quiz to Module 1: Passing 70%, Duration 10 min, Max attempts 3 | Quiz created |
| 7 | Add questions: e.g. "What is 2+2?" with options `3,4,5,6`, correct `4` | Questions added |
| 8 | Add second module: Title `Module 2`, Type `PDF`, URL `https://example.com/doc.pdf`, Sequence `2` | Second module added |
| 9 | Change course status to **Published** | Course visible in catalogue |

### 2.5 Course duplication

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to /admin/courses | — |
| 2 | Open "Introduction to Web Development" | — |
| 3 | Click **Duplicate** | New course created with same modules/quizzes |
| 4 | Verify duplicated course has same structure | — |

### 2.6 Course prerequisites

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open a course that has at least 2 modules | — |
| 2 | Find prerequisites section | — |
| 3 | Add prerequisite: "Module 2 requires Module 1" | Prerequisite saved |
| 4 | Verify employee cannot access Module 2 before completing Module 1 | — |

### 2.7 Reports & Analytics

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to /admin/reports | Reports page |
| 2 | Check enrollment stats, completion rates, user activity | Data displayed |

### 2.8 Settings

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to /admin/settings | General Settings page |
| 2 | Toggle notification settings | Toggles work |
| 3 | Adjust security settings (session timeout, max attempts) | Values displayed |
| 4 | Click **Save Settings** | Success feedback |

---

## 3. Manager Features

Log in as **manager@almnfthen.com** / **Manager123!**.

### 3.1 Dashboard

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to /manager | Manager dashboard with team stats |

### 3.2 Team Members

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to /manager/team | List of direct reports (Employee 1, Employee 2) |
| 2 | View employee details | Name, email, enrollments, progress |

### 3.3 Approval requests

| Step | Action | Expected |
|------|--------|----------|
| 1 | As Employee 2, request enrollment in a published course (see 4.2) | — |
| 2 | Log in as Manager | — |
| 3 | Go to /manager/approvals | Pending request from Employee 2 |
| 4 | Click **Approve** (optional: add comment) | Status → Approved; Employee 2 notified |
| 5 | Repeat flow, click **Reject** (optional: add comment) | Status → Rejected; Employee 2 notified |

### 3.4 Assign training

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to /manager/assign | Assign training page |
| 2 | Select employee (e.g. Employee 2) | — |
| 3 | Select course | — |
| 4 | Set optional deadline | — |
| 5 | Click **Assign** | Enrollment created with status APPROVED |

### 3.5 Team reports

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to /manager/reports | Team reports (completion, progress) |

---

## 4. Employee Features

Log in as **employee1@almnfthen.com** / **Employee123!**.

### 4.1 Dashboard

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to /employee | Dashboard with "My Courses", progress, deadlines |

### 4.2 Course catalogue & enrollment request

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to /employee/catalogue | Published courses listed |
| 2 | Use search/filter if available | Results update |
| 3 | Open a course | Course details |
| 4 | Click **Request Enrollment** | Enrollment created with status PENDING |
| 5 | Go to /employee/my-courses | Pending course appears |

### 4.3 My courses – learning flow

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to /employee/my-courses | List of enrollments |
| 2 | Open an approved course (e.g. "Introduction to Web Development") | Course content page |
| 3 | Open Module 1 | Video/PDF content and quiz link |
| 4 | Complete Module 1 content | — |
| 5 | Click **Take Quiz** | Quiz page with timer |
| 6 | Answer questions and submit | Score shown; pass/fail |
| 7 | If failed, retry (within max attempts) | New attempt allowed |
| 8 | If passed, Module 2 unlocks | Next module visible |
| 9 | Complete all modules | Progress 100%; enrollment COMPLETED |

### 4.4 Certificates

| Step | Action | Expected |
|------|--------|----------|
| 1 | Complete a course (all modules + quizzes) | — |
| 2 | Go to /employee/certificates | Certificate list |
| 3 | Open a certificate | Certificate details with verification code |
| 4 | Click **Download** (if available) | PDF download |

### 4.5 Profile & settings

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to /employee/profile | Profile page |
| 2 | Update name, phone, or profile picture | Changes saved |

### 4.6 Cancel enrollment

| Step | Action | Expected |
|------|--------|----------|
| 1 | Request enrollment in a course | Status PENDING |
| 2 | Before manager approval, cancel enrollment | Status updated; course removed from My Courses |

---

## 5. Shared Features

### 5.1 Notifications

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as any user | — |
| 2 | Click **Notifications** in sidebar | Notifications page |
| 3 | Filter by All / Unread / Approvals / Deadlines / Completions / Info | List updates |
| 4 | Click **Mark read** on a notification | Unread count decreases |
| 5 | Click **Mark all read** | All marked read |

### 5.2 Sign out

| Step | Action | Expected |
|------|--------|----------|
| 1 | Click **Sign Out** in sidebar | Redirect to /login |

---

## 6. Password Reset Flow

**Note:** If SMTP is not configured, the reset link is printed in the terminal. Copy it and open in the browser.

### 6.1 Forgot password

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to /login | — |
| 2 | Click **Forgot password?** | /forgot-password |
| 3 | Enter `employee1@almnfthen.com` | — |
| 4 | Click **Send Reset Link** | "Check Your Inbox" message |
| 5 | Check terminal (if SMTP not configured) for reset link | Link like `http://localhost:3000/reset-password?token=...` |

### 6.2 Reset password

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open reset link from email or terminal | Reset password form |
| 2 | Enter new password `NewPass123!` and confirm | — |
| 3 | Click **Reset Password** | Success message |
| 4 | Go to /login and sign in with `NewPass123!` | Login succeeds |
| 5 | Change password back to `Employee123!` via /settings/security | — |

### 6.3 Invalid reset link

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to /reset-password (no token) | "Invalid Reset Link" message |
| 2 | Go to /reset-password?token=invalid123 | Error on submit |

---

## 7. Negative / Edge Cases

### 7.1 Duplicate enrollment

| Step | Action | Expected |
|------|--------|----------|
| 1 | As Employee 1, request enrollment in a course already enrolled | Error or no duplicate created |

### 7.2 Quiz max attempts

| Step | Action | Expected |
|------|--------|----------|
| 1 | Fail a quiz 3 times (or max attempts) | No more attempts allowed |
| 2 | Try to start quiz again | Blocked or error |

### 7.3 Inactive user login

| Step | Action | Expected |
|------|--------|----------|
| 1 | As Admin, set Employee 1 to Inactive | — |
| 2 | Log in as Employee 1 | "Invalid email or password" |
| 3 | Set Employee 1 back to Active | — |

### 7.4 Prerequisite enforcement

| Step | Action | Expected |
|------|--------|----------|
| 1 | Create course with Module 2 requiring Module 1 | — |
| 2 | As Employee, try to access Module 2 before completing Module 1 | Blocked or message |

---

## Quick Reference: URLs

| Page | URL |
|------|-----|
| Login | http://localhost:3000/login |
| Forgot Password | http://localhost:3000/forgot-password |
| Admin Dashboard | http://localhost:3000/admin |
| Admin Users | http://localhost:3000/admin/users |
| Admin Courses | http://localhost:3000/admin/courses |
| Admin Reports | http://localhost:3000/admin/reports |
| Admin Settings | http://localhost:3000/admin/settings |
| Manager Dashboard | http://localhost:3000/manager |
| Manager Team | http://localhost:3000/manager/team |
| Manager Approvals | http://localhost:3000/manager/approvals |
| Manager Assign | http://localhost:3000/manager/assign |
| Manager Reports | http://localhost:3000/manager/reports |
| Employee Dashboard | http://localhost:3000/employee |
| Course Catalogue | http://localhost:3000/employee/catalogue |
| My Courses | http://localhost:3000/employee/my-courses |
| My Certificates | http://localhost:3000/employee/certificates |
| Profile | http://localhost:3000/employee/profile |
| Notifications | http://localhost:3000/notifications |
| Change Password | http://localhost:3000/settings/security |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid email or password" with correct credentials | Run `npm run db:seed` to reset users |
| Reset link not in email | Check terminal; SMTP may not be configured |
| 401 on API calls | Ensure you are logged in; try clearing cookies |
| Role redirect fails | Clear cookies and log in again |
| Database connection error | Verify `DATABASE_URL` in `.env` |

---

*Last updated: March 3, 2026*
