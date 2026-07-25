// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParseModule = require("pdf-parse");
import { logger } from "@smarthire/logger";

/**
 * Normalizes extracted text by cleaning up extra whitespace while preserving key structure.
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line && !/^--\s*\d+\s*of\s*\d+\s*--$/i.test(line))
    .join("\n");
}

/**
 * Extracts plain text from a PDF Buffer or Uint8Array.
 * Supports pdf-parse v2 (PDFParse class + Uint8Array) and pdf-parse v1 function,
 * with stream & hex text fallbacks for malformed or scanned PDFs.
 */
export async function extractTextFromPdfBuffer(buffer: Buffer | Uint8Array): Promise<string> {
  const cleanBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const uint8Data = new Uint8Array(cleanBuffer);

  // 1. pdf-parse v2 Class API (PDFParse)
  const PDFParseClass = pdfParseModule?.PDFParse || pdfParseModule?.default?.PDFParse;
  if (PDFParseClass) {
    try {
      const parser = new PDFParseClass(uint8Data);
      await parser.load();
      const res = await parser.getText();
      const extractedText = typeof res === "string" ? res : res?.text || "";
      if (extractedText && extractedText.trim().length > 0) {
        return normalizeText(extractedText);
      }
    } catch (err) {
      logger.warn("[PDFExtractor] pdf-parse PDFParse class failed, trying function fallback", err);
    }
  }

  // 2. pdf-parse v1 Function API
  const parseFn = typeof pdfParseModule === "function"
    ? pdfParseModule
    : (typeof pdfParseModule?.default === "function" ? pdfParseModule.default : null);

  if (parseFn) {
    try {
      const data = await parseFn(cleanBuffer);
      if (data && data.text && data.text.trim().length > 0) {
        return normalizeText(data.text);
      }
    } catch (err) {
      logger.warn("[PDFExtractor] pdf-parse function failed, trying stream text fallback", err);
    }
  }

  // 3. Stream text fallback (Tj/TJ PDF text operators: literal strings and hex strings)
  try {
    const raw = cleanBuffer.toString("latin1");

    // Match literal strings: (text) Tj / (text) TJ
    const literalMatches = raw.match(/\(([^()]{2,})\)\s*T[jJ]/g) || [];
    let literalText = "";
    if (literalMatches.length > 0) {
      literalText = literalMatches
        .map((m) => m.replace(/^\(/, "").replace(/\)\s*T[jJ]$/, ""))
        .join(" ");
    }

    // Match hex strings: <48656C6C6F> Tj / <48656C6C6F> TJ
    const hexMatches = raw.match(/<([0-9A-Fa-f]{4,})>\s*T[jJ]/g) || [];
    let hexText = "";
    if (hexMatches.length > 0) {
      hexText = hexMatches
        .map((m) => {
          const hex = m.replace(/^</, "").replace(/>\s*T[jJ]$/, "");
          let str = "";
          for (let i = 0; i < hex.length; i += 2) {
            const code = parseInt(hex.substring(i, i + 2), 16);
            if (code >= 32 && code <= 126) {
              str += String.fromCharCode(code);
            }
          }
          return str;
        })
        .filter((s) => s.length > 0)
        .join(" ");
    }

    const combinedStreamText = `${literalText} ${hexText}`.trim();
    if (combinedStreamText.length > 0) {
      return normalizeText(combinedStreamText);
    }
  } catch {
    // Ignore fallback failures
  }

  // 4. Robust fallback: Extract printable ASCII word blocks from raw buffer
  try {
    const raw = cleanBuffer.toString("latin1");
    const asciiBlocks = raw.match(/[A-Za-z0-9@#\$\%\&\*\_\+\-\=\:\;\,\.\/\?\s]{3,}/g) || [];
    const cleanText = asciiBlocks
      .map((b) => b.trim())
      .filter((b) => b.length > 2 && /[a-zA-Z]/.test(b))
      .join(" ");
    if (cleanText.trim().length > 0) {
      return normalizeText(cleanText);
    }
  } catch {
    // Ignore fallback failures
  }

  return "";
}
