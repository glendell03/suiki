# Design Analysis — Stampy Reference Mockups

**Analyzed from:** 8 screenshots provided by user (2026-03-26)
**Source:** "Stampy" loyalty card app concept (iOS mobile app mockups)

---

## Visual Language

### Color Strategy
- **Background:** Deep forest green gradient (`#0a1a14` → `#0a2e1a`), NOT pure black
- **Surfaces:** Dark green glass cards with translucent borders
- **Primary accent:** Bright green (#4ade80 range) for CTAs and active states
- **Secondary accent:** Warm amber/gold for rewards and stamps
- **Feature cards:** Multi-color (teal, pink, yellow) — each feature has its own accent
- **Text:** Near-white primary, muted gray-green secondary

### Glassmorphism Style
- Cards have `backdrop-filter: blur()` effect
- Borders are semi-transparent green-tinted (`rgba(74, 222, 128, 0.1)`)
- Background shows subtle grid/mesh pattern (optional decorative)
- Cards have gentle inner light/gradient at top edge
- Shadows are deep and dark, not diffused gray

### Typography
- Clean sans-serif (SF Pro / Inter equivalent)
- Bold weights for headings and merchant names
- Generous line-height on body text
- "Hey, Emily" personalized greeting uses italic bold

### Iconography
- 3D rendered food/treat emojis for stamp icons (donut, coffee, cake, etc.)
- Simple line icons for UI elements (bell, search, chevron)
- Merchant logos are circular with emoji/icon representations

---

## Screen Breakdown

### 1. Customer Home Dashboard
- **Header:** Logo (leaf) + notification bell + user avatar (right-aligned)
- **Greeting:** "Hey, {name}! Let's earn more stamps!"
- **Search:** Full-width glassmorphic search bar
- **Feature banners:** 2x2 grid of colored cards (Birthday Club=teal, Referral=neutral, Eco Hero=neutral, Scratch&Win=pink)
- **New merchants:** Section header with "View all" link, horizontal carousel of merchant cover cards
- **Bottom nav:** 4 icons (chat bubble, smiley, search, QR grid), active = filled green circle

### 2. QR & Reward Flow (3 screens)
- **NFC screen (SKIP):** We won't implement this — QR only
- **Congratulations:** White ticket/voucher shape with scalloped edges, confetti emoji, "Show this screen to staff", discount/date/one-time details, barcode → replace with QR
- **QR display:** Large styled QR code (green on light green background), "Show QR code" heading, "Enter code" text button fallback

### 3. Gifts & Stamp Card
- **My Gifts:** Horizontal scroll of gift voucher cards (free pastry, free bouquet)
- **Discount coupons:** Colorful gradient cards with QR code and percentage
- **Stamp card detail:** Merchant header (logo + name + category + arrow), stamp grid (3x3 or 4x2), last slot = gift icon, barcode → replace with QR, "Show this code to the staff"

### 4. Treat Selector
- **Title:** "Select your treat"
- **Preview area:** Large circular spotlight showing selected item
- **Grid:** 3x3 grid of 3D food items (bubble tea, coffee, cake, donut, etc.)
- **CTA:** Green "Select" button
- **Interaction:** Drag item into preview circle (future feature — start with tap-to-select)

### 5. Cards Progress
- **Title:** "Cards Progress"
- **List:** Vertical accordion list of merchant cards
- **Each row:** Circular emoji icon + merchant name + category + expand chevron
- **Expanded:** Segmented progress bar (green=filled, gray=empty) + "Stamps 3/9" counter
- **Sorted:** Most-progressed cards first

### 6. Push Notification
- **Lock screen style:** "Stampy - Bean Haven Cafe: You're just 1 stamp away from a free latte!"
- *Note: Push notification UI is future scope, but the data model should support notification triggers*

### 7. Gift Detail
- **Card style:** Rounded card with 3D emoji illustration
- **Text:** "Free bouquet" + merchant name "Blossom"
- **Background:** Subtle glass effect

---

## Key Patterns to Replicate

1. **Accordion merchant cards** — the most used pattern; merchant info collapsed, stamps shown on expand
2. **Segmented progress bars** — not a continuous bar, but discrete segments (one per stamp slot)
3. **Bottom navigation** — fixed, 4 tabs, active state is distinct green
4. **Glassmorphic search** — subtle, not overpowering
5. **Ticket/voucher styling** — scalloped edges for reward claims (CSS clip-path)
6. **3D emoji illustrations** — merchants pick their stamp emoji, rendered large for visual appeal
7. **Horizontal carousels** — for merchants, gifts, and features
8. **Personal greeting** — "Hey, {name}" creates intimacy

## What NOT to Replicate

1. **NFC flow** — removed entirely
2. **Barcodes** — all replaced with beautiful QR codes
3. **Native iOS chrome** — we're PWA, so no status bar, dynamic island, etc.
4. **Chat/smiley icons in nav** — replace with contextually appropriate icons (Home, Cards, Search, Scan)
