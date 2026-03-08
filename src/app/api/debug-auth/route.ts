import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(req: NextRequest) {
  const cookies = req.cookies.getAll();
  const cookieNames = cookies.map((c) => c.name);

  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = req.headers.get("host");

  let token = null;
  let tokenError = null;
  try {
    token = await getToken({
      req,
      secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    });
  } catch (e: unknown) {
    tokenError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    env: {
      AUTH_SECRET_SET: !!process.env.AUTH_SECRET,
      NEXTAUTH_SECRET_SET: !!process.env.NEXTAUTH_SECRET,
      AUTH_URL: process.env.AUTH_URL ?? "(not set)",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "(not set)",
      NODE_ENV: process.env.NODE_ENV,
    },
    headers: {
      "x-forwarded-proto": forwardedProto,
      "x-forwarded-host": forwardedHost,
      host,
    },
    cookies: cookieNames,
    token: token ? { id: token.id, role: token.role, exp: token.exp } : null,
    tokenError,
  });
}
