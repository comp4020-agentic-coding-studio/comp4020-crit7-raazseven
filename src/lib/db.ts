import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { and, asc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { newSessionId, sessionExpiry } from "./auth";
import {
  type CompanionRequest,
  type Event,
  type Message,
  type Tag,
  type User,
  companionRequests,
  eventTags,
  events,
  interests,
  messages,
  profileInterests,
  sessions,
  tags,
  userTags,
  users,
} from "./schema";

// One SQLite file is the app's whole persistent state. In production
// fly.toml points DATABASE_PATH at the machine's volume (/data), which is
// how state survives a reload and a redeploy; locally it defaults to an
// untracked file in .data/.
const path = process.env.DATABASE_PATH ?? "./.data/app.db";
mkdirSync(dirname(path), { recursive: true });

const client = new Database(path);
client.pragma("journal_mode = WAL");

export const db = drizzle(client);

// Migrations run at boot, on whatever machine holds the volume — the
// recommended shape for SQLite on Fly, where there's no separate machine to
// run them from. The flow: edit src/lib/schema.ts, `pnpm db:generate`,
// commit the migration it writes to drizzle/.
migrate(db, { migrationsFolder: "./drizzle" });

export type { Event, Message, Tag, User };

// --- users ---------------------------------------------------------------

export function getUserById(id: string): User | undefined {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export function getUserByEmail(email: string): User | undefined {
  return db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .get();
}

export function createUser(email: string, passwordHash: string, displayName: string): User {
  return db
    .insert(users)
    .values({ id: randomUUID(), email: email.trim().toLowerCase(), passwordHash, displayName })
    .returning()
    .get();
}

export function updateProfile(
  userId: string,
  {
    displayName,
    bio,
    pronouns,
    program,
  }: {
    displayName: string | null;
    bio: string | null;
    pronouns: string | null;
    program: string | null;
  },
): void {
  db.update(users).set({ displayName, bio, pronouns, program }).where(eq(users.id, userId)).run();
}

// --- sessions --------------------------------------------------------------

// One row per signed-in session (see src/middleware.ts) — logging out or
// letting a session expire is just removing/ignoring a row, no stateless
// token to invalidate.
export function createSession(userId: string): { id: string; expiresAt: string } {
  const id = newSessionId();
  const expiresAt = sessionExpiry();
  db.insert(sessions).values({ id, userId, expiresAt }).run();
  return { id, expiresAt };
}

export function getSessionUser(sessionId: string): User | undefined {
  const row = db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId))
    .get();
  if (!row) return undefined;
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    return undefined;
  }
  return row.user;
}

export function deleteSession(sessionId: string): void {
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}

// --- tags ----------------------------------------------------------------

export function listTags(): Tag[] {
  return db.select().from(tags).orderBy(asc(tags.kind), asc(tags.label)).all();
}

export function getUserTagIds(userId: string): number[] {
  return db
    .select({ tagId: userTags.tagId })
    .from(userTags)
    .where(eq(userTags.userId, userId))
    .all()
    .map((row) => row.tagId);
}

export function setUserTags(userId: string, tagIds: number[]): void {
  db.transaction((tx) => {
    tx.delete(userTags).where(eq(userTags.userId, userId)).run();
    for (const tagId of tagIds) {
      tx.insert(userTags).values({ userId, tagId }).run();
    }
  });
}

// --- profile interests -----------------------------------------------------

// A user's own self-described interests, shown on their profile — distinct
// from userTags above (their saved calendar filter): this says who they
// are, that says what they want to see.
export function getProfileInterestTagIds(userId: string): number[] {
  return db
    .select({ tagId: profileInterests.tagId })
    .from(profileInterests)
    .where(eq(profileInterests.userId, userId))
    .all()
    .map((row) => row.tagId);
}

export function getProfileInterestTags(userId: string): Tag[] {
  return db
    .select({ id: tags.id, label: tags.label, kind: tags.kind })
    .from(tags)
    .innerJoin(profileInterests, eq(profileInterests.tagId, tags.id))
    .where(eq(profileInterests.userId, userId))
    .all();
}

