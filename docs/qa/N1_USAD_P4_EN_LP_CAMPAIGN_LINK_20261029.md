# N1-USAD-P4 English LP campaign link (2026-10-29)

Base: remote main `c58330b40aeeedf974ac00088a48e6597b78da4d`.
Branch: `codex/usad-p4-en-lp-campaign-link`. Production deployment NOT authorized.

## Contract

Only `/en/consignment-note/` with exactly one decoded, case-sensitive
`src=ig_us_v115_p01` sets both `data-en-consignment-store-link` anchors to:

`https://apps.apple.com/us/app/id6800209010?pt=129293983&ct=ig_us_v115_p01&mt=8`

Every other source uses `https://apps.apple.com/us/app/id6800209010`.
No caller-provided pt/ct/destination is used. No redirect, persistence, identifier,
Pixel, SDK, new request, or click event is added. Existing Cloudflare analytics
is unchanged. HTML fallback remains the ordinary US link without JavaScript.
Japanese config and paid handler are unchanged and do not select these anchors.

## Verification

- `node --test tests/app-store-link.test.cjs`: 43 PASS (18 existing, 25 added).
- `node --test tests/*.test.cjs`: 194 PASS, zero failures/skips.
- `node --check script.js` and `git diff --check`: PASS.
- Actual English anchor attributes parsed in Node: two normal fallback hrefs,
  `_blank`, `noopener noreferrer`; no Japanese handler attribute.
- Chrome through computer-use tools, local HTTP 127.0.0.1:4187, 390x844:
  9 normal/paid/invalid/duplicate/case/similar/external/JP/utm-fbclid cases,
  both DOM hrefs and target/rel correct, no horizontal overflow.
- Actual Support click goes to `/en/support/` without src. Language switch to
  Japanese goes to `/consignment-note/` without src and uses normal Japanese URLs.
- Browser error/warning log returned empty. No blank page or error overlay.
- Source comparison: English HTML identical after removing only the two new
  attributes; Japanese handler byte-identical; CSS, copy, images, Privacy,
  language code, config and other pages unchanged.
- Mobile screenshots retained privately. Chrome automatic translation affected
  the before screenshot but not the immediate after screenshot, so these are
  NOT a pixel-identical English before/after comparison. English after view has
  readable heading and visible App Store button; source and DOM checks support
  layout preservation. No claim of actual iPhone acceptance.
- No-JS fallback checked in HTML/Node; disabling JavaScript in a browser was not
  separately exercised. No App Store button was clicked to create attribution.

## Scope and limitations

LP load, Meta link click, App Store button click, campaign-link usage and
Apple-attributed first download remain distinct. This verifies link construction,
not paid attribution, downloads or Pro conversion. JS-disabled/failed execution
loses campaign parameters while retaining a working ordinary link.

No Meta changes, deploy, main push/merge, ASC, app, PostHog or iCloud changes.
Next: owner-approved main integration/deploy, production URL readback, then
separately authorized unpublished Traffic-to-LP draft validation. Advertising
launch still requires its independent P0/Build30 English-USD QA acceptance.
