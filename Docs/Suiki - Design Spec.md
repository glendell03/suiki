---
title: "Suiki — Design Spec"
date: 2026-03-25
status: draft
tags:
  - project/suiki
  - blockchain/sui
  - market/philippines
  - type/design-spec
  - stage/brainstorm
created: 2026-03-25
updated: 2026-03-25
---

# Suiki — Design Spec

> [!abstract] One-liner
> A web-first PWA that lets any Filipino merchant launch a digital stamp card loyalty program in 2 minutes — powered by SUI blockchain, with stamps as upgradeable NFTs customers actually own.

## Map of Content

- [[#Problem Statement]]
- [[#Market Context]]
- [[#Product Vision]]
- [[#Architecture]]
- [[#Smart Contract Design]]
- [[#MVP Scope]]
- [[#Roadmap]]
- [[#Risks & Mitigations]]
- [[#Open Questions]]

---

## Problem Statement

99% of Filipino MSMEs have no loyalty tool. Customers carry physical punch cards that get lost, expire, or disappear when a merchant changes systems. Existing digital loyalty programs (GCash perks, brand apps) are siloed — you earn at one place, can't see everything in one view, and don't truly own your rewards.

**Core pain points:**
- Merchants lose repeat customers to bigger chains that have loyalty programs
- Physical stamp cards are easily faked, lost, and forgotten
- No portable loyalty history customers can take anywhere

---

## Market Context

> [!info] Philippines Blockchain Climate (2026)
> - **CADENA Act** passed Senate 17-0 (Dec 2025) — mandates all government budget records on blockchain
> - **Digital Bayanihan Chain** live — Philippines first country to put national budget on SUI-adjacent blockchain
> - **76% of Filipinos** unbanked or underbanked — mobile-first population
> - **BSP VASP freeze** — new crypto exchange licenses frozen; must partner with existing VASPs (Coins.ph, PDAX) for fiat on/off-ramps
> - Public trust in blockchain rising due to government adoption

> [!info] SUI Ecosystem (March 2026)
> - **130,000+ TPS** peak; **~400ms** finality
> - **Sponsored transactions** — app pays gas on behalf of users
> - **SUI Display standard** — NFT metadata is mutable and upgradeable natively
> - **USDsui stablecoin** live (by Bridge/Stripe) — USD-pegged, for future cashback layer
> - **$50M grant program** active — $10K–$100K developer grants available
> - **Sui Move Builder Program** ran in Philippines (Palawan) — local Move developer community exists
> - **UNDP SDG Accelerator** partnership — grant pathway for financial inclusion apps

---

## Product Vision

**What it is:** Suiki is a dual-sided PWA. Merchants set up a stamp loyalty program in under 2 minutes. Customers collect stamps across every participating merchant in one wallet-connected view.

**Why blockchain adds real value (not hype):**
- Stamps are Move objects owned by the customer — merchant cannot revoke or reset them arbitrarily
- Tamper-proof: stamp count is on-chain, not in a database a merchant can edit
- Never expire unless merchant sets a transparent on-chain expiry
- Future: stamp history = portable loyalty record = credit primitive

**Target users:**
| User | Description |
|---|---|
| **Merchants** | Any Filipino MSME — sari-sari store, carinderia, salon, pharmacy. Smartphone required. |
| **Customers** | Any Filipino with a smartphone and a Slush wallet. |

---

## Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) + PWA via `next-pwa` |
| Wallet connection | `@mysten/dapp-kit` + Slush wallet adapter (web version) |
| Smart contracts | Move on SUI mainnet |
| Sponsored transactions | SUI native Gas Station |
| Client queries | `@mysten/sui` TypeScript SDK (JSON-RPC) |
| Event streaming (premium) | SUI gRPC / Laserstream → Supabase Postgres |
| Database (premium only) | Supabase Postgres |
| Hosting | Vercel |

### Data Architecture

> [!tip] Free vs Premium storage split
> **Free tier** — 100% on-chain. Zero database. Stamp records live as Move objects on SUI. Merchant metadata stored in `StampProgram` shared object.
> **Premium tier** — SUI gRPC event listener mirrors `StampIssued` and `StampRedeemed` events to Supabase Postgres. Analytics queries hit Postgres, never the chain.

**Merchant logo:** Stored as a URL string in the Move object. Merchant pastes any hosted image URL (Facebook photo, Google Drive, etc.). No file upload infrastructure needed.

### QR Code Flow

```
Merchant QR  →  encodes: { type: "merchant", program_id, wallet_address }
Customer QR  →  encodes: { type: "customer", wallet_address }
```

Either party scans the other. App resolves both addresses → merchant signs `issue_stamp` transaction → SUI Gas Station sponsors the fee → customer's StampCard NFT counter increments.

### Sponsored Gas Rate Limiting

| Tier | Sponsored tx limit |
|---|---|
| Free | 50 sponsored tx / merchant / day |
| Premium | Unlimited |

Alert at 20% gas wallet balance remaining.

---

## Smart Contract Design

### Objects

**`StampProgram` (shared object — owned by merchant)**

```move
struct StampProgram has key, store {
    id: UID,
    merchant: address,
    name: String,
    logo_url: String,       // merchant-provided URL
    stamps_required: u64,
    reward_description: String,
    total_issued: u64,
}
```

**`StampCard` (owned object — owned by customer, upgradeable NFT)**

```move
struct StampCard has key, store {
    id: UID,
    program_id: ID,         // reference to merchant's StampProgram
    current_stamps: u64,    // resets on redemption
    total_earned: u64,      // lifetime counter, never resets
    last_stamped: u64,      // timestamp
}
```

### NFT Upgradeability

SUI's `Display` standard drives visual rendering. The StampCard's image, name, and description are linked to the merchant's `StampProgram` via `program_id`. When the merchant updates their program (new logo URL, seasonal design, new branding) — **all StampCard NFTs for that merchant visually update automatically** without re-minting.

Merchants can also push direct metadata updates to individual cards (e.g., promote a customer to "Gold Member" tier).

> [!example] Use case: Seasonal redesign
> A carinderia updates their `logo_url` to a Christmas-themed image in December. Every customer's StampCard instantly shows the holiday design in their Slush wallet. No customer action required.

### Key Functions

| Function | Who calls it | What it does |
|---|---|---|
| `create_program` | Merchant | Deploys a new `StampProgram` shared object |
| `issue_stamp` | Merchant | Increments `current_stamps` on customer's `StampCard` |
| `redeem_stamp` | Customer (confirmed by merchant) | Resets `current_stamps`, increments `total_earned`, emits event |
| `update_program` | Merchant | Updates `logo_url`, `name`, `reward_description` |

---

## MVP Scope

> [!success] What ships in MVP (Month 1–3)
> **Goal:** One merchant sets up a program. One customer earns and redeems stamps. Nothing else.

| Feature | Details |
|---|---|
| Merchant onboarding | Connect Slush wallet → fill program details → deploy `StampProgram` |
| Merchant QR page | Static QR + share link |
| Customer stamp view | Connect Slush wallet → see all StampCard NFTs across all merchants |
| Stamp issuance | Bidirectional QR scan → `issue_stamp` tx → card counter increments |
| Redemption | Customer taps Redeem → merchant confirms → `redeem_stamp` tx |
| Sponsored gas | SUI Gas Station — zero fees for merchants and customers |
| StampCard NFT Display | Renders with merchant logo and stamp count in Slush wallet |

> [!warning] Explicit MVP cuts
> No analytics, no push notifications, no cashback, no premium tier, no multi-location, no native mobile app.

---

## Roadmap

### Post-MVP — Month 4–6: "Make it sticky"

- [ ] Merchant analytics dashboard (Supabase + gRPC event mirror)
- [ ] Freemium gate — analytics becomes premium
- [ ] Customer discovery: browse nearby merchants
- [ ] Merchant seasonal card redesign (update Display metadata)
- [ ] PWA install prompt + Web Push notifications

### V2 — Month 7–12: "Make it a network"

- [ ] USDC/USDsui cashback tier (merchant funds cashback pool)
- [ ] Multi-location support per merchant
- [ ] Customer loyalty score — verifiable on-chain history
- [ ] Merchant referral program
- [ ] Expo/React Native companion app for merchants (native camera QR)

### Long-term — Year 2+: "Build the moat"

- [ ] Loyalty marketplace — customers trade or gift StampCard NFTs
- [ ] On-chain credit scoring — stamp history as microfinance collateral (partner with lender)
- [ ] B2B aggregated analytics — foot traffic data for brands, real estate, LGUs
- [ ] White-label for malls, markets, business associations
- [ ] CADENA Act integration — verified records for merchants in government procurement

---

## Risks & Mitigations

> [!danger] Risk 1 — Slush wallet friction
> Customers need a Slush wallet before they earn their first stamp.
> **Mitigation:** Onboarding screen guides new users to slush.org in 60 seconds. Frame it as "your digital loyalty wallet." StampCard NFT appearing immediately after first stamp is the hook.

> [!danger] Risk 2 — BSP regulatory exposure (v2)
> USDC/USDsui cashback = moving value = potential VASP territory.
> **Mitigation:** MVP has zero token movement (stamps are NFTs, not money). For v2, partner with Coins.ph or PDAX as the licensed off-ramp layer. Do not handle fiat conversion directly.

> [!danger] Risk 3 — SUI network downtime
> Outage = merchants can't issue stamps.
> **Mitigation:** Stamp issuance queue with exponential backoff retry. Show "pending" state, not error. Resolve automatically when network recovers.

> [!danger] Risk 4 — Merchant cold start (chicken-and-egg)
> No merchants = no customers. No customers = no merchants.
> **Mitigation:** Launch in one tight geography first — one city, one palengke, one barangay. Target 20 merchants manually. Density over breadth.

> [!danger] Risk 5 — Gas station depletion
> Sponsored tx spike drains gas budget.
> **Mitigation:** Rate limit: 50 sponsored tx/merchant/day on free tier. Premium removes cap. Alert at 20% gas wallet balance.

> [!danger] Risk 6 — Smart contract bugs
> Logic bug in `issue_stamp` or `redeem_stamp` could allow fake stamps or invalid redemptions.
> **Mitigation:** Move's type system eliminates reentrancy and overflow by default. Audit contracts before mainnet. Full testnet launch with real merchants first.

---

## Monetization

| Tier | Price | What's included |
|---|---|---|
| **Free** | ₱0 | Stamp program creation, issuance, redemption, StampCard NFT. 100% on-chain. No database. |
| **Premium** | TBD (₱299–₱499/mo estimated) | Analytics dashboard, customer segments, push notifications, custom branding, unlimited sponsored tx, cashback layer (v2) |

---

## Open Questions

- [ ] Which city / market do we target for the cold-start launch?
- [ ] Do we need a legal entity in the Philippines before launch, or can we operate as a foreign entity initially?
- [ ] Exact premium pricing — needs validation with target merchants.
- [ ] Smart contract audit vendor — which Move auditor do we use?
- [ ] SUI Foundation grant application — should we apply before or after MVP?

---

## Related Notes

- [[Philippines Blockchain Context]]
- [[SUI Ecosystem Research]]
- [[Suiki - Implementation Plan]]

---

*Spec written: 2026-03-25*
*Status: Awaiting user review*
