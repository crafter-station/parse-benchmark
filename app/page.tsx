"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { DocumentInput, type DocumentInput as DocumentInputType, type BlockWithProvider, SAMPLES } from "@/components/document-input";
import { FloatingHeader } from "@/components/floating-header";
import { ParticleBackground } from "@/components/particle-background";
import { ProviderSelector, providers } from "@/components/provider-selector";
import { ResultCard } from "@/components/result-card";
import { BlockViewerModal } from "@/components/block-viewer-modal";
import { DetailViewerModal } from "@/components/detail-viewer-modal";
import type { ParseResult, ParseOutputs, ParseStats } from "@/lib/types";
import { StatsSummary } from "@/components/stats-summary";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Footer } from "@/components/footer";
import { Play, RotateCcw, Zap, FileImage, Upload, Link } from "lucide-react";

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

interface ParseDocumentResult {
  content: string;
  outputs?: ParseOutputs;
  stats: ParseStats;
  rateLimit?: RateLimitInfo;
}

function extractRateLimit(response: Response): RateLimitInfo | undefined {
  const limit = response.headers.get("X-RateLimit-Limit");
  const remaining = response.headers.get("X-RateLimit-Remaining");
  const reset = response.headers.get("X-RateLimit-Reset");

  if (limit && remaining && reset) {
    return {
      limit: parseInt(limit, 10),
      remaining: parseInt(remaining, 10),
      reset: parseInt(reset, 10),
    };
  }
  return undefined;
}

async function parseDocument(
  input: DocumentInputType,
  providerId: string
): Promise<ParseDocumentResult> {
  if (input.mode === "file" && input.file) {
    const formData = new FormData();
    formData.append("file", input.file);
    formData.append("providerId", providerId);

    const response = await fetch("/api/parse", {
      method: "POST",
      body: formData,
    });

    const rateLimit = extractRateLimit(response);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to parse document");
    }

    const data = await response.json();
    return { ...data, rateLimit };
  } else if (input.mode === "url" && input.url) {
    const response = await fetch("/api/parse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: input.url,
        providerId,
      }),
    });

    const rateLimit = extractRateLimit(response);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to parse document");
    }

    const data = await response.json();
    return { ...data, rateLimit };
  }

  throw new Error("Invalid input");
}

// Document parser providers that support PDFs
const DOCUMENT_PARSER_IDS = ["llamaparse", "mistral-ocr", "datalab-marker"];

