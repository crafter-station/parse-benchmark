import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { z } from "zod";
import { put } from "@vercel/blob";
import { PDFDocument } from "pdf-lib";
import { 
  getModel, 
  getProviderConfig,
  isValidProviderId, 
  calculateCost,
  calculatePageCost 
} from "@/lib/providers";

// Helper to upload base64 image to Vercel Blob storage
async function uploadImageToBlob(base64: string, filename: string): Promise<string | null> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    console.log("BLOB_READ_WRITE_TOKEN not set, skipping blob upload");
    return null;
  }

  try {
    // Extract base64 data if it's a data URI
    let base64Data = base64;
    let mimeType = "image/png";
    
    if (base64.startsWith("data:")) {
      const match = base64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, "base64");
    
    // Upload to Vercel Blob
    const blob = await put(`parse-benchmark/${filename}`, buffer, {
      access: "public",
      contentType: mimeType,
      token: blobToken,
    });

    console.log("Uploaded image to blob:", blob.url);
    return blob.url;
  } catch (error) {
    console.error("Failed to upload image to blob:", error);
    return null;
  }
}

// Security: Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Security: Allowed MIME types (strict allowlist)
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

// Security: Allowed file extensions
const ALLOWED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".pdf",
]);

// Security: URL validation schema
const urlSchema = z
  .string()
  .url()
  .refine((url) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") return false;
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.") ||
        hostname.startsWith("172.16.") ||
        hostname.endsWith(".local") ||
        hostname === "0.0.0.0"
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }, "Invalid or disallowed URL");

// Security: Provider ID validation
const providerSchema = z.string().refine(isValidProviderId, "Invalid provider");

// Request body schema for URL-based parsing
const urlRequestSchema = z.object({
  url: urlSchema,
  providerId: providerSchema,
});

// System prompt for document parsing (AI Gateway providers)
const PARSING_PROMPT = `You are a document parsing assistant. Extract ALL text content from this document/image accurately and completely.

Instructions:
- Preserve the original structure (headings, paragraphs, lists, tables)
- For tables, use markdown table format
- Include all visible text, numbers, and data
- Maintain the reading order (left-to-right, top-to-bottom)
- If there are multiple columns, process them in logical order
- Do not add any commentary or explanations
- Do not summarize - extract the complete text

Output the extracted text in clean markdown format.`;

// Security: Validate file type by checking magic bytes
function validateFileSignature(buffer: ArrayBuffer, mimeType: string): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 8));

  if (mimeType === "image/png" && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return true;
  }
  if ((mimeType === "image/jpeg" || mimeType === "image/jpg") && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return true;
  }
  if (mimeType === "image/webp" && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return true;
  }
  if (mimeType === "image/gif" && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return true;
  }
  if (mimeType === "application/pdf" && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return true;
  }
  return false;
}

// Security: Sanitize error messages
function sanitizeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return "Invalid request parameters";
  }
  if (error instanceof Error) {
    if (error.message.includes("API")) {
      return "Service temporarily unavailable";
    }
    if (error.message.includes("timeout")) {
      return "Request timed out";
    }
    // Allow specific OCR service errors to pass through (sanitized)
    if (error.message.includes("LlamaParse") || error.message.includes("Mistral OCR") || error.message.includes("Datalab Marker")) {
      return error.message;
    }
  }
  return "An error occurred while processing your request";
}

// Security: Create safe response headers
function createSecureHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Cache-Control": "no-store, no-cache, must-revalidate",
  };
}

// ============================================================================
// LlamaParse API
// ============================================================================

const LLAMAPARSE_API_BASE = "https://api.cloud.llamaindex.ai/api/parsing";

interface LlamaParseJobResponse {
  id: string;
  status: string;
}

interface LlamaParseStatusResponse {
  id: string;
  status: "PENDING" | "SUCCESS" | "ERROR" | "PARTIAL_SUCCESS";
  num_pages?: number;
  error_message?: string;
}

interface LlamaParseLayoutItem {
  type: string;
  label?: string;
  bbox: { x: number; y: number; w: number; h: number };
  confidence?: number;
  page_number?: number;
  image_name?: string;
  isLikelyNoise?: boolean;
}

interface LlamaParseJsonPage {
  page: number;
  text?: string;
  md?: string;
  width?: number;
  height?: number;
  items?: Array<{
    type: string;
    value?: string;
    lvl?: number;
    bBox?: { x: number; y: number; w: number; h: number };
    children?: Array<{ type: string; value?: string }>;
  }>;
  layout?: LlamaParseLayoutItem[];
}

interface LlamaParseJsonResult {
  pages: LlamaParseJsonPage[];
}

// Maximum pages to process for PDF documents (to control costs)
const MAX_PDF_PAGES = 2;

// Fetch file from URL and convert to File object
async function fetchFileFromUrl(url: string): Promise<File> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ParseBenchmark/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch file from URL: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const buffer = await response.arrayBuffer();
  
  // Validate file size
  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw new Error("File too large (max 10MB)");
  }

  // Extract filename from URL
  const urlPath = new URL(url).pathname;
  const filename = urlPath.split("/").pop() || "document";
  
  // Determine MIME type
  let mimeType = contentType.split(";")[0].trim();
  if (mimeType === "application/octet-stream") {
    // Try to infer from extension
    if (filename.toLowerCase().endsWith(".pdf")) {
      mimeType = "application/pdf";
    } else if (filename.toLowerCase().endsWith(".png")) {
      mimeType = "image/png";
    } else if (filename.toLowerCase().match(/\.jpe?g$/)) {
      mimeType = "image/jpeg";
    } else if (filename.toLowerCase().endsWith(".webp")) {
      mimeType = "image/webp";
    } else if (filename.toLowerCase().endsWith(".gif")) {
      mimeType = "image/gif";
    }
  }

  return new File([buffer], filename, { type: mimeType });
}

