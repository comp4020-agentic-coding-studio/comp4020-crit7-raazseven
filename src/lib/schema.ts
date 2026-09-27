import { sql } from "drizzle-orm";
import { int, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// The schema is the ground truth for the database. To change it: edit here,
// run `pnpm db:generate` to turn the diff into a migration under drizzle/,
// and commit both — the migration applies automatically when the server
// boots (see src/lib/db.ts), locally and deployed. Never edit the database
// by hand: state on the deployed volume outlives every deploy, and the
// migration trail is what keeps old state and new code compatible.

// A visitor is a real account now — email + password back the login session
// (see src/lib/auth.ts, src/middleware.ts). email/passwordHash stay nullable
// at the schema level so a migration never fails against existing rows;
// application code enforces both being set for anyone who can log in.
export const users = sqliteTable("users", {
  id: text().primaryKey(),
  email: text().unique(),
  passwordHash: text("password_hash"),
  displayName: text("display_name"),
  bio: text(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Backs the login cookie (see src/middleware.ts) — one row per signed-in
// session, so logging out (or expiry) is just deleting/ignoring a row rather
// than needing to invalidate anything stateless.
export const sessions = sqliteTable("sessions", {
  id: text().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  expiresAt: text("expires_at").notNull(),
});

// Two kinds share one table because they're the same shape and are picked
// from the same checkbox list — "kind" only changes which heading they sit
// under on the calendar page.
export const tags = sqliteTable("tags", {
  id: int().primaryKey({ autoIncrement: true }),
  label: text().notNull().unique(),
  kind: text().notNull(), // 'course' | 'interest'
});

// The event catalogue is seeded once (src/lib/db.ts) — there's no real ANU
// events feed to pull from, and no "create an event" UI, so this is the
// closest thing to ground truth the prototype has.
export const events = sqliteTable("events", {
  id: int().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  description: text().notNull(),
  location: text().notNull(),
  category: text().notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const eventTags = sqliteTable(
  "event_tags",
  {
    eventId: int("event_id")
      .notNull()
      .references(() => events.id),
    tagId: int("tag_id")
      .notNull()
      .references(() => tags.id),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.tagId] })],
);

// A visitor's saved filter — "my calendar" is just the set of tags whose
// events show by default on "/" once saved.
export const userTags = sqliteTable(
  "user_tags",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    tagId: int("tag_id")
      .notNull()
      .references(() => tags.id),
  },
  (table) => [primaryKey({ columns: [table.userId, table.tagId] })],
);

// "I'm going" — both adds the event to the visitor's own list and makes them
// visible to other attendees on that event's page, so people can find each
// other and ask to go together (see companionRequests below).
export const interests = sqliteTable(
  "interests",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    eventId: int("event_id")
      .notNull()
      .references(() => events.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [primaryKey({ columns: [table.userId, table.eventId] })],
);

// One user asking another to go to an event together. Scoped to a single
// event (not a general friend request) because "going to the same thing" is
// the whole point of the ask — accepting doesn't mean anything outside that
// event. The unique index stops the same ask being sent twice.
export const companionRequests = sqliteTable(
  "companion_requests",
  {
    id: int().primaryKey({ autoIncrement: true }),
    eventId: int("event_id")
      .notNull()
      .references(() => events.id),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => users.id),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => users.id),
    status: text().notNull().default("pending"), // 'pending' | 'accepted' | 'declined'
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("companion_requests_unique_ask").on(
      table.eventId,
      table.fromUserId,
      table.toUserId,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Event = typeof events.$inferSelect;
export type CompanionRequest = typeof companionRequests.$inferSelect;
