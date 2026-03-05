/**
 * System Test Runner
 *
 * Orchestrates all automatable integration test suites in sequence.
 * Requires: dev server running at http://localhost:3000, seeded DB.
 *
 * Usage: npm test   OR   npx tsx tests/system.test.ts
 */

import { spawnSync } from "child_process";

const BASE = "http://localhost:3000";

const suites = [
  { name: "Auth (FR-2.x)", file: "tests/auth.test.ts" },
  { name: "Admin (FR-3/4/8.x)", file: "tests/admin.test.ts" },
  { name: "Employee (FR-5/6/7/9.x)", file: "tests/employee.test.ts" },
  { name: "Manager (FR-5/8/9.x)", file: "tests/manager.test.ts" },
];

const manualOnly = [
  "Quiz builder UI (drag-and-drop, Add Question button)",
  "Video player controls (play/pause/seek/resume)",
  "PDF module viewer rendering",
  "Certificate PDF download & print",
  "SMTP inbox verification (password reset email delivery)",
  "Responsive layout / visual regression",
];

async function checkServer(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/auth/csrf`);
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║         TMS — System Integration Tests          ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  const serverUp = await checkServer();
  if (!serverUp) {
    console.log(`❌  Cannot reach dev server at ${BASE}`);
    console.log("    Start it with: npm run dev\n");
    process.exit(1);
  }
  console.log(`✔  Dev server reachable at ${BASE}\n`);

  const results: { name: string; passed: boolean }[] = [];

  for (const suite of suites) {
    console.log(`\n${"─".repeat(54)}`);
    console.log(`  ▶  ${suite.name}`);
    console.log(`     ${suite.file}`);
    console.log(`${"─".repeat(54)}\n`);

    const result = spawnSync("npx", ["tsx", suite.file], {
      stdio: "inherit",
      env: { ...process.env, TEST_BASE_URL: BASE },
      cwd: process.cwd(),
    });

    results.push({ name: suite.name, passed: result.status === 0 });
  }

  const passedSuites = results.filter((r) => r.passed).length;

  console.log(`\n${"═".repeat(54)}`);
  console.log("  SUITE SUMMARY");
  console.log(`${"═".repeat(54)}`);
  for (const r of results) {
    console.log(`  ${r.passed ? "✅" : "❌"}  ${r.name}`);
  }

  console.log(`\n  Suites: ${passedSuites}/${results.length} passed`);

  console.log(`\n${"─".repeat(54)}`);
  console.log("  ⏭️   SKIPPED — Manual-only (require browser)");
  console.log(`${"─".repeat(54)}`);
  for (const item of manualOnly) {
    console.log(`  •  ${item}`);
  }

  console.log(`\n${"═".repeat(54)}\n`);
  process.exit(passedSuites < results.length ? 1 : 0);
}

main();
