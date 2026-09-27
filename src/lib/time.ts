const SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

// The stand-in for a push/email reminder this week: anything starting within
// the next 24h gets a visible badge wherever it's listed.
export function isStartingSoon(startsAtIso: string): boolean {
  const diff = new Date(startsAtIso).getTime() - Date.now();
  return diff >= 0 && diff <= SOON_WINDOW_MS;
}

export function formatWhen(startsAtIso: string): string {
  return new Date(startsAtIso).toLocaleString("en-AU", {
    timeZone: "Australia/Canberra",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