export function setProfileInterests(userId: string, tagIds: number[]): void {
  db.transaction((tx) => {
    tx.delete(profileInterests).where(eq(profileInterests.userId, userId)).run();
    for (const tagId of tagIds) {
      tx.insert(profileInterests).values({ userId, tagId }).run();
    }
  });
}

// The single source of truth for "has this person actually filled their
// profile in" — checked at login (see src/middleware.ts) and shown as a
// checklist on the profile page itself.
export function isProfileComplete(userId: string): boolean {
  const user = getUserById(userId);
  if (!user) return false;
  if (!user.displayName?.trim()) return false;
  if (!user.bio?.trim()) return false;
  if (!user.pronouns?.trim()) return false;
  if (!user.program?.trim()) return false;
  return getProfileInterestTagIds(userId).length > 0;
}

// --- events ----------------------------------------------------------------

// No tag filter (or none saved yet) is the "every event, all in one" baseline
// the brief asked for; a filter is what turns that into "my calendar".
export function listEvents(tagIds?: number[]): Event[] {
  if (!tagIds || tagIds.length === 0) {
    return db.select().from(events).orderBy(asc(events.startsAt)).all();
  }
  return db
    .selectDistinct({
      id: events.id,
      title: events.title,
      description: events.description,
      location: events.location,
      category: events.category,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      createdAt: events.createdAt,
    })
    .from(events)
    .innerJoin(eventTags, eq(eventTags.eventId, events.id))
    .where(inArray(eventTags.tagId, tagIds))
    .orderBy(asc(events.startsAt))
    .all();
}

export function getEvent(id: number): Event | undefined {
  return db.select().from(events).where(eq(events.id, id)).get();
}

export function getEventTags(eventId: number): Tag[] {
  return db
    .select({ id: tags.id, label: tags.label, kind: tags.kind })
    .from(tags)
    .innerJoin(eventTags, eq(eventTags.tagId, tags.id))
    .where(eq(eventTags.eventId, eventId))
    .all();
}

// --- interests ---------------------------------------------------------

export function isInterested(userId: string, eventId: number): boolean {
  return !!db
    .select({ userId: interests.userId })
    .from(interests)
    .where(and(eq(interests.userId, userId), eq(interests.eventId, eventId)))
    .get();
}

// Toggling both saves the event to the visitor's own list and makes them
// visible on the event's page to everyone else who's interested.
export function toggleInterest(userId: string, eventId: number): boolean {
  if (isInterested(userId, eventId)) {
    db.delete(interests)
      .where(and(eq(interests.userId, userId), eq(interests.eventId, eventId)))
      .run();
    return false;
  }
  db.insert(interests).values({ userId, eventId }).run();
  return true;
}

// The public shape of an attendee — never the email or password hash,
// whether the caller is browsing anonymously or looking at their own event.
// bio is optional on the type since most callers (companion-request lists)
// don't need it and don't select it — only the discover page does.
export type Attendee = { id: string; displayName: string | null; bio?: string | null };

export function listInterestedUsers(eventId: number): Attendee[] {
  return db
    .select({ id: users.id, displayName: users.displayName, bio: users.bio })
    .from(users)
    .innerJoin(interests, eq(interests.userId, users.id))
    .where(eq(interests.eventId, eventId))
    .orderBy(asc(interests.createdAt))
    .all();
}

// --- companion requests ---------------------------------------------------

// Asking someone to go to a specific event together. Only makes sense when
// both people are already marked as going — that's enforced by the caller
// (the API route), not here, so this stays a plain data-access function.
export function createCompanionRequest(
  eventId: number,
  fromUserId: string,
  toUserId: string,
): CompanionRequest {
  return db.insert(companionRequests).values({ eventId, fromUserId, toUserId }).returning().get();
}

