// Bounding box with normalized coordinates (0-1 fractions of page dimensions)
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Individual block from document parsing
export interface ParseBlock {
  id: string;
  type: "text" | "table" | "figure" | "title" | "list" | "header" | "footer" | "code" | "equation" | "unknown";
  content: string;
  bbox?: BBox;
  confidence?: number;
  pageIndex: number;
}

// Page dimensions
export interface PageDimensions {
  width: number;
  height: number;
}

// Rich outputs from OCR providers
export interface ParseOutputs {
  markdown: string;
  html?: string;
  json?: {
    blocks: ParseBlock[];
    dimensions?: PageDimensions[];
  };
}

// Stats from parsing
export interface ParseStats {
  time: number;
  cost: number;
  tokens: number;
  pages?: number;
}

// Complete parse result
export interface ParseResult {
  providerId: string;
  status: "idle" | "parsing" | "complete" | "error" | "skipped";
  content?: string; // Backward compatible - same as outputs.markdown
  outputs?: ParseOutputs;
  stats?: ParseStats;
  error?: string;
  skipReason?: string; // Reason for skipping (e.g., "PDF not supported")
}

// Hover state for bounding box highlighting
export interface HoveredBlock {
  providerId: string;
  bbox: BBox;
  pageIndex: number;
}
