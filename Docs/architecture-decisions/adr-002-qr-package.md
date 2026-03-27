# ADR-002: QR Code Package — beautiful-qr-code

## Status
Accepted

## Date
2026-03-26

## Context

Suiki's stamp collection flow is entirely QR-code based — there is no NFC implementation. QR codes appear in three distinct contexts: (1) the customer's scan page where the cashier scans the customer's wallet QR, (2) the merchant's program detail page where the customer scans a program QR to register, and (3) the reward claim / congratulations sheet where a voucher QR is presented for merchant redemption.

The existing implementation uses `qrcode.react` v4.2.0, which produces functional but visually plain QR codes — monochrome squares with no brand identity. The reference design (Stampy mockups in `Docs/design-references/`) shows styled QR codes with green dot patterns, rounded corners, and a center logo — none of which `qrcode.react` supports natively without heavy post-processing.

The replacement must: (a) render visually branded QR codes matching the green glassmorphic theme, (b) support a center logo overlay without compromising scan reliability, (c) work within the Next.js 16 App Router client component model, and (d) not introduce a scanning reliability regression relative to the current implementation.

All barcodes visible in the Stampy reference screenshots are being removed from Suiki's implementation — QR codes are the sole machine-readable format.

## Decision

Replace `qrcode.react` with `beautiful-qr-code` v1.0.9 (already present in `package.json`) for all QR code rendering in the UI. `qrcode.react` is retained as a listed `dependency` (not removed) to serve as a zero-migration fallback if `beautiful-qr-code` proves unreliable. All QR rendering in UI components is routed through a single wrapper component: `src/components/beautiful-qr.tsx` (the `BeautifulQR` component). No component imports either QR library directly.

### Why beautiful-qr-code

`beautiful-qr-code` provides:
- Configurable dot shapes (rounded, circular, square) — rounded dots match the glassmorphic aesthetic and the reference design.
- Configurable corner frame styles — rounded corner squares align with `--radius-card: 1rem`.
- Center image overlay support — the Suiki leaf SVG logo can be embedded at the center.
- Foreground color configuration — `#4ade80` (primary green) on a transparent/dark background ties the QR to the brand palette.
- React component API that fits the existing React 19 component model without additional wrappers.

### Error Correction Level: H (High) is Mandatory When Using Center Logo

QR codes encode data redundantly using Reed-Solomon error correction. The four error correction levels (L, M, Q, H) represent the percentage of codewords that can be restored if physically obscured:

| Level | Recovery Capacity | Module Overhead |
|-------|---|---|
| L | ~7% | Smallest code |
| M | ~15% | Standard default |
| Q | ~25% | Recommended for logos |
| H | ~30% | Required for logos |

A center logo overlay physically obscures approximately 20–25% of the QR code's modules. At error correction level M (the `qrcode.react` default), a 20% obscured region exceeds the 15% recovery capacity and produces an unscannable code. Error correction level H must be set for all `BeautifulQR` instances. This is enforced in the wrapper component and is not configurable by callers — it is a non-negotiable implementation constraint.

### Scanning Reliability in Poor Lighting Conditions

Filipino MSME settings include market stalls, dim restaurants, and outdoor food courts where ambient lighting is variable and inconsistent. Three factors affect scan reliability in poor lighting:

1. **Contrast ratio**: `#4ade80` on `#0a1a14` achieves approximately 8.5:1 contrast — sufficient for camera autofocus in low light. Pure black on white is 21:1; the green-on-dark scheme at 8.5:1 is within the reliable scanning range for modern phone cameras (testing shows reliable scanning above ~4:1).
2. **Module size**: Larger QR codes scan more reliably. The customer scan page renders the QR at a minimum of 240×240px on the device screen (approximately 240 CSS pixels = ~720 physical pixels on a 3x density phone). This module size is reliable at scanning distances of 10–50cm.
3. **Screen brightness**: The QR display page forces maximum screen brightness via the Screen Brightness API where supported (not all Android WebViews expose this). A UI instruction ("Increase brightness if scan fails") is displayed below the QR as a graceful fallback.

### QR Payload Security

QR codes never encode raw wallet addresses in plaintext as the sole content. All payloads use base64-encoded JSON to:
- Prevent casual interception and replay of raw addresses by photograph.
- Enable payload type discrimination (`type` field) so the scanner can reject unexpected QR formats.
- Support future payload versioning without a breaking change to the scanner.

Payload schemas:

```
Customer wallet QR (cashier scans):
{ "type": "stamp", "walletAddress": "0x...", "cardId": "0x..." }
→ base64-encoded → QR encoded

Merchant program QR (customer scans to register):
{ "type": "program", "programId": "0x..." }
→ base64-encoded → QR encoded

Reward voucher QR (merchant scans at redemption):
{ "type": "reward", "cardId": "0x...", "rewardIndex": 0, "nonce": "..." }
→ base64-encoded → QR encoded
```

Payload encoding and decoding live exclusively in `src/lib/qr-utils.ts`. No other file constructs or parses QR payloads.

### Barcode Removal

The Stampy reference design shows barcodes in certain screens. Suiki will not implement barcodes. All machine-readable codes are QR codes. This simplifies the scanning infrastructure (one code format, one scanner library: `html5-qrcode`) and avoids the need for a barcode scanning library.

## Consequences

### Positive
- QR codes are visually differentiated from generic Web3 QR codes — the Suiki leaf logo center and green dot pattern are immediately recognizable to repeat users.
- Single `BeautifulQR` wrapper component enforces error correction level H for all rendered codes — eliminates the class of bug where a developer uses the wrong error correction level.
- Base64-encoded JSON payloads enable payload versioning and type safety without breaking existing scanners.
- Removing barcodes reduces the scanner library surface area to one format.

### Negative / Risks
- `beautiful-qr-code` v1.0.9 is a relatively new package with limited community adoption data. Breaking changes between minor versions are possible given early-stage versioning.
- Error correction level H increases QR code module density by approximately 30% vs. level M — the code contains more modules, which at small display sizes can reduce scan reliability in very poor lighting. The 240px minimum size mitigates this.
- The center logo at error correction level H is reliable but has not been tested across the full range of target devices (Xiaomi Redmi, Samsung Galaxy A-series, Realme, Vivo — the Philippine mid-range Android market). Physical device testing is required before production release.
- `beautiful-qr-code` uses a canvas-based rendering approach. Canvas rendering may produce blurry output on non-integer device pixel ratios if the `devicePixelRatio` is not correctly applied. This is a known issue category for canvas QR libraries.

### Mitigations
- **Package maturity:** Pin `beautiful-qr-code` to `1.0.9` in `package.json` (exact version, not a range) until a production validation milestone is reached. Upgrade only after testing.
- **Fallback strategy:** `qrcode.react` remains in `dependencies`. If `beautiful-qr-code` produces scan failures on target devices, the `BeautifulQR` wrapper can be updated to render `qrcode.react` internally without any changes to callers. The API boundary is the `BeautifulQR` component — not either underlying library.
- **Canvas pixel ratio:** The `BeautifulQR` wrapper must pass `window.devicePixelRatio` (or default `2`) to the canvas size parameter to prevent blurry output on high-DPI screens.
- **Physical device testing requirement:** Before merging Phase 2 (QR Infrastructure), the QR code must be scanned successfully from all of the following: an iPhone running Safari, a mid-range Android (Snapdragon 665-class) running Chrome, and a low-end Android (Snapdragon 460-class) running Chrome. Test in indoor dim lighting (< 200 lux). Document results.
