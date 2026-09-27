import type { APIRoute } from "astro";
import { getEvent, toggleInterest } from "../../../../lib/db";

// Toggling "going" both saves the event to the visitor's own list and makes
// them visible to everyone else going, so people can ask each other along.
export const POST: APIRoute = async ({ params, locals, redirect }) => {
  if (!locals.user) return redirect(`/login`, 303);

  const id = Number.parseInt(params.id ?? "", 10);
  const event = Number.isInteger(id) ? getEvent(id) : undefined;
  if (event) {
    toggleInterest(locals.user.id, event.id);
  }
  return redirect(`/events/${params.id}`, 303);
};
