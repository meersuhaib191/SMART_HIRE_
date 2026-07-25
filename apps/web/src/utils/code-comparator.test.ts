import {
  normalizeStdinInput,
  normalizeOutput,
  compareOutputs,
  tokenizeOutput
} from "./code-comparator";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`✓ PASS: ${name}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${name}`);
    failed++;
  }
}

console.log("=== Testing Code Comparator Engine ===");

// 1. Escaped stdin test
const escapedStdin = "5\\n1 2 3 4 5";
const normStdin = normalizeStdinInput(escapedStdin);
assert(normStdin === "5\n1 2 3 4 5", "Escaped \\n unescaped to real newline");

// 2. Trailing newline check
assert(compareOutputs("15\n", "15").passed, "Expected '15', Actual '15\\n' -> PASS");

// 3. Trailing space check
assert(compareOutputs("1 2 3 ", "1 2 3").passed, "Expected '1 2 3', Actual '1 2 3 ' -> PASS");

// 4. CRLF vs LF check
assert(compareOutputs("Hello\r\nWorld", "Hello\nWorld").passed, "Expected CRLF, Actual LF -> PASS");

// 5. Token mode check
assert(compareOutputs("1   2   3", "1 2 3", { mode: "tokens" }).passed, "Token mode extra whitespace -> PASS");

// 6. Multiline check
const multilineActual = "1 2 3\n4 5 6\n7 8 9\n";
const multilineExpected = "1 2 3\n4 5 6\n7 8 9";
assert(compareOutputs(multilineActual, multilineExpected).passed, "Multiline trailing newline -> PASS");

// 7. Wrong answer checks (MUST FAIL)
assert(!compareOutputs("12", "13").passed, "Expected 13, Actual 12 -> FAIL");
assert(!compareOutputs("1 2 3", "1 2 4").passed, "Expected 1 2 4, Actual 1 2 3 -> FAIL");
assert(!compareOutputs("1 2 3", "1 2").passed, "Expected 1 2, Actual 1 2 3 -> FAIL");

// 8. Numeric tolerance check
assert(compareOutputs("3.141590", "3.14159", { mode: "numeric", tolerance: 0.0001 }).passed, "Numeric tolerance check -> PASS");

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
