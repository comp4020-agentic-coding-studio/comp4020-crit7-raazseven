import type { APIRoute } from "astro";
import { setUserTags } from "../../lib/db";
import { parseTagIds } from "../../lib/tags";

// Saving your filter as "my calendar": replace the visitor's saved tags with
// whatever was submitted. The redirect makes "/" read the saved calendar
// back on the very next request — no client-side JS involved.
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (!locals.user) return redirect("/login", 303);

  const form = await request.formData();
  const tagIds = parseTagIds(form.getAll("tags").map(String));
  setUserTags(locals.user.id, tagIds);

  return redirect("/", 303);
};
