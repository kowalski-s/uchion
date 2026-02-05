/**
 * Safe JSON parsing for LLM responses.
 * Gemini sometimes produces invalid escape sequences like \^, \(, \) in JSON strings.
 * This sanitizer fixes them before parsing.
 */

/**
 * Remove invalid JSON escape sequences by walking the string sequentially.
 * Valid JSON escapes: \" \\ \/ \b \f \n \r \t \uXXXX
 *
 * Unlike a simple regex, this correctly handles already-escaped backslashes:
 *   \\sqrt  →  \\sqrt  (preserved: literal backslash + sqrt)
 *   \sqrt   →  sqrt    (fixed: removed invalid \s)
 */
function sanitizeJsonString(raw: string): string {
  const result: string[] = []
  let i = 0

  while (i < raw.length) {
    if (raw[i] === '\\') {
      const next = raw[i + 1]
      if (next === undefined) {
        // Trailing backslash — drop it
        i++
      } else if ('"\\bfnrt/'.includes(next)) {
        // Valid 2-char escape sequence — keep both
        result.push('\\', next)
        i += 2
      } else if (next === 'u') {
        // \uXXXX — need exactly 4 hex digits
        const hex = raw.slice(i + 2, i + 6)
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          result.push(raw.slice(i, i + 6))
          i += 6
        } else {
          // Invalid \u without proper hex — drop the backslash
          i++
        }
      } else {
        // Invalid escape (\s, \^, \(, etc.) — drop the backslash, keep the char
        i++
      }
    } else {
      result.push(raw[i])
      i++
    }
  }

  return result.join('')
}

/**
 * Parse JSON from an LLM response with sanitization fallback.
 * 1. Try raw JSON.parse
 * 2. If it fails — sanitize invalid escapes and retry
 * 3. If still fails — return null (don't crash the pipeline)
 */
export function safeJsonParse<T>(raw: string, agentName: string): T | null {
  // Attempt 1: parse as-is
  try {
    return JSON.parse(raw) as T
  } catch {
    // expected for Gemini responses with bad escapes — fall through
  }

  // Attempt 2: sanitize invalid escape sequences and retry
  try {
    const sanitized = sanitizeJsonString(raw)
    console.warn(`[${agentName}] Sanitized invalid escape sequences in JSON`)
    return JSON.parse(sanitized) as T
  } catch (err) {
    console.error(
      `[${agentName}] JSON parse failed even after sanitization. Raw (first 500 chars):`,
      raw.slice(0, 500),
      err,
    )
    return null
  }
}
