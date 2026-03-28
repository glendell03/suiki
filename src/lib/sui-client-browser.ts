'use client';

import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { SUI_NETWORK } from '@/lib/constants';

const FULLNODE_URLS: Record<'testnet' | 'mainnet' | 'devnet', string> = {
  testnet: 'https://fullnode.testnet.sui.io:443',
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
};

/**
 * Browser-side JSON-RPC Sui client for client components and hooks.
 *
 * This is NOT the server-side gRPC singleton at src/lib/sui-client.ts.
 * Use this only in 'use client' files — never import in server components or API routes.
 *
 * Supports HTTP queries and event polling (queryEvents).
 */
export const suiBrowserClient = new SuiJsonRpcClient({
  url: FULLNODE_URLS[SUI_NETWORK],
});
