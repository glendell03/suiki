import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { SUI_NETWORK } from '@/lib/constants';

/**
 * Browser-side SuiClient for client components and hooks.
 *
 * This is NOT the server-side gRPC singleton at src/lib/sui-client.ts.
 * Use this only in 'use client' files — never import in server components or API routes.
 *
 * Supports both HTTP queries and WebSocket subscriptions (subscribeEvent).
 * The SDK derives the WebSocket endpoint automatically from the HTTP URL.
 */
export const suiBrowserClient = new SuiClient({
  url: getFullnodeUrl(SUI_NETWORK),
});
