"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import type { ParseResult } from "@/lib/types";
import type { ProviderConfig } from "@/lib/providers";

interface DetailViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ProviderConfig;
  result: ParseResult;
  documentSrc: string | null;
}

export function DetailViewerModal({
  open,
  onOpenChange,
  provider,
  result,
  documentSrc,
}: DetailViewerModalProps) {
  const content = result.status === "complete" ? result.content : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-6xl w-[calc(100vw-3rem)] h-[80vh] p-0 bg-[#0a0a0a] border-white/10">
        <DialogHeader className="px-4 py-3 border-b border-white/10">
          <DialogTitle className="flex items-center gap-3 text-white">
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
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Document Preview */}
          <ScrollArea className="w-1/2 bg-black/40 border-r border-white/10">
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
          <ScrollArea className="w-1/2 bg-black/20">
            <div className="p-4">
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
                Parsed Content
              </div>
              {content ? (
                <div className="prose prose-invert prose-sm max-w-none">
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
