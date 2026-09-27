import type { APIRoute } from "astro";
import { setProfileInterests, updateProfile } from "../../lib/db";
import { parseTagIds } from "../../lib/tags";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (!locals.user) return redirect("/login", 303);

  const form = await request.formData();
  const displayName = String(form.get("displayName") ?? "").trim().slice(0, 60) || null;
  const bio = String(form.get("bio") ?? "").trim().slice(0, 500) || null;
  const pronouns = String(form.get("pronouns") ?? "").trim().slice(0, 30) || null;
  const program = String(form.get("program") ?? "").trim().slice(0, 80) || null;
  const tagIds = parseTagIds(form.getAll("tags").map(String));

  updateProfile(locals.user.id, { displayName, bio, pronouns, program });
  setProfileInterests(locals.user.id, tagIds);

  return redirect("/profile", 303);
};
