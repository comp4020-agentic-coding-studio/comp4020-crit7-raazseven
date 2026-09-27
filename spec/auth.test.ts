import { describe, expect, it } from "vitest";
import { baseUrl, Visitor } from "./visitor";

describe("auth: signing up", () => {
  it("rejects each invalid submission with its own error, and blocks a duplicate email", async () => {
    const visitor = new Visitor();

    const missing = await visitor.signupRaw({ displayName: "" });
    expect(missing.status).toBe(303);
    expect(missing.headers.get("location")).toContain("error=missing");

    const weak = await visitor.signupRaw({ password: "short1", confirmPassword: "short1" });
    expect(weak.headers.get("location")).toContain("error=weak-password");

    const mismatch = await visitor.signupRaw({
      password: "correct-horse",
      confirmPassword: "different-horse",
    });
    expect(mismatch.headers.get("location")).toContain("error=mismatch");

    // None of the rejected attempts above should have created an account or
    // logged this visitor in — a real signup redirects to "/", not "/signup".
    const stillAnonymous = await visitor.fetch("/profile");
    expect(stillAnonymous.status).toBe(302);
    expect(stillAnonymous.headers.get("location")).toBe("/login");

    const ok = await visitor.signupRaw({});
    expect(ok.status).toBe(303);
    expect(ok.headers.get("location")).toBe("/");

    // Same email again, from a totally different visitor/session, must be
    // rejected — proves the email uniqueness check reads the shared database
    // rather than anything scoped to the first visitor's own session.
    const dupeVisitor = new Visitor();
    const dupe = await dupeVisitor.signupRaw({ email: visitor.email });
    expect(dupe.headers.get("location")).toContain("error=email-taken");
  });
});

describe("auth: logging in and out", () => {
  it("logs in with the right password, rejects the wrong one, and a logout really invalidates the session", async () => {
    const owner = new Visitor();
    await owner.signup("Login Tester");

    // A fresh cookie jar, same server/database — simulates the same person
    // coming back later (or from another device) rather than reusing the
    // signed-up session directly.
    const returning = new Visitor();

    const bad = await returning.post(
      "/api/auth/login",
      new URLSearchParams({ email: owner.email, password: "totally-wrong" }),
    );
    expect(bad.status).toBe(303);
    expect(bad.headers.get("location")).toContain("error=invalid-credentials");

    const stillAnonymous = await returning.fetch("/profile");
    expect(stillAnonymous.status).toBe(302);
    expect(stillAnonymous.headers.get("location")).toBe("/login");

    const good = await returning.post(
      "/api/auth/login",
      new URLSearchParams({ email: owner.email, password: "correct-horse" }),
    );
    expect(good.status).toBe(303);
    expect(good.headers.get("location")).toBe("/");

    const profileRes = await returning.fetch("/profile");
    expect(profileRes.status).toBe(200);
    expect(await profileRes.text()).toContain("Your profile");

    const sessionCookieBeforeLogout = returning.sessionCookie;
    expect(sessionCookieBeforeLogout).toBeTruthy();

    const logout = await returning.post("/api/auth/logout");
    expect(logout.status).toBe(303);
    expect(logout.headers.get("location")).toBe("/");

    // The real proof this is a server-side (database-backed) session, not
    // just a cookie the client happens to have cleared: replay the *old*
    // cookie value by hand and confirm the server itself now refuses it.
    const staleCookieAttempt = await fetch(new URL("/profile", baseUrl), {
      headers: { cookie: sessionCookieBeforeLogout! },
      redirect: "manual",
    });
    expect(staleCookieAttempt.status).toBe(302);
    expect(staleCookieAttempt.headers.get("location")).toBe("/login");
  });
});