// Strip PDF to only the first N pages to reduce processing time and cost
async function stripPdfToFirstPages(file: File, maxPages: number): Promise<File> {
  // Only process PDFs
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return file;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const totalPages = pdfDoc.getPageCount();

    // If already within limit, return original
    if (totalPages <= maxPages) {
      console.log(`[PDF Strip] Document has ${totalPages} pages, no stripping needed`);
      return file;
    }

    console.log(`[PDF Strip] Stripping PDF from ${totalPages} to ${maxPages} pages`);

    // Create a new PDF with only the first N pages
    const newPdfDoc = await PDFDocument.create();
    const pagesToCopy = await newPdfDoc.copyPages(pdfDoc, Array.from({ length: maxPages }, (_, i) => i));
    
    for (const page of pagesToCopy) {
      newPdfDoc.addPage(page);
    }

    const pdfBytes = await newPdfDoc.save();
    
    // Create new File with stripped content (copy to new ArrayBuffer for type safety)
    const strippedBuffer = new ArrayBuffer(pdfBytes.length);
    const strippedView = new Uint8Array(strippedBuffer);
    strippedView.set(pdfBytes);
    
    return new File([strippedBuffer], file.name, { type: "application/pdf" });
  } catch (error) {
    console.error("[PDF Strip] Error stripping PDF:", error);
    // Return original file if stripping fails
    return file;
  }
}

async function uploadToLlamaParse(file: File): Promise<string> {
  const apiKey = process.env.LLAMA_PARSE_API_KEY;
  if (!apiKey) {
    throw new Error("LlamaParse API key not configured");
  }

  const formData = new FormData();
  formData.append("file", file);
  // Enable layout extraction to get bounding boxes (costs 1 extra credit per page)
  formData.append("extract_layout", "true");
  // Request coordinate output in JSON
  formData.append("coordinates", "true");
  // Limit pages for PDFs to control costs
  formData.append("target_pages", `0-${MAX_PDF_PAGES - 1}`);

  const response = await fetch(`${LLAMAPARSE_API_BASE}/upload`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("LlamaParse upload error:", errorText);
    throw new Error("LlamaParse: Failed to upload file");
  }

  const data = await response.json() as LlamaParseJobResponse;
  return data.id;
}

