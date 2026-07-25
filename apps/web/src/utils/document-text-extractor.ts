import { extractTextFromPdfBuffer, normalizeText } from "./pdf-text-extractor";
import { logger } from "@smarthire/logger";

/**
 * Universal text extractor for any file format:
 * PDF, DOCX, DOC, JSON, TXT, MD, RTF, CSV, etc.
 */
export async function extractTextFromAnyFileBuffer(buffer: Buffer, fileName: string): Promise<string> {
  const ext = (fileName.split(".").pop() || "").toLowerCase();

  // 1. PDF Documents
  if (ext === "pdf") {
    const pdfText = await extractTextFromPdfBuffer(buffer);
    if (pdfText && pdfText.trim().length > 0) {
      return pdfText;
    }
  }

  // 2. JSON Documents
  if (ext === "json") {
    try {
      const jsonStr = buffer.toString("utf-8");
      const parsed = JSON.parse(jsonStr);

      const flattenJsonValues = (obj: any): string[] => {
        let acc: string[] = [];
        if (typeof obj === "string") {
          acc.push(obj);
        } else if (Array.isArray(obj)) {
          obj.forEach((item) => {
            acc = acc.concat(flattenJsonValues(item));
          });
        } else if (typeof obj === "object" && obj !== null) {
          Object.entries(obj).forEach(([key, val]) => {
            acc.push(key);
            acc = acc.concat(flattenJsonValues(val));
          });
        } else if (typeof obj === "number" || typeof obj === "boolean") {
          acc.push(String(obj));
        }
        return acc;
      };

      const extracted = flattenJsonValues(parsed).join(" ");
      return normalizeText(extracted);
    } catch (err) {
      logger.warn("[DocumentExtractor] JSON parsing failed, reading raw string", err);
    }
  }

  // 3. DOCX / DOC Documents
  if (ext === "docx" || ext === "doc") {
    try {
      const raw = buffer.toString("utf-8");
      // Extract XML text tags <w:t>...</w:t> from docx structure
      const xmlMatches = raw.match(/<w:t[^>]*>(.*?)<\/w:t>/gi);
      if (xmlMatches && xmlMatches.length > 0) {
        const text = xmlMatches
          .map((tag) => tag.replace(/<[^>]+>/g, "").trim())
          .filter(Boolean)
          .join(" ");
        if (text.trim().length > 0) {
          return normalizeText(text);
        }
      }
    } catch (err) {
      logger.warn("[DocumentExtractor] DOCX XML extraction failed", err);
    }
  }

  // 4. Plain Text, Markdown, RTF, CSV, or Arbitrary Document Formats
  try {
    const raw = buffer.toString("utf-8");
    // Strip non-printable binary control characters while keeping alphanumeric, spaces, and punctuation
    const cleanText = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, " ");
    return normalizeText(cleanText);
  } catch (err) {
    logger.error("[DocumentExtractor] Universal text extraction failed", err);
    return "";
  }
}
