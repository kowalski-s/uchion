/**
 * Safe JSON parsing for LLM responses.
 * Gemini sometimes produces invalid escape sequences like \^, \(, \) etc.
 * This sanitizer strips them before parsing.
 */

/**
 * Remove invalid JSON escape sequences.
 * Valid escapes: \" \\ \/ \b \f \n \r \t \uXXXX
 * Everything else (e.g. \^  \(  \)  \[  \]) — drop the backslash.
 */
function sanitizeJsonString(raw: string): string {
  return raw.replace(/\\(?!["\\/bfnrtu])/g, '')
}

/**
 * Parse JSON from an LLM response with sanitization fallback.
 * 1. Try raw JSON.parse
 * 2. If it fails with bad escape — sanitize and retry
 * 3. If still fails — return null and log the raw string
 */
export function safeJsonParse<T>(raw: string, agentName: string): T | null {
  // Attempt 1: parse as-is
  try {
    return JSON.parse(raw) as T
  } catch {
    // expected — fall through to sanitization
  }

  // Attempt 2: sanitize invalid escapes and retry
  try {
    const sanitized = sanitizeJsonString(raw)
    console.warn(`[${agentName}] Sanitized invalid escape sequences in JSON`)
    return JSON.parse(sanitized) as T
  } catch (err) {
    console.error(
      `[${agentName}] Failed to parse JSON even after sanitization. Raw (first 500 chars):`,
      raw.slice(0, 500),
      err,
    )
    return null
  }
}
