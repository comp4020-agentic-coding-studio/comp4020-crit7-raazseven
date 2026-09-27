import type { APIRoute } from "astro";
import {
  createCompanionRequest,
  getCompanionStatus,
  getEvent,
  isInterested,
} from "../../../../lib/db";

// Asking someone to go together only makes sense when you're both already
// going to the same event, and only once per pair per event.
export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
  if (!locals.user) return redirect("/login", 303);

  const eventId = Number.parseInt(params.id ?? "", 10);
  const event = Number.isInteger(eventId) ? getEvent(eventId) : undefined;
  const form = await request.formData();
  const toUserId = String(form.get("toUserId") ?? "");

  if (
    event &&
    toUserId &&
    toUserId !== locals.user.id &&
    isInterested(locals.user.id, event.id) &&
    isInterested(toUserId, event.id) &&
    !getCompanionStatus(event.id, locals.user.id, toUserId)
  ) {
    createCompanionRequest(event.id, locals.user.id, toUserId);
  }

  return redirect(`/events/${params.id}`, 303);
};
