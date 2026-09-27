import type { APIRoute } from "astro";
import { verifyPassword } from "../../../lib/auth";
import { createSession, getUserByEmail } from "../../../lib/db";
import { setSessionCookie } from "../../../middleware";

export const POST: APIRoute = async (context) => {
  const { request, redirect } = context;
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  const user = getUserByEmail(email);
  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return redirect(`/login?error=invalid-credentials&email=${encodeURIComponent(email)}`, 303);
  }

  const session = createSession(user.id);
  setSessionCookie(context, session.id);

  return redirect("/", 303);
};
