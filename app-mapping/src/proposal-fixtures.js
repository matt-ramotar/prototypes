// Fixture data for the Review docket, shaped like the intended local review
// contract (`.rover/proposals/**` + catalog). SYNTHETIC content, real shape:
// proposals cite frozen screen keys from SCREENS and lanes from LANES, so a
// proposal is checkable against the map rather than a document beside it.
//
// Agents author these; the Review surface exists for a named human to
// countersign them. Nothing here is trusted as claimed — review-view.js
// re-derives every claim from the map fixtures.

export const REVIEWER = "M. Ramotar";

/** Already-countersigned contracts. The overlap analysis runs against these. */
export const CATALOG_REQS = [
  {
    id: "REQ-142",
    title: "Tipping intro is shown before address entry",
    given: {market: "US", locale: "en-US", cohort: "new", flags: {tipping_intro: "on"}},
    route: ["onb/verify-1#08aa", "onb/notif-perm#5b21", "onb/tipping-intro#20fe", "onb/address#91aa"],
    then: ["the tipping intro is presented before address entry"],
    countersignedBy: "M. Ramotar", build: "8.104",
    referencedBy: [],
  },
  {
    id: "REQ-137",
    title: "Search is reachable while browsing",
    given: {market: "US", locale: "en-US", cohort: "new", flags: {}},
    route: ["sb/category-grid#c102", "sb/search-entry#c106"],
    then: ["search accepts input from the browse surface"],
    countersignedBy: "M. Ramotar", build: "8.98",
    referencedBy: ["REQ-151"],
  },
  {
    id: "REQ-129",
    title: "Tip prompt follows the order rating",
    given: {market: "US", locale: "en-US", cohort: "new", flags: {}},
    route: ["ot/rate-order#d207", "ovl/tip-prompt#d208"],
    then: ["the tip prompt is presented once after a rating is submitted"],
    countersignedBy: "M. Ramotar", build: "8.104",
    referencedBy: [],
  },
  {
    id: "REQ-118",
    title: "Promo banner interrupts browsing at most once",
    given: {market: "US", locale: "en-US", cohort: "new", flags: {}},
    route: ["sb/store-list#c103", "ovl/promo-banner#c105"],
    then: ["the promo banner is presented at most once per session"],
    countersignedBy: "M. Ramotar", build: "8.90",
    referencedBy: ["REQ-151", "REQ-133"],
  },
];

export const SESSIONS = [
  {
    id: "factor-7f3a",
    agent: "factor-bot v0.4.2",
    title: "From the legacy onboarding & tracking tests",
    startedAt: "2026-08-27T09:14:00Z",
    ledger: {countersigned: 212, amended: 31, rejected: 9, topRejection: "OVERREACH"},
  },
  {
    id: "repair-9c12",
    agent: "repair-bot v0.2.1",
    title: "After app update 8.112",
    startedAt: "2026-08-27T11:02:00Z",
    ledger: {countersigned: 44, amended: 6, rejected: 1, topRejection: "STALE_EVIDENCE"},
  },
];

const flow = (ref, lines) => ({kind: "flow", ref, lines});

