// Illustrated, deterministic-per-id avatars — not real photos of real
// people. That matters most for the seeded fake profiles (see
// seedFakeProfilesIfEmpty in src/lib/db.ts): using scraped photos of real
// strangers as fake dating-style profile pictures would be an impersonation
// problem, so every profile (real or fake) gets a generated illustration
// keyed off their user id instead.
export function avatarUrl(userId: string): string {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(userId)}`;
}

// Decorative cover photo for an event card — keyed off the event id so it's
// stable across renders. Purely atmospheric (the title next to it already
// says what the event is), so it's rendered with alt="" everywhere.
export function eventCoverUrl(eventId: number): string {
  return `https://picsum.photos/seed/event-${eventId}/640/360`;
}

export function nameOf(displayName: string | null | undefined): string {
  return displayName?.trim() || "Someone without a name yet";
}
