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
 * Safely loads pdf-parse module without triggering local test-file resolution bugs in Vercel serverless.
 */
function getPdfParseModule(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("pdf-parse");
  } catch (err) {
    logger.warn("[PDFExtractor] pdf-parse module require failed, using stream fallback", err);
    return null;
  }
}

/**
 * Extracts plain text from a PDF Buffer or Uint8Array.
 * Supports pdf-parse v1/v2 with robust in-memory stream fallbacks.
 * Guaranteed to never crash or throw unhandled exceptions.
 */
export async function extractTextFromPdfBuffer(buffer: Buffer | Uint8Array): Promise<string> {
  try {
    const cleanBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const uint8Data = new Uint8Array(cleanBuffer);

    const pdfParseModule = getPdfParseModule();

    if (pdfParseModule) {
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
          logger.warn("[PDFExtractor] PDFParse class failed, trying function fallback", err);
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
          logger.warn("[PDFExtractor] pdf-parse function failed, trying stream fallback", err);
        }
      }
    }

    // 3. Stream text fallback (Tj/TJ PDF text operators: literal strings and hex strings)
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

    // 4. Raw printable text fallback (removes binary control codes)
    const cleanPrintable = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, " ");
    const words = cleanPrintable.split(/\s+/).filter((w) => w.length > 2 && /^[a-zA-Z0-9.,\-()+@#]{2,}$/.test(w));
    if (words.length > 5) {
      return normalizeText(words.join(" "));
    }

    return "";
  } catch (err) {
    logger.error("[PDFExtractor] Fatal error in extractTextFromPdfBuffer", err);
    return "";
  }
}
