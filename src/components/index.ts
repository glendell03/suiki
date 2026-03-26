/**
 * Barrel export for all Suiki UI components.
 *
 * Import from this file to access any component without knowing its exact path:
 *   import { GlassCard, StampGrid, BottomNav } from "@/components";
 */

export { PageShell } from "./page-shell";
export { default as PageShellDefault } from "./page-shell";

export { GlassCard } from "./glass-card";
export { default as GlassCardDefault } from "./glass-card";

export { BottomNav } from "./bottom-nav";
export { default as BottomNavDefault } from "./bottom-nav";

export { StampGrid } from "./stamp-grid";
export { default as StampGridDefault } from "./stamp-grid";

export { ProgressBarStamps } from "./progress-bar-stamps";
export { default as ProgressBarStampsDefault } from "./progress-bar-stamps";

export { BeautifulQR } from "./beautiful-qr";
export { default as BeautifulQRDefault } from "./beautiful-qr";

export { MerchantCard } from "./merchant-card";
export { default as MerchantCardDefault } from "./merchant-card";

export { SearchBar } from "./search-bar";
export { default as SearchBarDefault } from "./search-bar";

export { Badge } from "./badge";
export { default as BadgeDefault } from "./badge";

export { EmptyState } from "./empty-state";
export { default as EmptyStateDefault } from "./empty-state";

export { WalletDropdown } from "./wallet-dropdown";
export { default as WalletDropdownDefault } from "./wallet-dropdown";

// Re-export updated button with new variants
export { Button } from "./ui/button";
export type { ButtonVariant } from "./ui/button";
