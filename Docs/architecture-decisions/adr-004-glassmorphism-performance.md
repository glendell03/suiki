# ADR-004: Glassmorphism Performance

## Status
Accepted

## Date
2026-03-26

## Context

Glassmorphism — UI surfaces that appear as frosted glass panels floating above a gradient background — is the central visual motif of the Suiki redesign. The primary technical mechanism is `backdrop-filter: blur()`, which applies a Gaussian blur to all pixels behind the element. This filter is GPU-composited: the browser promotes the element to its own compositing layer and the GPU applies the blur shader per frame.

The target market is Filipino MSME customers on mid-range Android devices: Snapdragon 665, 680, or 695-class SoCs, Adreno 610/619 GPUs, 4–6 GB RAM. These devices deliver 60 fps on static content but struggle with GPU-intensive effects applied to many elements simultaneously. Unconstrained glassmorphism across a scrolling list of 6–10 merchant cards would create unacceptable scroll jank on this hardware class.

This ADR defines the precise performance contract for glassmorphism: which elements may use `backdrop-filter: blur()`, which must use simulated glass instead, and what CSS optimizations are mandatory.

## Decision

### Performance Benchmark Target

The target is **60 fps sustained scroll** on a device equivalent to a Snapdragon 665 SoC with Adreno 610 GPU. This hardware class represents the 50th percentile of the Philippine Android market as of 2025. Testing must be performed on a physical device of this class, not a desktop browser emulator. Chrome DevTools device emulation does not replicate GPU performance constraints.

If 60 fps cannot be achieved, the acceptable degraded target is **45 fps with no visible stutter** (no frame drops below 30 fps). Visible stutter — where the user perceives individual frames — is the hard failure condition, not the fps number itself.

### Blur Surface Restriction: Two Surfaces Only

`backdrop-filter: blur()` is permitted on exactly two element categories:

**1. BottomNav (`src/components/bottom-nav.tsx`)**
The nav is `position: fixed` and does not participate in scroll layout. The browser can hoist it to a permanent compositing layer that is rendered once per frame at fixed coordinates. The GPU cost is paid once per frame regardless of scroll position. This is acceptable.

**2. Modal overlays and bottom sheets**
Modals appear infrequently (user-triggered actions) and occlude the majority of the screen when open. During modal open, the background scroll is locked. There is no scroll-concurrent blur rendering. The GPU cost is paid only during the modal open/close animation (350ms per `--duration-sheet`) and held static while the modal is visible.

**All other surfaces: simulated glass, no blur.**

The `GlassCard` component and all list items use:
```
background: var(--glass-bg);       /* rgba(20, 60, 40, 0.4) — semi-transparent */
border: 1px solid var(--glass-border);
box-shadow: var(--glass-shadow);
border-radius: var(--radius-card);
```

No `backdrop-filter` on `.glass-card`. The semi-transparent green background against the page gradient creates a visual layering effect that reads as glass at normal viewing distances — without GPU blur cost.

### CSS Containment: `contain: layout paint`

All glass card elements must include CSS containment to limit the browser's layout and paint scope:

```css
.glass-card {
  contain: layout paint;
}
```

`contain: layout` tells the browser that nothing outside the element affects its layout, and nothing inside affects the layout of elements outside it. `contain: paint` tells the browser the element's children do not visually overflow its bounds. Together, these allow the browser to skip re-layout and re-paint of adjacent elements when a glass card's content changes (e.g., stamp count update). This is particularly valuable in the cards list where multiple cards may update simultaneously after a React Query refetch.

Do not use `contain: strict` — this also implies `contain: size`, which breaks height-auto elements.

### `will-change: transform` — Sparse Use Policy

`will-change: transform` is a hint to the browser to promote the element to a compositing layer in advance of an animation. This improves animation smoothness by eliminating the layer-promotion cost at animation start, but it permanently consumes GPU memory for the compositing layer.

**Rules:**

- `will-change: transform` is set only on elements that are **actively animating**. It must be applied via JavaScript at animation start and removed at animation end — not set statically in CSS.
- Exception: the `BottomNav` may set `will-change: transform` statically since it is always composited.
- Cards that use the `.tap-target` press animation do not use `will-change: transform` statically. The `transform: scale()` on `:active` at 150ms duration does not require pre-promotion — the 150ms includes the promotion time for this hardware class.
- The bottom sheet / modal animation (350ms) benefits from pre-promotion: add `will-change: transform` when the open trigger fires, remove it in the `transitionend` event handler.

