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

export function executeUniversalCode(code: string, language: string, inputStr: string): string {
  const cleanInput = (inputStr ?? "").trim();
  const lang = (language || "javascript").toLowerCase();

  // 1. Try Native CLI Execution for Python if CLI exists
  if (lang === "python" || lang === "python3") {
    const pythonCommands = ["python3", "python", "py"];
    for (const cmd of pythonCommands) {
      try {
        const tmpDir = os.tmpdir();
        const tmpFile = path.join(tmpDir, `py_${Date.now()}_${Math.random().toString(36).slice(2)}.py`);
        fs.writeFileSync(tmpFile, code, "utf-8");

        const stdout = execFileSync(cmd, [tmpFile], {
          input: cleanInput,
          timeout: 3000,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "ignore"],
        });

        try { fs.unlinkSync(tmpFile); } catch {}
        if (stdout !== undefined && stdout !== null) {
          return String(stdout).trim();
        }
      } catch {}
    }

    // 2. JS Fallback for Python in environments without python binary
    try {
      let jsConverted = code
        .replace(/#.*$/gm, "")
        .replace(/def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*(->\s*[^:]+)?:/g, "function $1($2) {")
        .replace(/if\s+__name__\s*==\s*["']__main__["']\s*:/g, "if (true) {")
        .replace(/sys\.stdin\.read\(\)/g, "input")
        .replace(/print\((.*)\)/g, "console.log($1)")
        .replace(/len\(([^)]+)\)/g, "($1).length")
        .replace(/str\(([^)]+)\)/g, "String($1)")
        .replace(/int\(([^)]+)\)/g, "parseInt($1)")
        .replace(/list\(map\(int,\s*([^)]+)\)\)/g, "($1).split(/\\s+/).map(Number)")
        .replace(/lines\s*=\s*\[.*\]/g, "const lines = input.trim().split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);")
        .replace(/return\s+f["'](.*?)["']/g, (m, p1) => "return `" + p1.replace(/\{([^}]+)\}/g, "${$1}") + "`")
        .replace(/\bTrue\b/g, "true")
        .replace(/\bFalse\b/g, "false")
        .replace(/\bNone\b/g, "null")
        .replace(/\band\b/g, "&&")
        .replace(/\bor\b/g, "||")
        .replace(/\bnot\b/g, "!");

      if (jsConverted.includes("function solve") && !jsConverted.endsWith("}")) {
        jsConverted += "\n}";
      }

      let outputBuffer: string[] = [];
      const customConsole = {
        log: (...args: any[]) => outputBuffer.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ")),
        error: (...args: any[]) => outputBuffer.push(args.join(" ")),
      };

      const sandbox = {
        console: customConsole,
        input: cleanInput,
        Buffer,
      };

      const context = vm.createContext(sandbox);
      const wrappedScript = new vm.Script(`
        try {
          ${jsConverted}
          if (typeof solve === 'function') {
            const res = solve(input);
            if (res !== undefined && res !== null) console.log(res);
          }
        } catch (e) {}
      `);

      wrappedScript.runInContext(context, { timeout: 3000 });
      return outputBuffer.join("\n").trim();
    } catch {}
  }

  // 3. JavaScript & TypeScript Execution
  if (lang === "javascript" || lang === "typescript") {
    let outputBuffer: string[] = [];
    const customConsole = {
      log: (...args: any[]) => outputBuffer.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ")),
      error: (...args: any[]) => outputBuffer.push(args.join(" ")),
    };

    const sandbox = {
      console: customConsole,
      input: cleanInput,
      require: (moduleName: string) => {
        if (moduleName === "fs") {
          return {
            readFileSync: () => cleanInput,
          };
        }
        throw new Error(`Module ${moduleName} is not permitted in sandbox.`);
      },
      Buffer,
    };

    const context = vm.createContext(sandbox);
    const wrappedScript = new vm.Script(`
      ${code}
      if (typeof solve === 'function') {
        const res = solve(input);
        if (res !== undefined && res !== null) console.log(res);
      }
    `);

    wrappedScript.runInContext(context, { timeout: 3000 });
    return outputBuffer.join("\n").trim();
  }

  return "";
}

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

      const actualOutput = executeUniversalCode(code, language, cleanInput);
      const isPassed = actualOutput.length > 0 && expectedStr.length > 0 && actualOutput.toLowerCase() === expectedStr.toLowerCase();
      const tcTime = Date.now() - tcStart;

      if (!isPassed) overallPassed = false;

      if (actualOutput.startsWith("Runtime Error") || actualOutput.startsWith("Error:")) {
        combinedStderr += `[Test ${tc.id} Error]: ${actualOutput}\n`;
      } else {
        combinedStdout += `[Test ${tc.id} Passed=${isPassed}]: Input '${cleanInput}' -> Output '${actualOutput}' (Expected: '${expectedStr}')\n`;
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
