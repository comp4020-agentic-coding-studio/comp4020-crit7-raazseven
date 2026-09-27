import type { APIRoute } from "astro";
import { hashPassword } from "../../../lib/auth";
import { createSession, createUser, getUserByEmail } from "../../../lib/db";
import { setSessionCookie } from "../../../middleware";

const MIN_PASSWORD_LENGTH = 8;

export const POST: APIRoute = async (context) => {
  const { request, redirect } = context;
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const confirmPassword = String(form.get("confirmPassword") ?? "");
  const displayName = String(form.get("displayName") ?? "").trim().slice(0, 60);

  const fail = (error: string) =>
    redirect(`/signup?error=${error}&email=${encodeURIComponent(email)}`, 303);

  if (!email.includes("@") || !displayName) return fail("missing");
  if (password.length < MIN_PASSWORD_LENGTH) return fail("weak-password");
  if (password !== confirmPassword) return fail("mismatch");
  if (getUserByEmail(email)) return fail("email-taken");

  const user = createUser(email, hashPassword(password), displayName);
  const session = createSession(user.id);
  setSessionCookie(context, session.id);

  return redirect("/", 303);
};