async function checkLlamaParseStatus(jobId: string): Promise<LlamaParseStatusResponse> {
  const apiKey = process.env.LLAMA_PARSE_API_KEY;
  if (!apiKey) {
    throw new Error("LlamaParse API key not configured");
  }

  const response = await fetch(`${LLAMAPARSE_API_BASE}/job/${jobId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("LlamaParse: Failed to check job status");
  }

  return response.json() as Promise<LlamaParseStatusResponse>;
}

async function getLlamaParseMarkdown(jobId: string): Promise<string> {
  const apiKey = process.env.LLAMA_PARSE_API_KEY;
  if (!apiKey) {
    throw new Error("LlamaParse API key not configured");
  }

  const response = await fetch(`${LLAMAPARSE_API_BASE}/job/${jobId}/result/markdown`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("LlamaParse: Failed to get markdown results");
  }

  const data = await response.json() as { markdown: string };
  return data.markdown;
}

async function getLlamaParseJson(jobId: string): Promise<LlamaParseJsonResult | null> {
  const apiKey = process.env.LLAMA_PARSE_API_KEY;
  if (!apiKey) {
    throw new Error("LlamaParse API key not configured");
  }

  try {
    const response = await fetch(`${LLAMAPARSE_API_BASE}/job/${jobId}/result/json`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    return response.json() as Promise<LlamaParseJsonResult>;
  } catch {
    return null;
  }
}

import type { ParseOutputs, ParseBlock } from "@/lib/types";

function normalizeLlamaParseBlocks(jsonResult: LlamaParseJsonResult | null): ParseBlock[] {
  if (!jsonResult?.pages) return [];
  
  const blocks: ParseBlock[] = [];
  let blockId = 0;

  for (const page of jsonResult.pages) {
    const pageWidth = page.width || 1;
    const pageHeight = page.height || 1;
    
    console.log(`[LlamaParse] Page ${page.page}: layout=${page.layout?.length ?? 0}, items=${page.items?.length ?? 0}, dims=${pageWidth}x${pageHeight}`);
    
    // Extract from layout if available (preferred - has bounding boxes)
    if (page.layout && page.layout.length > 0) {
      console.log("[LlamaParse] Using layout data for bboxes");
      for (const item of page.layout) {
        // Skip noise elements
        if (item.isLikelyNoise) continue;
        
        const type = item.label || item.type;
        blocks.push({
          id: `llama-${blockId++}`,
          type: mapLlamaParseType(type),
          content: "",
          bbox: item.bbox, // Already in 0-1 fraction format
          confidence: item.confidence,
          pageIndex: page.page - 1,
        });
      }
    }
    
    // Extract from items if available (has content, may have bBox with coordinates=true)
    if (page.items && page.items.length > 0) {
      console.log("[LlamaParse] Processing items for content");
      for (const item of page.items) {
        // Check if item has bBox (available when coordinates=true)
        let bbox: ParseBlock["bbox"] = undefined;
        if (item.bBox) {
          // bBox from items might be in pixels, need to normalize
          bbox = {
            x: item.bBox.x / pageWidth,
            y: item.bBox.y / pageHeight,
            w: item.bBox.w / pageWidth,
            h: item.bBox.h / pageHeight,
          };
          console.log(`[LlamaParse] Item ${item.type} has bBox:`, item.bBox, "-> normalized:", bbox);
        }
        
        blocks.push({
          id: `llama-${blockId++}`,
          type: mapLlamaParseType(item.type),
          content: item.value || "",
          bbox,
          pageIndex: page.page - 1,
        });
      }
    }
  }

  console.log(`[LlamaParse] Total normalized blocks: ${blocks.length}, with bbox: ${blocks.filter(b => b.bbox).length}`);
  return blocks;
}

function mapLlamaParseType(type: string): ParseBlock["type"] {
  const typeMap: Record<string, ParseBlock["type"]> = {
    "text": "text",
    "table": "table",
    "figure": "figure",
    "title": "title",
    "heading": "title",
    "list": "list",
    "list_item": "list",
    "header": "header",
    "footer": "footer",
    "code": "code",
    "equation": "equation",
  };
  return typeMap[type.toLowerCase()] || "unknown";
}

async function parseLlamaParse(file: File): Promise<{ content: string; pages: number; outputs: ParseOutputs }> {
  const jobId = await uploadToLlamaParse(file);

  const maxAttempts = 30;
  const pollInterval = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await checkLlamaParseStatus(jobId);

    if (status.status === "SUCCESS" || status.status === "PARTIAL_SUCCESS") {
      const [markdown, jsonResult] = await Promise.all([
        getLlamaParseMarkdown(jobId),
        getLlamaParseJson(jobId),
      ]);
      
      console.log("[LlamaParse] jsonResult keys:", jsonResult ? Object.keys(jsonResult) : "null");
      console.log("[LlamaParse] pages count:", jsonResult?.pages?.length ?? 0);
      if (jsonResult?.pages?.[0]) {
        const firstPage = jsonResult.pages[0];
        console.log("[LlamaParse] First page keys:", Object.keys(firstPage));
        console.log("[LlamaParse] First page has layout:", !!firstPage.layout, "count:", firstPage.layout?.length);
        console.log("[LlamaParse] First page has items:", !!firstPage.items, "count:", firstPage.items?.length);
        if (firstPage.layout?.[0]) {
          console.log("[LlamaParse] Sample layout item:", JSON.stringify(firstPage.layout[0], null, 2));
        }
        if (firstPage.items?.[0]) {
          console.log("[LlamaParse] Sample item:", JSON.stringify(firstPage.items[0], null, 2));
        }
      }
      
      const blocks = normalizeLlamaParseBlocks(jsonResult);
      console.log("[LlamaParse] Final blocks:", blocks.length, "with bbox:", blocks.filter(b => b.bbox).length);
      
      return {
        content: markdown,
        pages: status.num_pages ?? 1,
        outputs: {
          markdown,
          json: blocks.length > 0 ? { blocks } : undefined,
        },
      };
    }

    if (status.status === "ERROR") {
      throw new Error(`LlamaParse: ${status.error_message || "Processing failed"}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error("LlamaParse: Processing timed out");
}

// ============================================================================
// Mistral OCR API
// ============================================================================

const MISTRAL_OCR_API = "https://api.mistral.ai/v1/ocr";

interface MistralOCRImage {
  id: string;
  image_base64?: string;
  top_left_x?: number;
  top_left_y?: number;
  bottom_right_x?: number;
  bottom_right_y?: number;
}

interface MistralOCRTable {
  id: string;
  html?: string;
  content?: string; // API returns HTML in "content" field when format is "html"
  markdown?: string;
  format?: string;
  top_left_x?: number;
  top_left_y?: number;
  bottom_right_x?: number;
  bottom_right_y?: number;
}

interface MistralOCRPage {
  index: number;
  markdown: string;
  images?: MistralOCRImage[];
  tables?: MistralOCRTable[];
  dimensions?: { width: number; height: number };
}

// Process Mistral markdown to embed images and tables inline
async function processMistralMarkdown(
  markdown: string,
  images: MistralOCRImage[],
  tables: MistralOCRTable[]
): Promise<string> {
  let processed = markdown;
  
  console.log("Mistral processing - images:", images.length, "tables:", tables.length);
  console.log("Mistral table IDs:", tables.map(t => t.id));

  // Replace image references with URLs (upload to blob or use inline data URI)
  for (const img of images) {
    if (img.image_base64) {
      // Try to upload to Vercel Blob first, fallback to inline data URI
      let imageUrl: string;
      const blobUrl = await uploadImageToBlob(img.image_base64, `mistral-${Date.now()}-${img.id}`);
      
      if (blobUrl) {
        imageUrl = blobUrl;
      } else {
        // Fallback to inline data URI
        imageUrl = `data:image/jpeg;base64,${img.image_base64}`;
      }
      
      // Match patterns like ![...](image_id) or ![...](image_id.jpg) or ![...](image_id.extension)
      const imgPattern = new RegExp(`!\\[([^\\]]*)\\]\\(${escapeRegex(img.id)}[^)]*\\)`, 'gi');
      processed = processed.replace(imgPattern, `![$1](${imageUrl})`);
    } else {
      // Remove image references if no base64 available
      const imgPattern = new RegExp(`!\\[([^\\]]*)\\]\\(${escapeRegex(img.id)}[^)]*\\)`, 'gi');
      processed = processed.replace(imgPattern, '[Image: $1]');
    }
  }

  // Replace table references with inline HTML
  // Tables can be referenced as [text](tbl-N.html) or similar patterns
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    const tableHtml = table.html || table.content; // API returns HTML in "content" field
    if (tableHtml) {
      console.log(`[Mistral] Table ${i} has HTML content, length: ${tableHtml.length}`);
      // Try multiple patterns: exact id, id with .html, tbl-N pattern
      const patterns = [
        new RegExp(`\\[([^\\]]*)\\]\\(${escapeRegex(table.id)}\\)`, 'gi'),
        new RegExp(`\\[([^\\]]*)\\]\\(${escapeRegex(table.id)}\\.html\\)`, 'gi'),
        new RegExp(`\\[([^\\]]*)\\]\\(tbl-${i}\\.html\\)`, 'gi'),
        new RegExp(`\\[([^\\]]*)\\]\\(tbl-${i}\\)`, 'gi'),
      ];
      
      for (const pattern of patterns) {
        const before = processed;
        processed = processed.replace(pattern, `\n\n${tableHtml}\n\n`);
        if (processed !== before) {
          console.log("[Mistral] Replaced table with pattern:", pattern.source);
          break;
        }
      }
    }
  }
  
  // Also try to replace any remaining tbl-N.html references with table HTML if available
  processed = processed.replace(/\[([^\]]*)\]\((tbl-\d+\.html)\)/gi, (match, text, href) => {
    const tableIndex = parseInt(href.match(/tbl-(\d+)/)?.[1] || "-1");
    const tableHtml = tables[tableIndex]?.html || tables[tableIndex]?.content;
    if (tableIndex >= 0 && tableIndex < tables.length && tableHtml) {
      console.log("[Mistral] Replaced remaining table reference:", href);
      return `\n\n${tableHtml}\n\n`;
    }
    return `[Table: ${text}]`;
  });

  return processed;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface MistralOCRResponse {
  pages: MistralOCRPage[];
  model: string;
  usage_info?: {
    pages_processed?: number;
  };
}

