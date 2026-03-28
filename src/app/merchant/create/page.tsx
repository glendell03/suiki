// src/app/merchant/create/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Minus, Plus, ImageOff } from "lucide-react";
import { StampCard } from "@/components/stamp-card";
import { ThemePicker } from "@/components/theme-picker";
import { useCurrentClient } from "@mysten/dapp-kit-react";
import { useAccount } from "@/hooks/use-account";
import { AnimatePresence, motion } from "framer-motion";
import { WalletGuard } from "@/components/wallet-guard";
import { PageHeader } from "@/components/page-header";
import { StepIndicator } from "@/components/step-indicator";
import { useSponsoredTx } from "@/hooks/use-sponsored-tx";
import { buildCreateProgram } from "@/lib/transactions";

/** Labels shown in PageHeader for each step. */
const STEP_LABELS = ["Program Name", "Logo", "Stamp Goal", "Reward", "Theme", "Review"] as const;

/** Shared input class string used across text-input steps. */
const INPUT_CLASS = [
  "w-full bg-(--color-surface) border border-(--color-border)",
  "rounded-(--radius-xl) px-4 py-4 text-[17px] text-(--color-text-primary)",
  "placeholder:text-(--color-text-muted) outline-none",
  "focus:border-(--color-brand) focus:shadow-[0_0_0_3px_var(--color-brand-subtle)]",
  "transition-[border-color,box-shadow] duration-150",
].join(" ");

/** Framer Motion variants for step transitions. */
const stepVariants = {
  enter: { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

/**
 * Step 1 -- Program name input.
 */
function StepName({
  value,
  onChange,
  onNext,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}) {
  const valid = value.trim().length >= 2;

  return (
    <div className="flex flex-col gap-4">
      <h2
        className="text-(--color-text-primary)"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 22,
        }}
      >
        What&apos;s your program called?
      </h2>

      <input
        type="text"
        className={INPUT_CLASS}
        placeholder="e.g. Coffee Bean Loyalty Stamps"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && valid) onNext();
        }}
        maxLength={50}
        autoFocus
      />

      <p className="text-[13px] text-(--color-text-muted)">
        Required, at least 2 characters
      </p>

      <div className="mt-8">
        <NextButton disabled={!valid} onClick={onNext} />
      </div>
    </div>
  );
}

/**
 * Step 2 -- Optional logo URL with live StampCard preview.
 */
function StepLogo({
  value,
  onChange,
  onNext,
  programName,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  programName: string;
}) {
  // 'idle' | 'loading' | 'ok' | 'error'
  const [imgState, setImgState] = useState<"idle" | "loading" | "ok" | "error">("idle");

  const isValidUrl = (url: string) => {
    if (!url.trim()) return false; // required
    try { new URL(url); return true; } catch { return false; }
  };

  const showPreview = imgState === "ok";
  const showError = value.trim() && imgState === "error";
  const canProceed = isValidUrl(value) && imgState !== "loading";

  // Reset image state whenever URL changes
  useEffect(() => {
    if (!value.trim()) { setImgState("idle"); return; }
    if (!isValidUrl(value)) { setImgState("error"); return; }
    setImgState("loading");
    const img = new Image();
    img.onload = () => setImgState("ok");
    img.onerror = () => setImgState("error");
    img.src = value;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2
          className="text-(--color-text-primary)"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22 }}
        >
          Add a logo
        </h2>
        <p className="text-[13px] text-(--color-text-muted)">
          Paste a public image URL to brand your stamp card.
        </p>
      </div>

      <input
        type="url"
        className={INPUT_CLASS}
        placeholder="https://example.com/logo.png"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && canProceed) onNext(); }}
        autoFocus
      />

      {/* URL error */}
      {showError && (
        <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--color-error)" }}>
          <ImageOff size={14} aria-hidden={true} />
          <span>Couldn&apos;t load image from this URL.</span>
        </div>
      )}

      {/* Loading shimmer */}
      {imgState === "loading" && (
        <div className="h-4 w-32 animate-pulse rounded-full bg-(--color-border)" />
      )}

      {/* Live StampCard preview */}
      {showPreview && (
        <div className="flex flex-col gap-2">
          <p
            className="text-[12px] font-semibold uppercase tracking-wider text-(--color-text-muted)"
            style={{ letterSpacing: "0.06em" }}
          >
            Preview
          </p>
          <StampCard
            programId="preview"
            merchantName={programName || "Your Program"}
            programName="Loyalty Program"
            logoUrl={value}
            stampCount={3}
            totalStamps={10}
            rewardDescription="Your reward"
            variant="featured"
          />
        </div>
      )}

      <div className="mt-4">
        <NextButton disabled={!canProceed} onClick={onNext} />
      </div>
    </div>
  );
}

