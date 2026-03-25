import { SuiGrpcClient } from "@mysten/sui/grpc";
import { env } from "@/env";

/** gRPC endpoint per network. Prefer gRPC over JSON-RPC per Mysten recommendation. */
const GRPC_URLS: Record<"testnet" | "mainnet" | "devnet", string> = {
  testnet: "https://fullnode.testnet.sui.io:443",
  mainnet: "https://fullnode.mainnet.sui.io:443",
  devnet: "https://fullnode.devnet.sui.io:443",
};

/**
 * Server-side SuiGrpcClient singleton.
 *
 * IMPORTANT: Only import this module in Server Components and API routes.
 * Importing it in a Client Component will expose server-side env vars to the
 * browser bundle. Use `src/lib/constants.ts` for client-safe network values.
 *
 * The singleton is module-level to reuse the underlying gRPC connection across
 * requests within the same Node.js process (avoids connection setup overhead).
 */
export const suiClient = new SuiGrpcClient({
  network: env.NEXT_PUBLIC_SUI_NETWORK,
  baseUrl: GRPC_URLS[env.NEXT_PUBLIC_SUI_NETWORK],
});