function normalizeMistralBlocks(data: MistralOCRResponse): ParseBlock[] {
  const blocks: ParseBlock[] = [];
  let blockId = 0;

  console.log("[Mistral] pages count:", data.pages.length);
  
  for (const page of data.pages) {
    const dims = page.dimensions;
    console.log(`[Mistral] Page ${page.index}: dims=${dims?.width}x${dims?.height}, images=${page.images?.length ?? 0}, tables=${page.tables?.length ?? 0}`);
    
    // Add markdown content as a text block (no bbox for full page text)
    if (page.markdown) {
      blocks.push({
        id: `mistral-text-${blockId++}`,
        type: "text",
        content: page.markdown,
        pageIndex: page.index,
      });
    }

    // Add images with bounding boxes
    if (page.images && page.images.length > 0) {
      console.log("[Mistral] Sample image:", JSON.stringify(page.images[0], (key, val) => key === 'image_base64' ? '[base64]' : val, 2));
      for (const img of page.images) {
        const bbox = dims && img.top_left_x !== undefined && img.top_left_y !== undefined &&
          img.bottom_right_x !== undefined && img.bottom_right_y !== undefined
          ? {
              x: img.top_left_x / dims.width,
              y: img.top_left_y / dims.height,
              w: (img.bottom_right_x - img.top_left_x) / dims.width,
              h: (img.bottom_right_y - img.top_left_y) / dims.height,
            }
          : undefined;

        if (bbox) {
          console.log(`[Mistral] Image ${img.id} bbox: [${img.top_left_x},${img.top_left_y}]-[${img.bottom_right_x},${img.bottom_right_y}] -> normalized:`, bbox);
        }

        blocks.push({
          id: `mistral-img-${blockId++}`,
          type: "figure",
          content: img.id,
          bbox,
          pageIndex: page.index,
        });
      }
    }

    // Add tables with bounding boxes and HTML content
    if (page.tables && page.tables.length > 0) {
      console.log("[Mistral] Sample table:", JSON.stringify({ ...page.tables[0], html: page.tables[0].html ? '[html]' : undefined }, null, 2));
      for (const table of page.tables) {
        const bbox = dims && table.top_left_x !== undefined && table.top_left_y !== undefined &&
          table.bottom_right_x !== undefined && table.bottom_right_y !== undefined
          ? {
              x: table.top_left_x / dims.width,
              y: table.top_left_y / dims.height,
              w: (table.bottom_right_x - table.top_left_x) / dims.width,
              h: (table.bottom_right_y - table.top_left_y) / dims.height,
            }
          : undefined;

        if (bbox) {
          console.log(`[Mistral] Table ${table.id} bbox: [${table.top_left_x},${table.top_left_y}]-[${table.bottom_right_x},${table.bottom_right_y}] -> normalized:`, bbox);
        }

        blocks.push({
          id: `mistral-table-${blockId++}`,
          type: "table",
          content: table.html || table.content || table.markdown || table.id,
          bbox,
          pageIndex: page.index,
        });
      }
    }
  }

  console.log(`[Mistral] Total blocks: ${blocks.length}, with bbox: ${blocks.filter(b => b.bbox).length}`);
  return blocks;
}