export function getCompanionRequest(
  eventId: number,
  fromUserId: string,
  toUserId: string,
): CompanionRequest | undefined {
  return db
    .select()
    .from(companionRequests)
    .where(
      and(
        eq(companionRequests.eventId, eventId),
        eq(companionRequests.fromUserId, fromUserId),
        eq(companionRequests.toUserId, toUserId),
      ),
    )
    .get();
}

// The two possible directions of an ask read as the same relationship on the
// event page — "you and X are going together" doesn't care who asked whom.
export function getCompanionStatus(
  eventId: number,
  userA: string,
  userB: string,
): CompanionRequest | undefined {
  return (
    getCompanionRequest(eventId, userA, userB) ?? getCompanionRequest(eventId, userB, userA)
  );
}

export function respondToCompanionRequest(
  requestId: number,
  recipientId: string,
  accept: boolean,
): boolean {
  const request = db
    .select()
    .from(companionRequests)
    .where(eq(companionRequests.id, requestId))
    .get();
  if (!request || request.toUserId !== recipientId || request.status !== "pending") return false;
  db.update(companionRequests)
    .set({ status: accept ? "accepted" : "declined", updatedAt: new Date().toISOString() })
    .where(eq(companionRequests.id, requestId))
    .run();
  return true;
}

export function listIncomingRequests(
  userId: string,
): Array<CompanionRequest & { fromUser: Attendee; event: Event }> {
  return db
    .select({
      id: companionRequests.id,
      eventId: companionRequests.eventId,
      fromUserId: companionRequests.fromUserId,
      toUserId: companionRequests.toUserId,
      status: companionRequests.status,
      createdAt: companionRequests.createdAt,
      updatedAt: companionRequests.updatedAt,
      fromUser: { id: users.id, displayName: users.displayName },
      event: events,
    })
    .from(companionRequests)
    .innerJoin(users, eq(users.id, companionRequests.fromUserId))
    .innerJoin(events, eq(events.id, companionRequests.eventId))
    .where(and(eq(companionRequests.toUserId, userId), eq(companionRequests.status, "pending")))
    .orderBy(asc(companionRequests.createdAt))
    .all();
}

export function listOutgoingRequests(
  userId: string,
): Array<CompanionRequest & { toUser: Attendee; event: Event }> {
  return db
    .select({
      id: companionRequests.id,
      eventId: companionRequests.eventId,
      fromUserId: companionRequests.fromUserId,
      toUserId: companionRequests.toUserId,
      status: companionRequests.status,
      createdAt: companionRequests.createdAt,
      updatedAt: companionRequests.updatedAt,
      toUser: { id: users.id, displayName: users.displayName },
      event: events,
    })
    .from(companionRequests)
    .innerJoin(users, eq(users.id, companionRequests.toUserId))
    .innerJoin(events, eq(events.id, companionRequests.eventId))
    .where(eq(companionRequests.fromUserId, userId))
    .orderBy(asc(companionRequests.createdAt))
    .all();
}

// --- chat --------------------------------------------------------------

// An accepted companion request, from one participant's point of view — the
// "other" person and the event they're going to together. This is what
// backs both the chat inbox and the authorization check on a single thread.
export type Match = { request: CompanionRequest; other: Attendee; event: Event };

export function listMatches(userId: string): Match[] {
  const asAsker = db
    .select({
      request: companionRequests,
      other: { id: users.id, displayName: users.displayName },
      event: events,
    })
    .from(companionRequests)
    .innerJoin(users, eq(users.id, companionRequests.toUserId))
    .innerJoin(events, eq(events.id, companionRequests.eventId))
    .where(and(eq(companionRequests.fromUserId, userId), eq(companionRequests.status, "accepted")))
    .all();

  const asRecipient = db
    .select({
      request: companionRequests,
      other: { id: users.id, displayName: users.displayName },
      event: events,
    })
    .from(companionRequests)
    .innerJoin(users, eq(users.id, companionRequests.fromUserId))
    .innerJoin(events, eq(events.id, companionRequests.eventId))
    .where(and(eq(companionRequests.toUserId, userId), eq(companionRequests.status, "accepted")))
    .all();

  return [...asAsker, ...asRecipient].sort((a, b) =>
    b.request.updatedAt.localeCompare(a.request.updatedAt),
  );
}

