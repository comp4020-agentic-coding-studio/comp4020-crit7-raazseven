import type { APIRoute } from "astro";
import { updateProfile } from "../../lib/db";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (!locals.user) return redirect("/login", 303);

  const form = await request.formData();
  const displayName = String(form.get("displayName") ?? "").trim().slice(0, 60) || null;
  const bio = String(form.get("bio") ?? "").trim().slice(0, 500) || null;

  updateProfile(locals.user.id, { displayName, bio });

  return redirect("/profile", 303);
};
