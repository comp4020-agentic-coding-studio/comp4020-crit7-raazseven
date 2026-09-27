import type { APIRoute } from "astro";
import { deleteSession } from "../../../lib/db";
import { COOKIE } from "../../../middleware";

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const sid = cookies.get(COOKIE)?.value;
  if (sid) deleteSession(sid);
  cookies.delete(COOKIE, { path: "/" });
  return redirect("/", 303);
};
