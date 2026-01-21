"use client";

import React, { useCallback, useState, useEffect } from "react";
import { Upload, FileText, X, Link, AlertCircle, FileImage } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParseBlock } from "@/lib/types";

export type InputMode = "file" | "url";

// Preloaded sample documents
const SAMPLES = [
  { id: "invoice", name: "Invoice", file: "/samples/invoice.png" },
  { id: "financial", name: "Financial 10-K", file: "/samples/financial-10k.png" },
  { id: "handwritten", name: "Handwritten", file: "/samples/handwritten-invoice.png" },
  { id: "healthcare", name: "Healthcare", file: "/samples/healthcare-details-disclaimers.png" },
  { id: "math", name: "Math Heavy", file: "/samples/math-heavy-documents.png" },
] as const;

export interface DocumentInput {
  mode: InputMode;
  file?: File;
  url?: string;
}

// Block with provider info for overlay rendering
export interface BlockWithProvider extends ParseBlock {
  providerId: string;
  providerColor: string;
}

interface DocumentInputProps {
  onInputChange: (input: DocumentInput | null) => void;
  input: DocumentInput | null;
  highlightedBlockId?: string | null;  // kept for potential future use
  allBlocks?: BlockWithProvider[];     // kept for potential future use
  selectedBlockId?: string | null;     // kept for potential future use
  onBlockSelect?: (blockId: string, providerId: string) => void;  // kept for potential future use
}

const ALLOWED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif"];
const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/pdf",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function getFileExtension(filename: string): string {
  return filename.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
}

function getExtensionFromMime(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
  };
  return mimeToExt[mimeType] || "";
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

