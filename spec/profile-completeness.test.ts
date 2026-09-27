import { describe, expect, it } from "vitest";
import { Visitor } from "./visitor";

// The gate itself (src/middleware.ts): a logged-in user with an incomplete
// profile gets bounced to /profile everywhere except the handful of paths
// that let them actually complete it. Bypasses Visitor.signup()'s helper
// (which auto-completes) to exercise the "just signed up" state directly.

describe("profile completeness: gate on login", () => {
  it("redirects an incomplete profile away from the rest of the app, but not from completing it", async () => {
    const visitor = new Visitor();
    const signupRes = await visitor.signupRaw({ displayName: "Half Done" });
    expect(signupRes.status).toBe(303);
    expect(signupRes.headers.get("location")).toBe("/");

    const home = await visitor.fetch("/");
    expect(home.status).toBe(302);
    expect(home.headers.get("location")).toBe("/profile?required=1");

    // The gate itself must still be reachable, or nobody could ever clear it.
    // Follows the redirect target exactly (including its query string) rather
    // than a bare /profile, since that's what a real browser would load next.
    const profilePage = await visitor.fetch("/profile?required=1");
    expect(profilePage.status).toBe(200);
    const profileHtml = await profilePage.text();
    expect(profileHtml).toContain("Complete your profile");

    const tagMatch = profileHtml.match(/name="tags"\s+value="(\d+)"/);
    expect(tagMatch).toBeTruthy();

    const complete = await visitor.post(
      "/api/profile",
      new URLSearchParams({
        displayName: "Half Done",
        pronouns: "they/them",
        program: "Test program",
        bio: "Now I'm done.",
        tags: tagMatch![1],
      }),
    );
    expect(complete.status).toBe(303);

    const homeAfter = await visitor.fetch("/");
    expect(homeAfter.status).toBe(200);
  });
});