export default function Home() {
  const [documentInput, setDocumentInput] = useState<DocumentInputType | null>(null);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([
    "llamaparse",
    "mistral-ocr",
    "datalab-marker",
    "gpt-4o",
  ]);
  const [results, setResults] = useState<ParseResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<{ blockId: string; providerId: string } | null>(null);
  
  // Block viewer modal state
  const [blockViewerProviderId, setBlockViewerProviderId] = useState<string | null>(null);
  const [detailViewerProviderId, setDetailViewerProviderId] = useState<string | null>(null);
  const [documentPreviewSrc, setDocumentPreviewSrc] = useState<string | null>(null);
  
  // Rate limit tracking
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  
  // Empty state input handling
  const [emptyStateUrl, setEmptyStateUrl] = useState("");
  const [isDraggingEmpty, setIsDraggingEmpty] = useState(false);

  // Generate document preview URL when input changes
  useEffect(() => {
    if (documentInput?.mode === "file" && documentInput.file) {
      const url = URL.createObjectURL(documentInput.file);
      setDocumentPreviewSrc(url);
      return () => URL.revokeObjectURL(url);
    } else if (documentInput?.mode === "url" && documentInput.url) {
      setDocumentPreviewSrc(documentInput.url);
    } else {
      setDocumentPreviewSrc(null);
    }
  }, [documentInput]);

  const handleBlockHover = useCallback((blockId: string | null) => {
    setHoveredBlockId(blockId);
  }, []);

  const handleBlockSelect = useCallback((blockId: string, providerId: string) => {
    setSelectedBlock({ blockId, providerId });
  }, []);

  const handleViewBlocks = useCallback((providerId: string) => {
    setBlockViewerProviderId(providerId);
  }, []);

  const closeBlockViewer = useCallback(() => {
    setBlockViewerProviderId(null);
  }, []);

  const handleViewDetail = useCallback((providerId: string) => {
    setDetailViewerProviderId(providerId);
  }, []);

  const closeDetailViewer = useCallback(() => {
    setDetailViewerProviderId(null);
  }, []);

  // Build allBlocks from all results for bbox overlay rendering
  const allBlocks = useMemo<BlockWithProvider[]>(() => {
    const blocks: BlockWithProvider[] = [];
    
    for (const result of results) {
      if (result.status !== "complete" || !result.outputs?.json?.blocks) continue;
      
      const provider = providers.find(p => p.id === result.providerId);
      if (!provider) continue;
      
      for (const block of result.outputs.json.blocks) {
        if (block.bbox) {
          blocks.push({
            ...block,
            providerId: result.providerId,
            providerColor: provider.color,
          });
        }
      }
    }
    
    return blocks;
  }, [results]);

  const toggleProvider = useCallback((id: string) => {
    setSelectedProviders((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }, []);

  const loadSample = useCallback(async (sampleFile: string, sampleName: string) => {
    try {
      const response = await fetch(sampleFile);
      if (!response.ok) throw new Error("Failed to load sample");
      const blob = await response.blob();
      const fileName = sampleFile.split("/").pop() || `${sampleName}.png`;
      const file = new File([blob], fileName, { type: blob.type });
      setDocumentInput({ mode: "file", file });
    } catch (error) {
      console.error("Failed to load sample:", error);
    }
  }, []);

  // Empty state handlers
  const handleEmptyStateDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingEmpty(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      setDocumentInput({ mode: "file", file: files[0] });
    }
  }, []);

  const handleEmptyStateFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      setDocumentInput({ mode: "file", file: files[0] });
    }
  }, []);

  const handleEmptyStateUrlSubmit = useCallback(() => {
    const trimmedUrl = emptyStateUrl.trim();
    if (!trimmedUrl) return;
    try {
      const url = new URL(trimmedUrl);
      if (url.protocol === "https:") {
        setDocumentInput({ mode: "url", url: trimmedUrl });
        setEmptyStateUrl("");
      }
    } catch {
      // Invalid URL, ignore
    }
  }, [emptyStateUrl]);

  const startBenchmark = useCallback(async () => {
    if (!documentInput || selectedProviders.length === 0) return;

    setIsRunning(true);

    // Check if input is PDF
    const isPdf = documentInput.mode === "file" 
      ? (documentInput.file?.type === "application/pdf" || documentInput.file?.name.toLowerCase().endsWith(".pdf"))
      : documentInput.url?.toLowerCase().endsWith(".pdf");

    // Initialize results - mark Vision LLMs as skipped for PDFs
    const initialResults: ParseResult[] = selectedProviders.map((id) => {
      const isVisionLlm = !DOCUMENT_PARSER_IDS.includes(id);
      if (isPdf && isVisionLlm) {
        return {
          providerId: id,
          status: "skipped" as const,
          skipReason: "PDF not supported by Vision LLMs",
        };
      }
      return {
        providerId: id,
        status: "parsing" as const,
      };
    });
    setResults(initialResults);

    // Only run document parsers for PDFs, all providers for images
    const providersToRun = isPdf 
      ? selectedProviders.filter(id => DOCUMENT_PARSER_IDS.includes(id))
      : selectedProviders;

    // Run providers in parallel
    const promises = providersToRun.map(async (providerId) => {
      try {
        const result = await parseDocument(documentInput, providerId);
        // Update rate limit from the latest response
        if (result.rateLimit) {
          setRateLimit(result.rateLimit);
        }
        return {
          providerId,
          status: "complete" as const,
          content: result.content,
          outputs: result.outputs,
          stats: result.stats,
        };
      } catch (error) {
        return {
          providerId,
          status: "error" as const,
          error: error instanceof Error ? error.message : "Unknown error",
          stats: { time: 0, cost: 0, tokens: 0 },
        };
      }
    });

    // Update results as they complete
    for (const promise of promises) {
      const result = await promise;
      setResults((prev) =>
        prev.map((r) => (r.providerId === result.providerId ? result : r))
      );
    }

    setIsRunning(false);
  }, [documentInput, selectedProviders]);

  const resetBenchmark = useCallback(() => {
    setResults([]);
    setIsRunning(false);
  }, []);

  const selectedProviderData = providers.filter((p) =>
    selectedProviders.includes(p.id)
  );

  const hasInput = documentInput !== null;

  return (
    <main className="min-h-screen relative">
      <ParticleBackground />

      {/* Margin lines container */}
      <div className="fixed inset-x-0 top-0 bottom-12 sm:bottom-16 pointer-events-none flex justify-center z-10">
        <div className="w-full max-w-7xl mx-4 sm:mx-6 relative">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-white/10" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-white/10" />
        </div>
      </div>

      {/* Main panel container */}
      <div className="relative z-20 flex justify-center pb-12 sm:pb-16 min-h-screen">
        <div className="w-full max-w-7xl mx-4 sm:mx-6">
          <div className="min-h-[calc(100vh-3rem)] sm:min-h-[calc(100vh-4rem)] bg-[#131010]/80 border-x border-b border-white/10 flex flex-col">
            <FloatingHeader />
            <div className="px-6 sm:px-8 py-6 flex-1">
              {/* Control Panel - Compact Row */}
              <div className="flex flex-col lg:flex-row gap-4 mb-6">
                {/* Document Input */}
                <div className="lg:w-64 shrink-0">
                  <h2 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                    Document
                  </h2>
                  <DocumentInput
                    input={documentInput}
                    onInputChange={setDocumentInput}
                    highlightedBlockId={hoveredBlockId}
                    allBlocks={allBlocks}
                    selectedBlockId={selectedBlock?.blockId}
                    onBlockSelect={handleBlockSelect}
                  />
                </div>

                {/* Providers + Run Button */}
                <div className="flex-1 flex flex-col">
                  <h2 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                    Providers
                  </h2>
                  <div className="flex flex-col sm:flex-row gap-3 items-start">
                    <div className="flex-1">
                      <ProviderSelector
                        selected={selectedProviders}
                        onToggle={toggleProvider}
                        compact
                      />
                    </div>
                    <div className="flex gap-2 shrink-0 w-full sm:w-auto items-center">
                      <Button
                        className="flex-1 sm:flex-none sm:px-6"
                        onClick={startBenchmark}
                        disabled={!hasInput || selectedProviders.length === 0 || isRunning}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        {isRunning ? "Running..." : "Run Benchmark"}
                      </Button>
                      {results.length > 0 && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={resetBenchmark}
                          disabled={isRunning}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      )}
                      {rateLimit && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground ml-2 cursor-help">
                              <Zap className="w-3 h-3" />
                              <span className="tabular-nums">
                                {rateLimit.remaining}/{rateLimit.limit}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            Requests remaining (resets every 10s)
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-white/10 my-6" />

              {/* Results Section - Full Width */}
              <div>
                {results.length === 0 ? (
                  <div className="space-y-6">
                    {/* Upload / URL Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Drop Zone */}
                      <div
                        className={`relative border-2 border-dashed p-8 transition-all cursor-pointer ${
                          isDraggingEmpty
                            ? "border-white/40 bg-white/10"
                            : "border-white/10 hover:border-white/30 hover:bg-white/5"
                        }`}
                        onDragEnter={(e) => { e.preventDefault(); setIsDraggingEmpty(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setIsDraggingEmpty(false); }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleEmptyStateDrop}
                      >
                        <input
                          type="file"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={handleEmptyStateFileInput}
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.gif"
                        />
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="w-12 h-12 bg-white/10 flex items-center justify-center mb-3">
                            <Upload className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <h3 className="text-sm font-medium text-foreground mb-1">
                            Drop or click to upload
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            PDF, PNG, JPG, WebP (max 10MB)
                          </p>
                        </div>
                      </div>

                      {/* URL Input */}
                      <div className="border border-white/10 p-8 bg-black/20">
                        <div className="flex flex-col items-center justify-center text-center h-full">
                          <div className="w-12 h-12 bg-white/10 flex items-center justify-center mb-3">
                            <Link className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <h3 className="text-sm font-medium text-foreground mb-3">
                            Or paste a URL
                          </h3>
                          <div className="flex gap-2 w-full max-w-md">
                            <input
                              type="url"
                              value={emptyStateUrl}
                              onChange={(e) => setEmptyStateUrl(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleEmptyStateUrlSubmit()}
                              placeholder="https://example.com/document.pdf"
                              className="flex-1 px-3 py-2 bg-black/40 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/30"
                            />
                            <button
                              onClick={handleEmptyStateUrlSubmit}
                              className="px-4 py-2 bg-white/10 border border-white/10 text-sm font-medium text-foreground hover:bg-white/20 transition-colors"
                            >
                              Load
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Samples Section */}
                    <div className="border border-white/10 p-6 bg-black/20">
                      <div className="text-center mb-4">
                        <h3 className="text-sm font-medium text-foreground mb-1">
                          Or try a sample document
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          See how different parsers handle various document types
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {SAMPLES.map((sample) => (
                          <button
                            key={sample.id}
                            onClick={() => loadSample(sample.file, sample.name)}
                            className="group relative overflow-hidden border border-white/10 bg-black/40 hover:bg-white/5 hover:border-white/20 transition-all p-3 text-left"
                          >
                            <div className="aspect-[4/3] mb-2 bg-white/5 overflow-hidden flex items-center justify-center">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={sample.file}
                                alt={sample.name}
                                className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <FileImage className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-sm font-medium text-foreground truncate">{sample.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{sample.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {selectedProviderData.map((provider) => {
                        const result = results.find(
                          (r) => r.providerId === provider.id
                        ) || {
                          providerId: provider.id,
                          status: "idle" as const,
                        };
                        const isSelectedProvider = selectedBlock?.providerId === provider.id;
                        return (
                          <ResultCard
                            key={provider.id}
                            provider={provider}
                            result={result}
                            onBlockHover={handleBlockHover}
                            selectedBlockId={isSelectedProvider ? selectedBlock?.blockId : null}
                            onViewBlocks={() => handleViewBlocks(provider.id)}
                            onViewDetail={() => handleViewDetail(provider.id)}
                          />
                        );
                      })}
                    </div>

                    <StatsSummary results={results} providers={providers} />
                  </div>
                )}
              </div>
            </div>

            {/* Footer - inside panel */}
            <Footer />
          </div>
        </div>
      </div>

      {/* Block Viewer Modal */}
      {blockViewerProviderId && (() => {
        const provider = providers.find(p => p.id === blockViewerProviderId);
        const result = results.find(r => r.providerId === blockViewerProviderId);
        const blocks = result?.outputs?.json?.blocks || [];
        
        if (!provider) return null;
        
        // Get provider IDs that have blocks
        const providersWithBlocks = results
          .filter(r => r.status === "complete" && r.outputs?.json?.blocks?.length)
          .map(r => r.providerId);
        
        return (
          <BlockViewerModal
            open={!!blockViewerProviderId}
            onOpenChange={(open) => !open && closeBlockViewer()}
            provider={provider}
            blocks={blocks}
            documentSrc={documentPreviewSrc}
            allProviderIds={providersWithBlocks}
            onNavigate={setBlockViewerProviderId}
          />
        );
      })()}

      {/* Detail Viewer Modal */}
      {detailViewerProviderId && (() => {
        const provider = providers.find(p => p.id === detailViewerProviderId);
        const result = results.find(r => r.providerId === detailViewerProviderId);
        
        if (!provider || !result) return null;
        
        // Get provider IDs that have viewable results (complete or error with content)
        const viewableProviderIds = results
          .filter(r => r.status === "complete" || r.status === "error")
          .map(r => r.providerId);
        
        return (
          <DetailViewerModal
            open={!!detailViewerProviderId}
            onOpenChange={(open) => !open && closeDetailViewer()}
            provider={provider}
            result={result}
            documentSrc={documentPreviewSrc}
            allProviderIds={viewableProviderIds}
            onNavigate={setDetailViewerProviderId}
          />
        );
      })()}
    </main>
  );
}