/**
 * Step 3 -- Stamp goal with increment/decrement stepper.
 */
function StepStampGoal({
  value,
  onChange,
  onNext,
}: {
  value: number;
  onChange: (v: number) => void;
  onNext: () => void;
}) {
  const MIN = 2;
  const MAX = 50;

  function decrement() {
    onChange(Math.max(MIN, value - 1));
  }

  function increment() {
    onChange(Math.min(MAX, value + 1));
  }

  return (
    <div className="flex flex-col gap-4">
      <h2
        className="text-(--color-text-primary)"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 22,
        }}
      >
        How many stamps to earn a reward?
      </h2>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-6 py-6">
        <button
          type="button"
          onClick={decrement}
          disabled={value <= MIN}
          aria-label="Decrease stamps"
          className="tap-target flex items-center justify-center rounded-full bg-(--color-surface) border border-(--color-border) disabled:opacity-30 transition-opacity"
          style={{ width: 48, height: 48 }}
        >
          <Minus size={20} aria-hidden={true} className="text-(--color-text-primary)" />
        </button>

        <span
          className="text-(--color-text-primary) tabular-nums"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 48,
            minWidth: "3ch",
            textAlign: "center",
          }}
        >
          {value}
        </span>

        <button
          type="button"
          onClick={increment}
          disabled={value >= MAX}
          aria-label="Increase stamps"
          className="tap-target flex items-center justify-center rounded-full bg-(--color-surface) border border-(--color-border) disabled:opacity-30 transition-opacity"
          style={{ width: 48, height: 48 }}
        >
          <Plus size={20} aria-hidden={true} className="text-(--color-text-primary)" />
        </button>
      </div>

      <p className="text-[13px] text-(--color-text-muted) text-center">
        Customers will stamp on each visit
      </p>

      <div className="mt-8">
        <NextButton disabled={false} onClick={onNext} />
      </div>
    </div>
  );
}

/**
 * Step 3 -- Reward description input.
 */
function StepReward({
  value,
  onChange,
  onNext,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}) {
  const valid = value.trim().length >= 5;

  return (
    <div className="flex flex-col gap-4">
      <h2
        className="text-(--color-text-primary)"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 22,
        }}
      >
        What do customers earn?
      </h2>

      <input
        type="text"
        className={INPUT_CLASS}
        placeholder="e.g. One free coffee"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && valid) onNext();
        }}
        maxLength={200}
        autoFocus
      />

      <p className="text-[13px] text-(--color-text-muted)">
        Required, at least 5 characters
      </p>

      <div className="mt-8">
        <NextButton disabled={!valid} onClick={onNext} />
      </div>
    </div>
  );
}

/**
 * Step 5 -- Stamp card theme picker.
 */
function StepTheme({
  value,
  onChange,
  onNext,
}: {
  value: number;
  onChange: (v: number) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2
          className="text-(--color-text-primary)"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22 }}
        >
          Pick a stamp style
        </h2>
        <p className="text-[13px] text-(--color-text-muted)">
          Choose how your stamps look. Premium styles can be unlocked later.
        </p>
      </div>

      <ThemePicker value={value} onChange={onChange} />

      <div className="mt-8">
        <NextButton disabled={false} onClick={onNext} />
      </div>
    </div>
  );
}

