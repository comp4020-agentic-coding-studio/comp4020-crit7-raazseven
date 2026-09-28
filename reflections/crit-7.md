# Crit 7 reflection

**What was the breakthrough that moved the work forward?**

Actually opening the real ANU events calendar and comparing it to what I'd
built. On paper my starter looked done — browse, filter, mark interest — but
sitting the two side by side made it obvious I'd rebuilt a page that already
exists, just worse. Once the question became "who's going, and can I go with
them" instead of "what's on," the schema, the login requirement, and the
companion-request idea followed pretty directly. But the pivot alone wasn't
enough: a social app with one user and no one to ask is still just a form.
The second breakthrough was realising that, and seeding ~16 fake "already
going" profiles so a brand-new visitor always has someone to swipe on and
match with — the feature only actually feels like the app it's meant to be
once there's someone there.

**What did this work change about who I want to be as a software developer?**

I want to trust the spec test more than my own sense of "this looks right."
Every real bug this crit — an axe heading-order violation, a companion-request
test grabbing the wrong user from state bleed, a profile-completeness test
following a bare `/profile` instead of its actual redirect target — passed a
visual check and only surfaced because I ran the full suite and read the
failure instead of skimming past it. I also noticed myself deferring
scope mid-request (the contextual event photos got pushed to a later commit
once I could see the rest of that ask stood on its own) rather than either
dropping it or blocking everything on it — splitting honestly instead of
quietly under-delivering is the habit I want to keep.
