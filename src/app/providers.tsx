"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createDAppKit } from "@mysten/dapp-kit-core";
import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { MotionConfig } from "framer-motion";

// gRPC endpoints per network (preferred over JSON-RPC per Mysten recommendation)
const GRPC_URLS: Record<"testnet" | "mainnet" | "devnet", string> = {
  testnet: "https://fullnode.testnet.sui.io:443",
  mainnet: "https://fullnode.mainnet.sui.io:443",
  devnet: "https://fullnode.devnet.sui.io:443",
};

const dAppKit = createDAppKit({
  networks: ["testnet", "mainnet", "devnet"] as const,
  defaultNetwork: "testnet",
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
});

// TypeScript module augmentation so useDAppKit() is fully typed
// without requiring consumers to pass a generic type argument.
declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}

/** Root provider tree. Order matters: QueryClientProvider wraps DAppKitProvider
 * so blockchain hooks can use React Query's cache for server data independently. */
export function Providers({ children }: { children: React.ReactNode }) {
  // useState factory prevents QueryClient from being shared across SSR requests
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60 * 1000 } },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </DAppKitProvider>
    </QueryClientProvider>
  );
}