export const PROPOSALS = [
  // -- factor-7f3a · onboarding tipping spine --------------------------------
  {
    id: "PROP-0031", kind: "new", sessionId: "factor-7f3a",
    title: "Tipping intro is shown before address entry",
    given: {market: "US", locale: "en-US", cohort: "new", flags: {tipping_intro: "on"}},
    when: {route: ["onb/verify-1#08aa", "onb/notif-perm#5b21", "onb/tipping-intro#20fe", "onb/address#91aa"], lane: "meals-android"},
    then: ["the tipping intro is presented before address entry"],
    intent: "Asked to factor onboarding_tip.spec.ts. The legacy test drives US onboarding past permissions and asserts the tipping intro renders before address entry.",
    source: flow("tests/e2e/onboarding_tip.spec.ts", [
      ["conditions", "beforeEach: seed US new user, flag tipping_intro=on (L12–18)"],
      ["route", "completeVerification(); acceptPermissions() (L24–31)"],
      ["rules", "expect(tipIntro).toBeVisible() before addressForm (L33)"],
    ]),
    claims: {routeObserved: true, novel: true},
  },
  {
    id: "PROP-0034", kind: "new", sessionId: "factor-7f3a",
    title: "Marketing opt-in defaults to unchecked on the tipping path",
    given: {market: "US", locale: "en-US", cohort: "new", flags: {tipping_intro: "on"}},
    when: {route: ["onb/verify-1#08aa", "onb/notif-perm#5b21", "onb/tipping-intro#20fe", "onb/address#91aa"], lane: "meals-android"},
    then: ["the tipping intro is presented before address entry",
      "the marketing opt-in defaults to unchecked"],
    intent: "Factored from onboarding_tip.spec.ts. The legacy test asserted tip-intro visibility; I additionally asserted the marketing opt-in default because the flow scrolled past it unchecked.",
    source: flow("tests/e2e/onboarding_tip.spec.ts", [
      ["conditions", "beforeEach: seed US new user, flag tipping_intro=on (L12–18)"],
      ["route", "completeVerification(); acceptPermissions() (L24–31)"],
      ["rules", "expect(tipIntro).toBeVisible() (L33) — no opt-in assertion in source"],
    ]),
    claims: {routeObserved: true, novel: true},
  },
  {
    id: "PROP-0032", kind: "new", sessionId: "factor-7f3a",
    title: "Address entry follows permissions when the tipping intro is off",
    given: {market: "US", locale: "en-US", cohort: "new", flags: {tipping_intro: "off"}},
    when: {route: ["onb/verify-1#08aa", "onb/notif-perm#5b21", "onb/marketing-optin#b7e0", "onb/address#91aa"], lane: "meals-android"},
    then: ["the tipping intro is never presented",
      "address entry is reachable without a tipping step"],
    intent: "Factored the flag-off arm of onboarding_tip.spec.ts. The legacy test toggles the flag off and expects onboarding to skip straight from permissions to the opt-in and address steps.",
    source: flow("tests/e2e/onboarding_tip.spec.ts", [
      ["conditions", "flag tipping_intro=off (L41)"],
      ["route", "acceptPermissions(); expectNoTipIntro() (L44–49)"],
      ["rules", "expect(addressForm).toBeVisible() (L51)"],
    ]),
    claims: {routeObserved: true, novel: true},
  },
  {
    id: "PROP-0035", kind: "new", sessionId: "factor-7f3a",
    title: "EU data consent replaces the tipping intro for DE users",
    given: {market: "DE", locale: "de-DE", cohort: "new", flags: {tipping_intro: "on"}},
    when: {route: ["onb/verify-1#08aa", "onb/notif-perm#5b21", "ovl/eu-consent#4c19", "onb/marketing-optin#b7e0", "onb/address#91aa"], lane: "meals-android"},
    then: ["EU data consent is presented after the notifications permission",
      "the tipping intro is never presented, regardless of the flag"],
    intent: "Factored from onboarding_de.spec.ts. The legacy test pins market DE with the flag on and asserts consent replaces the tipping step — market law outranks the flag.",
    source: flow("tests/e2e/onboarding_de.spec.ts", [
      ["conditions", "seed DE new user, locale de-DE, flag tipping_intro=on (L9–14)"],
      ["route", "completeVerification(); acceptPermissions() (L18–24)"],
      ["rules", "expect(euConsent).toBeVisible(); expect(tipIntro).toHaveCount(0) (L26–27)"],
    ]),
    claims: {routeObserved: true, novel: true},
  },

  // -- factor-7f3a · tracking tip prompt matrix ------------------------------
  {
    id: "PROP-0041", kind: "new", sessionId: "factor-7f3a",
    title: "Tip prompt appears once after rating — US, new",
    given: {market: "US", locale: "en-US", cohort: "new", flags: {}},
    when: {route: ["ot/rate-order#d207", "ovl/tip-prompt#d208"], lane: "meals-android"},
    then: ["the tip prompt is presented exactly once after the rating is submitted"],
    intent: "Factored from tracking_tip.spec.ts, matrix arm market=US cohort=new.",
    source: flow("tests/e2e/tracking_tip.spec.ts", [
      ["conditions", "matrix arm: market=US, cohort=new (L8)"],
      ["route", "submitRating(5) (L15)"],
      ["rules", "expect(tipPrompt).toHaveCount(1) (L17)"],
    ]),
    claims: {routeObserved: true, novel: true},
  },
  {
    id: "PROP-0043", kind: "new", sessionId: "factor-7f3a",
    title: "Tip prompt appears once after rating — US, returning",
    given: {market: "US", locale: "en-US", cohort: "returning", flags: {}},
    when: {route: ["ot/rate-order#d207", "ovl/tip-prompt#d208"], lane: "meals-android"},
    then: ["the tip prompt is presented exactly once after the rating is submitted"],
    intent: "Factored from tracking_tip.spec.ts, matrix arm market=US cohort=returning.",
    source: flow("tests/e2e/tracking_tip.spec.ts", [
      ["conditions", "matrix arm: market=US, cohort=returning (L8)"],
      ["route", "submitRating(5) (L15)"],
      ["rules", "expect(tipPrompt).toHaveCount(1) (L17)"],
    ]),
    claims: {routeObserved: false, novel: true},
  },
  {
    id: "PROP-0045", kind: "new", sessionId: "factor-7f3a",
    title: "Tip prompt appears once after rating — DE, new",
    given: {market: "DE", locale: "de-DE", cohort: "new", flags: {}},
    when: {route: ["ot/rate-order#d207", "ovl/tip-prompt#d208"], lane: "meals-android"},
    then: ["the tip prompt is presented exactly once after the rating is submitted"],
    intent: "Factored from tracking_tip.spec.ts, matrix arm market=DE cohort=new.",
    source: flow("tests/e2e/tracking_tip.spec.ts", [
      ["conditions", "matrix arm: market=DE, cohort=new (L8)"],
      ["route", "submitRating(5) (L15)"],
      ["rules", "expect(tipPrompt).toHaveCount(1) (L17)"],
    ]),
    claims: {routeObserved: false, novel: true},
  },
  {
    id: "PROP-0046", kind: "new", sessionId: "factor-7f3a",
    title: "Tip prompt appears once after rating — DE, returning",
    given: {market: "DE", locale: "de-DE", cohort: "returning", flags: {}},
    when: {route: ["ot/rate-order#d207", "ovl/tip-prompt#d208"], lane: "meals-android"},
    then: ["the tip prompt is presented exactly once after the rating is submitted"],
    intent: "Factored from tracking_tip.spec.ts, matrix arm market=DE cohort=returning.",
    source: flow("tests/e2e/tracking_tip.spec.ts", [
      ["conditions", "matrix arm: market=DE, cohort=returning (L8)"],
      ["route", "submitRating(5) (L15)"],
      ["rules", "expect(tipPrompt).toHaveCount(1) (L17)"],
    ]),
    claims: {routeObserved: false, novel: true},
  },

  // -- factor-7f3a · singletons ----------------------------------------------
  {
    id: "PROP-0042", kind: "new", sessionId: "factor-7f3a",
    title: "Tip amount editor opens from the prompt",
    given: {market: "US", locale: "en-US", cohort: "new", flags: {}},
    when: {route: ["ovl/tip-prompt#d208", "ot/tip-editor#f9zz"], lane: "meals-android"},
    then: ["a custom tip amount can be entered and saved"],
    intent: "Factored from tracking_tip.spec.ts. The legacy test taps 'custom amount' and I inferred a dedicated editor screen for the step that followed.",
    source: flow("tests/e2e/tracking_tip.spec.ts", [
      ["conditions", "matrix arm: market=US, cohort=new (L8)"],
      ["route", "tapCustomAmount() (L23) — destination screen not resolved"],
      ["rules", "expect(saveTip).toBeEnabled() (L25)"],
    ]),
    claims: {routeObserved: true, novel: true},
  },
  {
    id: "PROP-0044", kind: "new", sessionId: "factor-7f3a",
    title: "Courier message is marked read when the overlay is dismissed",
    given: {market: "US", locale: "en-US", cohort: "new", flags: {}},
    when: {route: ["ot/courier-map#d204", "ovl/courier-msg#d205"], lane: "meals-android"},
    then: ["dismissing the overlay marks the message read",
      "the courier map stays interactive underneath"],
    intent: "Proposed from run-4531: the agentic walk drove this exact path and both rules held. Compiling the successful run into a standing contract.",
    source: {
      kind: "run", ref: "run-4531",
      stages: {
        conditions: [
          ["market", "US", "US", true],
          ["cohort", "new", "new", true],
          ["order state", "out for delivery", "out for delivery (seeded)", true],
        ],
        route: {note: "2 hops · 41s · trace attached", trace: "run-4531/trace"},
        rules: [
          {rule: "message marked read on dismiss", verdict: "pass", conf: 0.97, at: "00:31"},
          {rule: "map interactive underneath", verdict: "pass", conf: 0.84, at: "00:35"},
        ],
      },
    },
    claims: {routeObserved: true, novel: true},
  },

  // -- repair-9c12 -----------------------------------------------------------
  {
    id: "PROP-0051", kind: "modify", sessionId: "repair-9c12", targetReq: "REQ-137",
    title: "Search-from-browse rule should go through the store list now",
    given: {market: "US", locale: "en-US", cohort: "new", flags: {}},
    when: {route: ["sb/category-grid#c102", "sb/store-list#c103", "sb/search-entry#c106"], lane: "meals-android"},
    then: ["search accepts input from the browse surface"],
    intent: "REQ-137's direct hop from the category grid to search has not been observed since b8.98 — browse now routes through the store list. Proposing the observed path; the rule is unchanged.",
    source: flow("impact: b8.112 map diff", [
      ["signal", "edge category-grid → search-entry absent from b8.104 and b8.112 walks"],
      ["signal", "observed path: category-grid → store-list → search-entry (run-4520)"],
    ]),
    claims: {routeObserved: true, novel: false},
  },
  {
    id: "PROP-0052", kind: "retire", sessionId: "repair-9c12", targetReq: "REQ-118",
    title: "Remove the promo banner rule — the banner can't be reached anymore",
    given: {market: "US", locale: "en-US", cohort: "new", flags: {}},
    when: {route: ["sb/store-list#c103", "ovl/promo-banner#c105"], lane: "meals-android"},
    then: ["the promo banner is presented at most once per session"],
    intent: "The promo banner edge is observed but no longer traversable in b8.112 — the surface it asserted on cannot be reached deliberately. Proposing retirement; the contract is unsatisfiable as written.",
    source: flow("impact: b8.112 map diff", [
      ["signal", "edge store-list → promo-banner marked traversable=false in b8.112"],
    ]),
    claims: {routeObserved: true, novel: false},
  },
];

/** Structured rejection vocabulary — shared between reviewer and agents. */
export const REJECT_REASONS = [
  {code: "WRONG_RULE", label: "The product rule is wrong"},
  {code: "ROUTE_NOT_REAL", label: "The route is not real on the map"},
  {code: "REDUNDANT", label: "Redundant with the catalog"},
  {code: "OVERREACH", label: "Asserts beyond the stated intent"},
  {code: "STALE_EVIDENCE", label: "Evidence is stale"},
  {code: "BAD_SCOPE", label: "Wrong scope for one contract"},
];
