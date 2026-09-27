# Crit 7 reflection

**What was the breakthrough that moved the work forward?**

Actually opening the real ANU events calendar and comparing it to what I'd
built. On paper my starter looked done — browse, filter, mark interest — but
sitting the two side by side made it obvious I'd rebuilt a page that already
exists, just worse. The breakthrough wasn't a technical one, it was noticing
the app had no reason to exist yet. Once the question became "who's going,
and can I go with them" instead of "what's on," the schema, the login
requirement, and the whole companion-request idea followed pretty directly —
the hard part was seeing that the slice I'd picked wasn't a slice at all.

**What did this work change about who I want to be as a software developer?**

I want to trust the spec test more than my own sense of "this looks right."
Both real bugs this week — an axe heading-order violation and a
companion-request test that silently asked the wrong person — passed a
visual check and only showed up because I ran the full suite and read the
failure instead of skimming past it. The second one especially: my first
instinct was to suspect the test's regex, and the actual cause was state
bleeding in from an earlier test. Chasing that down rather than patching
around the symptom is the habit I want to keep — grounding a "looks done" app
against something I didn't write myself before calling it finished.
