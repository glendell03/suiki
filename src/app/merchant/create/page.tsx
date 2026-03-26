'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { WalletGuard } from '@/components/wallet-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSponsoredTx } from '@/hooks/use-sponsored-tx';
import { buildCreateProgram } from '@/lib/transactions';

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const schema = z.object({
  name: z.string().min(2).max(50),
  logoUrl: z.string().url().optional().or(z.literal('')),
  stampsRequired: z.number().int().min(1).max(100),
  rewardDescription: z.string().min(5).max(200),
});

// ---------------------------------------------------------------------------
// Form field error helper
// ---------------------------------------------------------------------------

/**
 * Extracts the first validation error string from a tanstack-form field state.
 * Returns undefined when there are no errors so callers can omit the prop
 * entirely — required for exactOptionalPropertyTypes compatibility.
 */
function firstFieldError(errors: unknown[]): string | undefined {
  if (errors.length === 0) return undefined;
  const first = errors[0];
  return typeof first === 'string' ? first : undefined;
}

// ---------------------------------------------------------------------------
// Create Program form — rendered after wallet check passes
// ---------------------------------------------------------------------------

/**
 * Inner form rendered inside WalletGuard once the account is available.
 * Uses @tanstack/react-form with Zod field-level validation and the
 * gas-sponsored transaction flow from useSponsoredTx.
 */
function CreateProgramForm() {
  const account = useCurrentAccount();
  const router = useRouter();
  const { executeSponsoredTx, isPending, error: txError, digest } = useSponsoredTx();

  // Redirect to dashboard once the transaction confirms on-chain.
  useEffect(() => {
    if (digest) {
      router.push('/merchant');
    }
  }, [digest, router]);

  // Type is inferred from defaultValues — do not pass explicit type args to
  // useForm in @tanstack/react-form v1 (type arity changed from earlier betas).
  const form = useForm({
    defaultValues: {
      name: '',
      logoUrl: '',
      stampsRequired: 5,
      rewardDescription: '',
    },
    onSubmit: async ({ value }) => {
      if (!account) return;

      const parsed = schema.safeParse(value);
      if (!parsed.success) return;

      const { name, logoUrl, stampsRequired, rewardDescription } = parsed.data;
      const tx = buildCreateProgram(
        account.address,
        name,
        logoUrl ?? '',
        stampsRequired,
        rewardDescription,
      );

      await executeSponsoredTx(tx);
    },
  });

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      {/* Back navigation */}
      <Link
        href="/merchant"
        className="mb-6 inline-flex items-center gap-1 text-sm text-[--color-text-secondary] hover:text-[--color-text-primary]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
            clipRule="evenodd"
          />
        </svg>
        Back to Dashboard
      </Link>

      <h1 className="mb-8 text-xl font-bold text-[--color-text-primary]">
        Create Loyalty Program
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="flex flex-col gap-6"
        aria-label="Create loyalty program form"
      >
        {/* Program name */}
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) => {
              const r = z.string().min(2, 'At least 2 characters').max(50, 'Max 50 characters').safeParse(value);
              return r.success ? undefined : r.error.issues[0]?.message;
            },
          }}
        >
          {(field) => {
            const err = firstFieldError(field.state.meta.errors);
            return (
              <Input
                label="Program Name"
                placeholder="e.g. Cafe Tagalog Stamps"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                disabled={isPending}
                maxLength={50}
                // Only pass error when defined — required by exactOptionalPropertyTypes
                {...(err !== undefined ? { error: err } : {})}
              />
            );
          }}
        </form.Field>

        {/* Logo URL */}
        <form.Field
          name="logoUrl"
          validators={{
            onChange: ({ value }) => {
              if (!value || value === '') return undefined;
              const r = z.string().url('Must be a valid URL').safeParse(value);
              return r.success ? undefined : r.error.issues[0]?.message;
            },
          }}
        >
          {(field) => {
            const err = firstFieldError(field.state.meta.errors);
            return (
              <Input
                label="Logo URL (optional)"
                type="url"
                placeholder="https://example.com/logo.png"
                value={field.state.value ?? ''}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                disabled={isPending}
                {...(err !== undefined ? { error: err } : {})}
              />
            );
          }}
        </form.Field>

        {/* Stamps required */}
        <form.Field
          name="stampsRequired"
          validators={{
            onChange: ({ value }) => {
              const r = z.number().int('Must be a whole number').min(1, 'At least 1').max(100, 'Max 100').safeParse(value);
              return r.success ? undefined : r.error.issues[0]?.message;
            },
          }}
        >
          {(field) => {
            const err = firstFieldError(field.state.meta.errors);
            return (
              <Input
                label="Stamps Required for Reward"
                type="number"
                min={1}
                max={100}
                value={String(field.state.value)}
                onChange={(e) => field.handleChange(Number(e.target.value))}
                onBlur={field.handleBlur}
                disabled={isPending}
                {...(err !== undefined ? { error: err } : {})}
              />
            );
          }}
        </form.Field>

        {/* Reward description — native textarea (not covered by Input) */}
        <form.Field
          name="rewardDescription"
          validators={{
            onChange: ({ value }) => {
              const r = z.string().min(5, 'At least 5 characters').max(200, 'Max 200 characters').safeParse(value);
              return r.success ? undefined : r.error.issues[0]?.message;
            },
          }}
        >
          {(field) => {
            const err = firstFieldError(field.state.meta.errors);
            return (
              <div className="flex flex-col gap-1">
                <label
                  className="text-sm font-medium text-[--color-text-primary]"
                  htmlFor="reward-description"
                >
                  Reward Description
                </label>
                <textarea
                  id="reward-description"
                  placeholder="e.g. Free coffee after 10 stamps"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  disabled={isPending}
                  maxLength={200}
                  rows={3}
                  aria-invalid={err !== undefined ? 'true' : undefined}
                  className={[
                    'rounded-lg border border-[--color-border] bg-[--color-bg-surface] px-4 py-2.5',
                    'text-sm text-[--color-text-primary] placeholder:text-[--color-text-muted]',
                    'transition-colors duration-150 resize-none',
                    'focus:outline-none focus:ring-2 focus:ring-[--color-primary] focus:border-transparent',
                    'disabled:pointer-events-none disabled:opacity-50',
                    err ? 'border-[--color-error] focus:ring-[--color-error]' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
                {err && (
                  <p className="text-xs text-[--color-error]" role="alert">
                    {err}
                  </p>
                )}
              </div>
            );
          }}
        </form.Field>

        {/* Transaction error */}
        {txError && (
          <div
            className="rounded-lg border border-[--color-error] bg-[--color-bg-surface] px-4 py-3 text-sm text-[--color-error]"
            role="alert"
          >
            {txError.message}
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          variant="primary"
          disabled={isPending}
          className="w-full"
        >
          {isPending ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating Program…
            </>
          ) : (
            'Create Program'
          )}
        </Button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

/**
 * Create loyalty program page.
 * Guarded by WalletGuard — prompts wallet connection when no account is present.
 */
export default function CreateProgramPage() {
  return (
    <WalletGuard heading="Create Loyalty Program">
      <CreateProgramForm />
    </WalletGuard>
  );
}
