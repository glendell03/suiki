/**
 * Server-side SuiClient singleton.
 *
 * This module exports a single SuiClient instance configured for the active
 * network. Import this in server components, API routes, and server actions.
 * Do NOT import this in client components — use useSuiClient() from
 * @mysten/dapp-kit instead (it reads from the SuiClientProvider context).
 *
 * The module-level singleton is created once per Node.js process, so it is
 * safely shared across requests in the Next.js server runtime.
 *
 * TODO: install @mysten/sui @mysten/dapp-kit
 * npm install @mysten/sui @mysten/dapp-kit @tanstack/react-query
 */

// TODO: install @mysten/sui
// import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { SUI_NETWORK } from './constants';

// ---------------------------------------------------------------------------
// Stub types — replace with real imports once @mysten/sui is installed
// ---------------------------------------------------------------------------

/**
 * Minimal SuiClient interface.
 * This stub mirrors the subset of the real SuiClient used by this app.
 * Remove this stub and uncomment the real import once dependencies are installed.
 */
export interface SuiClientInterface {
  /** Fetch a single object by ID with optional display / content / type options. */
  getObject(params: {
    id: string;
    options?: {
      showContent?: boolean;
      showDisplay?: boolean;
      showType?: boolean;
    };
  }): Promise<{
    data?: {
      objectId: string;
      content?: unknown;
      display?: unknown;
    } | null;
    error?: unknown;
  }>;

  /** Fetch multiple objects by their IDs in a single RPC call. */
  multiGetObjects(params: {
    ids: string[];
    options?: {
      showContent?: boolean;
      showDisplay?: boolean;
      showType?: boolean;
    };
  }): Promise<
    Array<{
      data?: {
        objectId: string;
        content?: unknown;
      } | null;
      error?: unknown;
    }>
  >;

  /** Query on-chain events emitted by Move modules. */
  queryEvents(params: {
    query:
      | { MoveEventType: string }
      | { Transaction: string }
      | { Sender: string };
    limit?: number;
    cursor?: string | null;
    order?: 'ascending' | 'descending';
  }): Promise<{
    data: Array<{
      id: { txDigest: string; eventSeq: string };
      packageId: string;
      transactionModule: string;
      sender: string;
      type: string;
      parsedJson?: unknown;
      timestampMs?: string;
    }>;
    nextCursor?: string | null;
    hasNextPage: boolean;
  }>;

  /** Execute a signed transaction block. */
  executeTransactionBlock(params: {
    transactionBlock: string;
    signature: string[];
    options?: {
      showEffects?: boolean;
      showEvents?: boolean;
      showObjectChanges?: boolean;
    };
  }): Promise<{
    digest: string;
    effects?: unknown;
    events?: unknown[];
  }>;
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

/**
 * Lazily-created SuiClient singleton.
 *
 * Laziness prevents module-load errors when @mysten/sui is not yet installed
 * (e.g., during scaffolding). Once the dependency is installed, replace the
 * stub below with a real SuiClient instantiation.
 */
let _client: SuiClientInterface | null = null;

/**
 * Returns the shared server-side SuiClient instance.
 *
 * Usage:
 *   import { getSuiClient } from '@/lib/sui-client';
 *   const client = getSuiClient();
 *   const obj = await client.getObject({ id: programId, options: { showContent: true } });
 *
 * After installing @mysten/sui, replace the stub constructor with:
 *   import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
 *   _client = new SuiClient({ url: getFullnodeUrl(SUI_NETWORK) });
 */
export function getSuiClient(): SuiClientInterface {
  if (_client) return _client;

  // TODO: replace stub with real client after running:
  //   npm install @mysten/sui
  //
  // Replacement code:
  //   const { SuiClient, getFullnodeUrl } = await import('@mysten/sui/client');
  //   _client = new SuiClient({ url: getFullnodeUrl(SUI_NETWORK) });

  // Stub implementation — throws on use so callers get a clear error message
  // instead of a confusing "module not found" at import time.
  _client = createNotInstalledStub(SUI_NETWORK);
  return _client;
}

/**
 * Direct export for convenience — identical to calling getSuiClient().
 *
 * Usage:
 *   import { suiClient } from '@/lib/sui-client';
 */
export const suiClient: SuiClientInterface = new Proxy({} as SuiClientInterface, {
  get(_target, prop: string) {
    return getSuiClient()[prop as keyof SuiClientInterface];
  },
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Creates a stub SuiClientInterface that throws a descriptive error on every
 * method call, directing the developer to install the missing dependency.
 *
 * @param network - The configured network, included in the error message for context.
 */
function createNotInstalledStub(network: string): SuiClientInterface {
  const error = (): never => {
    throw new Error(
      `SuiClient is not available. ` +
        `Run "npm install @mysten/sui" and replace the stub in src/lib/sui-client.ts. ` +
        `Configured network: ${network}`,
    );
  };

  return {
    getObject: error,
    multiGetObjects: error,
    queryEvents: error,
    executeTransactionBlock: error,
  };
}