async function parseMistralOCR(
  file: File | null,
  url: string | null
): Promise<{ content: string; pages: number; outputs: ParseOutputs }> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error("Mistral OCR: API key not configured");
  }

  let document: { type: string; document_url?: string; image_url?: string };

  if (url) {
    const urlLower = url.toLowerCase();
    const isImage = /\.(png|jpg|jpeg|gif|webp|avif)(\?|$)/i.test(urlLower);
    
    if (isImage) {
      document = { type: "image_url", image_url: url };
    } else {
      document = { type: "document_url", document_url: url };
    }
  } else if (file) {
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const dataUri = `data:${file.type};base64,${base64}`;
    
    const isImage = file.type.startsWith("image/");
    if (isImage) {
      document = { type: "image_url", image_url: dataUri };
    } else {
      document = { type: "document_url", document_url: dataUri };
    }
  } else {
    throw new Error("Mistral OCR: No file or URL provided");
  }

  const response = await fetch(MISTRAL_OCR_API, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-ocr-latest",
      document,
      table_format: "html",
      include_image_base64: true, // Include base64 to embed images inline
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Mistral OCR error:", errorText);
    throw new Error("Mistral OCR: Failed to process document");
  }

  const data = await response.json() as MistralOCRResponse;
  
  // Collect all images and tables across pages
  const allImages = data.pages.flatMap((p) => p.images || []);
  const allTables = data.pages.flatMap((p) => p.tables || []);
  
  // Process markdown to embed images and tables inline
  const processedPages = await Promise.all(
    data.pages.map((page) => processMistralMarkdown(page.markdown, page.images || [], page.tables || []))
  );
  const processedMarkdown = processedPages.join("\n\n---\n\n");

  // Build HTML from tables (for HTML tab)
  const tablesHtml = allTables
    .map((t) => t.html || t.content)
    .filter(Boolean)
    .join("\n");

  const pages = data.usage_info?.pages_processed ?? data.pages.length;
  const blocks = normalizeMistralBlocks(data);
  
  // Extract page dimensions
  const dimensions = data.pages
    .filter((p) => p.dimensions)
    .map((p) => p.dimensions!);

  return {
    content: processedMarkdown,
    pages,
    outputs: {
      markdown: processedMarkdown,
      html: tablesHtml || undefined,
      json: blocks.length > 0 ? { blocks, dimensions: dimensions.length > 0 ? dimensions : undefined } : undefined,
    },
  };
}

// ============================================================================
// Datalab Marker API
// ============================================================================

const DATALAB_MARKER_API = "https://www.datalab.to/api/v1/marker";

interface DatalabMarkerSubmitResponse {
  request_id: string;
  request_check_url: string;
  success: boolean;
  error?: string;
}

interface DatalabMarkerBlock {
  id?: string;
  block_type: string;
  text?: string;
  html?: string;
  polygon?: Array<[number, number]>;
  bbox?: [number, number, number, number]; // [x1, y1, x2, y2]
  page_idx?: number;
  children?: DatalabMarkerBlock[];
}

interface DatalabMarkerJsonOutput {
  children?: DatalabMarkerBlock[];
  block_type?: string;
  bbox?: [number, number, number, number]; // [x1, y1, x2, y2] - page dimensions
  [key: string]: unknown;
}

interface DatalabMarkerResultResponse {
  status: string;
  success: boolean;
  markdown?: string;
  html?: string;
  json?: DatalabMarkerJsonOutput | DatalabMarkerBlock[]; // JSON output - can be object or array
  children?: DatalabMarkerBlock[]; // Alternative field name for blocks
  images?: Record<string, string>; // Map of image filename to base64 data
  page_count?: number;
  parse_quality_score?: number;
  error?: string;
  metadata?: {
    page_width?: number;
    page_height?: number;
    pages?: Array<{ width: number; height: number; page_num: number }>;
    [key: string]: unknown;
  };
}

// Process Datalab Marker markdown to embed images inline
async function processMarkerMarkdown(
  markdown: string,
  images: Record<string, string> | undefined
): Promise<string> {
  console.log("Marker processing - images available:", images ? Object.keys(images).length : 0);
  if (images && Object.keys(images).length > 0) {
    console.log("Marker image keys:", Object.keys(images));
    // Log first few chars of first image value to see format
    const firstKey = Object.keys(images)[0];
    const firstValue = images[firstKey];
    console.log("Marker first image value starts with:", firstValue?.substring(0, 50));
  }
  
  // Find all image references in markdown
  const imageRefs = markdown.match(/!\[[^\]]*\]\([^)]+\)/g) || [];
  console.log("Marker image references in markdown:", imageRefs);

  if (!images || Object.keys(images).length === 0) {
    // No images to embed, strip broken image references
    return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
      // Keep external URLs (http/https), strip local file references
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
        return match;
      }
      return alt ? `[Image: ${alt}]` : '[Image]';
    });
  }

  let processed = markdown;
  
  // Replace image references with URLs (upload to blob or use inline data URI)
  for (const [filename, base64] of Object.entries(images)) {
    // Try to upload to Vercel Blob first, fallback to inline data URI
    let imageUrl: string;
    const blobUrl = await uploadImageToBlob(base64, `marker-${Date.now()}-${filename}`);
    
    if (blobUrl) {
      imageUrl = blobUrl;
    } else {
      // Fallback to inline data URI
      imageUrl = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
    }
    
    // Try exact match first
    const exactPattern = new RegExp(`!\\[([^\\]]*)\\]\\(${escapeRegex(filename)}\\)`, 'gi');
    const before = processed;
    processed = processed.replace(exactPattern, `![$1](${imageUrl})`);
    
    if (processed !== before) {
      console.log("Marker replaced image:", filename);
    } else {
      // Try matching just the filename without path
      const filenameOnly = filename.split('/').pop() || filename;
      const loosePattern = new RegExp(`!\\[([^\\]]*)\\]\\([^)]*${escapeRegex(filenameOnly)}[^)]*\\)`, 'gi');
      processed = processed.replace(loosePattern, `![$1](${imageUrl})`);
    }
  }

  // Strip any remaining broken local image references
  processed = processed.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      return match;
    }
    console.log("Marker stripping unmatched image:", src);
    return alt ? `[Image: ${alt}]` : '[Image]';
  });

  return processed;
}

