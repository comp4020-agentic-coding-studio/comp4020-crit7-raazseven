import { expect, inject } from "vitest";

// Drives the running app over HTTP, one simulated visitor (cookie jar) per
// test actor — mirrors how a real browser would behave, since Astro tracks
// "current visitor" purely through the session cookie the middleware reads.
// Shared by every spec file so tests across features all exercise the same
// real, built server and the same shared sqlite database.
export const baseUrl = inject("baseUrl");

let counter = 0;
export function uniqueEmail(): string {
  counter += 1;
  return `visitor-${Date.now()}-${counter}@example.com`;
}

type SignupFields = Partial<{
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
}>;

export class Visitor {
  private cookie?: string;
  readonly email = uniqueEmail();

  // Exposed so a test can prove a stale/old session cookie stops working
  // after logout, instead of only ever replaying whatever this jar holds now.
  get sessionCookie(): string | undefined {
    return this.cookie;
  }

  async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.cookie) headers.set("cookie", this.cookie);
    // Astro checks form POSTs carry a same-origin Origin header (CSRF
    // protection); a real browser sends it automatically, fetch doesn't.
    if (init.method === "POST") headers.set("origin", baseUrl);
    const res = await fetch(new URL(path, baseUrl), { ...init, headers, redirect: "manual" });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    return res;
  }

  post(path: string, body: URLSearchParams = new URLSearchParams()): Promise<Response> {
    return this.fetch(path, { method: "POST", body });
  }

  async get(path: string): Promise<string> {
    const res = await this.fetch(path);
    return res.text();
  }

  // Raw form post to signup, with no assertions — lets a test drive each
  // validation failure branch instead of only the happy path.
  signupRaw(fields: SignupFields = {}): Promise<Response> {
    const password = fields.password ?? "correct-horse";
    return this.post(
      "/api/auth/signup",
      new URLSearchParams({
        displayName: fields.displayName ?? "Test Visitor",
        email: fields.email ?? this.email,
        password,
        confirmPassword: fields.confirmPassword ?? password,
      }),
    );
  }

  async signup(displayName: string): Promise<void> {
    const res = await this.signupRaw({ displayName });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
  }
}
