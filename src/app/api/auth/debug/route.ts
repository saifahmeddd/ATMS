import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const cookies = req.cookies.getAll();
  const cookieInfo = cookies.map((c) => ({
    name: c.name,
    length: c.value.length,
  }));

  const forwardedProto = req.headers.get("x-forwarded-proto");
  const host = req.headers.get("host");

  // Method 1: getToken (what the middleware uses)
  let getTokenResult = null;
  let getTokenError = null;
  try {
    const t = await getToken({
      req,
      secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    });
    getTokenResult = t ? { id: t.id, role: t.role } : null;
  } catch (e: unknown) {
    getTokenError = e instanceof Error ? e.message : String(e);
  }

  // Method 1b: getToken with explicit salt
  let getTokenExplicit = null;
  let getTokenExplicitError = null;
  try {
    const t = await getToken({
      req,
      secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
      salt: "__Secure-authjs.session-token",
    });
    getTokenExplicit = t ? { id: t.id, role: t.role } : null;
  } catch (e: unknown) {
    getTokenExplicitError = e instanceof Error ? e.message : String(e);
  }

  // Method 1c: getToken with non-secure cookie name
  let getTokenNonSecure = null;
  try {
    const t = await getToken({
      req,
      secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
      salt: "authjs.session-token",
      secureCookie: false,
    });
    getTokenNonSecure = t ? { id: t.id, role: t.role } : null;
  } catch {
    // ignore
  }

  // Method 2: auth() (NextAuth's own session reader)
  let authSession = null;
  let authError = null;
  try {
    const session = await auth();
    authSession = session ? { user: session.user } : null;
  } catch (e: unknown) {
    authError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    env: {
      AUTH_SECRET_SET: !!process.env.AUTH_SECRET,
      AUTH_SECRET_LENGTH: (process.env.AUTH_SECRET ?? "").length,
      AUTH_URL: process.env.AUTH_URL ?? "(not set)",
      NODE_ENV: process.env.NODE_ENV,
    },
    headers: { "x-forwarded-proto": forwardedProto, host },
    cookies: cookieInfo,
    getToken: { result: getTokenResult, error: getTokenError },
    getTokenExplicitSalt: { result: getTokenExplicit, error: getTokenExplicitError },
    getTokenNonSecure: { result: getTokenNonSecure },
    authSession: { result: authSession, error: authError },
  });
}