// Process Datalab Marker HTML to embed images inline
async function processMarkerHtml(
  html: string,
  images: Record<string, string> | undefined
): Promise<string> {
  if (!html) return "";
  
  if (!images || Object.keys(images).length === 0) {
    // No images to embed, strip broken image references
    return html.replace(/<img\s+[^>]*src="([^"]+)"[^>]*>/gi, (match, src) => {
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
        return match;
      }
      return '<!-- Image removed: ' + src + ' -->';
    });
  }

  let processed = html;
  
  // Replace image src attributes with uploaded URLs
  for (const [filename, base64] of Object.entries(images)) {
    // Try to upload to Vercel Blob first, fallback to inline data URI
    let imageUrl: string;
    const blobUrl = await uploadImageToBlob(base64, `marker-html-${Date.now()}-${filename}`);
    
    if (blobUrl) {
      imageUrl = blobUrl;
    } else {
      imageUrl = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
    }
    
    // Replace src="filename" patterns
    const srcPattern = new RegExp(`src=["']${escapeRegex(filename)}["']`, 'gi');
    processed = processed.replace(srcPattern, `src="${imageUrl}"`);
    
    // Also try just the filename without path
    const filenameOnly = filename.split('/').pop() || filename;
    const looseSrcPattern = new RegExp(`src=["'][^"']*${escapeRegex(filenameOnly)}["']`, 'gi');
    processed = processed.replace(looseSrcPattern, `src="${imageUrl}"`);
  }

  // Strip any remaining broken local image src
  processed = processed.replace(/<img\s+[^>]*src="([^"]+)"[^>]*>/gi, (match, src) => {
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      return match;
    }
    console.log("[Marker HTML] stripping unmatched image:", src);
    return '<!-- Image removed -->';
  });

  return processed;
}

