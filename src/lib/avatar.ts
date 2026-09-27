// Illustrated, deterministic-per-id avatars — not real photos of real
// people. That matters most for the seeded fake profiles (see
// seedFakeProfilesIfEmpty in src/lib/db.ts): using scraped photos of real
// strangers as fake dating-style profile pictures would be an impersonation
// problem, so every profile (real or fake) gets a generated illustration
// keyed off their user id instead.
export function avatarUrl(userId: string): string {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(userId)}`;
}

function unsplash(id: string): string {
  return `https://images.unsplash.com/photo-${id}?w=640&h=360&fit=crop&auto=format`;
}

// Keyword → real photo of that actual activity, checked against the
// lowercased event title before falling back to a category default. Longer,
// more specific keywords are listed first so e.g. "basketball" wins over a
// more generic "sport" match.
const KEYWORD_PHOTOS: Array<{ keywords: string[]; photoId: string }> = [
  { keywords: ["basketball"], photoId: "1519861531473-9200262188bf" },
  { keywords: ["soccer"], photoId: "1579952363873-27f3bade9f55" },
  { keywords: ["yoga", "sunrise"], photoId: "1544367567-0f2fcb009e0b" },
  { keywords: ["hackathon", "coding", "build night", "hack night"], photoId: "1517694712202-14dd9538aa97" },
  { keywords: ["board game", "trivia"], photoId: "1610890716171-6b1bb98ffd09" },
  { keywords: ["hike", "hiking", "mountain", "trail"], photoId: "1551632811-561732d1e306" },
  { keywords: ["choir", "open mic", "music", "rehearsal"], photoId: "1493225457124-a3eb161ffa5f" },
  { keywords: ["farmers", "market", "food festival"], photoId: "1488459716781-31db52582fe9" },
  { keywords: ["careers fair", "careers"], photoId: "1521737604893-d14cc237f11d" },
  { keywords: ["photography", "photo society", "night shoot"], photoId: "1502920917128-1aa500764cbd" },
  { keywords: ["gaming", "esports"], photoId: "1542751371-adc38448a05e" },
  { keywords: ["sustainability", "environment", "working bee"], photoId: "1542601906990-b4d3fb778b09" },
  { keywords: ["coffee"], photoId: "1495474472287-4d71bcdd2085" },
  { keywords: ["volunteer"], photoId: "1559027615-cd4628902d4a" },
  { keywords: ["dance"], photoId: "1508700115892-45ecd05ae2ad" },
];

// One curated photo per category, used whenever a title doesn't hit a more
// specific keyword above.
const CATEGORY_PHOTOS: Record<string, string> = {
  college: "1523240795612-9a054b0db644",
  club: "1511578314322-379afb476865",
  research: "1532094349884-543bc11b234d",
  careers: "1521737604893-d14cc237f11d",
  sport: "1461896836934-ffe607ba8211",
  social: "1543269865-cbf427effbad",
};

// Cover photo for an event card, matched to what the event actually is
// rather than a random per-id placeholder — a basketball event gets a real
// basketball photo, a food event gets a real food photo, and so on. Falls
// back to a category default, then (for a category this app has never
// seen) to the old picsum-by-id placeholder so this never returns nothing.
export function eventCoverUrl(event: { id: number; title: string; category: string }): string {
  const title = event.title.toLowerCase();
  const keywordMatch = KEYWORD_PHOTOS.find(({ keywords }) => keywords.some((k) => title.includes(k)));
  if (keywordMatch) return unsplash(keywordMatch.photoId);

  const categoryPhotoId = CATEGORY_PHOTOS[event.category];
  if (categoryPhotoId) return unsplash(categoryPhotoId);

  return `https://picsum.photos/seed/event-${event.id}/640/360`;
}

export function nameOf(displayName: string | null | undefined): string {
  return displayName?.trim() || "Someone without a name yet";
}

const CATEGORY_BADGES: Record<string, { label: string; className: string }> = {
  college: { label: "🎓 College", className: "badge-category-college" },
  club: { label: "🎉 Club", className: "badge-category-club" },
  research: { label: "🔬 Research", className: "badge-category-research" },
  careers: { label: "💼 Careers", className: "badge-category-careers" },
  sport: { label: "🏀 Sport", className: "badge-category-sport" },
  social: { label: "✨ Social", className: "badge-category-social" },
};

// A small, colourful visual cue for an event's category — shown alongside
// the plain-text tag list rather than replacing it.
export function categoryBadge(category: string): { label: string; className: string } {
  return CATEGORY_BADGES[category] ?? { label: category, className: "badge-muted" };
}
