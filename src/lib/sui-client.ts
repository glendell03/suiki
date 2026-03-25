import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SUI_NETWORK } from "./constants";

/** gRPC endpoint per network. */
const GRPC_URLS: Record<"testnet" | "mainnet" | "devnet", string> = {
  testnet: "https://fullnode.testnet.sui.io:443",
  mainnet: "https://fullnode.mainnet.sui.io:443",
  devnet: "https://fullnode.devnet.sui.io:443",
};

/**
 * Server-side SuiGrpcClient singleton.
 *
 * IMPORTANT: Only import this module in Server Components and API routes.
 * Use useSuiClient() from @mysten/dapp-kit in Client Components instead.
 *
 * The singleton is module-level to reuse the underlying gRPC connection across
 * requests within the same Node.js process.
 */
export const suiClient = new SuiGrpcClient({
  network: SUI_NETWORK,
  baseUrl: GRPC_URLS[SUI_NETWORK],
});
