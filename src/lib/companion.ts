import { getCompanionStatus } from "./db";
import type { User } from "./schema";

// For a given other attendee, what an "ask to go together" action should
// show right now — shared between the plain attendee list
// (src/pages/events/[id].astro) and the swipe/discover page
// (src/pages/events/[id]/discover.astro) so the two stay in sync.
export type CompanionView = {
  label: string;
  kind: "ask" | "sent" | "reply" | "together" | "none";
  requestId?: number;
};

export function companionView(
  user: User | null,
  eventId: number,
  attendeeId: string,
): CompanionView {
  if (!user) return { label: "", kind: "none" };
  const request = getCompanionStatus(eventId, user.id, attendeeId);
  if (!request) return { label: "Ask to go together", kind: "ask" };
  if (request.status === "accepted") {
    return { label: "🎉 Going together", kind: "together", requestId: request.id };
  }
  if (request.status === "declined") return { label: "", kind: "none" };
  // pending
  if (request.fromUserId === user.id) return { label: "Request sent", kind: "sent" };
  return { label: "They asked you — reply in Requests", kind: "reply" };
}