// The authorization check every chat route relies on: a match only exists
// (from this user's point of view) if the request was accepted and this
// user is one of its two participants.
export function getMatch(requestId: number, userId: string): Match | undefined {
  const request = db
    .select()
    .from(companionRequests)
    .where(eq(companionRequests.id, requestId))
    .get();
  if (!request || request.status !== "accepted") return undefined;
  if (request.fromUserId !== userId && request.toUserId !== userId) return undefined;

  const otherId = request.fromUserId === userId ? request.toUserId : request.fromUserId;
  const other = getUserById(otherId);
  const event = getEvent(request.eventId);
  if (!other || !event) return undefined;

  return { request, other: { id: other.id, displayName: other.displayName }, event };
}

export function listMessages(companionRequestId: number): Message[] {
  return db
    .select()
    .from(messages)
    .where(eq(messages.companionRequestId, companionRequestId))
    .orderBy(asc(messages.createdAt))
    .all();
}

export function sendMessage(companionRequestId: number, senderId: string, body: string): Message {
  const message = db.insert(messages).values({ companionRequestId, senderId, body }).returning().get();
  db.update(companionRequests)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(companionRequests.id, companionRequestId))
    .run();
  return message;
}

const FAKE_REPLIES = [
  "Sounds good, see you there! 🎉",
  "Can't wait — I'll meet you out front.",
  "Yes! Keen for this one.",
  "Awesome, this'll be fun 🙌",
  "Great, let's do it!",
];

// A seeded profile can never log in to type a real reply, so without this a
// "match" leads to a chat thread that just sits silent — the opposite of the
// warm/friendly feel the whole seeded-profiles idea is for. Fires once per
// thread (checked below), not on every message the real user sends.
export function maybeSendFakeReply(companionRequestId: number, otherUserId: string): void {
  const other = getUserById(otherUserId);
  if (!other?.isFake) return;

  const alreadyReplied = db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.companionRequestId, companionRequestId), eq(messages.senderId, otherUserId)))
    .limit(1)
    .all();
  if (alreadyReplied.length > 0) return;

  const reply = FAKE_REPLIES[companionRequestId % FAKE_REPLIES.length];
  sendMessage(companionRequestId, otherUserId, reply);
}

// --- seed ------------------------------------------------------------------

// There's no real ANU events feed and no "create an event" UI, so the
// catalogue is a curated seed of realistic ANU events. Dates are offsets
// from the moment of seeding (not fixed calendar dates) so the catalogue
// still looks like an upcoming week whenever it's viewed.
//
// Both ensureTags() and ensureEvents() below insert only what's missing (by
// label / title) and run on *every* boot, not just once — a plain "seed if
// the table is empty" guard would mean adding a new tag or event to the
// arrays below silently does nothing once a database has already been
// seeded (as production's already has). Existing rows are never touched, so
// this is safe to run on every restart.
const hoursFromNow = (n: number) => new Date(Date.now() + n * 60 * 60 * 1000).toISOString();

const seedTags: Array<{ label: string; kind: "course" | "interest" }> = [
  { label: "COMP4020", kind: "course" },
  { label: "COMP2100", kind: "course" },
  { label: "COMP1730", kind: "course" },
  { label: "Postgrad", kind: "course" },
  { label: "Undergrad", kind: "course" },
  { label: "COMP1100", kind: "course" },
  { label: "COMP2620", kind: "course" },
  { label: "COMP3120", kind: "course" },
  { label: "COMP8420", kind: "course" },
  { label: "Honours", kind: "course" },
  { label: "Sport", kind: "interest" },
  { label: "Music", kind: "interest" },
  { label: "Careers", kind: "interest" },
  { label: "Food", kind: "interest" },
  { label: "Arts", kind: "interest" },
  { label: "Research", kind: "interest" },
  { label: "Social", kind: "interest" },
  { label: "Environment", kind: "interest" },
  { label: "Gaming", kind: "interest" },
  { label: "Photography", kind: "interest" },
  { label: "Outdoors", kind: "interest" },
  { label: "Volunteering", kind: "interest" },
  { label: "Coffee", kind: "interest" },
  { label: "Wellbeing", kind: "interest" },
  { label: "Board Games", kind: "interest" },
  { label: "Dance", kind: "interest" },
];

