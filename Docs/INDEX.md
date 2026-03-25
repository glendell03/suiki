---
title: Suiki Documentation Index
date: 2026-03-25
---

# Suiki Documentation Index

## Quick Navigation

### Core Documents (Read in this order)

1. **[Suiki - Design Spec](./Suiki%20-%20Design%20Spec.md)** (11KB)
   - Problem statement, market context, product vision
   - Tech stack, data architecture, smart contract design
   - MVP scope, roadmap, risks & mitigations
   - **Read first:** Understand the "what" and "why"

2. **[Suiki - Implementation Plan](./Suiki%20-%20Implementation%20Plan.md)** (76KB)
   - 13 tasks with step-by-step execution guide
   - Complete Move smart contract code
   - Transaction builders, UI components
   - Testing, deployment, PWA setup
   - **Read second:** Understand the "how"

3. **[Architecture Map](./Architecture%20Map.md)** (35KB) ← **YOU ARE HERE**
   - Object model: StampProgram, StampCard (fields, abilities, relationships)
   - Transaction flows: all 5 key functions with on-chain actions + events
   - QR code data format & app resolution logic
   - File structure: all 23 files mapped to tasks
   - Task dependencies & critical path
   - Risk inventory with gap analysis & recommendations
   - **Read third:** Deep understanding of architecture, design decisions, risks

---

## Document Purposes

| Document | Purpose | Audience | Length |
|----------|---------|----------|--------|
| Design Spec | Establish product vision, technical approach, risks | Product leads, architects | 11KB |
| Implementation Plan | Step-by-step execution guide with code templates | Developers | 76KB |
| Architecture Map | Technical reference: objects, flows, files, dependencies, risks | Developers, architects, reviewers | 35KB |

---

## Key Sections Quick Reference

### Object Model
- `StampProgram`: Shared object, merchant-owned, stores program metadata
- `StampCard`: Shared object, customer-owned NFT with Display standard
- Both linked via `program_id`, 1-to-many relationship

**Find in Architecture Map:** [Object Model](./Architecture%20Map.md#object-model)

### Transaction Flows
Five key functions:
1. `create_program` — Merchant launches loyalty program
2. `create_card_and_stamp` — Merchant creates first customer card
3. `issue_stamp` — Merchant adds stamp to card
4. `redeem` — Customer resets counter at threshold
5. `update_program` — Merchant updates metadata (triggers Display update)

Each flow includes: function signature, access control, on-chain actions, events, client flow, gas costs.

**Find in Architecture Map:** [Transaction Flow Map](./Architecture%20Map.md#transaction-flow-map)

### QR Code Format
- **Merchant QR:** `{type: "merchant", program_id, wallet_address}`
- **Customer QR:** `{type: "customer", wallet_address}`
- App resolves type → routes to detail page or issue flow

**Find in Architecture Map:** [QR Code Data Format](./Architecture%20Map.md#qr-code-data-format)

### File Structure
23 files across 13 tasks:
- Move contract: 3 files (code + tests)
- Next.js app: 20 files (pages, components, hooks, API)
- Final directory tree provided

**Find in Architecture Map:** [File Structure Map](./Architecture%20Map.md#file-structure-map)

### Task Dependencies
- Critical path: Task 1→2→4→5→7→(8|9|10|11)→12→13
- Parallel opportunities: Phase 3 (infrastructure), Phase 4 (UI pages)
- Estimated implementation time: 2-3 days

**Find in Architecture Map:** [Dependencies Map](./Architecture%20Map.md#dependencies-map)

### Risks & Mitigations
10 identified risks:
1. Slush wallet friction
2. BSP regulatory exposure
3. SUI network downtime (GAP)
4. Merchant cold start (business problem)
5. Gas station depletion (GAP)
6. Smart contract bugs (covered by Move type safety)
7. Shared object latency (acceptable, needs optimistic UI)
8. Wallet Display limitation (PWA is primary)
9. QR scanning reliability (GAP)
10. Mobile browser compatibility

All risks cross-referenced to source, gaps flagged with recommendations.

**Find in Architecture Map:** [Risk Inventory](./Architecture%20Map.md#risk-inventory)

---

## For Different Audiences

### Product Leads / Non-Technical
1. Read Design Spec (sections: Problem Statement, Market Context, Product Vision)
2. Skim Implementation Plan (file structure overview)
3. Skip Architecture Map (or read Object Model + Transaction Flows at high level)

### Developers Starting Implementation
1. Read Design Spec (full)
2. Read Implementation Plan (full, especially your assigned tasks)
3. Reference Architecture Map for:
   - Object model (when writing Move code)
   - Transaction flows (when building client code)
   - File structure (when creating directories)
   - Dependencies (when planning task sequence)

### Smart Contract Developers
1. Read Design Spec (section: Smart Contract Design, Risks)
2. Read Implementation Plan (tasks 2-3: Move contract + tests)
3. Reference Architecture Map (Object Model + Transaction Flow Map)

### Frontend Developers
1. Read Design Spec (section: Product Vision, MVP Scope)
2. Read Implementation Plan (tasks 5-13: UI implementation)
3. Reference Architecture Map (File Structure + QR Code Format)

### Architects / Code Reviewers
1. Read all three documents in order
2. Focus on: Design Spec risks, Implementation Plan task dependencies, Architecture Map risk inventory
3. Use Architecture Map as reference for code review checklist

---

## Checklist Before Implementation

- [ ] All team members have read Design Spec
- [ ] Implementation team has read Implementation Plan
- [ ] Architecture Map reviewed for risks and gaps
- [ ] Task dependencies understood and committed
- [ ] Gap tasks identified (retry queue, rate limiting, QR fallback)
- [ ] SUI testnet environment set up (faucet, CLI, wallet)
- [ ] GitHub repo initialized with these Docs committed
- [ ] Vercel/hosting choice confirmed
- [ ] (Optional) Figma/UI mockups reviewed for design consistency

---

## Known Gaps to Address Before MVP

From Architecture Map risk assessment:

1. **Missing Task: Retry Queue** (Risk 3)
   - Implement stamp issuance queue with exponential backoff
   - Show "pending" UI state, not error
   - Add to Task 7 or create Task 7b

2. **Missing Task: Rate Limiting + Gas Monitoring** (Risk 5)
   - Enforce 50 sponsored tx/merchant/day limit (free tier)
   - Monitor gas wallet balance, alert at 20%
   - Add to Task 6 or create Task 6b

3. **Missing Feature: QR Scan Fallback** (Risk 9)
   - Manual address entry as alternative to QR
   - Add to Task 10 (merchant issue) and Task 11 (customer scan)

4. **Missing: Legal Review** (Risk 2)
   - Engage BSP compliance lawyer before public launch
   - Document regulatory strategy for Philippines market

---

## Post-MVP Roadmap

From Design Spec:
- Month 4-6: Analytics dashboard, customer discovery, seasonal redesigns, push notifications
- Month 7-12: USDC/USDsui cashback, multi-location support, loyalty score, referral program
- Year 2+: Marketplace, credit scoring, B2B analytics, white-label

See Design Spec section "Roadmap" for details.

---

## Contact & Questions

For clarifications on:
- **Design decisions:** See Design Spec or Architecture Map sections
- **Implementation details:** See Implementation Plan task descriptions
- **Risks & mitigations:** See Architecture Map "Risk Inventory"
- **File locations:** See Architecture Map "File Structure Map"

---

*Last updated: 2026-03-25*
*Status: Ready for implementation*
