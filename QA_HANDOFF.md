# QA Handoff — ATMS (Almnfthen Training Management System)

**Date:** March 2026
**Version:** 1.0
**Deployed URL:** https://atms-xqka.onrender.com
**Repository:** https://github.com/saifahmeddd/ATMS

> **Note:** The app is hosted on Render's free tier. After periods of inactivity the server spins down — the first request may take 30–60 seconds to respond.

---

## 1. Test Credentials

| Role     | Email                     | Password       |
| -------- | ------------------------- | -------------- |
| Admin    | admin@almnfthen.com       | Admin123!      |
| Manager  | manager@almnfthen.com     | Manager123!    |
| Employee | employee1@almnfthen.com   | Employee123!   |
| Employee | employee2@almnfthen.com   | Employee123!   |

Each role is automatically redirected to its own dashboard after login. The middleware enforces strict role-based routing — you cannot access another role's pages.

---

## 2. Feature Checklist by Role

### 2.1 Authentication (All Roles)

| # | Test Case | Steps |
|---|-----------|-------|
| A1 | Successful login | Enter valid credentials → should redirect to role-specific dashboard |
| A2 | Invalid credentials | Enter wrong password → should show "Invalid email or password" |
| A3 | Logout | Click logout in sidebar → should redirect to login page |
| A4 | Session persistence | Log in, close tab, reopen URL → should still be logged in |
| A5 | Role-based access | Log in as Employee, manually navigate to `/admin` → should be redirected to login |
| A6 | Forgot password | Click "Forgot password?" → enter email → should show success message |
| A7 | Change password | Go to profile → change password → log out → log in with new password |

### 2.2 Admin Dashboard

| # | Test Case | Steps |
|---|-----------|-------|
| AD1 | Dashboard stats | Verify user count, course count, and enrolment stats are displayed |
| AD2 | Create user | Users → Add User → fill form → verify user appears in list |
| AD3 | Edit user | Click a user → change name/role/status → save → verify update |
| AD4 | Bulk import users | Users → Bulk Import → upload CSV → verify users are created |
| AD5 | Bulk status update | Select multiple users → change status → verify update |
| AD6 | Create course | Courses → New Course → fill details → save |
| AD7 | Add modules | Open course → add Video/PDF/Document modules → save |
| AD8 | Add quiz | Open course → add quiz with questions → set passing score and time limit |
| AD9 | Publish course | Set course status to Published → verify it appears in employee catalogue |
| AD10 | Duplicate course | Click duplicate on a course → verify copy is created with modules and quizzes |
| AD11 | Set prerequisites | Edit course → add prerequisite courses → save |
| AD12 | View enrolments | Enrolments page → verify all enrolment requests are visible |
| AD13 | View reports | Reports page → verify charts and data load correctly |

### 2.3 Manager Dashboard

| # | Test Case | Steps |
|---|-----------|-------|
| M1 | Dashboard stats | Verify team size, pending requests, and completion stats |
| M2 | View team | Team page → verify employee1 and employee2 are listed |
| M3 | Approve enrolment | Pending request → click Approve → verify status changes |
| M4 | Reject enrolment | Pending request → click Reject → verify status changes |
| M5 | Assign course | Select employee → assign a course → verify enrolment is created |
| M6 | Team reports | Reports page → filter by date range → verify data loads |
| M7 | Notifications | Check notification bell → verify notifications are displayed |

### 2.4 Employee Dashboard

| # | Test Case | Steps |
|---|-----------|-------|
| E1 | Dashboard stats | Verify enrolled courses, completion percentage, and certificates |
| E2 | Browse catalogue | Catalogue page → verify published courses are listed |
| E3 | Search/filter catalogue | Use search bar and category filter → verify results update |
| E4 | Request enrolment | Click a course → request enrolment → verify status is "Pending" |
| E5 | View enrolled courses | My Courses page → verify enrolled courses are listed |
| E6 | Complete modules | Open course → click through modules → mark as complete |
| E7 | Take quiz | Open quiz → answer questions → submit → verify score and pass/fail |
| E8 | Quiz time limit | Start a timed quiz → verify timer counts down and auto-submits |
| E9 | View progress | My Courses → verify progress bar updates after completing modules |
| E10 | Download certificate | Complete a course → verify certificate is available for download |
| E11 | View transcript | Profile/Transcript → verify completed courses are listed |
| E12 | Update profile | Profile → change name → save → verify update |
| E13 | Notifications | Check notification bell → verify enrolment approvals appear |

---

## 3. Manual-Only Tests

These features require human verification and are **not covered by automated tests**:

| # | Test Case | What to Verify |
|---|-----------|----------------|
| MN1 | Quiz builder UI | Drag-and-drop question reordering, "Add Question" button works |
| MN2 | PDF module viewer | PDF modules open and are readable |
| MN3 | Certificate PDF | Downloaded certificate opens as a valid PDF with correct name/course |
| MN4 | Email delivery | Password reset email is received (requires SMTP to be configured) |
| MN5 | Responsive layout | Test on mobile/tablet screen sizes — sidebar collapses, forms are usable |
| MN6 | Browser compatibility | Test on Chrome, Firefox, Safari, Edge |
| MN7 | Loading states | Verify spinners/skeletons appear while data loads |
| MN8 | Error handling | Test with invalid inputs, empty forms, network interruptions |

---

## 4. Automated Test Suite (~153 Tests)

The project includes automated integration tests that run against a local dev server. These can be used to verify core functionality after any code changes.

### Running Automated Tests Locally

```bash
git clone https://github.com/saifahmeddd/ATMS.git
cd ATMS
cp .env.example .env          # Fill in DATABASE_URL, AUTH_SECRET, AUTH_URL
npm install
npm run db:migrate
npm run db:seed
npm run dev                    # Start dev server (keep running)
# In a second terminal:
npm test                       # Runs all ~153 tests
```

### Individual Test Suites

| Command | Suite | Coverage |
|---------|-------|----------|
| `npm run test:auth` | Authentication | Login, logout, CSRF, password reset, change password, role redirects, sessions |
| `npm run test:admin` | Admin | Course CRUD, modules, quizzes, questions, duplication, prerequisites, bulk import, reports |
| `npm run test:employee` | Employee | Catalogue, enrolment, progress, quizzes, certificates, profile, notifications |
| `npm run test:manager` | Manager | Team list, enrolment approval/rejection, course assignment, reports, notifications |
| `npm test` | All suites | Runs all four suites sequentially |

---

## 5. Known Limitations

| Item | Detail |
|------|--------|
| Render cold start | Free tier spins down after ~15 minutes of inactivity. First request takes 30–60s. |
| Video modules | Videos open as external links (no embedded player) |
| Email | Password reset emails only work if SMTP is configured. Without SMTP, reset tokens are logged to the server console. |
| File uploads | Bulk user import expects a specific CSV format (see Admin → Bulk Import for template) |

---

## 6. Environment & Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Database | PostgreSQL 15 (Neon) |
| ORM | Prisma 6 |
| Auth | NextAuth v5 (JWT, Credentials) |
| Styling | Tailwind CSS 3 + shadcn/ui |
| Email | Nodemailer (SMTP) |
| Certificates | jsPDF |

---

## 7. Bug Reporting

When reporting a bug, please include:

1. **Role used** (Admin / Manager / Employee)
2. **Steps to reproduce** (numbered list)
3. **Expected result** vs **Actual result**
4. **Screenshot** (if applicable)
5. **Browser and device** (e.g. Chrome 120, MacBook)
6. **URL** at the time of the issue