function ensureTags(): void {
  const existingLabels = new Set(db.select({ label: tags.label }).from(tags).all().map((t) => t.label));
  const missing = seedTags.filter((tag) => !existingLabels.has(tag.label));
  if (missing.length === 0) return;

  db.transaction((tx) => {
    for (const tag of missing) tx.insert(tags).values(tag).run();
  });
}

type SeedEvent = {
  title: string;
  description: string;
  location: string;
  category: string;
  hoursFromNow: number;
  durationHours: number;
  tagLabels: string[];
};

const seedEvents: SeedEvent[] = [
    {
      title: "COMP4020 studio crit",
      description: "Weekly crit session — bring your deployed prototype.",
      location: "Marie Reay Building, Room 4.03",
      category: "college",
      hoursFromNow: 3,
      durationHours: 1.5,
      tagLabels: ["COMP4020", "Postgrad"],
    },
    {
      title: "ANU Coding Society: build night",
      description: "Casual hack night, bring a laptop and a project.",
      location: "Hanna Neumann Building",
      category: "club",
      hoursFromNow: 20,
      durationHours: 3,
      tagLabels: ["COMP1730", "COMP2100", "Undergrad", "Social"],
    },
    {
      title: "Fenner Hall trivia night",
      description: "Weekly trivia, teams of up to six.",
      location: "Fenner Hall dining hall",
      category: "college",
      hoursFromNow: 30,
      durationHours: 2,
      tagLabels: ["Social", "Food"],
    },
    {
      title: "School of Computing research seminar",
      description: "Guest talk on distributed systems, open to all students.",
      location: "CSIT Building, Seminar Room N101",
      category: "research",
      hoursFromNow: 48,
      durationHours: 1,
      tagLabels: ["Research", "COMP4020", "Postgrad"],
    },
    {
      title: "ANU Careers Fair",
      description: "Meet recruiters from government, tech and research.",
      location: "Union Court",
      category: "careers",
      hoursFromNow: 60,
      durationHours: 5,
      tagLabels: ["Careers", "Undergrad", "Postgrad"],
    },
    {
      title: "ANU Basketball social comp",
      description: "Mixed-ability social games, no experience needed.",
      location: "ANU Sport & Fitness Centre",
      category: "sport",
      hoursFromNow: 72,
      durationHours: 2,
      tagLabels: ["Sport", "Social"],
    },
    {
      title: "ANUSA clubs market day",
      description: "Every club and society with a stall, all in one afternoon.",
      location: "Kambri Cultural Centre",
      category: "social",
      hoursFromNow: 96,
      durationHours: 4,
      tagLabels: ["Social", "Arts"],
    },
    {
      title: "COMP2100 assignment help session",
      description: "Drop-in help with the current assignment.",
      location: "Copland Building, Lab 1",
      category: "college",
      hoursFromNow: 100,
      durationHours: 2,
      tagLabels: ["COMP2100", "Undergrad"],
    },
    {
      title: "ANU Photography Society: night shoot",
      description: "Group shoot around campus at night, all skill levels.",
      location: "Kambri, meeting at the fountain",
      category: "club",
      hoursFromNow: 120,
      durationHours: 2,
      tagLabels: ["Arts", "Social"],
    },
    {
      title: "Sustainability working group open meeting",
      description: "Open meeting on campus environmental initiatives.",
      location: "Manning Clark Centre, Room 3",
      category: "college",
      hoursFromNow: 140,
      durationHours: 1.5,
      tagLabels: ["Environment", "Social"],
    },
    {
      title: "COMP4020 final project studio",
      description: "Open studio time for final project work.",
      location: "Marie Reay Building, Room 4.03",
      category: "college",
      hoursFromNow: 168,
      durationHours: 2,
      tagLabels: ["COMP4020", "Postgrad"],
    },
    {
      title: "ANU Choral Society rehearsal",
      description: "Weekly rehearsal, new members welcome.",
      location: "School of Music, Recital Hall",
      category: "club",
      hoursFromNow: 190,
      durationHours: 1.5,
      tagLabels: ["Music", "Arts"],
    },
    {
      title: "Postgrad and Research Students Association mixer",
      description: "Casual drinks and food for postgrad and HDR students.",
      location: "University House",
      category: "social",
      hoursFromNow: 216,
      durationHours: 2,
      tagLabels: ["Postgrad", "Research", "Food", "Social"],
    },
    {
      title: "AI @ ANU seminar series",
      description: "Student and staff talks on current AI research.",
      location: "Hanna Neumann Building, Theatre 1",
      category: "research",
      hoursFromNow: 240,
      durationHours: 1.5,
      tagLabels: ["Research", "COMP4020", "Postgrad"],
    },
    {
      title: "ANU Farmers' Market",
      description: "Local produce stalls on campus.",
      location: "Kambri Cultural Centre",
      category: "social",
      hoursFromNow: 260,
      durationHours: 3,
      tagLabels: ["Food", "Social"],
    },
    {
      title: "ANU Soccer social comp",
      description: "Mixed-ability five-a-side games, no experience needed.",
      location: "ANU Sport & Fitness Centre",
      category: "sport",
      hoursFromNow: 280,
      durationHours: 2,
      tagLabels: ["Sport", "Social"],
    },
    {
      title: "Board game night at Kambri",
      description: "Casual board games and card games, all welcome.",
      location: "Kambri Cultural Centre",
      category: "social",
      hoursFromNow: 300,
      durationHours: 3,
      tagLabels: ["Board Games", "Social"],
    },
    {
      title: "ANUSA Hackathon: build something in 24 hours",
      description: "Team up and ship a project in a weekend, mentors on hand.",
      location: "Hanna Neumann Building",
      category: "club",
      hoursFromNow: 320,
      durationHours: 24,
      tagLabels: ["COMP1100", "COMP2620", "Undergrad", "Postgrad"],
    },
    {
      title: "Sunrise yoga on Sullivans Creek",
      description: "Gentle outdoor yoga session, mats provided.",
      location: "Sullivans Creek, near Kambri",
      category: "sport",
      hoursFromNow: 340,
      durationHours: 1,
      tagLabels: ["Sport", "Wellbeing"],
    },
    {
      title: "Coffee & chat: casual meetup",
      description: "Drop in for coffee and easy conversation, no agenda.",
      location: "Coffee Grounds, Union Court",
      category: "social",
      hoursFromNow: 360,
      durationHours: 1.5,
      tagLabels: ["Coffee", "Social"],
    },
    {
      title: "Campus volunteering working bee",
      description: "Help tidy up campus green spaces, gloves and tools supplied.",
      location: "Sullivans Creek Reserve",
      category: "social",
      hoursFromNow: 380,
      durationHours: 3,
      tagLabels: ["Volunteering", "Environment", "Social"],
    },
    {
      title: "ANU Esports gaming night",
      description: "Casual and competitive gaming, consoles and PCs set up.",
      location: "Kambri, Level 2",
      category: "club",
      hoursFromNow: 400,
      durationHours: 3,
      tagLabels: ["Gaming", "Social"],
    },
    {
      title: "Sunset hike: Black Mountain trail",
      description: "Group hike up Black Mountain, back in time for sunset.",
      location: "Meet at Black Mountain car park",
      category: "social",
      hoursFromNow: 420,
      durationHours: 2.5,
      tagLabels: ["Outdoors", "Sport", "Social"],
    },
    {
      title: "International food festival",
      description: "Student clubs cook up dishes from home, all proceeds to charity.",
      location: "Union Court",
      category: "social",
      hoursFromNow: 440,
      durationHours: 4,
      tagLabels: ["Food", "Social"],
    },
    {
      title: "Open mic night at Molly's",
      description: "Sign up on the night, any instrument or none at all.",
      location: "Molly's, Lonsdale Street",
      category: "club",
      hoursFromNow: 460,
      durationHours: 2,
      tagLabels: ["Music", "Arts", "Social"],
    },
  ];

