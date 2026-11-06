# LITTLE FOUNDERS — Phase 0 Report

Status: complete, awaiting approval · Date: 2026-11-05

## 1. What was investigated
- Fit of the proposed stack (Next.js/TS, Tailwind/shadcn, Supabase, Vercel, Base, Solidity) for a children's product.
- Credential options on Base: NFTs, soulbound tokens, EAS on-chain/off-chain attestations, W3C Verifiable Credentials 2.0 / Open Badges 3.0.
- Gas sponsorship and wallet abstraction on Base (CDP Paymaster, smart accounts) and whether they are needed.
- Children's privacy law: Nigeria Data Protection Act 2023 (s.31) and GAID 2025; US COPPA 2025 amendments; UK/EU at a high level.
- Authentication patterns for children without child accounts; RLS isolation; upload risks.
- Feasibility of deterministic (non-AI) investor feedback and simulator logic.

No code, dependencies, migrations, contracts, or deployments were created.

## 2. Recommended architecture (summary)
- **Next.js App Router + TypeScript on Vercel**, Tailwind + shadcn/ui with a custom child-friendly theme.
- **Supabase**: Auth for **adults only**; children are guardian-owned profiles; Postgres with RLS on every table; no user uploads in MVP.
- **Child Mode**: adult signs in, selects a child profile, signed cookie gates `/play/*`; PIN unlock to return to `/parent/*`.
- **Content-as-code**: curriculum, scenarios, personas and achievements in typed repo files, seeded into read-only tables.
- **Pure TS engines** for quiz scoring, simulator, investor rubric and achievements — deterministic, unit-tested, server-authoritative.
- **Credentials**: off-chain certificates + `/verify` page first; then **EAS attestations on Base** (predeployed contracts, no custom Solidity), issued by a server-side LITTLE FOUNDERS issuer after **adult opt-in**, containing only a salted commitment — no wallets, no paymaster, no child interaction with crypto.

