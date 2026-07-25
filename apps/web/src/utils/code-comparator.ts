/**
 * Centralized Code Output Comparator & Input Sanitizer for SmartHire IDE.
 *
 * Implements strict, deterministic output comparison rules:
 * - STDIN Input Normalization (unescapes literal `\n` and `\r\n` sequences from corrupted JSON inputs)
 * - Multiline Output Normalization (CRLF/LF line endings, trailing whitespace removal per line, blank line stripping)
 * - Token-based Comparison Mode (whitespace-invariant token sequence matching)
 * - Numeric Tolerance Comparison Mode (absolute and relative floating point tolerance)
 */

export interface ComparisonOptions {
  mode?: "exact" | "trimmed" | "tokens" | "numeric";
  tolerance?: number; // e.g. 0.0001 for numeric comparison
}

export interface ComparisonResult {
  passed: boolean;
  mode: "exact" | "trimmed" | "tokens" | "numeric";
  normalizedActual: string;
  normalizedExpected: string;
  reason?: string;
}

/**
 * Normalizes raw STDIN input from database or recruiter JSON.
 * Fixes literal double-escaped `\n` or `\r\n` strings stored as text `\n` rather than actual newlines.
 */
export function normalizeStdinInput(rawInput: string): string {
  if (rawInput === null || rawInput === undefined) return "";

  let input = String(rawInput);

  // If input contains literal backslash-n ('\n' as two characters) and no real newlines,
  // unescape literal \r\n and \n to real newline characters.
  if (!input.includes("\n") && (input.includes("\\n") || input.includes("\\r\\n"))) {
    input = input.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  } else {
    // Standardize CRLF to LF
    input = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  }

  return input;
}

/**
 * Standard multiline output normalization.
 * 1. Convert CRLF to LF.
 * 2. Trim trailing whitespace from each line.
 * 3. Remove leading and trailing blank lines.
 * 4. Trim outer leading/trailing whitespace.
 */
export function normalizeOutput(rawOutput: string): string {
  if (rawOutput === null || rawOutput === undefined) return "";

  let str = String(rawOutput);

  // 1. Standardize line endings
  str = str.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 2. Split lines and trim trailing whitespace per line
  const lines = str.split("\n").map((line) => line.trimEnd());

  // 3. Remove leading blank lines
  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }

  // 4. Remove trailing blank lines
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  return lines.join("\n").trim();
}

/**
 * Tokenizes output by splitting on any whitespace sequence.
 */
export function tokenizeOutput(rawOutput: string): string[] {
  const norm = normalizeOutput(rawOutput);
  if (!norm) return [];
  return norm.split(/\s+/).filter(Boolean);
}

/**
 * Main output comparison function.
 */
export function compareOutputs(
  actual: string,
  expected: string,
  options: ComparisonOptions = {}
): ComparisonResult {
  const mode = options.mode || "trimmed";
  const normActual = normalizeOutput(actual);
  const normExpected = normalizeOutput(expected);

  // 1. If expected is empty, fail (test case is invalid)
  if (normExpected.length === 0 && actual === "") {
    // Both empty: if expected output is genuinely intended to be empty
    return {
      passed: true,
      mode,
      normalizedActual: "",
      normalizedExpected: "",
    };
  }

  if (normExpected.length === 0) {
    return {
      passed: false,
      mode,
      normalizedActual: normActual,
      normalizedExpected: normExpected,
      reason: "Expected output is empty",
    };
  }

  // 2. Exact mode
  if (mode === "exact") {
    const passed = String(actual) === String(expected);
    return {
      passed,
      mode: "exact",
      normalizedActual: actual,
      normalizedExpected: expected,
    };
  }

  // 3. Numeric mode (with tolerance)
  if (mode === "numeric") {
    const tol = options.tolerance ?? 0.000001;
    const numActual = Number(normActual);
    const numExpected = Number(normExpected);

    if (!isNaN(numActual) && !isNaN(numExpected)) {
      const diff = Math.abs(numActual - numExpected);
      const relDiff = Math.abs(diff / (numExpected || 1));
      const passed = diff <= tol || relDiff <= tol;
      return {
        passed,
        mode: "numeric",
        normalizedActual: normActual,
        normalizedExpected: normExpected,
      };
    }
  }

  // 4. Trimmed mode (Default)
  // Check exact normalized match (case-insensitive)
  if (normActual.toLowerCase() === normExpected.toLowerCase()) {
    return {
      passed: true,
      mode: "trimmed",
      normalizedActual: normActual,
      normalizedExpected: normExpected,
    };
  }

  // Line-by-line normalized check
  const actualLines = normActual.toLowerCase().split("\n");
  const expectedLines = normExpected.toLowerCase().split("\n");

  if (actualLines.length === expectedLines.length) {
    const linesMatch = actualLines.every((line, i) => line.trim() === expectedLines[i].trim());
    if (linesMatch) {
      return {
        passed: true,
        mode: "trimmed",
        normalizedActual: normActual,
        normalizedExpected: normExpected,
      };
    }
  }

  // 5. Token-based fallback check (Whitespace-invariant token sequence comparison)
  if (mode === "tokens" || mode === "trimmed") {
    const actualTokens = tokenizeOutput(actual);
    const expectedTokens = tokenizeOutput(expected);

    if (actualTokens.length > 0 && actualTokens.length === expectedTokens.length) {
      const tokensMatch = actualTokens.every((token, i) => {
        const expToken = expectedTokens[i];
        if (token.toLowerCase() === expToken.toLowerCase()) return true;

        // Numeric token tolerance if both tokens are numbers
        const nAct = Number(token);
        const nExp = Number(expToken);
        if (!isNaN(nAct) && !isNaN(nExp)) {
          return Math.abs(nAct - nExp) <= 0.0001;
        }

        return false;
      });

      if (tokensMatch) {
        return {
          passed: true,
          mode: "tokens",
          normalizedActual: normActual,
          normalizedExpected: normExpected,
        };
      }
    }
  }

  return {
    passed: false,
    mode,
    normalizedActual: normActual,
    normalizedExpected: normExpected,
  };
}
