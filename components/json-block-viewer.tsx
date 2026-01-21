"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronRight, ChevronDown, Box, Type, Table, Image, List, Code, Hash, FileText } from "lucide-react";
import type { ParseBlock, BBox } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface JsonBlockViewerProps {
  blocks: ParseBlock[];
  onBlockHover?: (blockId: string | null) => void;
  selectedBlockId?: string | null;
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
  equation: Code,
  unknown: Box,
};

const typeColors: Record<string, string> = {
  text: "text-blue-400",
  table: "text-green-400",
  figure: "text-purple-400",
  title: "text-yellow-400",
  list: "text-orange-400",
  header: "text-cyan-400",
  footer: "text-cyan-400",
  code: "text-pink-400",
  equation: "text-pink-400",
  unknown: "text-gray-400",
};

function BlockItem({
  block,
  onHover,
  isSelected,
  blockRef,
}: {
  block: ParseBlock;
  onHover?: (blockId: string | null) => void;
  isSelected?: boolean;
  blockRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = typeIcons[block.type] || Box;
  const colorClass = typeColors[block.type] || "text-gray-400";
  
  const hasContent = block.content && block.content.length > 0;
  const hasBbox = block.bbox !== undefined;
  const contentPreview = block.content?.slice(0, 100) || "";
  const isLongContent = (block.content?.length || 0) > 100;

  // Auto-expand when selected
  useEffect(() => {
    if (isSelected && hasContent) {
      setIsExpanded(true);
    }
  }, [isSelected, hasContent]);

  const handleMouseEnter = () => {
    if (hasBbox && onHover) {
      onHover(block.id);
    }
  };

  const handleMouseLeave = () => {
    if (onHover) {
      onHover(null);
    }
  };

  return (
    <div
      ref={blockRef}
      className={cn(
        "border-l-2 transition-colors",
        isSelected 
          ? "border-yellow-400 bg-yellow-400/10" 
          : "border-transparent hover:border-white/30",
        hasBbox && "cursor-pointer hover:bg-white/5"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="flex items-start gap-2 py-1.5 px-2"
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
      >
        {hasContent ? (
          <button className="p-0.5 hover:bg-white/10 shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-4" />
        )}
        
        <Icon className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", colorClass)} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground capitalize">
              {block.type}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Page {block.pageIndex + 1}
            </span>
            {hasBbox && (
              <span className="text-[10px] text-green-500 font-mono">
                bbox
              </span>
            )}
            {isSelected && (
              <span className="text-[10px] text-yellow-400 font-medium">
                Selected
              </span>
            )}
          </div>
          
          {!isExpanded && hasContent && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {contentPreview}{isLongContent && "..."}
            </p>
          )}
        </div>
      </div>
      
      {isExpanded && hasContent && (
        <div className="ml-8 mr-2 mb-2 p-2 bg-black/30 border border-white/5">
          <pre className="text-xs text-foreground whitespace-pre-wrap break-words font-mono">
            {block.content}
          </pre>
          {hasBbox && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <p className="text-[10px] text-muted-foreground font-mono">
                x: {block.bbox!.x.toFixed(3)}, y: {block.bbox!.y.toFixed(3)}, 
                w: {block.bbox!.w.toFixed(3)}, h: {block.bbox!.h.toFixed(3)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function JsonBlockViewer({ blocks, onBlockHover, selectedBlockId }: JsonBlockViewerProps) {
  const selectedBlockRef = useRef<HTMLDivElement>(null);

  // Scroll to selected block when it changes
  useEffect(() => {
    if (selectedBlockId && selectedBlockRef.current) {
      selectedBlockRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedBlockId]);

  if (blocks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4">
        No structured blocks available
      </div>
    );
  }

  // Group blocks by page
  const blocksByPage = blocks.reduce((acc, block) => {
    const page = block.pageIndex;
    if (!acc[page]) acc[page] = [];
    acc[page].push(block);
    return acc;
  }, {} as Record<number, ParseBlock[]>);

  const pageNumbers = Object.keys(blocksByPage).map(Number).sort((a, b) => a - b);

  return (
    <ScrollArea className="h-[420px]">
      <div className="p-2 space-y-2">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs text-muted-foreground">
            {blocks.length} block{blocks.length !== 1 ? "s" : ""} detected
          </span>
          <span className="text-[10px] text-muted-foreground">
            Hover to highlight
          </span>
        </div>
        
        {pageNumbers.map((pageNum) => (
          <div key={pageNum} className="space-y-0.5">
            {pageNumbers.length > 1 && (
              <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider bg-white/5">
                Page {pageNum + 1}
              </div>
            )}
            {blocksByPage[pageNum].map((block) => {
              const isSelected = block.id === selectedBlockId;
              return (
                <BlockItem
                  key={block.id}
                  block={block}
                  onHover={onBlockHover}
                  isSelected={isSelected}
                  blockRef={isSelected ? selectedBlockRef : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
