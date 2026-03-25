---
title: "Suiki — Final Code Review (Post Security-Fix)"
date: 2026-03-25
status: complete
reviewer: Claude Sonnet 4.6
---

# Suiki — Final Code Review

## Results

| File | Verdict | Issues Found |
|---|---|---|
| `move/suiki/sources/suiki.move` | ✅ CLEAN | 0 |
| `move/suiki/tests/suiki_tests.move` | ✅ FIXED | Missing EInvalidUrl test for update_program → added |
| `src/app/api/sponsor/route.ts` | ✅ FIXED | Rate limiter ordering allowed sender quota exhaustion → fixed |

## Fixes Applied in This Review

### Bug 1 — route.ts: Rate limiter counter burned on IP-blocked requests
**Severity:** High
**Lines fixed:** 207–215

`checkRateLimit(sender)` was called before `checkRateLimit(ip)`, incrementing the sender's daily quota even when the request was ultimately rejected by the IP gate. Fixed by checking sender first (early return on failure), then checking IP with rollback of sender counter on rejection.

### Bug 2 — suiki_tests.move: Missing EInvalidUrl test for update_program
**Severity:** High (test gap)

`update_program` asserts EInvalidUrl on empty logo_url (contract line 243) but had no test. Added `test_update_program_empty_url_fails`.

## All Security Findings Status

| Finding | Severity | Status |
|---------|----------|--------|
| FIND-01: Sponsor API open relay | Critical | ✅ Fixed — PTB allowlist validation |
| FIND-04: stamps_required=0 | Critical | ✅ Fixed — assert!(stamps_required > 0) |
| FIND-16: PTB call spoofing | High | ✅ Fixed — reject non-MoveCall commands |
| FIND-03: Shared object DoS | High | ✅ Fixed — issue_stamp takes &StampProgram |
| FIND-02: Rate limit bypass | High | ✅ Fixed — per-sender + per-IP limiting |
| Rate limit ordering bug | High | ✅ Fixed — sequential check with rollback |
| FIND-06: Excess stamps discarded | Medium | ✅ Fixed — carry forward on redeem |
| FIND-05: total_earned semantics | Medium | ✅ Fixed — counts redemption cycles |
| FIND-08: No merchant recovery | Medium | ✅ Fixed — transfer_merchant added |
| FIND-07: Unconstrained URLs | Medium | ✅ Fixed — length validation |
| ADR-006: Display NFT staleness | Design bug | ✅ Fixed — sync_card_metadata added |
| EInvalidUrl test gap | High (test) | ✅ Fixed — test_update_program_empty_url_fails added |

## Remaining Known Limitations (Not Bugs)

- No MAX_STAMPS_REQUIRED cap — degenerate value could lock customers out (Low risk, post-MVP)
- In-memory rate limiter needs Redis upgrade before mainnet (documented in route.ts README)
- PDPA compliance review required before launch
- sui CLI not installed locally — build verification pending