export function DocumentInput({ 
  onInputChange, 
  input, 
  highlightedBlockId,
  allBlocks = [],
  selectedBlockId,
  onBlockSelect 
}: DocumentInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<InputMode>("file");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Create preview URL when file changes
  useEffect(() => {
    if (input?.mode === "file" && input.file && isImageFile(input.file)) {
      const url = URL.createObjectURL(input.file);
      setPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setPreviewUrl(null);
      };
    } else {
      setPreviewUrl(null);
    }
  }, [input]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const validateFile = useCallback((file: File, isPasted = false): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return "File too large (max 10MB)";
    }
    // For pasted images, check MIME type instead of extension
    if (isPasted) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return "Unsupported file type";
      }
      return null;
    }
    const ext = getFileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`;
    }
    return null;
  }, []);

  const handleFileSelect = useCallback(
    (file: File, isPasted = false) => {
      const validationError = validateFile(file, isPasted);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);
      
      // For pasted images without proper filename, create a new file with correct name
      if (isPasted && !file.name.includes(".")) {
        const ext = getExtensionFromMime(file.type);
        const newFile = new File([file], `pasted-image${ext}`, { type: file.type });
        onInputChange({ mode: "file", file: newFile });
      } else {
        onInputChange({ mode: "file", file });
      }
    },
    [onInputChange, validateFile]
  );

  // Handle clipboard paste
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            setMode("file");
            handleFileSelect(file, true);
          }
          return;
        }
      }
    },
    [handleFileSelect]
  );

  // Add paste event listener
  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [handlePaste]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files[0]) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files[0]) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  const handleUrlSubmit = useCallback(() => {
    const trimmedUrl = urlValue.trim();
    if (!trimmedUrl) {
      setError("Please enter a URL");
      return;
    }
    if (!isValidUrl(trimmedUrl)) {
      setError("Please enter a valid HTTPS URL");
      return;
    }
    setError(null);
    onInputChange({ mode: "url", url: trimmedUrl });
  }, [urlValue, onInputChange]);

  const handleUrlKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleUrlSubmit();
      }
    },
    [handleUrlSubmit]
  );

  const removeInput = useCallback(() => {
    onInputChange(null);
    setUrlValue("");
    setError(null);
  }, [onInputChange]);

  const switchMode = useCallback(
    (newMode: InputMode) => {
      setMode(newMode);
      setError(null);
      if (input) {
        onInputChange(null);
      }
      setUrlValue("");
    },
    [input, onInputChange]
  );

  const loadSample = useCallback(
    async (sampleFile: string, sampleName: string) => {
      setError(null);
      try {
        const response = await fetch(sampleFile);
        if (!response.ok) throw new Error("Failed to load sample");
        const blob = await response.blob();
        const fileName = sampleFile.split("/").pop() || `${sampleName}.png`;
        const file = new File([blob], fileName, { type: blob.type });
        onInputChange({ mode: "file", file });
      } catch {
        setError("Failed to load sample document");
      }
    },
    [onInputChange]
  );

  // Check if URL is an image
  const isImageUrl = (url: string): boolean => {
    const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some((ext) => lowerUrl.includes(ext));
  };

  // Show selected input
  if (input) {
    const hasFilePreview = previewUrl && input.mode === "file" && input.file && isImageFile(input.file);
    const hasUrlPreview = input.mode === "url" && input.url && isImageUrl(input.url);
    const hasPreview = hasFilePreview || hasUrlPreview;
    const previewSrc = hasFilePreview ? previewUrl : hasUrlPreview ? input.url : null;
    
    return (
      <div className="relative border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden">
        {/* Compact preview with thumbnail */}
        <div className="p-3 flex items-center gap-3">
          {/* Thumbnail */}
          {hasPreview && previewSrc && (
            <div className="w-12 h-12 shrink-0 bg-black/40 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewSrc}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          {!hasPreview && (
            <div className="w-12 h-12 shrink-0 bg-white/10 flex items-center justify-center">
              {input.mode === "file" ? (
                <FileText className="w-5 h-5 text-muted-foreground" />
              ) : (
                <Link className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          )}
          
          {/* File info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-foreground">
              {input.mode === "file" ? input.file?.name : "URL Input"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {input.mode === "file"
                ? `${((input.file?.size ?? 0) / 1024).toFixed(1)} KB`
                : input.url}
            </p>
          </div>
          
          {/* Remove button */}
          <button
            onClick={removeInput}
            className="p-1.5 hover:bg-white/10 transition-colors shrink-0"
            aria-label="Remove input"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Mode Toggle */}
      <div className="flex gap-1 p-1 bg-white/5 border border-white/10">
        <button
          onClick={() => switchMode("file")}
          className={cn(
            "flex-1 px-3 py-1.5 text-xs font-medium transition-colors",
            mode === "file"
              ? "bg-white/10 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Upload File
        </button>
        <button
          onClick={() => switchMode("url")}
          className={cn(
            "flex-1 px-3 py-1.5 text-xs font-medium transition-colors",
            mode === "url"
              ? "bg-white/10 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Paste URL
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* File Upload Mode */}
      {mode === "file" && (
        <>
          <div
            className={cn(
              "relative border-2 border-dashed p-4 transition-all duration-200 cursor-pointer backdrop-blur-md flex items-center justify-center",
              isDragging
                ? "border-white/40 bg-white/10"
                : "border-white/10 hover:border-white/30 hover:bg-white/5"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileInput}
              accept={ALLOWED_EXTENSIONS.join(",")}
            />
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 shrink-0">
                <Upload className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">
                  Drop or paste document
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF (first 2 pages), PNG, JPG, WebP
                </p>
              </div>
            </div>
          </div>

          {/* Sample documents */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Or try a sample:</p>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLES.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => loadSample(sample.file, sample.name)}
                  className="px-2 py-1 text-xs bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors flex items-center gap-1"
                >
                  <FileImage className="w-3 h-3" />
                  {sample.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* URL Input Mode */}
      {mode === "url" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={handleUrlKeyDown}
              placeholder="https://example.com/document.pdf"
              className="flex-1 px-3 py-2 bg-black/40 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/30"
            />
            <button
              onClick={handleUrlSubmit}
              className="px-4 py-2 bg-white/10 border border-white/10 text-sm font-medium text-foreground hover:bg-white/20 transition-colors"
            >
              Load
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            HTTPS URLs · PDFs limited to first 2 pages
          </p>
        </div>
      )}
    </div>
  );
}
