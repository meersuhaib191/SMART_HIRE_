import { NextRequest, NextResponse } from "next/server";
import { logger } from "@smarthire/logger";
import vm from "vm";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

interface TestCasePayload {
  id: string;
  input: string;
  expectedOutput: string;
  hidden?: boolean;
}

// ─── Output Normalization for Comparison ──────────────────────────────────────

function normalizeOutput(output: string): string {
  return String(output ?? "")
    .trim()
    // Normalize line endings
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Remove trailing whitespace on each line
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    // Remove trailing newlines
    .replace(/\n+$/, "");
}

function outputsMatch(actual: string, expected: string): boolean {
  const normActual = normalizeOutput(actual);
  const normExpected = normalizeOutput(expected);

  // Empty expected means we can't validate
  if (normExpected.length === 0) return false;

  // Exact match (case-insensitive)
  if (normActual.toLowerCase() === normExpected.toLowerCase()) return true;

  // Try line-by-line comparison (handles trailing spaces per line)
  const actualLines = normActual.toLowerCase().split("\n").filter(Boolean);
  const expectedLines = normExpected.toLowerCase().split("\n").filter(Boolean);

  if (actualLines.length === expectedLines.length) {
    const allMatch = actualLines.every((line, i) => line.trim() === expectedLines[i].trim());
    if (allMatch) return true;
  }

  // Try numeric comparison for single-value outputs
  if (!normActual.includes("\n") && !normExpected.includes("\n")) {
    const numActual = Number(normActual);
    const numExpected = Number(normExpected);
    if (!isNaN(numActual) && !isNaN(numExpected) && numActual === numExpected) return true;
  }

  return false;
}

// ─── Code Execution Engine ────────────────────────────────────────────────────

export function executeUniversalCode(code: string, language: string, inputStr: string): string {
  const cleanInput = (inputStr ?? "").trim();
  const lang = (language || "javascript").toLowerCase();

  // 1. Python execution — try native CLI first
  if (lang === "python" || lang === "python3") {
    const pythonCommands = ["python3", "python", "py"];
    for (const cmd of pythonCommands) {
      try {
        const tmpDir = os.tmpdir();
        const tmpFile = path.join(tmpDir, `py_${Date.now()}_${Math.random().toString(36).slice(2)}.py`);
        fs.writeFileSync(tmpFile, code, "utf-8");

        const stdout = execFileSync(cmd, [tmpFile], {
          input: cleanInput,
          timeout: 5000,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });

        try { fs.unlinkSync(tmpFile); } catch {}
        if (stdout !== undefined && stdout !== null) {
          return String(stdout).trim();
        }
      } catch (err: any) {
        // If the command exists but the code has a runtime error, capture it
        if (err?.stderr) {
          const stderr = String(err.stderr).trim();
          if (stderr.includes("Error") || stderr.includes("Traceback")) {
            return `Runtime Error: ${stderr.split("\n").pop() || stderr}`;
          }
        }
        // If command not found, try next
        continue;
      }
    }

    // 2. JS Fallback for Python (serverless environments without python binary)
    // This is a best-effort transpiler for simple Python patterns
    try {
      return executePythonFallback(code, cleanInput);
    } catch {
      return "";
    }
  }

  // 3. JavaScript & TypeScript Execution via VM sandbox
  if (lang === "javascript" || lang === "typescript") {
    try {
      return executeJavaScript(code, cleanInput);
    } catch (err: any) {
      return `Runtime Error: ${err.message || String(err)}`;
    }
  }

  // 4. C/C++/Java/C# — not available server-side, return empty
  return "";
}

// ─── JavaScript VM Sandbox ────────────────────────────────────────────────────

function executeJavaScript(code: string, input: string): string {
  const outputBuffer: string[] = [];
  const customConsole = {
    log: (...args: any[]) => outputBuffer.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ")),
    error: (...args: any[]) => outputBuffer.push(args.map(a => String(a)).join(" ")),
  };

  const sandbox = {
    console: customConsole,
    input,
    require: (moduleName: string) => {
      if (moduleName === "fs") {
        return {
          readFileSync: (_fd: any, _enc?: string) => input,
        };
      }
      throw new Error(`Module ${moduleName} is not permitted in sandbox.`);
    },
    Buffer,
    parseInt,
    parseFloat,
    Number,
    String,
    Array,
    Math,
    JSON,
    Map,
    Set,
    Object,
    RegExp,
    isNaN,
    isFinite,
  };

  const context = vm.createContext(sandbox);
  const wrappedScript = new vm.Script(`
    try {
      ${code}
      if (typeof solve === 'function') {
        const res = solve(input);
        if (res !== undefined && res !== null) console.log(res);
      }
    } catch (e) {
      console.error("Runtime Error: " + (e.message || e));
    }
  `);

  wrappedScript.runInContext(context, { timeout: 5000 });
  return outputBuffer.join("\n").trim();
}

