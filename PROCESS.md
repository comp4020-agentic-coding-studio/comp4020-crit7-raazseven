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
mark yourself as going to an event, see who else is going, and ask a specific
attendee to go together. `README.md` has the full account of what the app is
and what good means here.

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

## Before you ship

`pnpm check:evidence` verifies that this comment is gone, that your citations
resolve to real commits, that a crit week's reflection entry is in
`reflections/`, and that your `CLAUDE.md` is there. It checks that your account
is traceable, not that it is good: that is the marker's call.

Images aren't checked: unlike a citation whose SHA doesn't resolve, a broken
image is visible the moment this file is rendered on GitHub.
