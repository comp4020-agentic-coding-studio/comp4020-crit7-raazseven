import type { APIRoute } from "astro";
import {
  createCompanionRequest,
  getCompanionStatus,
  getEvent,
  getUserById,
  isInterested,
  respondToCompanionRequest,
} from "../../../../lib/db";

// Asking someone to go together only makes sense when you're both already
// going to the same event, and only once per pair per event.
export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
  if (!locals.user) return redirect("/login", 303);

  const eventId = Number.parseInt(params.id ?? "", 10);
  const event = Number.isInteger(eventId) ? getEvent(eventId) : undefined;
  const form = await request.formData();
  const toUserId = String(form.get("toUserId") ?? "");
  const toUser = toUserId ? getUserById(toUserId) : undefined;

  if (
    event &&
    toUser &&
    toUserId !== locals.user.id &&
    isInterested(locals.user.id, event.id) &&
    isInterested(toUserId, event.id) &&
    !getCompanionStatus(event.id, locals.user.id, toUserId)
  ) {
    const request = createCompanionRequest(event.id, locals.user.id, toUserId);
    // A fake profile can never log in to accept the ask themselves, so it
    // resolves immediately — a "match", not a request left pending forever.
    if (toUser.isFake) respondToCompanionRequest(request.id, toUserId, true);
  }

  return redirect(`/events/${params.id}`, 303);
};
