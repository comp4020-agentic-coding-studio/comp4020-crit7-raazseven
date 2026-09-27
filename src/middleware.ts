import type { APIContext } from "astro";
import { defineMiddleware } from "astro:middleware";
import { getSessionUser } from "./lib/db";

export const COOKIE = "sid";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Real accounts now (see src/lib/auth.ts) — the cookie names a session, not
// an identity, so a missing/expired session just means "logged out", not
// "brand new anonymous visitor". Pages read Astro.locals.user (User | null)
// instead of re-deriving identity themselves.
export const onRequest = defineMiddleware((context, next) => {
  const sid = context.cookies.get(COOKIE)?.value;
  const user = sid ? getSessionUser(sid) : undefined;

  if (sid && !user) {
    context.cookies.delete(COOKIE, { path: "/" });
  }

  context.locals.user = user ?? null;
  return next();
});

// Shared by the auth API routes so the cookie's options never drift between
// where it's set (login/signup) and where it's cleared (logout).
export function setSessionCookie(context: APIContext, sessionId: string): void {
  context.cookies.set(COOKIE, sessionId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: context.url.hostname !== "localhost",
    maxAge: ONE_YEAR_SECONDS,
  });
}