/**
 * Step 6 -- Review and submit.
 */
function StepReview({
  form,
  isSubmitting,
  error,
  onSubmit,
}: {
  form: { name: string; logoUrl: string; stampsRequired: number; rewardDescription: string; themeId: number };
  isSubmitting: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <h2
        className="text-(--color-text-primary)"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 22,
        }}
      >
        Review your program
      </h2>

      {/* Live StampCard preview */}
      <StampCard
        programId="preview"
        merchantName={form.name}
        programName="Loyalty Program"
        logoUrl={form.logoUrl || ""}
        stampCount={0}
        totalStamps={form.stampsRequired}
        rewardDescription={form.rewardDescription}
        variant="featured"
      />

      {/* Error */}
      {error && (
        <div
          className="rounded-(--radius-xl) border border-red-300 bg-red-50 px-4 py-3 text-[14px] text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Submit CTA */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        className="tap-target w-full flex items-center justify-center gap-2 text-white font-semibold disabled:opacity-60 transition-opacity"
        style={{
          background: "var(--color-brand)",
          borderRadius: "var(--radius-full)",
          padding: "14px 0",
          fontSize: 17,
          fontFamily: "var(--font-display)",
        }}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Creating...
          </>
        ) : (
          "Create Program"
        )}
      </button>
    </div>
  );
}

/**
 * Reusable "Next" button used at the bottom of steps 1-3.
 */
function NextButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="tap-target w-full text-white font-semibold disabled:opacity-30 transition-opacity"
      style={{
        background: "var(--color-brand)",
        borderRadius: "var(--radius-full)",
        padding: "14px 0",
        fontSize: 17,
        fontFamily: "var(--font-display)",
      }}
    >
      Next &rarr;
    </button>
  );
}

// ---------------------------------------------------------------------------
// Post-transaction helpers
// ---------------------------------------------------------------------------

/**
 * Queries the transaction effects for the created StampProgram object ID.
 * Looks for a newly created object whose type includes "StampProgram".
 *
 * Uses `client.core.getTransaction` because the dapp-kit client type
 * (`ClientWithCoreApi`) exposes transport methods on the `.core` accessor.
 */
async function extractCreatedProgramId(
  client: ReturnType<typeof useCurrentClient>,
  digest: string,
): Promise<string> {
  const result = await client.core.getTransaction({
    digest,
    include: { effects: true, objectTypes: true },
  });

  const tx = result.Transaction ?? result.FailedTransaction;
  if (!tx?.effects || !tx.objectTypes) {
    throw new Error("Could not read transaction effects");
  }

  const created = tx.effects.changedObjects.find(
    (obj: { idOperation: string; objectId: string }) => {
      if (obj.idOperation !== "Created") return false;
      const objectType = tx.objectTypes![obj.objectId];
      return objectType?.includes("StampProgram");
    },
  );

  if (!created) {
    throw new Error("StampProgram object not found in transaction effects");
  }

  return created.objectId;
}

/** Payload for the off-chain program metadata API. */
interface ProgramMetadataPayload {
  programId: string;
  merchantAddress: string;
  name: string;
  logoUrl: string;
  rewardDescription: string;
  stampsRequired: number;
}

/**
 * POSTs program metadata to the off-chain DB API.
 * Best-effort: logs errors but does not throw, because the on-chain
 * record already exists and metadata can be re-posted later.
 */
async function postProgramMetadata(payload: ProgramMetadataPayload): Promise<void> {
  try {
    const res = await fetch("/api/merchant/programs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(
        `[postProgramMetadata] API returned ${res.status}:`,
        await res.text().catch(() => "unknown"),
      );
    }
  } catch (err) {
    // Network-level failure — log but don't block UX.
    console.error("[postProgramMetadata] Failed to POST metadata:", err);
  }
}

/**
 * Multi-step create-program form. Manages step navigation, validation,
 * and submission via the sponsored transaction hook.
 */
