import { env } from "@/env";

/**
 * The SUI network to connect to.
 * Derives from the validated NEXT_PUBLIC_SUI_NETWORK env variable.
 * Safe to use in both Server and Client Components.
 */
export const SUI_NETWORK = env.NEXT_PUBLIC_SUI_NETWORK;

/**
 * The deployed Move package ID on the SUI network.
 * Set to the real address after Task 4 (Deploy).
 * Safe to use in both Server and Client Components.
 */
export const PACKAGE_ID = env.NEXT_PUBLIC_PACKAGE_ID;
