import type { APIRoute } from "astro";
import { getMatch, maybeSendFakeReply, sendMessage } from "../../../../lib/db";

export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
  if (!locals.user) return redirect("/login", 303);

  const id = Number.parseInt(params.id ?? "", 10);
  const match = Number.isInteger(id) ? getMatch(id, locals.user.id) : undefined;
  const form = await request.formData();
  const body = String(form.get("body") ?? "").trim();

  if (match && body) {
    sendMessage(match.request.id, locals.user.id, body);
    maybeSendFakeReply(match.request.id, match.other.id);
  }

  return redirect(`/chat/${params.id}`, 303);
};
