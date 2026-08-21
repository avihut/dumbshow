---
"@dumbshow/core": patch
---

`docSlug` trims its edge dashes without an ambiguous quantifier, and gets the
tests it never had.

No output changes — the slug for every title is byte-identical, verified
against the old expression over the edge cases plus a fuzz sweep. What changes
is the expression and what pins it.

`docSlug` collapses each run of non-alphanumerics into a single dash, then
trims the dashes left at the edges. The trim used `/^-+|-+$/g`, whose `-+$`
is the shape CodeQL reports as polynomial ReDoS
([`js/polynomial-redos`](https://github.com/avihut/dumbshow/security/code-scanning/3),
against `doc.title`, which the document format does not bound). The report
reads the two replaces independently: the collapse cannot emit `--`, so no
title can ever put more than one dash at either edge, and the quantifier had
nothing to match. Dropping it to `/^-|-$/g` makes the expression say that,
and leaves the query nothing to flag.

The invariant is now a comment at the regex and a test — `docSlug` had no
test at all, despite naming every export the editor hands the browser
(`<slug>.png`, `<slug>.gif`, `<slug>.webm`, `<slug>.txt`,
`<slug>.<tag>.json`). `tests/storage.test.ts` covers the casing, the collapse,
the edge trim, the `"scenario"` fallback, the tag suffix, and the
no-doubled-dash invariant that keeps the trim linear.
