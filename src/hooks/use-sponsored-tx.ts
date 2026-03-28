'use client';

import { useState, useCallback } from 'react';
import { useDAppKit, useCurrentAccount, useCurrentClient } from '@mysten/dapp-kit-react';
import { useQueryClient } from '@tanstack/react-query';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/utils';
import { env } from '@/env';
import type {
  SponsoredTxRequest,
  SponsoredTxResponse,
  SponsoredTxErrorResponse,
} from '@/types/sui';
import { asSuiAddress } from '@/types/sui';

/**
 * Granular phase of the async transaction flow.
 * Consumers can use this to render step-specific status copy (e.g. "Approve in wallet").
 */
export type TxPhase =
  | 'idle'
  | 'building'      // building tx bytes / calling /api/sponsor
  | 'signing'       // wallet prompt is open, awaiting user approval
  | 'confirming'    // tx submitted, awaiting on-chain finality
  | 'done';         // confirmed — digest is set

interface UseSponsoredTxResult {
  /** Execute a transaction. When NEXT_PUBLIC_ENABLE_SPONSOR_GAS is true, the
   *  gas station pays the fee; otherwise the connected wallet pays.
   *  Returns the confirmed transaction digest on success, or undefined on failure. */
  executeSponsoredTx: (tx: Transaction) => Promise<string | undefined>;
  /** True while the transaction is being signed, sponsored, or waited on. */
  isPending: boolean;
  /** Granular phase for step-specific status copy. */
  phase: TxPhase;
  /** Set when any step of the flow fails. Cleared on the next call. */
  error: Error | null;
  /** The confirmed transaction digest on success, null otherwise. */
  digest: string | null;
}

/**
 * Hook for executing Suiki Move transactions.
 *
 * Direct path (NEXT_PUBLIC_ENABLE_SPONSOR_GAS=false):
 *   1. Calls signAndExecuteTransaction — wallet signs and the wallet adapter submits.
 *   2. Checks result.FailedTransaction for on-chain failure.
 *   3. Calls client.waitForTransaction so the indexer has caught up before cache
 *      invalidation.
 *   4. Invalidates React Query caches.
 *
 * Sponsored path (NEXT_PUBLIC_ENABLE_SPONSOR_GAS=true):
 *   1. Caller builds a Transaction and passes it to executeSponsoredTx().
 *   2. Hook sets the sender on the transaction (required before signing).
 *   3. Transaction kind bytes are built (onlyTransactionKind: true) and posted
 *      to /api/sponsor; the server attaches gas owner/payment/budget, signs as
 *      sponsor, and returns the full transaction bytes + sponsor signature.
 *   4. User signs the sponsored bytes (now containing gas fields) via signTransaction.
 *   5. Both signatures are submitted together via client.core.executeTransaction.
 *   6. Hook waits for finality then invalidates relevant React Query caches.
 */
export function useSponsoredTx(): UseSponsoredTxResult {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  // useCurrentClient must be called at the top level of the hook — not inside the
  // callback — so it always participates in the React rules-of-hooks call order.
  const client = useCurrentClient();
  const queryClient = useQueryClient();

  const [isPending, setIsPending] = useState(false);
  const [phase, setPhase] = useState<TxPhase>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [digest, setDigest] = useState<string | null>(null);

  const executeSponsoredTx = useCallback(
    async (tx: Transaction) => {
      if (!account) {
        setError(new Error('No wallet connected. Please connect your wallet first.'));
        return undefined;
      }

      setIsPending(true);
      setPhase('building');
      setError(null);
      setDigest(null);

      try {
        tx.setSenderIfNotSet(account.address);

        if (!env.NEXT_PUBLIC_ENABLE_SPONSOR_GAS) {
          // --- Direct path: user pays their own gas -------------------------
          // signAndExecuteTransaction opens the wallet prompt internally.
          setPhase('signing');
          const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });

          // result is a discriminated union — always check for failure first.
          if (result.FailedTransaction) {
            throw new Error(
              result.FailedTransaction.status.error?.message ?? 'Transaction failed on-chain',
            );
          }

          const confirmedDigest = result.Transaction.digest;

          // Wait for the transaction to be indexed before invalidating queries.
          // Without this, re-fetched queries may return stale data.
          setPhase('confirming');
          await client.waitForTransaction({ digest: confirmedDigest });

          setPhase('done');
          setDigest(confirmedDigest);
          await queryClient.invalidateQueries({ queryKey: ['programs', account.address] });
          await queryClient.invalidateQueries({ queryKey: ['cards', account.address] });
          return confirmedDigest;
        }

        // --- Sponsored path -----------------------------------------------
        // Step 1: build unsigned transaction-kind bytes to send to the gas station.
        // onlyTransactionKind: true produces a TransactionKind BCS blob that the
        // sponsor wraps in a full TransactionData envelope (adds gas fields).
        const kindBytes = await tx.build({
          client,
          onlyTransactionKind: true,
        });

        // Step 2: POST the kind bytes + sender address to the gas station.
        const body: SponsoredTxRequest = {
          txKindBytes: Buffer.from(kindBytes).toString('base64'),
          sender: asSuiAddress(account.address),
        };

        const sponsorRes = await fetch('/api/sponsor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!sponsorRes.ok) {
          const errPayload: SponsoredTxErrorResponse = await sponsorRes.json();
          throw new Error(errPayload.error ?? `Sponsor API error: ${sponsorRes.status}`);
        }

        const { transactionBytes, sponsorSignature }: SponsoredTxResponse =
          await sponsorRes.json();

        // Step 3: user signs the SPONSORED bytes — the version with the
        // sponsor's gas owner/payment/budget already encoded.
        // The wallet adapter must sign exactly these bytes (not the original kind bytes).
        setPhase('signing');
        const { signature: userSignature } = await dAppKit.signTransaction({
          transaction: Transaction.from(transactionBytes),
        });

        // Step 4: execute with both signatures.
        // Order: [userSignature, sponsorSignature] — user first, sponsor second.
        //
        // transactionBytes is a base64 string (tx.sign() calls toBase64 internally).
        // executeTransaction expects Uint8Array — decode before passing.
        setPhase('confirming');
        const result = await client.core.executeTransaction({
          transaction: fromBase64(transactionBytes),
          signatures: [userSignature, sponsorSignature],
        });

        // Step 5: check for on-chain failure before declaring success.
        if (result.FailedTransaction) {
          const status = result.FailedTransaction.status;
          const reason = status.error?.message ?? 'unknown error';
          throw new Error(`Transaction failed on-chain: ${reason}`);
        }

        const confirmedDigest = result.Transaction.digest;

        // Step 6: wait for the transaction to be indexed by the node before
        // invalidating React Query caches.
        await client.waitForTransaction({ digest: confirmedDigest });

        setPhase('done');
        setDigest(confirmedDigest);

        // Invalidate wallet-specific caches so UI reflects the new on-chain state.
        await queryClient.invalidateQueries({ queryKey: ['programs', account.address] });
        await queryClient.invalidateQueries({ queryKey: ['cards', account.address] });

        return confirmedDigest;
      } catch (err) {
        setPhase('idle');
        setError(err instanceof Error ? err : new Error(String(err)));
        return undefined;
      } finally {
        setIsPending(false);
      }
    },
    [account, dAppKit, client, queryClient],
  );

  return { executeSponsoredTx, isPending, phase, error, digest };
}
