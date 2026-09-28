# Process overview

Written by you, for a reader: how you got from the brief to the harness and
agentic workflow behind this submission. Markers read this file and follow its
citations; they don't trawl the repo for evidence you didn't point at.

This file is the shape; the course site's
[assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
is the requirement, and its
[word counts](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#word-counts)
cover every deliverable.

## What I built

An ANU events tool that's about who you go with, not just what's on: sign up,
build a complete profile (pronouns, program, bio, interest tags), browse a
catalogue of events across a dozen categories with photos that actually match
what the event is, mark yourself as going, see who else is going, ask a
specific attendee to go together (or swipe through seeded "already going"
profiles the same way), and chat once you've matched. `README.md` has the full
account of what the app is and what good means here.

## How I got here

The starter I settled onto was a plain anonymous ANU events calendar — browse,
filter by tag, mark "interested," see who else was. Before building on it I
checked it against the real thing it was modelling
(`https://www.anu.edu.au/events/calendar`) and it did exactly the same job: a
read-only listing. That's not a slice of a system worth shipping, it's a
worse mirror of one that already exists.

> i juxt searhced anu websute https://www.anu.edu.au/events/calendar and it
> does exact same thing as our current website . so make it ore realted to
> meeting new people to go tot eh evnt with so it should have a login and
> sign up and you should be able to mark as going to event and see who
> others are going and be able to ask to them if they are gping , like make
> everyone has a profile and according to profile you can ask people who are
> goignt o the event accompany you.

That reframed the slice: not "what events exist" but "who's going, and can I
go with them." That needs real identity (an anonymous cookie can't carry a
standing relationship between two people), so the schema grew a real accounts
table (email + password, sessions) and a new `companion_requests` table —
one user asking another to go to a specific event together, `pending` /
`accepted` / `declined`, scoped per event rather than a general friends
system. Browsing stayed open to anonymous visitors; only the social actions
(going, attendee profiles, asking to go together) sit behind login, so the
shipped anonymous-access invariants test keeps passing.

> continue with above prompt also make sure use astro stack or something
> better stack so the website look beautiful

I kept the course-fixed stack (Astro SSR, Drizzle, SQLite, Fly) — that
infrastructure isn't mine to swap — and added Tailwind CSS for the visual
pass instead of migrating anything.

Grounding this against the shipped spec test (`spec/invariants.test.ts`) is
what caught two real mistakes rather than take my own word for it: an axe
`heading-order` violation from an `<h3>` I'd put on event cards with no `<h2>`
in between (fixed by making it a styled paragraph, not a heading — it wasn't
semantically a heading in the first place), and a companion-request test that
failed for a non-obvious reason — an earlier test had left a *different* Bob
still marked "going" to the same event, so my new test's "first attendee link
on the page" grabbed the wrong user's id. The fix was giving that test its
own event rather than sharing state with an earlier one. Both are visible in
the same commit as the feature, since I ran `pnpm check` (typecheck + build +
the full spec suite) before considering it done rather than after.

[`220c839`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-raazseven/commit/220c839)
is the whole pivot: schema, auth, profiles, going/companion-request flow, nav,
and the Tailwind restyle.

The pivot made the *mechanism* work — you could ask someone to go together —
but the app still looked and felt like a form, and cold-starting a social app
with zero other users on it means there's never anyone to actually ask.

> Other few things to maek note of make the site responsive as in includes
> breakpoints so everything looks good. Also add some pictures of AI gen or
> from the internet as it should look more like firend building we site make
> it feel welcoming and friendly. You could also add some fake profiles
> present like 10 to 20 fake profiles which are already intrested in going
> for ost of the even and you could either right of left swipe them like a
> dating pp to go to the event.

That became real Tailwind breakpoints instead of a single fixed layout,
DiceBear-illustrated avatars and Picsum event cover photos in place of blank
placeholders, ~16 seeded "companion" profiles pre-marked as going to most
events so a brand-new visitor always has someone to find, and a
`/events/[id]/discover` swipe page (left/right, dating-app style) for asking
one of them to go together instead of hunting through a plain attendee list.
Shipped as
[`cfd17ad`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-raazseven/commit/cfd17ad).

> all the photos are rnadomly assigned i wante dthe right images for right
> events but dont worry about the events i want the site in general to look
> more welocming as having background picture if wesite as firends hanging
> out together and have a dedicated chat with friends who you asked

I split this: the "right photo for the right event" half needed a real
keyword-matching lookup, which was a bigger job than the rest, so I deferred
it (see `df3cf3d` below) and shipped the parts that stood on their own — a
welcoming homepage hero photo of friends together, and a real `/chat/[id]`
thread once two people are "going together," instead of the ask/accept flow
being the end of the interaction. Shipped as
[`f8852e6`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-raazseven/commit/f8852e6).

> deo all the feature work like chat and are those in the datbase create
> automated test to test all the feature sand tst them out thorughly

By this point the feature surface (auth, profile edits, going/companion-
request/chat, seeded-profile matching) was ahead of its test coverage, so this
pass was pure hardening: a shared `spec/visitor.ts` `Visitor` helper (one
cookie-jar actor per test, mirroring a real browser) extracted out of the
calendar spec so every subsequent test file could drive the same running
server the same way, plus new coverage for auth edge cases, profile
persistence (including that a second, unrelated visitor really does see the
saved changes — not just session state), and companion-request/chat paths
against both real users and seeded fake profiles. Shipped as
[`a525f00`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-raazseven/commit/a525f00).

> so add more course and filter options and also add more events. and all
> the photos you used in the events dont use it randomly use it acccording
> to context as in if its a basketball event insert a photo form internet of
> a basketball, like that also make it more graphic and vibrant colour so it
> looks like a friendly app where you can fnd real epope to go with also in
> profile add more things like intrest tags and more thing about the person
> amke it a complete profile and when logining in make sure people have a
> complete profile . and everything is in database

This was the biggest single pass: more course and interest tags, ten more
events, and the deferred contextual-photo lookup from `f8852e6` — event
photos are now matched by keyword against the event's title (a basketball
event gets a basketball photo), falling back to a per-category default
instead of a random pick. Profiles grew pronouns, program, and self-described
interest tags, all backed by real tables (`profileInterests`, extended
`users` columns) rather than anything client-side. "Make sure people have a
complete profile" became an actual gate: `src/middleware.ts` now redirects any
logged-in user with an incomplete profile to `/profile?required=1` on every
route except the handful needed to complete it. A vibrant gradient/badge
redesign in `src/styles.css` covers the "more graphic and vibrant" ask.
Existing seed data doesn't get re-seeded on restart, so all of this — new
tags, new events, and backfilling pronouns/program/interests onto the
already-live fake profiles — runs through idempotent, additive seed functions
instead of the old "seed only if the events table is empty" guard, so it
actually shows up for accounts created before this change too. One real test
bug turned up while grounding this against `pnpm check`: a
profile-completeness test asserted on the wording shown at `/profile`, but
followed a bare `/profile` instead of the redirect's actual
`/profile?required=1` target, so it saw the wrong copy — fixed by following
the real redirect target, not the app logic. Shipped as
[`df3cf3d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-raazseven/commit/df3cf3d).

## Before you ship

`pnpm check:evidence` verifies that this comment is gone, that your citations
resolve to real commits, that a crit week's reflection entry is in
`reflections/`, and that your `CLAUDE.md` is there. It checks that your account
is traceable, not that it is good: that is the marker's call.

Images aren't checked: unlike a citation whose SHA doesn't resolve, a broken
image is visible the moment this file is rendered on GitHub.