// ─── Python Fallback Transpiler ───────────────────────────────────────────────

function executePythonFallback(code: string, input: string): string {
  const outputBuffer: string[] = [];

  // Check if this is a simple solve() pattern
  const hasSolveFunc = /def\s+solve\s*\(/.test(code);

  if (!hasSolveFunc) {
    // Try to directly execute simple scripts with print statements
    return executeSimplePython(code, input, outputBuffer);
  }

  // Extract the solve function body and try to convert it
  let jsCode = code;

  // Remove comments (but preserve strings)
  jsCode = jsCode.replace(/#(?![!]).*$/gm, "");

  // Convert Python function definitions
  jsCode = jsCode.replace(/def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*[^:]+)?\s*:/g, "function $1($2) {");

  // Convert Python control structures
  jsCode = jsCode.replace(/\belif\b/g, "} else if");
  jsCode = jsCode.replace(/\belse\s*:/g, "} else {");
  jsCode = jsCode.replace(/\bif\s+(.+?):/g, "if ($1) {");
  jsCode = jsCode.replace(/\bwhile\s+(.+?):/g, "while ($1) {");
  jsCode = jsCode.replace(/\bfor\s+(\w+)\s+in\s+range\s*\(([^)]+)\)\s*:/g, (_, v, args) => {
    const parts = args.split(",").map((s: string) => s.trim());
    if (parts.length === 1) return `for (let ${v} = 0; ${v} < ${parts[0]}; ${v}++) {`;
    if (parts.length === 2) return `for (let ${v} = ${parts[0]}; ${v} < ${parts[1]}; ${v}++) {`;
    return `for (let ${v} = ${parts[0]}; ${v} < ${parts[1]}; ${v} += ${parts[2]}) {`;
  });
  jsCode = jsCode.replace(/\bfor\s+(\w+)\s+in\s+(.+?):/g, "for (const $1 of $2) {");

  // Convert main guard
  jsCode = jsCode.replace(/if\s+\(?__name__\s*==\s*['"]__main__['"]\)?\s*\{?/g, "if (true) {");

  // Convert builtins
  jsCode = jsCode.replace(/sys\.stdin\.read\(\)/g, "input");
  jsCode = jsCode.replace(/input\(\)/g, "input");
  jsCode = jsCode.replace(/print\((.+?)\)/g, "console.log($1)");
  jsCode = jsCode.replace(/\blen\(([^)]+)\)/g, "($1).length");
  jsCode = jsCode.replace(/\bstr\(([^)]+)\)/g, "String($1)");
  jsCode = jsCode.replace(/\bint\(([^)]+)\)/g, "parseInt($1)");
  jsCode = jsCode.replace(/\bfloat\(([^)]+)\)/g, "parseFloat($1)");
  jsCode = jsCode.replace(/\babs\(([^)]+)\)/g, "Math.abs($1)");
  jsCode = jsCode.replace(/\bmin\(([^)]+)\)/g, "Math.min($1)");
  jsCode = jsCode.replace(/\bmax\(([^)]+)\)/g, "Math.max($1)");
  jsCode = jsCode.replace(/\bsorted\(([^)]+)\)/g, "[...$1].sort()");
  jsCode = jsCode.replace(/\breversed\(([^)]+)\)/g, "[...$1].reverse()");

  // Convert common patterns
  jsCode = jsCode.replace(/\.split\(\)/g, ".split(/\\s+/)");
  jsCode = jsCode.replace(/\.strip\(\)/g, ".trim()");
  jsCode = jsCode.replace(/\.lower\(\)/g, ".toLowerCase()");
  jsCode = jsCode.replace(/\.upper\(\)/g, ".toUpperCase()");
  jsCode = jsCode.replace(/\.append\(([^)]+)\)/g, ".push($1)");
  jsCode = jsCode.replace(/\.join\(([^)]*)\)/g, ".join($1)");
  jsCode = jsCode.replace(/list\(map\(int,\s*([^)]+)\)\)/g, "($1).map(Number)");

  // Convert boolean/none literals
  jsCode = jsCode.replace(/\bTrue\b/g, "true");
  jsCode = jsCode.replace(/\bFalse\b/g, "false");
  jsCode = jsCode.replace(/\bNone\b/g, "null");
  jsCode = jsCode.replace(/\band\b/g, "&&");
  jsCode = jsCode.replace(/\bor\b/g, "||");
  jsCode = jsCode.replace(/\bnot\b/g, "!");

  // Convert f-strings
  jsCode = jsCode.replace(/return\s+f["'](.*?)["']/g, (_, p1) =>
    "return `" + p1.replace(/\{([^}]+)\}/g, "${$1}") + "`"
  );

  // Balance braces — count function defs and add closing braces
  const openCount = (jsCode.match(/\{/g) || []).length;
  const closeCount = (jsCode.match(/\}/g) || []).length;
  for (let i = 0; i < openCount - closeCount; i++) {
    jsCode += "\n}";
  }

  const customConsole = {
    log: (...args: any[]) => outputBuffer.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ")),
    error: (...args: any[]) => outputBuffer.push(args.map(a => String(a)).join(" ")),
  };

  const sandbox = {
    console: customConsole,
    input,
    Buffer,
    parseInt,
    parseFloat,
    Number,
    String,
    Array,
    Math,
    JSON,
    Map,
    Set,
    Object,
    isNaN,
    isFinite,
  };

  const context = vm.createContext(sandbox);
  const wrappedScript = new vm.Script(`
    try {
      ${jsCode}
      if (typeof solve === 'function') {
        const res = solve(input);
        if (res !== undefined && res !== null) console.log(res);
      }
    } catch (e) {
      console.error("Runtime Error: " + (e.message || e));
    }
  `);

  wrappedScript.runInContext(context, { timeout: 5000 });
  return outputBuffer.join("\n").trim();
}

