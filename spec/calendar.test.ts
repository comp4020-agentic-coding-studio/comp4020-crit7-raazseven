import { describe, expect, inject, it } from "vitest";

// Drives the running app over HTTP, one simulated visitor (cookie jar) per
// test actor — mirrors how a real browser would behave, since Astro tracks
// "current visitor" purely through the session cookie the middleware reads.
const baseUrl = inject("baseUrl");

let counter = 0;
function uniqueEmail(): string {
  counter += 1;
  return `visitor-${Date.now()}-${counter}@example.com`;
}

class Visitor {
  private cookie?: string;
  readonly email = uniqueEmail();

  async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.cookie) headers.set("cookie", this.cookie);
    // Astro checks form POSTs carry a same-origin Origin header (CSRF
    // protection); a real browser sends it automatically, fetch doesn't.
    if (init.method === "POST") headers.set("origin", baseUrl);
    const res = await fetch(new URL(path, baseUrl), { ...init, headers, redirect: "manual" });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    return res;
  }

  post(path: string, body: URLSearchParams = new URLSearchParams()): Promise<Response> {
    return this.fetch(path, { method: "POST", body });
  }

  async get(path: string): Promise<string> {
    const res = await this.fetch(path);
    return res.text();
  }

  async signup(displayName: string): Promise<void> {
    const res = await this.post(
      "/api/auth/signup",
      new URLSearchParams({
        displayName,
        email: this.email,
        password: "correct-horse",
        confirmPassword: "correct-horse",
      }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
  }
}

describe("calendar: saving a filter persists as your default view", () => {
  it("survives a reload — the spec's 'create something, and it's still there'", async () => {
    const visitor = new Visitor();
    await visitor.signup("Filter Fan");

    // tag id 1 is "COMP4020", deterministic from the one-time seed order.
    const save = await visitor.post("/api/preferences", new URLSearchParams({ tags: "1" }));
    expect(save.status).toBe(303);
    expect(save.headers.get("location")).toBe("/");

    const home = await visitor.get("/");
    expect(home).toContain("Showing your saved calendar");
    expect(home).toContain("COMP4020 studio crit");
    expect(home).not.toContain("ANU Basketball social comp");
  });
});

describe("calendar: marking yourself going", () => {
  it("requires an account, persists, and is visible to other attendees", async () => {
    const alice = new Visitor();
    const bob = new Visitor();
    await alice.signup("Alice");
    await bob.signup("Bob");

    const goingRes = await alice.post("/api/events/1/going");
    expect(goingRes.status).toBe(303);
    expect(goingRes.headers.get("location")).toBe("/events/1");

    let page = await alice.get("/events/1");
    expect(page).toContain("Alice");

    await bob.post("/api/events/1/going");
    page = await bob.get("/events/1");
    expect(page).toContain("Alice");
    expect(page).toContain("Bob");

    // toggling the same button again withdraws going
    await alice.post("/api/events/1/going");
    page = await alice.get("/events/1");
    expect(page).not.toContain("Alice");
    expect(page).toContain("Bob");
  });
});

describe("calendar: asking someone to go together", () => {
  it("lets two attendees find each other and agree to go together", async () => {
    const alice = new Visitor();
    const bob = new Visitor();
    await alice.signup("Alice Companion");
    await bob.signup("Bob Companion");

    // Event 2, not 1 — the "marking yourself going" test above already left
    // its own Bob marked as going to event 1, which would make him (not
    // Alice) the first attendee link on that page.
    await alice.post("/api/events/2/going");
    await bob.post("/api/events/2/going");

    // Bob asks Alice — need Alice's user id, which the event page links to.
    // Match her name specifically rather than "the first /u/ link on the
    // page": the attendee list also includes the seeded fake profiles, whose
    // interests are older than this test's, so they can sort ahead of Alice.
    const eventPage = await bob.get("/events/2");
    const match = eventPage.match(/\/u\/([\w-]+)"[^>]*>\s*Alice Companion/);
    expect(match).toBeTruthy();
    const aliceId = match![1];

    const ask = await bob.post("/api/events/2/ask", new URLSearchParams({ toUserId: aliceId }));
    expect(ask.status).toBe(303);

    let aliceRequests = await alice.get("/requests");
    expect(aliceRequests).toContain("Bob Companion");
    expect(aliceRequests).toContain("wants to go with you");

    const requestIdMatch = aliceRequests.match(/\/api\/requests\/(\d+)\/respond/);
    expect(requestIdMatch).toBeTruthy();
    const requestId = requestIdMatch![1];

    const accept = await alice.post(
      `/api/requests/${requestId}/respond`,
      new URLSearchParams({ action: "accept" }),
    );
    expect(accept.status).toBe(303);

    const eventPageAfter = await alice.get("/events/2");
    expect(eventPageAfter).toContain("Going together");
  });
});

describe("calendar: seeded companion profiles", () => {
  it("shows on the discover page and matches instantly when asked", async () => {
    const visitor = new Visitor();
    await visitor.signup("Discover Tester");

    await visitor.post("/api/events/3/going");

    const discoverPage = await visitor.get("/events/3/discover");
    expect(discoverPage).toContain("Find someone to go with");

    const candidateMatch = discoverPage.match(/name="toUserId" value="([\w-]+)"/);
    expect(candidateMatch).toBeTruthy();
    const candidateId = candidateMatch![1];

    const ask = await visitor.post(
      "/api/events/3/ask",
      new URLSearchParams({ toUserId: candidateId }),
    );
    expect(ask.status).toBe(303);

    // A seeded profile can't log in to accept, so this resolves immediately —
    // no second actor needed, unlike the real-user test above.
    const eventPage = await visitor.get("/events/3");
    expect(eventPage).toContain("Going together");
  });
});