Details: `TECHNICAL_ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, `CHILD_SAFETY_AND_PRIVACY.md`.

## 3. Major decisions & changes to the original plan

| # | Change | Reason |
|---|---|---|
| C1 | **No custom smart contracts**; use EAS predeploys on Base | Removes audit/test burden; built-in revocation & explorer |
| C2 | **No NFTs** (incl. soulbound) | Need wallets, imply collectability/trading, wrong for children |
| C3 | **No paymaster / smart wallets** in MVP | Only the issuer transacts; it pays its own (small) gas. Paymasters only sponsor smart-account users |
| C4 | **Only certificates go on-chain**, and only with adult opt-in; badges stay off-chain | Cuts gas, cuts privacy surface |
| C5 | **No pitch uploads** in MVP; built-in deck builder only | Malware, PII in files/metadata, moderation burden |
| C6 | **No independent child logins**; educator classrooms deferred | Avoid child credentials/contact data; simpler consent |
| C7 | Investor Room answers are **structured choices** (+ optional unscored note) | Makes deterministic scoring meaningful without AI |
| C8 | Roadmap reordered: data model + RLS in Phase 1; consent in Phase 2; Passport/achievements from Phase 3; testing continuous; Phase 7 = credentials + hardening | Dependencies and safety-first |
| C9 | Content authoring is a **separate parallel workstream** | Largest hidden effort; blocks Phase 3 |
| C10 | **No real child data until legal review**; demo uses fictional profiles | Unresolved consent-verification question |

## 4. Technical risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| RLS misconfiguration leaks child data (silent failures) | Med | Critical | Cross-tenant automated tests on every table; views hiding answer keys; service-role key server-only |
| Content not ready (6 modules, quizzes, banks) | High | High | Start in Phase 1; cut-line of 3 full modules |
| shadcn default look feels "adult" | Med | Med | Dedicated theme/illustration time in Phase 1 |
| Simulator balancing produces odd/unfair outcomes | Med | Med | Pure engine, property tests, playtests with children (supervised) |
| Deterministic feedback feels repetitive | Med | Low | Larger option/feedback banks; variant phrasing keyed by seed |
| Base RPC/testnet instability during demo | Low–Med | Med | Async issuance; off-chain verification works without chain |
| Issuer key compromise | Low | Med | Minimal balance, rate limits, separate keys, managed signer later |
| Next.js caching leaking per-user data | Low | High | No-store on authenticated routes; review in Phase 2 |
| Shared-device Child Mode bypass | Med | Med | PIN with lockout; Child Mode is a UX boundary, adult owns data |

## 5. Safety / compliance risks (summary)
- Consent-verification adequacy under NDPA s.31 & GAID is **unresolved** ⚖️.
- Cross-border hosting (any single Supabase/Vercel region serves a global audience) needs a transfer basis ⚖️.
- Immutability of on-chain records vs erasure — mitigated by salted commitments + revocation, but needs legal confirmation ⚖️.
- Children may type personal info into free text — mitigated by nudges, privacy-by-default, no sharing.
- Full list: `CHILD_SAFETY_AND_PRIVACY.md` §12.

## 6. Decisions requiring your approval

> **Update 2026-11-05 (Phase 1 kickoff).** Confirmed by the product owner:
> - **D1 → Global** platform (not Nigeria-first); English initially with globally relatable examples.
> - **D2 → Confirmed:** parents own accounts; Child Mode on the parent's device; no child login credentials; Parent Dashboard for monitoring.
> - **D6 → Fictional virtual currency**, clearly labelled.
> - No external AI APIs; no real fundraising/investment; no child wallets; Base stays behind the scenes.
> - **Real child data gated** pending professional privacy/legal review (**D11 → yes**); demo profiles fictional.
>
> Still open: D3 (testnet/mainnet), D4/D5 (treated as deferred per recommendation), D7 (region), D8 (module outline — Phase 1 landing page uses the proposed outline), D9 (content owner), D10 (deadline).
>
> Original table, kept for the record:

| ID | Decision | Recommendation |
|---|---|---|
| **D1** | Target market for MVP | Nigeria-first; other countries waitlisted |
| **D2** | Accept "Child Mode under adult account" (no child logins) | Yes |
| **D3** | Chain for demo / launch | Base Sepolia for hackathon; mainnet only after legal review |
| **D4** | Drop pitch uploads from MVP | Yes |
| **D5** | Educator accounts | Defer; marketing waitlist only |
| **D6** | Simulator currency | Fictional units (e.g. "Founder Points") **or** naira for realism — recommend fictional units, avoiding the word "coins", to prevent real-money/crypto confusion |
| **D7** | Supabase region | Pick the closest available region with a DPA; confirm list and transfer basis with counsel |
| **D8** | Module outline in `PRODUCT_SPEC.md` §2.1 | Approve or supply your curriculum |
| **D9** | Who authors lesson/quiz content and illustrations, and by when | Needs an owner |
| **D10** | Hackathon deadline & team size | Needed to fix the cut-line |
| **D11** | Engage a data-protection professional before real child data | Yes |

## 7. Facts vs assumptions
- **Verified facts** (cited below): EAS predeploy addresses on Base; CDP paymaster scope (Base/Base Sepolia, ERC-4337 smart accounts); VC 2.0 W3C Recommendation; Open Badges 3.0 alignment with VC 2.0; NDPA child = under 18 and s.31 parental consent/verification; GAID 2025 issuance; COPPA amended rule dates and retention-policy requirement.
- **Assumptions** (not verified): mainnet attestation cost "fractions of a cent"; Supabase region availability near Nigeria; low-bandwidth mobile-heavy audience; 10–13 reading level targets; that the hackathon judges value on-chain verification.
- **Secondary-source caveat**: NDPA/GAID and COPPA points were taken from law-firm and Big-4 summaries, not primary texts; EAS addresses from the EAS npm package listing and OP docs. Re-verify before Phase 7 / production.

## 8. Readiness for Phase 1
**Recommendation: ready to begin Phase 1 once D1, D2, D4, D6, D8 and D10 are answered.** Phase 1 contains nothing irreversible (no real child data, no chain writes), so the legal items (D7, D11) can proceed in parallel, but must be resolved before any real child data is collected.

Awaiting explicit approval before starting Phase 1.

## 9. Sources
- Base — Paymasters (Smart Wallet guide): https://docs.base.org/smart-wallet/guides/paymasters
- Base — Base Account sponsor gas: https://docs.base.org/base-account/improve-ux/sponsor-gas/paymasters
- Base — Gasless transactions cookbook: https://docs.base.org/cookbook/account-abstraction/gasless-transactions-with-paymaster
- Coinbase Developer Platform — Paymaster: https://docs.cdp.coinbase.com/paymaster/introduction/welcome
- CDP — Gas sponsorship (smart accounts only): https://docs.cdp.coinbase.com/server-wallets/v2/evm-features/gas-sponsorship
- EAS contracts (deployment tables incl. Base): https://www.npmjs.com/package/@ethereum-attestation-service/eas-contracts · https://github.com/ethereum-attestation-service/contracts
- Optimism — EAS contracts (Superchain predeploys): https://community.optimism.io/identity/contracts-eas
- EAS docs: https://docs.attest.org/docs/welcome
- W3C — VC 2.0 family is a W3C Recommendation: https://www.w3.org/news/2025/the-verifiable-credentials-2-0-family-of-specifications-is-now-a-w3c-recommendation/
- 1EdTech — Open Badges 3.0: https://www.imsglobal.org/spec/ob/v3p0 · Implementation guide: https://www.imsglobal.org/spec/ob/v3p0/impl
- NDPA 2023 review (KPMG): https://assets.kpmg.com/content/dam/kpmg/ng/pdf/nigeria-data-protection-act2023_kpmg-review.pdf
- DLA Piper — Data protection in Nigeria: https://www.dlapiperdataprotection.com/?c=NG&t=law
- GAID 2025 commentary (Mondaq): https://www.mondaq.com/nigeria/privacy-protection/1700306/gaid-2025-unpacked-series-ii-data-protection-officers-mandatory-consents-and-emerging-technologies
- GAID 2025 guide (LawPavilion): https://blog.lawpavilion.com/ndp-act-2023-gaid-2025-a-comprehensive-guide-to-nigerias-new-data-protection-landscape
- COPPA amendments (Jones Day): https://jonesday.com/en/insights/2025/05/ftc-finalizes-amendments-to-coppa--rule
- COPPA compliance deadline (Hunton): https://www.hunton.com/privacy-and-cybersecurity-law-blog/coppa-rule-amendment-compliance-deadline-approaches