function normalizeMarkerBlocks(
  jsonData: DatalabMarkerJsonOutput | DatalabMarkerBlock[] | undefined, 
  pageWidth = 1, 
  pageHeight = 1
): ParseBlock[] {
  if (!jsonData) return [];
  
  const blocks: ParseBlock[] = [];
  let blockId = 0;

  function processBlock(block: DatalabMarkerBlock) {
    if (!block || typeof block !== 'object') return;
    
    let bbox: ParseBlock["bbox"] | undefined;
    
    // Try to get bbox from polygon or bbox field
    if (block.polygon && Array.isArray(block.polygon) && block.polygon.length >= 4) {
      const xs = block.polygon.map(p => p[0]);
      const ys = block.polygon.map(p => p[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      bbox = {
        x: minX / pageWidth,
        y: minY / pageHeight,
        w: (maxX - minX) / pageWidth,
        h: (maxY - minY) / pageHeight,
      };
    } else if (block.bbox && Array.isArray(block.bbox)) {
      bbox = {
        x: block.bbox[0] / pageWidth,
        y: block.bbox[1] / pageHeight,
        w: (block.bbox[2] - block.bbox[0]) / pageWidth,
        h: (block.bbox[3] - block.bbox[1]) / pageHeight,
      };
    }

    // Only add if we have a block_type
    if (block.block_type) {
      blocks.push({
        id: `marker-${blockId++}`,
        type: mapMarkerBlockType(block.block_type),
        content: block.text || block.html || "",
        bbox,
        pageIndex: block.page_idx ?? 0,
      });
    }

    // Process nested children
    if (block.children && Array.isArray(block.children)) {
      for (const child of block.children) {
        processBlock(child);
      }
    }
  }

  // Handle different structures
  if (Array.isArray(jsonData)) {
    // jsonData is array of blocks
    for (const block of jsonData) {
      processBlock(block);
    }
  } else if (typeof jsonData === 'object') {
    // jsonData is an object - check for children array or process as single block
    if (jsonData.children && Array.isArray(jsonData.children)) {
      for (const block of jsonData.children) {
        processBlock(block as DatalabMarkerBlock);
      }
    } else if (jsonData.block_type) {
      // It's a single block object
      processBlock(jsonData as unknown as DatalabMarkerBlock);
    }
  }

  return blocks;
}

function mapMarkerBlockType(blockType: string): ParseBlock["type"] {
  const typeMap: Record<string, ParseBlock["type"]> = {
    "Text": "text",
    "TextInlineMath": "text",
    "Title": "title",
    "SectionHeader": "title",
    "Table": "table",
    "TableCell": "table",
    "Figure": "figure",
    "FigureCaption": "figure",
    "ListGroup": "list",
    "ListItem": "list",
    "Code": "code",
    "Equation": "equation",
    "PageHeader": "header",
    "PageFooter": "footer",
  };
  return typeMap[blockType] || "unknown";
}

async function submitToDatalabMarker(
  file: File | null,
  url: string | null,
  mode: string
): Promise<string> {
  const apiKey = process.env.DATALAB_API_KEY;
  if (!apiKey) {
    throw new Error("Datalab Marker: API key not configured");
  }

  const formData = new FormData();
  formData.append("mode", mode);
  formData.append("output_format", "markdown,html,json");
  // Limit pages for PDFs to control costs (0-indexed, so "0-1" means pages 1-2)
  formData.append("page_range", `0-${MAX_PDF_PAGES - 1}`);

  if (file) {
    formData.append("file", file);
  } else if (url) {
    formData.append("file_url", url);
  } else {
    throw new Error("Datalab Marker: No file or URL provided");
  }

  const response = await fetch(DATALAB_MARKER_API, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Datalab Marker submit error:", errorText);
    throw new Error("Datalab Marker: Failed to submit document");
  }

  const data = await response.json() as DatalabMarkerSubmitResponse;
  
  if (!data.success) {
    throw new Error(`Datalab Marker: ${data.error || "Submission failed"}`);
  }

  return data.request_id;
}

async function checkDatalabMarkerResult(requestId: string): Promise<DatalabMarkerResultResponse> {
  const apiKey = process.env.DATALAB_API_KEY;
  if (!apiKey) {
    throw new Error("Datalab Marker: API key not configured");
  }

  const response = await fetch(`${DATALAB_MARKER_API}/${requestId}`, {
    method: "GET",
    headers: {
      "X-API-Key": apiKey,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Datalab Marker: Failed to check result status");
  }

  return response.json() as Promise<DatalabMarkerResultResponse>;
}

async function parseDatalabMarker(
  file: File | null,
  url: string | null,
  mode: string
): Promise<{ content: string; pages: number; outputs: ParseOutputs }> {
  const requestId = await submitToDatalabMarker(file, url, mode);

  const maxAttempts = 60;
  const pollInterval = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await checkDatalabMarkerResult(requestId);

    if (result.status === "complete") {
      if (!result.success) {
        throw new Error(`Datalab Marker: ${result.error || "Processing failed"}`);
      }
      
      // Process markdown and HTML to embed images inline or strip broken references
      const rawMarkdown = result.markdown || "";
      const rawHtml = result.html || "";
      const [processedMarkdown, processedHtml] = await Promise.all([
        processMarkerMarkdown(rawMarkdown, result.images),
        processMarkerHtml(rawHtml, result.images),
      ]);
      
      // Check both json and children fields for blocks
      const blockData = result.json || result.children;
      console.log("Datalab Marker response keys:", Object.keys(result));
      console.log("Datalab Marker has json:", !!result.json, "has children:", !!result.children);
      if (result.json) {
        console.log("Datalab Marker json type:", Array.isArray(result.json) ? "array" : typeof result.json);
        if (!Array.isArray(result.json) && typeof result.json === 'object') {
          console.log("Datalab Marker json keys:", Object.keys(result.json));
        }
      }
      
      // Extract page dimensions from metadata or from Page block
      let pageWidth = 1;
      let pageHeight = 1;
      if (result.metadata?.pages?.[0]) {
        pageWidth = result.metadata.pages[0].width || 1;
        pageHeight = result.metadata.pages[0].height || 1;
        console.log("[Marker] page dims from metadata:", pageWidth, "x", pageHeight);
      } else if (result.metadata?.page_width && result.metadata?.page_height) {
        pageWidth = result.metadata.page_width;
        pageHeight = result.metadata.page_height;
        console.log("[Marker] page dims from metadata (flat):", pageWidth, "x", pageHeight);
      } else if (result.json && typeof result.json === 'object' && !Array.isArray(result.json)) {
        // Try to extract from the Page block's bbox [x1, y1, x2, y2]
        const jsonObj = result.json as DatalabMarkerJsonOutput;
        if (jsonObj.bbox && Array.isArray(jsonObj.bbox) && jsonObj.bbox.length === 4) {
          pageWidth = jsonObj.bbox[2] - jsonObj.bbox[0];
          pageHeight = jsonObj.bbox[3] - jsonObj.bbox[1];
          console.log("[Marker] page dims from Page bbox:", pageWidth, "x", pageHeight);
        } else if (jsonObj.children?.[0]?.bbox) {
          // Try first child if Page block has no bbox
          const firstBbox = jsonObj.children[0].bbox;
          if (Array.isArray(firstBbox) && firstBbox.length === 4) {
            // Estimate from first block - not ideal but better than 1x1
            console.log("[Marker] Warning: using first child bbox as estimate");
          }
        }
      }
      
      // Fallback: if still 1x1, try to find Page block in children
      if (pageWidth === 1 && pageHeight === 1 && result.json) {
        const jsonObj = result.json as DatalabMarkerJsonOutput;
        if (jsonObj.children) {
          const pageBlock = jsonObj.children.find((b: DatalabMarkerBlock) => b.block_type === 'Page');
          if (pageBlock?.bbox && Array.isArray(pageBlock.bbox) && pageBlock.bbox.length === 4) {
            pageWidth = pageBlock.bbox[2] - pageBlock.bbox[0];
            pageHeight = pageBlock.bbox[3] - pageBlock.bbox[1];
            console.log("[Marker] page dims from child Page block:", pageWidth, "x", pageHeight);
          }
        }
      }
      
      // Debug: log first block structure
      if (result.json) {
        const sampleBlock = Array.isArray(result.json) 
          ? result.json[0] 
          : (result.json as DatalabMarkerJsonOutput)?.children?.[0];
        if (sampleBlock) {
          console.log("[Marker] Sample block:", JSON.stringify(sampleBlock, null, 2));
        }
      }
      
      const blocks = normalizeMarkerBlocks(blockData, pageWidth, pageHeight);
      console.log("[Marker] normalized blocks:", blocks.length, "with bbox:", blocks.filter(b => b.bbox).length);
      
      return {
        content: processedMarkdown,
        pages: result.page_count ?? 1,
        outputs: {
          markdown: processedMarkdown,
          html: processedHtml || undefined,
          json: blocks.length > 0 ? { blocks } : undefined,
        },
      };
    }

    if (result.status === "error") {
      throw new Error(`Datalab Marker: ${result.error || "Processing failed"}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error("Datalab Marker: Processing timed out");
}

// ============================================================================
// Main POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = performance.now();

  try {
    const contentType = request.headers.get("content-type") || "";

    let providerId: string;
    let file: File | null = null;
    let imageData: string | URL | null = null;
    let urlString: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      file = formData.get("file") as File | null;
      const providerIdRaw = formData.get("providerId") as string | null;

      if (!file || !providerIdRaw) {
        return NextResponse.json(
          { error: "Missing file or provider" },
          { status: 400, headers: createSecureHeaders() }
        );
      }

      const providerResult = providerSchema.safeParse(providerIdRaw);
      if (!providerResult.success) {
        return NextResponse.json(
          { error: "Invalid provider" },
          { status: 400, headers: createSecureHeaders() }
        );
      }
      providerId = providerResult.data;

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "File too large (max 10MB)" },
          { status: 400, headers: createSecureHeaders() }
        );
      }

      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: "Unsupported file type" },
          { status: 400, headers: createSecureHeaders() }
        );
      }

      const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
      if (!ALLOWED_EXTENSIONS.has(extension)) {
        return NextResponse.json(
          { error: "Unsupported file extension" },
          { status: 400, headers: createSecureHeaders() }
        );
      }

      const buffer = await file.arrayBuffer();
      if (!validateFileSignature(buffer, file.type)) {
        return NextResponse.json(
          { error: "File content does not match declared type" },
          { status: 400, headers: createSecureHeaders() }
        );
      }

      // Recreate file from buffer (since we consumed the arrayBuffer)
      file = new File([buffer], file.name, { type: file.type });

      // For AI Gateway providers, convert to base64
      const base64 = Buffer.from(buffer).toString("base64");
      imageData = `data:${file.type};base64,${base64}`;
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      const result = urlRequestSchema.safeParse(body);

      if (!result.success) {
        return NextResponse.json(
          { error: "Invalid request parameters" },
          { status: 400, headers: createSecureHeaders() }
        );
      }

      providerId = result.data.providerId;
      urlString = result.data.url;
      imageData = new URL(result.data.url);
    } else {
      return NextResponse.json(
        { error: "Unsupported content type" },
        { status: 400, headers: createSecureHeaders() }
      );
    }

    // Get provider config
    const providerConfig = getProviderConfig(providerId);
    if (!providerConfig) {
      return NextResponse.json(
        { error: "Invalid provider" },
        { status: 400, headers: createSecureHeaders() }
      );
    }

    // For document parsers, strip PDF to first N pages before processing
    const isDocumentParser = ["llamaparse", "mistral-ocr", "datalab-marker"].includes(providerConfig.type);
    let processedFile = file;
    let processedUrl = urlString;
    
    if (isDocumentParser) {
      // If we have a URL, fetch it first so we can strip the PDF
      if (!processedFile && processedUrl) {
        processedFile = await fetchFileFromUrl(processedUrl);
        processedUrl = null; // We now have the file, no need for URL
      }
      
      // Strip PDF to first N pages
      if (processedFile) {
        processedFile = await stripPdfToFirstPages(processedFile, MAX_PDF_PAGES);
      }
    }

    // Handle LlamaParse
    if (providerConfig.type === "llamaparse") {
      if (!processedFile) {
        return NextResponse.json(
          { error: "LlamaParse requires a file or URL" },
          { status: 400, headers: createSecureHeaders() }
        );
      }

      const { content, pages, outputs } = await parseLlamaParse(processedFile);
      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000;
      const cost = calculatePageCost(providerConfig.modelId, pages);

      return NextResponse.json(
        {
          content,
          outputs,
          stats: {
            time: duration,
            cost,
            tokens: 0,
            pages,
          },
        },
        { status: 200, headers: createSecureHeaders() }
      );
    }

    // Handle Mistral OCR
    if (providerConfig.type === "mistral-ocr") {
      const { content, pages, outputs } = await parseMistralOCR(processedFile, processedUrl);
      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000;
      const cost = calculatePageCost(providerConfig.modelId, pages);

      return NextResponse.json(
        {
          content,
          outputs,
          stats: {
            time: duration,
            cost,
            tokens: 0,
            pages,
          },
        },
        { status: 200, headers: createSecureHeaders() }
      );
    }

    // Handle Datalab Marker
    if (providerConfig.type === "datalab-marker") {
      const { content, pages, outputs } = await parseDatalabMarker(processedFile, processedUrl, providerConfig.modelId);
      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000;
      const cost = calculatePageCost(providerConfig.modelId, pages);

      return NextResponse.json(
        {
          content,
          outputs,
          stats: {
            time: duration,
            cost,
            tokens: 0,
            pages,
          },
        },
        { status: 200, headers: createSecureHeaders() }
      );
    }

    // AI Gateway providers (Vision LLMs)
    // Check if PDF - Vision LLMs only support images, not PDFs
    const isPdf = file?.type === "application/pdf" || 
                  (urlString && urlString.toLowerCase().endsWith(".pdf"));
    
    if (isPdf) {
      return NextResponse.json(
        { error: "Vision LLMs only support images (PNG, JPG, WebP, GIF). For PDFs, use Document Parsers like LlamaParse, Mistral OCR, or Marker." },
        { status: 400, headers: createSecureHeaders() }
      );
    }

    if (!imageData) {
      return NextResponse.json(
        { error: "Missing image data" },
        { status: 400, headers: createSecureHeaders() }
      );
    }

    const model = getModel(providerId);

    const result = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PARSING_PROMPT },
            { type: "image", image: imageData },
          ],
        },
      ],
    });

    const endTime = performance.now();
    const duration = (endTime - startTime) / 1000;

    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;
    const cost = calculateCost(providerId, inputTokens, outputTokens);

    // AI Gateway providers return markdown only (no HTML/JSON blocks)
    const outputs: ParseOutputs = {
      markdown: result.text,
    };

    return NextResponse.json(
      {
        content: result.text,
        outputs,
        stats: {
          time: duration,
          cost,
          tokens: inputTokens + outputTokens,
          inputTokens,
          outputTokens,
        },
      },
      { status: 200, headers: createSecureHeaders() }
    );
  } catch (error) {
    console.error("Parse API error:", error);

    const endTime = performance.now();
    const duration = (endTime - startTime) / 1000;

    return NextResponse.json(
      {
        error: sanitizeError(error),
        stats: { time: duration },
      },
      { status: 500, headers: createSecureHeaders() }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: createSecureHeaders() }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: createSecureHeaders() }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: createSecureHeaders() }
  );
}