function executeSimplePython(code: string, input: string, outputBuffer: string[]): string {
  // For very simple scripts — just try basic conversion
  let jsCode = code
    .replace(/#.*$/gm, "")
    .replace(/print\((.+?)\)/g, "console.log($1)")
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\bNone\b/g, "null")
    .replace(/input\(\)/g, "input");

  const customConsole = {
    log: (...args: any[]) => outputBuffer.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ")),
    error: (...args: any[]) => {},
  };

  const sandbox = { console: customConsole, input, parseInt, parseFloat, Number, String, Math };
  const context = vm.createContext(sandbox);

  try {
    new vm.Script(jsCode).runInContext(context, { timeout: 3000 });
  } catch {}

  return outputBuffer.join("\n").trim();
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const { code, language, testCases }: { code: string; language: string; testCases: TestCasePayload[] } = await request.json();

    if (!code || !language) {
      return NextResponse.json({ error: "Code and language are required" }, { status: 400 });
    }

    logger.info(`[Coding Run API] Candidate running code in language: ${language}`);

    const safeTestCases = (testCases || []).filter((tc) => !tc.hidden);

    const testCaseResults: Array<{
      id: string;
      passed: boolean;
      input: string;
      output: string;
      expected: string;
      execTimeMs: number;
    }> = [];

    let overallPassed = true;
    let combinedStdout = "";
    let combinedStderr = "";

    for (const tc of safeTestCases) {
      const tcStart = Date.now();
      const cleanInput = String(tc.input ?? "").trim();
      const expectedStr = String(tc.expectedOutput ?? "").trim();

      let actualOutput = "";
      try {
        actualOutput = executeUniversalCode(code, language, cleanInput);
      } catch (err: any) {
        actualOutput = `Runtime Error: ${err.message || String(err)}`;
      }

      // Use robust output matching instead of strict equality
      const isPassed = outputsMatch(actualOutput, expectedStr);
      const tcTime = Date.now() - tcStart;

      if (!isPassed) overallPassed = false;

      if (actualOutput.startsWith("Runtime Error")) {
        combinedStderr += `[Test ${tc.id} Error]: ${actualOutput}\n`;
      } else {
        combinedStdout += `[Test ${tc.id} ${isPassed ? "PASSED" : "FAILED"}]: Input '${cleanInput}' -> Output '${actualOutput}' (Expected: '${expectedStr}')\n`;
      }

      testCaseResults.push({
        id: tc.id,
        passed: isPassed,
        input: cleanInput,
        output: actualOutput,
        expected: expectedStr,
        execTimeMs: tcTime,
      });
    }

    const execTimeMs = Date.now() - startTime;

    return NextResponse.json({
      passed: overallPassed && safeTestCases.length > 0,
      stdout: combinedStdout,
      stderr: combinedStderr,
      execTimeMs,
      testCaseResults,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("API error in candidate coding run route", err);
    return NextResponse.json({ error: "Execution service error", message }, { status: 500 });
  }
}