Applying `will-change: transform` to every card in a list is the single most common glassmorphism performance anti-pattern. It consumes compositing layer memory proportional to the number of visible cards and causes GPU memory pressure on devices with shared CPU/GPU memory (which includes all mid-range ARM SoCs).

### Animation Token Compliance

All animations must use the timing tokens from `globals.css`. No hardcoded timing values:

| Animation | Token | Value |
|---|---|---|
| Press feedback | `--duration-micro` + `--ease-out` | 150ms cubic-bezier(0.16,1,0.3,1) |
| Card expand/collapse | `--duration-normal` + `--ease-out` | 250ms cubic-bezier(0.16,1,0.3,1) |
| Sheet open/close | `--duration-sheet` + `--ease-out` | 350ms cubic-bezier(0.16,1,0.3,1) |

`prefers-reduced-motion: reduce` collapses all these to `0.01ms` via the global rule in `globals.css`. This is already implemented and must not be overridden by component-level CSS.

### Testing Recommendation

Performance testing must occur at two checkpoints:

**Checkpoint 1: End of Phase 1 (Foundation)**
Test the `BottomNav` + `GlassCard` + `PageShell` composition in isolation with 10 mock cards rendered in a scrolling list. Scroll for 10 seconds. Record FPS using Chrome DevTools Performance tab connected to a physical mid-range Android device via USB debugging. Pass criterion: no frames below 45 fps during scroll.

**Checkpoint 2: End of Phase 3 (Customer Screens)**
Test the full customer home page with live data (real React Query fetches from testnet). Scroll through merchant cards, open/close an expanded card, switch tabs. Record FPS for the full interaction sequence. Pass criterion: no frames below 45 fps during scroll, no frames below 30 fps during card expand animation.

If either checkpoint fails, the first remediation is removing `backdrop-filter` from `BottomNav`. If that does not recover the target FPS, reduce `--glass-blur` from 20px to 12px for the permitted blur surfaces. Do not remove glassmorphism tokens from the design system as a first response — diagnose the specific compositing cost first.

## Consequences

### Positive
- Constraining `backdrop-filter: blur()` to two non-scrolling surfaces eliminates the primary GPU performance risk of glassmorphism on mid-range Android.
- CSS containment (`contain: layout paint`) on `.glass-card` reduces layout thrashing during React Query-driven list updates.
- Sparse `will-change` policy prevents GPU memory pressure that degrades overall device performance beyond just the app's frame rate.
- Simulated glass (semi-transparent background, no blur) is indistinguishable from real blur glassmorphism at normal phone viewing distances (30–50cm) — the visual quality trade-off is negligible.
- Performance checkpoints at Phase 1 and Phase 3 catch regressions before they accumulate across all screens.

### Negative / Risks
- Designers reviewing the app on a high-end MacBook or iPhone 15 Pro may not perceive the performance issues that exist on target hardware — all glassmorphism will look smooth on those devices regardless of implementation quality.
- The two-surface blur restriction is a convention, not a compile-time enforcement. A future developer adding `backdrop-filter` to a card violates this ADR silently — there is no lint rule that detects this.
- `contain: layout paint` on glass cards prevents child elements from visually overflowing the card boundary. If a design calls for a tooltip or dropdown that appears outside the card bounds, this will be clipped. The design must be adjusted to avoid such overflow.
- Removing `will-change: transform` from card animations means the first press of each card session pays the compositing layer promotion cost (~8–12ms on target hardware). This is a single-frame spike, not sustained jank, and is acceptable.

### Mitigations
- **Designer review on target hardware:** All visual design sign-off must include a review session on a physical mid-range Android device. Design decisions made exclusively on high-end hardware are invalid for this product.
- **Lint convention:** Add a comment block to `.glass-card` in `globals.css` that explicitly states "No backdrop-filter on this class — by ADR-004". This is a documentation guardrail, not a technical one, but it is the most practical option without a custom ESLint rule.
- **Overflow from cards:** Any UI element that must overflow a card boundary (e.g., a contextual action menu) must be rendered as a portal to the document root, outside the card DOM tree.
- **First-press promotion spike:** The 8–12ms promotion spike for the first press is below the perceptual threshold for touch response (humans perceive delays above ~100ms as a lag). No mitigation required.
