"use client";

import { useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ParseResult } from "@/lib/types";
import type { ProviderConfig } from "@/lib/providers";

interface DetailViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ProviderConfig;
  result: ParseResult;
  documentSrc: string | null;
  // Navigation props
  allProviderIds?: string[];
  onNavigate?: (providerId: string) => void;
}

export function DetailViewerModal({
  open,
  onOpenChange,
  provider,
  result,
  documentSrc,
  allProviderIds = [],
  onNavigate,
}: DetailViewerModalProps) {
  const content = result.status === "complete" ? result.content : "";
  
  // Find current index and determine if navigation is possible
  const currentIndex = allProviderIds.indexOf(provider.id);
  const canNavigate = allProviderIds.length > 1 && onNavigate;
  const hasPrevious = canNavigate && currentIndex > 0;
  const hasNext = canNavigate && currentIndex < allProviderIds.length - 1;

  const navigatePrevious = useCallback(() => {
    if (hasPrevious && onNavigate) {
      onNavigate(allProviderIds[currentIndex - 1]);
    }
  }, [hasPrevious, onNavigate, allProviderIds, currentIndex]);

  const navigateNext = useCallback(() => {
    if (hasNext && onNavigate) {
      onNavigate(allProviderIds[currentIndex + 1]);
    }
  }, [hasNext, onNavigate, allProviderIds, currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!open || !canNavigate) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigatePrevious();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navigateNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, canNavigate, navigatePrevious, navigateNext]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-6xl w-[calc(100vw-3rem)] h-[80vh] p-0 bg-[#0a0a0a] border-white/10 flex flex-col overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-white/10 shrink-0">
          <DialogTitle className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: provider.color }}
              />
              {provider.name} - Detail View
              {result.stats && (
                <span className="text-sm font-normal text-white/50">
                  {result.stats.time.toFixed(2)}s · ${result.stats.cost.toFixed(4)}
                </span>
              )}
            </div>
            
            {/* Navigation controls */}
            {canNavigate && (
              <div className="flex items-center gap-2">
                <button
                  onClick={navigatePrevious}
                  disabled={!hasPrevious}
                  className="p-1.5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous result"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-white/50 tabular-nums min-w-[3ch] text-center">
                  {currentIndex + 1}/{allProviderIds.length}
                </span>
                <button
                  onClick={navigateNext}
                  disabled={!hasNext}
                  className="p-1.5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next result"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-xs text-white/30 ml-2 hidden sm:inline">
                  ← → to navigate
                </span>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Document Preview */}
          <ScrollArea className="w-1/2 h-full bg-black/40 border-r border-white/10">
            <div className="p-4 flex items-start justify-center">
              {documentSrc ? (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={documentSrc}
                    alt="Document"
                    className="max-w-full h-auto"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-white/40 py-20">
                  No document preview available
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Result Content */}
          <ScrollArea className="w-1/2 h-full bg-black/20">
            <div className="p-4">
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
                Parsed Content
              </div>
              {content ? (
                <div className="prose prose-invert prose-sm max-w-none overflow-hidden break-words">
                  <MarkdownRenderer content={content} />
                </div>
              ) : (
                <div className="text-white/40 text-sm">
                  No content available
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