function CreateProgramForm() {
  const router = useRouter();
  const account = useAccount();
  const client = useCurrentClient();
  const { executeSponsoredTx } = useSponsoredTx();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    logoUrl: "",
    stampsRequired: 10,
    rewardDescription: "",
    themeId: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Navigate back -- if step 1, go to merchant dashboard. */
  function handleBack() {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  }

  /**
   * Two-step submit: (1) on-chain tx, (2) POST off-chain metadata to DB.
   *
   * V3 change: logoUrl and rewardDescription are no longer stored on-chain.
   * After the sponsored tx succeeds, we extract the created StampProgram
   * object ID from the transaction effects and POST metadata to the DB API.
   * If the metadata POST fails, we log the error but still navigate away
   * because the on-chain record exists and metadata can be re-posted later.
   */
  async function handleCreate() {
    if (!account) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const tx = buildCreateProgram({
        name: form.name,
        stampsRequired: form.stampsRequired,
        themeId: form.themeId,
      });
      const digest = await executeSponsoredTx(tx);
      if (!digest) throw new Error("Transaction did not return a digest");

      // Extract the created StampProgram object ID from transaction effects.
      const programId = await extractCreatedProgramId(client, digest);

      // POST off-chain metadata to the DB API (best-effort).
      await postProgramMetadata({
        programId,
        merchantAddress: account.address,
        name: form.name,
        logoUrl: form.logoUrl,
        rewardDescription: form.rewardDescription,
        stampsRequired: form.stampsRequired,
      });

      router.push("/merchant");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-(--color-bg-base) flex flex-col">
      {/* Fixed header */}
      <PageHeader
        title={STEP_LABELS[step - 1] ?? "Create"}
        leftAction={
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            className="tap-target flex items-center justify-center"
            style={{ width: 40, height: 40 }}
          >
            <ChevronLeft
              size={24}
              className="text-(--color-text-primary)"
            />
          </button>
        }
      />

      {/* Content -- offset below fixed header */}
      <div className="mx-auto w-full max-w-[430px] flex flex-col px-5 gap-6 pt-[calc(56px+env(safe-area-inset-top)+2rem)] pb-12">
        {/* Step indicator */}
        <div className="flex justify-center">
          <StepIndicator steps={6} current={step} />
        </div>

        {/* Step content with animated transitions */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex flex-col"
          >
            {step === 1 && (
              <StepName
                value={form.name}
                onChange={(name) => setForm((f) => ({ ...f, name }))}
                onNext={() => setStep(2)}
              />
            )}

            {step === 2 && (
              <StepLogo
                value={form.logoUrl}
                onChange={(logoUrl) => setForm((f) => ({ ...f, logoUrl }))}
                onNext={() => setStep(3)}
                programName={form.name}
              />
            )}

            {step === 3 && (
              <StepStampGoal
                value={form.stampsRequired}
                onChange={(stampsRequired) =>
                  setForm((f) => ({ ...f, stampsRequired }))
                }
                onNext={() => setStep(4)}
              />
            )}

            {step === 4 && (
              <StepReward
                value={form.rewardDescription}
                onChange={(rewardDescription) =>
                  setForm((f) => ({ ...f, rewardDescription }))
                }
                onNext={() => setStep(5)}
              />
            )}

            {step === 5 && (
              <StepTheme
                value={form.themeId}
                onChange={(themeId) => setForm((f) => ({ ...f, themeId }))}
                onNext={() => setStep(6)}
              />
            )}

            {step === 6 && (
              <StepReview
                form={form}
                isSubmitting={isSubmitting}
                error={error}
                onSubmit={() => void handleCreate()}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Create loyalty program page.
 * Guarded by WalletGuard -- prompts wallet connection when no account is present.
 */
export default function CreateProgramPage() {
  return (
    <WalletGuard heading="Create Loyalty Program">
      <CreateProgramForm />
    </WalletGuard>
  );
}