function ensureEvents(): void {
  const existingTitles = new Set(db.select({ title: events.title }).from(events).all().map((e) => e.title));
  const missing = seedEvents.filter((event) => !existingTitles.has(event.title));
  if (missing.length === 0) return;

  db.transaction((tx) => {
    const tagIdByLabel = new Map(tx.select({ id: tags.id, label: tags.label }).from(tags).all().map((t) => [t.label, t.id]));

    for (const seedEvent of missing) {
      const row = tx
        .insert(events)
        .values({
          title: seedEvent.title,
          description: seedEvent.description,
          location: seedEvent.location,
          category: seedEvent.category,
          startsAt: hoursFromNow(seedEvent.hoursFromNow),
          endsAt: hoursFromNow(seedEvent.hoursFromNow + seedEvent.durationHours),
        })
        .returning()
        .get();
      for (const label of seedEvent.tagLabels) {
        const tagId = tagIdByLabel.get(label);
        if (tagId) tx.insert(eventTags).values({ eventId: row.id, tagId }).run();
      }
    }
  });
}

// Companion profiles nobody can log in as (no email/password), so the
// social features have visible activity from the start instead of an empty
// "nobody's going yet" everywhere. Gated on its own guard (isFake users, not
// events) — the events table is seeded separately by ensureEvents(), so
// tying this to that guard would mean it never runs on an already-seeded
// deploy.
function seedFakeProfilesIfEmpty(): void {
  const existing = db.select({ id: users.id }).from(users).where(eq(users.isFake, true)).limit(1).all();
  if (existing.length > 0) return;

  const fakeProfiles: Array<{ displayName: string; bio: string }> = [
    { displayName: "Priya Nair", bio: "Second-year CS, always up for trivia." },
    { displayName: "Jack Sullivan", bio: "Postgrad in engineering, into pickup basketball." },
    { displayName: "Mei Chen", bio: "Loves photography and finding new coffee spots on campus." },
    { displayName: "Liam O'Connor", bio: "Studying law, plays in a covers band on weekends." },
    { displayName: "Amara Okafor", bio: "PhD student, will talk your ear off about AI research." },
    { displayName: "Noah Fitzgerald", bio: "First-year, still figuring out which clubs to join." },
    { displayName: "Sana Malik", bio: "Runs the odd 5k, always keen for a social sport." },
    { displayName: "Tom Bennett", bio: "Music student, rehearses more than he sleeps." },
    { displayName: "Isla Robertson", bio: "Environmental science, into the sustainability group." },
    { displayName: "Ravi Kapoor", bio: "Career-fair regular, job-hunting and networking." },
    { displayName: "Chloe Ahmed", bio: "Undergrad, mostly here for the free food at events." },
    { displayName: "Ethan Walsh", bio: "Building a startup idea, always looking for collaborators." },
    { displayName: "Grace Thompson", bio: "Choir member, happy to chat about anything music." },
    { displayName: "Zara Hussain", bio: "Research assistant, loves a good seminar." },
    { displayName: "Oliver Ward", bio: "Into board games and building-night hackathons." },
    { displayName: "Freya Mitchell", bio: "New to Canberra, trying to meet people through events." },
  ];

  db.transaction((tx) => {
    const seededUsers = fakeProfiles.map((profile) =>
      tx
        .insert(users)
        .values({ id: randomUUID(), displayName: profile.displayName, bio: profile.bio, isFake: true })
        .returning()
        .get(),
    );

    const allEvents = tx.select({ id: events.id }).from(events).all();

    seededUsers.forEach((seededUser, userIdx) => {
      allEvents.forEach((event, eventIdx) => {
        // Roughly two out of every three events, deterministic per profile —
        // enough that most events have a handful of fake attendees already.
        if ((userIdx + eventIdx) % 3 !== 0) {
          tx.insert(interests).values({ userId: seededUser.id, eventId: event.id }).run();
        }
      });
    });
  });
}

