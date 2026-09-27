import { describe, expect, it } from "vitest";
import { Visitor } from "./visitor";

// Extra edge cases around companion requests and chat beyond the main
// happy-path flows already covered in calendar.test.ts: declining, the
// guardrails on who can be asked, discover-page exclusion, and chat
// authorization for people who aren't part of a match.

describe("companion requests: declining", () => {
  it("marks the request declined, drops the 'going together' badge, and never opens a chat", async () => {
    const alice = new Visitor();
    const bob = new Visitor();
    await alice.signup("Alice Decliner");
    await bob.signup("Bob Decliner");

    await alice.post("/api/events/6/going");
    await bob.post("/api/events/6/going");

    const eventPage = await bob.get("/events/6");
    const match = eventPage.match(/\/u\/([\w-]+)"[^>]*>\s*Alice Decliner/);
    expect(match).toBeTruthy();
    const aliceId = match![1];

    await bob.post("/api/events/6/ask", new URLSearchParams({ toUserId: aliceId }));

    const aliceRequests = await alice.get("/requests");
    const requestIdMatch = aliceRequests.match(/\/api\/requests\/(\d+)\/respond/);
    expect(requestIdMatch).toBeTruthy();
    const requestId = requestIdMatch![1];

    const decline = await alice.post(
      `/api/requests/${requestId}/respond`,
      new URLSearchParams({ action: "decline" }),
    );
    expect(decline.status).toBe(303);

    const eventPageAfter = await alice.get("/events/6");
    expect(eventPageAfter).not.toContain("Going together");

    const chatAttempt = await alice.fetch(`/chat/${requestId}`);
    expect(chatAttempt.status).toBe(404);
  });
});

describe("companion requests: guardrails on who can be asked", () => {
  it("silently ignores asking yourself, and asking someone who isn't marked going", async () => {
    const alice = new Visitor();
    const bob = new Visitor();
    await alice.signup("Alice Guard");
    await bob.signup("Bob Guard");

    await alice.post("/api/events/7/going");
    // Bob deliberately never marks himself as going to event 7.

    const aliceProfile = await alice.get("/profile");
    const aliceId = aliceProfile.match(/seed=([\w-]+)"/)![1];
    const bobProfile = await bob.get("/profile");
    const bobId = bobProfile.match(/seed=([\w-]+)"/)![1];

    await alice.post("/api/events/7/ask", new URLSearchParams({ toUserId: aliceId }));
    expect(await alice.get("/requests")).toContain("You haven't asked anyone yet.");

    await alice.post("/api/events/7/ask", new URLSearchParams({ toUserId: bobId }));
    expect(await alice.get("/requests")).toContain("You haven't asked anyone yet.");
  });

  it("does not create a duplicate request when the same person is asked twice", async () => {
    const alice = new Visitor();
    const bob = new Visitor();
    await alice.signup("Alice Dupe");
    await bob.signup("Bob Dupe");

    await alice.post("/api/events/8/going");
    await bob.post("/api/events/8/going");

    const eventPage = await bob.get("/events/8");
    const match = eventPage.match(/\/u\/([\w-]+)"[^>]*>\s*Alice Dupe/);
    expect(match).toBeTruthy();
    const aliceId = match![1];

    await bob.post("/api/events/8/ask", new URLSearchParams({ toUserId: aliceId }));
    await bob.post("/api/events/8/ask", new URLSearchParams({ toUserId: aliceId }));

    const aliceRequests = await alice.get("/requests");
    const occurrences = aliceRequests.match(/wants to go with you/g) ?? [];
    expect(occurrences.length).toBe(1);
  });
});

describe("companion requests: the discover page only offers people you can still ask", () => {
  it("drops a candidate from the list once you've asked them", async () => {
    const visitor = new Visitor();
    await visitor.signup("Discover Excluder");

    await visitor.post("/api/events/9/going");
    const before = await visitor.get("/events/9/discover");
    const candidateMatch = before.match(/name="toUserId" value="([\w-]+)"/);
    expect(candidateMatch).toBeTruthy();
    const candidateId = candidateMatch![1];

    await visitor.post("/api/events/9/ask", new URLSearchParams({ toUserId: candidateId }));

    const after = await visitor.get("/events/9/discover");
    expect(after).not.toContain(`value="${candidateId}"`);
  });
});

describe("companion requests: chat is only for the two matched people", () => {
  it("404s for a third party, and their messages never reach the real thread", async () => {
    const alice = new Visitor();
    const bob = new Visitor();
    const carol = new Visitor();
    await alice.signup("Alice Private");
    await bob.signup("Bob Private");
    await carol.signup("Carol Snoop");

    await alice.post("/api/events/10/going");
    await bob.post("/api/events/10/going");

    const eventPage = await bob.get("/events/10");
    const match = eventPage.match(/\/u\/([\w-]+)"[^>]*>\s*Alice Private/);
    expect(match).toBeTruthy();
    const aliceId = match![1];

    await bob.post("/api/events/10/ask", new URLSearchParams({ toUserId: aliceId }));

    const aliceRequests = await alice.get("/requests");
    const requestIdMatch = aliceRequests.match(/\/api\/requests\/(\d+)\/respond/);
    expect(requestIdMatch).toBeTruthy();
    const requestId = requestIdMatch![1];

    await alice.post(`/api/requests/${requestId}/respond`, new URLSearchParams({ action: "accept" }));

    const snoop = await carol.fetch(`/chat/${requestId}`);
    expect(snoop.status).toBe(404);

    const snoopPost = await carol.post(
      `/api/chat/${requestId}/messages`,
      new URLSearchParams({ body: "let me in" }),
    );
    expect(snoopPost.status).toBe(303);

    const aliceThread = await alice.get(`/chat/${requestId}`);
    expect(aliceThread).not.toContain("let me in");
  });

  it("blocks messaging a request that hasn't been accepted yet", async () => {
    const alice = new Visitor();
    const bob = new Visitor();
    await alice.signup("Alice Pending");
    await bob.signup("Bob Pending");

    await alice.post("/api/events/11/going");
    await bob.post("/api/events/11/going");

    const eventPage = await bob.get("/events/11");
    const match = eventPage.match(/\/u\/([\w-]+)"[^>]*>\s*Alice Pending/);
    expect(match).toBeTruthy();
    const aliceId = match![1];

    await bob.post("/api/events/11/ask", new URLSearchParams({ toUserId: aliceId }));

    const aliceRequests = await alice.get("/requests");
    const requestIdMatch = aliceRequests.match(/\/api\/requests\/(\d+)\/respond/);
    expect(requestIdMatch).toBeTruthy();
    const requestId = requestIdMatch![1];

    // Still pending — nobody can chat until Alice responds.
    const bobAttempt = await bob.fetch(`/chat/${requestId}`);
    expect(bobAttempt.status).toBe(404);

    const bobPost = await bob.post(
      `/api/chat/${requestId}/messages`,
      new URLSearchParams({ body: "too soon" }),
    );
    expect(bobPost.status).toBe(303);

    await alice.post(`/api/requests/${requestId}/respond`, new URLSearchParams({ action: "accept" }));
    const aliceThread = await alice.get(`/chat/${requestId}`);
    expect(aliceThread).not.toContain("too soon");
  });
});
