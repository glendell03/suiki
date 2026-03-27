# Design References

Reference screenshots from the "Stampy" loyalty card app concept (Dribbble).
These serve as inspiration for Suiki's UI/UX — adapted for web PWA (not native iOS).

## Screens Captured

| File | Screen | Key Elements |
|------|--------|--------------|
| `01-home-dashboard.png` | Customer home | Search bar, feature cards (Birthday Club, Referral, Eco Hero, Scratch & Win), new merchants carousel, bottom nav |
| `02-qr-congratulations.png` | QR + reward flow | QR code display, congratulations ticket/voucher, discount details, barcode |
| `03-gifts-stampcard.png` | Gifts & stamp card | Personalized greeting, gift cards, discount coupons, stamp card with progress, barcode |
| `04-treat-selector-notification.png` | Treat picker + push | Drag-to-select treat UI, push notification preview, gift card detail |
| `05-cards-progress.png` | All cards progress | Accordion list of merchant cards with stamp progress bars |
| `06-overview-collage.png` | Full app overview | Multiple screens composed together |
| `07-overview-collage-2.png` | Full app overview 2 | Alternative composition with congratulations screen prominent |

## Design Decisions (Suiki Adaptations)

- **No NFC** — QR code only (using `beautiful-qr-code` package)
- **No barcode** — Replace all barcodes with styled QR codes
- **Web PWA** — Must feel like a mobile app but built with Next.js
- **Dark theme** — Deep green/teal gradient (not pure black)
- **Glassmorphism** — Frosted glass cards with subtle borders
- **Emoji stamps** — Merchants choose emoji icons for their stamp cards
