import { NextRequest, NextResponse } from "next/server";
import { logger } from "@smarthire/logger";
import vm from "vm";
import { execFileSync, execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { normalizeStdinInput, compareOutputs, ComparisonOptions } from "@/utils/code-comparator";

interface TestCasePayload {
  id: string;
  input: string;
  expectedOutput: string;
  hidden?: boolean;
}

export type ExecutionStatus =
  | "ACCEPTED"
  | "WRONG_ANSWER"
  | "COMPILATION_ERROR"
  | "RUNTIME_ERROR"
  | "TIME_LIMIT_EXCEEDED"
  | "INFRASTRUCTURE_ERROR";

export interface SingleExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  status: ExecutionStatus;
  execTimeMs: number;
}

/**
 * Universal Code Execution Engine for STDIN -> STDOUT assessments.
 * Executes candidate code using available CLI runtimes or sandboxed fallbacks.
 */
export function executeUniversalCode(
  code: string,
  language: string,
  inputStr: string
): SingleExecutionResult {
  const startTime = Date.now();
  const cleanInput = normalizeStdinInput(inputStr);
  const lang = (language || "javascript").toLowerCase().trim();

  // ── 1. PYTHON ─────────────────────────────────────────────────────────────
  if (lang === "python" || lang === "python3" || lang === "py") {
    const pythonCmds = ["python3", "python", "py"];
    for (const cmd of pythonCmds) {
      try {
        const tmpDir = os.tmpdir();
        const tmpFile = path.join(tmpDir, `py_${Date.now()}_${Math.random().toString(36).slice(2)}.py`);
        fs.writeFileSync(tmpFile, code, "utf-8");

        try {
          const stdout = execFileSync(cmd, [tmpFile], {
            input: cleanInput,
            timeout: 5000,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          });
          fs.unlinkSync(tmpFile);

          return {
            stdout: String(stdout || "").trim(),
            stderr: "",
            exitCode: 0,
            status: "ACCEPTED",
            execTimeMs: Date.now() - startTime,
          };
        } catch (err: any) {
          try { fs.unlinkSync(tmpFile); } catch {}

          if (err.code === "ETIMEDOUT") {
            return { stdout: "", stderr: "Execution timed out (limit: 5000ms)", exitCode: 124, status: "TIME_LIMIT_EXCEEDED", execTimeMs: 5000 };
          }

          const stderr = String(err.stderr || err.message || "").trim();
          const stdout = String(err.stdout || "").trim();

          if (stderr.includes("SyntaxError") || stderr.includes("IndentationError")) {
            return { stdout, stderr: sanitizeStderr(stderr), exitCode: err.status || 1, status: "COMPILATION_ERROR", execTimeMs: Date.now() - startTime };
          }

          return { stdout, stderr: sanitizeStderr(stderr), exitCode: err.status || 1, status: "RUNTIME_ERROR", execTimeMs: Date.now() - startTime };
        }
      } catch {
        // CLI not installed, try next
        continue;
      }
    }

    // Python JS Transpiler Fallback (for serverless environments without python binary)
    try {
      const fallbackStdout = executePythonFallback(code, cleanInput);
      const isErr = fallbackStdout.startsWith("Runtime Error:") || fallbackStdout.startsWith("SyntaxError:");
      return {
        stdout: isErr ? "" : fallbackStdout,
        stderr: isErr ? fallbackStdout : "",
        exitCode: isErr ? 1 : 0,
        status: isErr ? "RUNTIME_ERROR" : "ACCEPTED",
        execTimeMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return { stdout: "", stderr: String(err?.message || err), exitCode: 1, status: "RUNTIME_ERROR", execTimeMs: Date.now() - startTime };
    }
  }

  // ── 2. JAVASCRIPT & TYPESCRIPT ──────────────────────────────────────────────
  if (lang === "javascript" || lang === "typescript" || lang === "js" || lang === "ts") {
    try {
      const outputBuffer: string[] = [];
      const errorBuffer: string[] = [];

      const customConsole = {
        log: (...args: any[]) => outputBuffer.push(args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ")),
        error: (...args: any[]) => errorBuffer.push(args.map(a => String(a)).join(" ")),
      };

      const sandbox = {
        console: customConsole,
        input: cleanInput,
        require: (moduleName: string) => {
          if (moduleName === "fs") {
            return { readFileSync: () => cleanInput };
          }
          throw new Error(`Module '${moduleName}' is restricted in sandbox.`);
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

      const stderr = errorBuffer.join("\n").trim();
      const stdout = outputBuffer.join("\n").trim();
      const isErr = stderr.includes("Runtime Error");

      return {
        stdout: isErr ? "" : stdout,
        stderr,
        exitCode: isErr ? 1 : 0,
        status: isErr ? "RUNTIME_ERROR" : "ACCEPTED",
        execTimeMs: Date.now() - startTime,
      };
    } catch (err: any) {
      const isTimeout = err.code === "ERR_SCRIPT_EXECUTION_TIMEOUT";
      return {
        stdout: "",
        stderr: isTimeout ? "Execution timed out (limit 5000ms)" : String(err?.message || err),
        exitCode: isTimeout ? 124 : 1,
        status: isTimeout ? "TIME_LIMIT_EXCEEDED" : "COMPILATION_ERROR",
        execTimeMs: Date.now() - startTime,
      };
    }
  }

  // ── 3. JAVA ─────────────────────────────────────────────────────────────────
  if (lang === "java") {
    try {
      const tmpDir = os.tmpdir();
      // Extract class name or default to Solution / Main
      const match = code.match(/public\s+class\s+([A-Za-z0-9_]+)/);
      const className = match ? match[1] : "Solution";

      const javaFile = path.join(tmpDir, `${className}.java`);
      fs.writeFileSync(javaFile, code, "utf-8");

      try {
        // Compile
        execSync(`javac "${javaFile}"`, { timeout: 5000, stdio: "pipe" });
        // Execute
        const stdout = execFileSync("java", ["-cp", tmpDir, className], {
          input: cleanInput,
          timeout: 5000,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });

        try {
          fs.unlinkSync(javaFile);
          fs.unlinkSync(path.join(tmpDir, `${className}.class`));
        } catch {}

        return { stdout: String(stdout || "").trim(), stderr: "", exitCode: 0, status: "ACCEPTED", execTimeMs: Date.now() - startTime };
      } catch (err: any) {
        try { fs.unlinkSync(javaFile); } catch {}
        const stderr = String(err.stderr || err.message || "").trim();
        const isCompileErr = stderr.includes("error:") || stderr.includes("javac");
        return {
          stdout: "",
          stderr: sanitizeStderr(stderr),
          exitCode: err.status || 1,
          status: isCompileErr ? "COMPILATION_ERROR" : "RUNTIME_ERROR",
          execTimeMs: Date.now() - startTime,
        };
      }
    } catch {
      // Fallback if Java CLI not installed
    }
  }

  // ── 4. C & CPP ──────────────────────────────────────────────────────────────
  if (lang === "c" || lang === "cpp" || lang === "c++") {
    const compiler = lang === "c" ? "gcc" : "g++";
    try {
      const tmpDir = os.tmpdir();
      const ext = lang === "c" ? ".c" : ".cpp";
      const srcFile = path.join(tmpDir, `code_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
      const exeFile = path.join(tmpDir, `exe_${Date.now()}_${Math.random().toString(36).slice(2)}${os.platform() === "win32" ? ".exe" : ""}`);

      fs.writeFileSync(srcFile, code, "utf-8");

      try {
        execSync(`${compiler} "${srcFile}" -o "${exeFile}"`, { timeout: 5000, stdio: "pipe" });
        const stdout = execFileSync(exeFile, [], {
          input: cleanInput,
          timeout: 5000,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });

        try { fs.unlinkSync(srcFile); fs.unlinkSync(exeFile); } catch {}
        return { stdout: String(stdout || "").trim(), stderr: "", exitCode: 0, status: "ACCEPTED", execTimeMs: Date.now() - startTime };
      } catch (err: any) {
        try { fs.unlinkSync(srcFile); fs.unlinkSync(exeFile); } catch {}
        const stderr = String(err.stderr || err.message || "").trim();
        return { stdout: "", stderr: sanitizeStderr(stderr), exitCode: err.status || 1, status: stderr.includes("error:") ? "COMPILATION_ERROR" : "RUNTIME_ERROR", execTimeMs: Date.now() - startTime };
      }
    } catch {}
  }

  // Fallback default response for unhandled languages or missing compilers
  return {
    stdout: "",
    stderr: `Language runtime for '${language}' is not available in server environment.`,
    exitCode: 1,
    status: "INFRASTRUCTURE_ERROR",
    execTimeMs: Date.now() - startTime,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sanitizeStderr(stderr: string): string {
  if (!stderr) return "";
  // Remove absolute file system paths for security
  return stderr
    .replace(/[A-Z]:\\[^:\n]+/g, "[source_file]")
    .replace(/\/tmp\/[^:\n]+/g, "[source_file]")
    .trim();
}

function executePythonFallback(code: string, input: string): string {
  const outputBuffer: string[] = [];
  let jsCode = code.replace(/#(?![!]).*$/gm, "");

  jsCode = jsCode.replace(/def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*[^:]+)?\s*:/g, "function $1($2) {");
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
  jsCode = jsCode.replace(/if\s+\(?__name__\s*==\s*['"]__main__['"]\)?\s*\{?/g, "if (true) {");

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
  jsCode = jsCode.replace(/\.split\(\)/g, ".split(/\\s+/)");
  jsCode = jsCode.replace(/\.strip\(\)/g, ".trim()");
  jsCode = jsCode.replace(/\.lower\(\)/g, ".toLowerCase()");
  jsCode = jsCode.replace(/\.upper\(\)/g, ".toUpperCase()");
  jsCode = jsCode.replace(/\.append\(([^)]+)\)/g, ".push($1)");
  jsCode = jsCode.replace(/\.join\(([^)]*)\)/g, ".join($1)");
  jsCode = jsCode.replace(/list\(map\(int,\s*([^)]+)\)\)/g, "($1).map(Number)");
  jsCode = jsCode.replace(/\bTrue\b/g, "true");
  jsCode = jsCode.replace(/\bFalse\b/g, "false");
  jsCode = jsCode.replace(/\bNone\b/g, "null");
  jsCode = jsCode.replace(/\band\b/g, "&&");
  jsCode = jsCode.replace(/\bor\b/g, "||");
  jsCode = jsCode.replace(/\bnot\b/g, "!");
  jsCode = jsCode.replace(/return\s+f["'](.*?)["']/g, (_, p1) =>
    "return `" + p1.replace(/\{([^}]+)\}/g, "${$1}") + "`"
  );

  const openCount = (jsCode.match(/\{/g) || []).length;
  const closeCount = (jsCode.match(/\}/g) || []).length;
  for (let i = 0; i < openCount - closeCount; i++) {
    jsCode += "\n}";
  }

  const customConsole = {
    log: (...args: any[]) => outputBuffer.push(args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ")),
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

// ─── POST Handler (Run Code API) ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const {
      code,
      language,
      testCases,
      comparisonOptions,
    }: {
      code: string;
      language: string;
      testCases: TestCasePayload[];
      comparisonOptions?: ComparisonOptions;
    } = await request.json();

    if (!code || !language) {
      return NextResponse.json({ error: "Code and language are required" }, { status: 400 });
    }

    logger.info(`[Coding Run API] Running candidate code in language: ${language}`);

    const safeTestCases = (testCases || []).filter((tc) => !tc.hidden);

    const testCaseResults: Array<{
      id: string;
      passed: boolean;
      status: ExecutionStatus;
      input: string;
      output: string;
      expected: string;
      stderr: string;
      execTimeMs: number;
    }> = [];

    let overallPassed = true;
    let combinedStdout = "";
    let combinedStderr = "";

    for (const tc of safeTestCases) {
      const tcInput = normalizeStdinInput(tc.input);
      const expectedOutput = tc.expectedOutput ?? "";

      const execRes = executeUniversalCode(code, language, tcInput);

      let finalStatus: ExecutionStatus = execRes.status;
      let isPassed = false;

      if (execRes.status === "ACCEPTED") {
        const comp = compareOutputs(execRes.stdout, expectedOutput, comparisonOptions);
        isPassed = comp.passed;
        finalStatus = isPassed ? "ACCEPTED" : "WRONG_ANSWER";
      }

      if (!isPassed) overallPassed = false;

      if (execRes.stderr) {
        combinedStderr += `[Test ${tc.id} ${finalStatus}]: ${execRes.stderr}\n`;
      }
      combinedStdout += `[Test ${tc.id} ${finalStatus}]: Input '${tcInput}' -> Output '${execRes.stdout}' (Expected: '${expectedOutput}')\n`;

      // ── DETAILED DEV TRACING (Requirement 1) ──
      logger.info(`[Dev Trace] Test ${tc.id}:
        - Language: ${language}
        - Input: "${tcInput}"
        - Exit Code: ${execRes.exitCode}
        - Status: ${finalStatus}
        - Raw Stdout: "${execRes.stdout}"
        - Raw Stderr: "${execRes.stderr}"
        - Expected: "${expectedOutput}"
        - Passed: ${isPassed}`);

      testCaseResults.push({
        id: tc.id,
        passed: isPassed,
        status: finalStatus,
        input: tcInput,
        output: execRes.stdout,
        expected: expectedOutput,
        stderr: execRes.stderr,
        execTimeMs: execRes.execTimeMs,
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
