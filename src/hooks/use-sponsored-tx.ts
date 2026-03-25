'use client';

import { useState, useCallback } from 'react';
import { useDAppKit, useCurrentAccount } from '@mysten/dapp-kit-react';
import { useQueryClient } from '@tanstack/react-query';
import { Transaction } from '@mysten/sui/transactions';
import type {
  SponsoredTxRequest,
  SponsoredTxResponse,
  SponsoredTxErrorResponse,
} from '@/types/sui';
import { asSuiAddress } from '@/types/sui';

interface UseSponsoredTxResult {
  /** Execute a sponsored transaction. The gas station pays the fee. */
  executeSponsoredTx: (tx: Transaction) => Promise<void>;
  /** True while the transaction is being signed, sponsored, or waited on. */
  isPending: boolean;
  /** Set when any step of the flow fails. Cleared on the next call. */
  error: Error | null;
  /** The confirmed transaction digest on success, null otherwise. */
  digest: string | null;
}

/**
 * Hook for the gas-sponsored transaction flow.
 *
 * Flow:
 *   1. Caller builds a Transaction and passes it to executeSponsoredTx().
 *   2. Hook sets the sender on the transaction (required before signing).
 *   3. User signs the transaction bytes (no gas payment yet).
 *   4. Signed bytes are posted to /api/sponsor; the server attaches its own
 *      sponsor signature and returns the fully-sponsored transaction bytes.
 *   5. The combined transaction is executed on-chain via dAppKit.
 *   6. Hook waits for finality then invalidates relevant React Query caches.
 */
export function useSponsoredTx(): UseSponsoredTxResult {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [digest, setDigest] = useState<string | null>(null);

  const executeSponsoredTx = useCallback(
    async (tx: Transaction) => {
      if (!account) {
        setError(new Error('No wallet connected. Please connect your wallet first.'));
        return;
      }

      setIsPending(true);
      setError(null);
      setDigest(null);

      try {
        // Step 1: bind sender so the transaction bytes include the correct sender field.
        tx.setSender(account.address);

        // Step 2: user signs the transaction — wallet approves the Move calls
        // but does NOT pay gas yet (the sponsor will cover it).
        const { bytes, signature } = await dAppKit.signTransaction({
          transaction: tx,
        });

        // Step 3: hand the signed bytes to the gas station.
        const body: SponsoredTxRequest = {
          txKindBytes: bytes,
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

        // Step 4: execute with both the user signature and the sponsor signature.
        // dAppKit.signAndExecuteTransaction does not accept additionalSignatures
        // (that is a wallet-standard concept). For sponsored transactions we must
        // call the lower-level client executeTransaction directly, passing both
        // signatures (user + sponsor) in the signatures array.
        const txBytes = Transaction.from(transactionBytes);
        const builtBytes = await txBytes.build({ client: dAppKit.getClient() });
        const result = await dAppKit.getClient().core.executeTransaction({
          transaction: builtBytes,
          signatures: [signature, sponsorSignature],
        });

        // Step 5: check for on-chain failure before declaring success.
        if (result.$kind === 'FailedTransaction') {
          const status = result.FailedTransaction.status;
          const reason = status.success ? 'unknown error' : status.error.message;
          throw new Error(`Transaction failed on-chain: ${reason}`);
        }

        const confirmedDigest = result.Transaction.digest;

        // Step 6: wait for the transaction to be indexed by the node.
        await dAppKit.getClient().core.waitForTransaction({ digest: confirmedDigest });

        setDigest(confirmedDigest);

        // Invalidate wallet-specific caches so UI reflects the new on-chain state.
        await queryClient.invalidateQueries({ queryKey: ['programs', account.address] });
        await queryClient.invalidateQueries({ queryKey: ['cards', account.address] });
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsPending(false);
      }
    },
    [account, dAppKit, queryClient],
  );

  return { executeSponsoredTx, isPending, error, digest };
}
