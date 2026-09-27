import { describe, expect, it } from "vitest";
import { Visitor } from "./visitor";

describe("profile: editing it persists to the shared database", () => {
  it("saves display name and bio, and a completely different visitor can see them", async () => {
    const owner = new Visitor();
    await owner.signup("Old Name");

    const save = await owner.post(
      "/api/profile",
      new URLSearchParams({ displayName: "New Name", bio: "Loves COMP4020 crits." }),
    );
    expect(save.status).toBe(303);
    expect(save.headers.get("location")).toBe("/profile");

    const ownProfile = await owner.get("/profile");
    expect(ownProfile).toContain("New Name");
    expect(ownProfile).toContain("Loves COMP4020 crits.");

    // The avatar image is keyed off the user's own id (see src/lib/avatar.ts)
    // — the only id this visitor's session ever reveals in rendered HTML.
    const idMatch = ownProfile.match(/seed=([\w-]+)"/);
    expect(idMatch).toBeTruthy();
    const ownerId = idMatch![1];

    // A second, independent visitor (its own cookie jar, never talked to the
    // first) looking this person up is the strongest proof available over
    // HTTP that the update landed in shared storage, not per-session state.
    const stranger = new Visitor();
    await stranger.signup("Nosy Stranger");
    const publicView = await stranger.get(`/u/${ownerId}`);
    expect(publicView).toContain("New Name");
    expect(publicView).toContain("Loves COMP4020 crits.");
  });

  it("trims an empty display name and bio back to their placeholders", async () => {
    const visitor = new Visitor();
    await visitor.signup("Someone");

    await visitor.post("/api/profile", new URLSearchParams({ displayName: "", bio: "" }));

    const profile = await visitor.get("/profile");
    expect(profile).toContain("No name set yet");
  });

  it("saves pronouns, program and interest tags, visible to another visitor", async () => {
    const owner = new Visitor();
    await owner.signup("Interests Owner");

    const profilePage = await owner.get("/profile");
    const tagMatches = [...profilePage.matchAll(/name="tags"\s+value="(\d+)"/g)];
    expect(tagMatches.length).toBeGreaterThan(1);
    const [firstTagId, secondTagId] = tagMatches.map((m) => m[1]);

    const save = await owner.post(
      "/api/profile",
      new URLSearchParams([
        ["displayName", "Interests Owner"],
        ["pronouns", "she/her"],
        ["program", "3rd-year Computer Science"],
        ["bio", "Here for the events."],
        ["tags", firstTagId],
        ["tags", secondTagId],
      ]),
    );
    expect(save.status).toBe(303);

    const ownProfile = await owner.get("/profile");
    expect(ownProfile).toContain("she/her");
    expect(ownProfile).toContain("3rd-year Computer Science");

    const idMatch = ownProfile.match(/seed=([\w-]+)"/);
    expect(idMatch).toBeTruthy();
    const ownerId = idMatch![1];

    const stranger = new Visitor();
    await stranger.signup("Another Stranger");
    const publicView = await stranger.get(`/u/${ownerId}`);
    expect(publicView).toContain("she/her");
    expect(publicView).toContain("3rd-year Computer Science");
  });
});
