import type { APIRoute } from "astro";
import { respondToCompanionRequest } from "../../../../lib/db";

export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
  if (!locals.user) return redirect("/login", 303);

  const id = Number.parseInt(params.id ?? "", 10);
  const form = await request.formData();
  const accept = form.get("action") === "accept";

  if (Number.isInteger(id)) {
    respondToCompanionRequest(id, locals.user.id, accept);
  }

  return redirect("/requests", 303);
};
