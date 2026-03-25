import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { SUI_NETWORK } from "./constants";

/**
 * Server-side SuiClient singleton.
 *
 * IMPORTANT: Only import this module in Server Components and API routes.
 * Use useSuiClient() from @mysten/dapp-kit in Client Components instead.
 *
 * The singleton is module-level to reuse the underlying connection across
 * requests within the same Node.js process.
 */
export const suiClient = new SuiClient({
  url: getFullnodeUrl(SUI_NETWORK),
});
