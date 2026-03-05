import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import bcrypt from "bcryptjs";

const bulkStatusSchema = z.object({
  userIds: z.array(z.string()).min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

const csvRowSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]),
  password: z.string().min(8),
});

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}

/**
 * POST /api/users/bulk - CSV import
 * Expects JSON body: { csv: "name,email,role,password\n..." }
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  let body: { csv?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.csv || typeof body.csv !== "string") {
    return NextResponse.json({ error: "CSV data is required" }, { status: 400 });
  }

  const rows = parseCSV(body.csv);
  if (rows.length === 0) {
    return NextResponse.json({ error: "No data rows found in CSV" }, { status: 400 });
  }

  const results: { row: number; email: string; status: string; error?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const parsed = csvRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      results.push({
        row: i + 1,
        email: rows[i].email ?? "",
        status: "error",
        error: parsed.error.issues.map((e) => e.message).join(", "),
      });
      continue;
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (existing) {
      results.push({
        row: i + 1,
        email: parsed.data.email,
        status: "error",
        error: "Email already exists",
      });
      continue;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        passwordHash,
      },
    });

    results.push({ row: i + 1, email: parsed.data.email, status: "created" });
  }

  const created = results.filter((r) => r.status === "created").length;
  const errors = results.filter((r) => r.status === "error").length;

  return NextResponse.json({ created, errors, total: rows.length, results });
}

/**
 * PATCH /api/users/bulk - Bulk status update
 */
export async function PATCH(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bulkStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { count } = await prisma.user.updateMany({
    where: { id: { in: parsed.data.userIds } },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ updated: count });
}