const FAKE_PRONOUNS = ["she/her", "he/him", "they/them"];

const FAKE_PROGRAMS = [
  "2nd-year Computer Science",
  "Postgrad, Engineering",
  "3rd-year Fine Arts",
  "Law student",
  "PhD, Artificial Intelligence",
  "1st-year, undecided major",
  "2nd-year Health Science",
  "Bachelor of Music",
  "3rd-year Environmental Science",
  "Postgrad, Business",
  "1st-year Arts",
  "3rd-year Computer Science",
  "Bachelor of Music",
  "Research Assistant, School of Computing",
  "2nd-year Computer Science",
  "1st-year, exchange student",
];

const FAKE_INTEREST_LABELS: string[][] = [
  ["Social", "Research"],
  ["Sport", "Careers"],
  ["Photography", "Coffee"],
  ["Music", "Social"],
  ["Research", "Careers"],
  ["Social", "Gaming"],
  ["Sport", "Wellbeing"],
  ["Music", "Arts"],
  ["Environment", "Volunteering"],
  ["Careers", "Social"],
  ["Food", "Social"],
  ["Careers", "Gaming"],
  ["Music", "Arts"],
  ["Research", "Coffee"],
  ["Board Games", "Gaming"],
  ["Social", "Coffee"],
];

// Backfills pronouns/program/interest-tags for any isFake user missing them
// — runs on every boot, same idempotent shape as ensureTags/ensureEvents, so
// it also completes the fake profiles already sitting on a deployed
// database rather than only ones seeded fresh going forward.
function ensureFakeProfileDetails(): void {
  const fakeUsers = db
    .select()
    .from(users)
    .where(eq(users.isFake, true))
    .orderBy(asc(users.createdAt))
    .all();
  if (fakeUsers.length === 0) return;

  const tagIdByLabel = new Map(db.select({ id: tags.id, label: tags.label }).from(tags).all().map((t) => [t.label, t.id]));

  db.transaction((tx) => {
    fakeUsers.forEach((user, idx) => {
      if (!user.pronouns?.trim() || !user.program?.trim()) {
        tx.update(users)
          .set({
            pronouns: user.pronouns?.trim() || FAKE_PRONOUNS[idx % FAKE_PRONOUNS.length],
            program: user.program?.trim() || FAKE_PROGRAMS[idx % FAKE_PROGRAMS.length],
          })
          .where(eq(users.id, user.id))
          .run();
      }

      const hasInterests = tx
        .select({ tagId: profileInterests.tagId })
        .from(profileInterests)
        .where(eq(profileInterests.userId, user.id))
        .limit(1)
        .all();
      if (hasInterests.length === 0) {
        const labels = FAKE_INTEREST_LABELS[idx % FAKE_INTEREST_LABELS.length];
        for (const label of labels) {
          const tagId = tagIdByLabel.get(label);
          if (tagId) tx.insert(profileInterests).values({ userId: user.id, tagId }).run();
        }
      }
    });
  });
}

// Runs once every boot, after every function above it is defined (const seed
// data is not hoisted, unlike the functions themselves) — see each
// function's own comment for why this is safe to run unconditionally.
ensureTags();
ensureEvents();
seedFakeProfilesIfEmpty();
ensureFakeProfileDetails();
