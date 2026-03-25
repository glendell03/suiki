/**
 * Generic API response envelope types used across all server actions and
 * route handlers in Suiki.
 *
 * Usage:
 * ```ts
 * async function fetchProgram(id: string): Promise<ApiResponse<StampProgram>> {
 *   try {
 *     const data = await suiClient.getObject(id);
 *     return { success: true, data };
 *   } catch (err) {
 *     return { success: false, error: "Object not found", code: "NOT_FOUND" };
 *   }
 * }
 *
 * const result = await fetchProgram("0xabc...");
 * if (result.success) {
 *   console.log(result.data.name); // StampProgram
 * } else {
 *   console.error(result.error, result.code);
 * }
 * ```
 */

/** Successful API response carrying a typed payload. */
export type ApiSuccess<T> = { success: true; data: T };

/** Failed API response with a human-readable message and optional error code. */
export type ApiError = { success: false; error: string; code?: string };

/**
 * Discriminated union of success and error states.
 * Narrow with `if (result.success)` before accessing `result.data`.
 */
export type ApiResponse<T> = ApiSuccess<T> | ApiError;
