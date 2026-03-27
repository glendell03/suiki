import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Type-safe environment variable validation using @t3-oss/env-nextjs.
 *
 * Server variables are only accessible in Server Components and API routes.
 * Client variables (NEXT_PUBLIC_*) are safe to expose to the browser.
 *
 * Validation runs at build time via the import in next.config.ts.
 * If required vars are missing the process exits loudly — no silent failures.
 */
export const env = createEnv({
  server: {
    // SEC-05: validate bech32 format at startup so a misconfigured key fails loudly
    // at build/start time rather than returning HTTP 503 on the first request.
    SPONSOR_PRIVATE_KEY: z
      .string()
      .min(1)
      .refine(
        (val) => val.startsWith('suiprivkey1'),
        {
          message:
            'SPONSOR_PRIVATE_KEY must be a bech32-encoded Ed25519 key (starts with "suiprivkey1"). ' +
            'Generate one with: sui keytool generate ed25519',
        },
      ),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },
  client: {
    NEXT_PUBLIC_SUI_NETWORK: z
      .enum(["testnet", "mainnet", "devnet"])
      .default("testnet"),
    NEXT_PUBLIC_PACKAGE_ID: z.string().default("0x_PLACEHOLDER"),
    NEXT_PUBLIC_ENABLE_SPONSOR_GAS: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
  },
  runtimeEnv: {
    SPONSOR_PRIVATE_KEY: process.env.SPONSOR_PRIVATE_KEY,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUI_NETWORK: process.env.NEXT_PUBLIC_SUI_NETWORK,
    NEXT_PUBLIC_PACKAGE_ID: process.env.NEXT_PUBLIC_PACKAGE_ID,
    NEXT_PUBLIC_ENABLE_SPONSOR_GAS: process.env.NEXT_PUBLIC_ENABLE_SPONSOR_GAS,
  },
  /**
   * Skip validation during CI or when SKIP_ENV_VALIDATION is set.
   * Production builds should never set this flag.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Treat empty strings as undefined so that unset vars fail validation
   * rather than passing as empty strings.
   */
  emptyStringAsUndefined: true,
});
