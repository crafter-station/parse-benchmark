"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ParseBlock } from "@/lib/types";
import type { ProviderConfig } from "@/lib/providers";
import {
  Box,
  Type,
  Table,
  Image,
  List,
  Hash,
  FileText,
  Code,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
} from "lucide-react";

interface BlockViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ProviderConfig;
  blocks: ParseBlock[];
  documentSrc: string | null;
  // Navigation props
  allProviderIds?: string[];
  onNavigate?: (providerId: string) => void;
}

const typeIcons: Record<string, React.ElementType> = {
  text: Type,
  table: Table,
  figure: Image,
  title: Hash,
  list: List,
  header: FileText,
  footer: FileText,
  code: Code,
  unknown: Box,
};

const typeColors: Record<string, string> = {
  text: "#3b82f6",      // blue
  table: "#22c55e",     // green
  figure: "#f59e0b",    // amber
  title: "#ef4444",     // red
  list: "#8b5cf6",      // purple
  header: "#06b6d4",    // cyan
  footer: "#64748b",    // slate
  code: "#ec4899",      // pink
  equation: "#14b8a6",  // teal
  unknown: "#9ca3af",   // gray
};

function BlockItem({
  block,
  isHovered,
  onHover,
  onClick,
}: {
  block: ParseBlock;
  isHovered: boolean;
  onHover: (block: ParseBlock | null) => void;
  onClick: (block: ParseBlock) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const blockType = block.type.toLowerCase();
  const Icon = typeIcons[blockType] || Box;
  const color = typeColors[blockType] || typeColors.unknown;
  const hasContent = block.content && block.content.length > 0;
  const hasBbox = !!block.bbox;
  const contentPreview = block.content?.slice(0, 80) || "";
  const isLongContent = (block.content?.length || 0) > 80;

  return (
    <div
      className={cn(
        "border-l-2 transition-all duration-100 cursor-pointer",
        isHovered ? "bg-white/10 border-white" : "border-transparent hover:bg-white/5"
      )}
      style={{ borderLeftColor: isHovered ? color : "transparent" }}
      onMouseEnter={() => hasBbox && onHover(block)}
      onMouseLeave={() => onHover(null)}
      onClick={() => hasBbox && onClick(block)}
    >
      <div className="flex items-start gap-2 py-2 px-3">
        <div
          className="mt-0.5 p-1 rounded"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="w-3 h-3" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white/90 capitalize">
              {block.type}
            </span>
            {block.confidence !== undefined && (
              <span className="text-[10px] text-white/50">
                {(block.confidence * 100).toFixed(0)}%
              </span>
            )}
            {!hasBbox && (
              <span className="text-[10px] text-white/30 italic">no bbox</span>
            )}
          </div>
          {hasContent && (
            <div className="mt-1">
              <p className="text-xs text-white/60 break-words">
                {isExpanded ? block.content : contentPreview}
                {isLongContent && !isExpanded && "..."}
              </p>
              {isLongContent && (
                <button
                  className="text-[10px] text-white/40 hover:text-white/60 mt-1 flex items-center gap-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                >
                  {isExpanded ? (
                    <>
                      <ChevronDown className="w-3 h-3" /> Less
                    </>
                  ) : (
                    <>
                      <ChevronRight className="w-3 h-3" /> More
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function BlockViewerModal({
  open,
  onOpenChange,
  provider,
  blocks,
  documentSrc,
  allProviderIds = [],
  onNavigate,
}: BlockViewerModalProps) {
  const [hoveredBlock, setHoveredBlock] = useState<ParseBlock | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<ParseBlock | null>(null);
  const blockListRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Navigation state
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

  // Keyboard navigation (only for left/right, not interfering with block selection)
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

  // Scroll to selected block in the list
  useEffect(() => {
    if (selectedBlock) {
      const blockEl = blockRefs.current.get(selectedBlock.id);
      if (blockEl) {
        blockEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [selectedBlock]);

  const blocksWithBbox = useMemo(
    () => blocks.filter((b) => b.bbox && b.type !== "unknown"),
    [blocks]
  );

  const blocksByType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const block of blocks) {
      counts[block.type] = (counts[block.type] || 0) + 1;
    }
    return counts;
  }, [blocks]);

  const handleBboxClick = (block: ParseBlock) => {
    setSelectedBlock(block);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-6xl w-[calc(100vw-3rem)] h-[80vh] p-0 bg-[#0a0a0a] border-white/10">
        <DialogHeader className="px-4 py-3 border-b border-white/10">
          <DialogTitle className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: provider.color }}
              />
              {provider.name} - Block Viewer
              <span className="text-sm font-normal text-white/50">
                {blocksWithBbox.length} blocks with bounding boxes
              </span>
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

        <div className="flex flex-1 min-h-0">
          {/* Document Preview with Bboxes */}
          <ScrollArea className="flex-1 bg-black/40">
            <div className="p-6 flex items-start justify-center min-h-full">
              {documentSrc ? (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={documentSrc}
                    alt="Document"
                    className="max-w-full h-auto w-auto"
                  />
                {/* Bounding boxes overlay */}
                {blocksWithBbox.map((block) => {
                  const isHovered = hoveredBlock?.id === block.id;
                  const isSelected = selectedBlock?.id === block.id;
                  const blockType = block.type.toLowerCase();
                  const color = typeColors[blockType] || typeColors.unknown;

                  return (
                    <div
                      key={block.id}
                      className="absolute cursor-pointer transition-all duration-100"
                      style={{
                        left: `${block.bbox!.x * 100}%`,
                        top: `${block.bbox!.y * 100}%`,
                        width: `${block.bbox!.w * 100}%`,
                        height: `${block.bbox!.h * 100}%`,
                        borderWidth: isHovered || isSelected ? 2 : 1,
                        borderStyle: "solid",
                        borderColor: color,
                        backgroundColor:
                          isHovered || isSelected
                            ? `${color}40`
                            : `${color}15`,
                        zIndex: isSelected ? 20 : isHovered ? 10 : 1,
                      }}
                      onMouseEnter={() => setHoveredBlock(block)}
                      onMouseLeave={() => setHoveredBlock(null)}
                      onClick={() => handleBboxClick(block)}
                      title={`${block.type}${
                        block.confidence
                          ? ` (${(block.confidence * 100).toFixed(0)}%)`
                          : ""
                      }`}
                    >
                      {/* Type label on hover */}
                      {(isHovered || isSelected) && (
                        <div
                          className="absolute -top-5 left-0 px-1.5 py-0.5 text-[10px] font-medium text-white rounded whitespace-nowrap"
                          style={{ backgroundColor: color }}
                        >
                          {block.type}
                          {block.confidence &&
                            ` ${(block.confidence * 100).toFixed(0)}%`}
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-white/40">
                  No document preview available
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Block List */}
          <div className="w-56 min-w-56 border-l border-white/10 flex flex-col overflow-hidden">
            {/* Stats header */}
            <div className="p-3 border-b border-white/10 bg-black/20 shrink-0 max-h-32 overflow-y-auto">
              <div className="text-xs text-white/70 mb-2">Block Types</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(blocksByType).map(([type, count]) => {
                  const color = typeColors[type.toLowerCase()] || typeColors.unknown;
                  return (
                    <div
                      key={type}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      <span className="capitalize">{type}</span>
                      <span className="opacity-70">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Block list */}
            <ScrollArea className="flex-1 min-h-0">
              <div ref={blockListRef} className="divide-y divide-white/5">
                {blocks.map((block) => (
                  <div
                    key={block.id}
                    ref={(el) => {
                      if (el) blockRefs.current.set(block.id, el);
                    }}
                  >
                    <BlockItem
                      block={block}
                      isHovered={
                        hoveredBlock?.id === block.id ||
                        selectedBlock?.id === block.id
                      }
                      onHover={setHoveredBlock}
                      onClick={setSelectedBlock}
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
