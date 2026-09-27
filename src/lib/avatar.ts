// A display name is optional at the schema level (old rows, or a blank
// profile) but everyone rendering an avatar needs *something* to show.
export function initials(displayName: string | null | undefined): string {
  const trimmed = displayName?.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0];
  return letters.toUpperCase();
}

export function nameOf(displayName: string | null | undefined): string {
  return displayName?.trim() || "Someone without a name yet";
}
