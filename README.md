# Going Together

An ANU events tool that's about who you go with, not just what's on. Every
event ANU has running shows up here — filter it to your course or interests
— but the point isn't the listing, ANU already has that
(anu.edu.au/events/calendar) and it does the job fine. The point is: sign up,
mark yourself as going to an event, see who else is going, and ask a specific
person to go with you. They accept or decline; if they accept, you both see
you're going together. It's a companion-finder layered on top of a
calendar, not a calendar.

## What good looks like here

Browsing stays open to anyone — you can look at every event and filter by
tag without an account, because there's no reason to gate information that
was never private. An account is only required the moment something becomes
social: marking yourself as going, seeing an attendee's profile, or asking
someone to go together. That split is a judgement call, not something a test
enforces, but it's also what keeps `spec/invariants.test.ts` — the shipped
check that `/` and `/events/1` return 200 for an anonymous visitor — green
without a workaround.

A few things I decided deliberately:

- **Asks are scoped to a shared event, not a general friend system.** You can
  only ask someone to go together if you're both already marked as going to
  that specific event. There's no browsing a directory of everyone on the
  site and no messaging that isn't tied to an event — the whole point is
  "let's go to *this* together," not a general social network bolted onto a
  calendar.
- **A public attendee's profile only ever shows a display name, a bio, and a
  join date.** Email and password never leave the server side of the app,
  even in the data structures that build the "who's going" list — there's a
  narrower `Attendee` type specifically so a future change to that list can't
  accidentally start selecting a sensitive column.
- **An ask can be declined quietly.** A declined request just stops showing
  up as a pending ask; it doesn't notify or nag the person who sent it. Not
  every social interaction online needs a receipt.
- **Login is by email, unverified.** There's no mail sender in this project,
  so email is just a unique login key here, not proof of identity — fine for
  a prototype, not something I'd ship past this course as-is.

What's enforced rather than a judgement call: the shipped
`spec/invariants.test.ts` (accessibility landmarks, one `<h1>`, alt text,
axe) and the project's own `spec/calendar.test.ts`, which exercises the real
end-to-end flow this app is about — signing up, marking yourself going,
and two people finding each other and agreeing to go together.
