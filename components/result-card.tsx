"use client";

import { Clock, DollarSign, Hash, Loader2, AlertCircle, FileText, Maximize2, Eye, FileX } from "lucide-react";
import type { ProviderConfig } from "@/lib/providers";
import type { ParseResult } from "@/lib/types";
import { MarkdownRenderer } from "./markdown-renderer";
import { HtmlViewer } from "./html-viewer";
import { JsonBlockViewer } from "./json-block-viewer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type { ParseResult } from "@/lib/types";

interface ResultCardProps {
  provider: ProviderConfig;
  result: ParseResult;
  onBlockHover?: (blockId: string | null) => void;
  selectedBlockId?: string | null;
  onViewBlocks?: () => void;
  onViewDetail?: () => void;
}

export function ResultCard({ provider, result, onBlockHover, selectedBlockId, onViewBlocks, onViewDetail }: ResultCardProps) {
  const isPageBasedProvider = provider.type === "llamaparse" || provider.type === "mistral-ocr" || provider.type === "datalab-marker";
  
  const hasHtml = result.outputs?.html && result.outputs.html.length > 0;
  const hasJson = result.outputs?.json?.blocks && result.outputs.json.blocks.length > 0;
  const hasRichOutput = hasHtml || hasJson;
  
  // Check if we have blocks with bounding boxes for the viewer
  const blocksWithBbox = result.outputs?.json?.blocks?.filter(b => b.bbox) || [];
  const hasBlocksWithBbox = blocksWithBbox.length > 0;
  
  return (
    <div className="border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden flex flex-col h-full">
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5"
            style={{ backgroundColor: provider.color }}
          />
          <h3 className="font-medium text-foreground text-sm">{provider.name}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {result.status === "complete" && hasBlocksWithBbox && onViewBlocks && (
            <button
              onClick={onViewBlocks}
              className="flex items-center gap-1 px-2 py-1 text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              title="View blocks with bounding boxes"
            >
              <Maximize2 className="w-3 h-3" />
              Blocks
            </button>
          )}
          {result.status === "complete" && onViewDetail && (
            <button
              onClick={onViewDetail}
              className="flex items-center gap-1 px-2 py-1 text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              title="View side-by-side detail"
            >
              <Eye className="w-3 h-3" />
              Detail
            </button>
          )}
          {result.status === "parsing" && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
          {result.status === "error" && (
            <AlertCircle className="w-4 h-4 text-destructive" />
          )}
          {result.status === "skipped" && (
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Skipped</span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {result.status === "idle" && (
          <div className="h-full p-4 flex items-center justify-center text-muted-foreground text-sm">
            Waiting to start...
          </div>
        )}

        {result.status === "parsing" && (
          <div className="p-4 space-y-3">
            <div className="h-3 bg-secondary animate-pulse" />
            <div className="h-3 bg-secondary animate-pulse w-4/5" />
            <div className="h-3 bg-secondary animate-pulse w-3/5" />
            <div className="h-3 bg-secondary animate-pulse w-4/5" />
            <div className="h-3 bg-secondary animate-pulse w-2/5" />
          </div>
        )}

        {result.status === "complete" && result.content && (
          hasRichOutput ? (
            <Tabs defaultValue="markdown" className="h-full flex flex-col">
              <TabsList className="w-full justify-start border-b border-white/10 bg-transparent p-0 h-auto">
                <TabsTrigger 
                  value="markdown" 
                  className="data-[state=active]:bg-white/10 data-[state=active]:text-foreground text-muted-foreground text-xs px-3 py-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-white/50"
                >
                  Markdown
                </TabsTrigger>
                {hasHtml && (
                  <TabsTrigger 
                    value="html"
                    className="data-[state=active]:bg-white/10 data-[state=active]:text-foreground text-muted-foreground text-xs px-3 py-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-white/50"
                  >
                    HTML
                  </TabsTrigger>
                )}
                {hasJson && (
                  <TabsTrigger 
                    value="json"
                    className="data-[state=active]:bg-white/10 data-[state=active]:text-foreground text-muted-foreground text-xs px-3 py-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-white/50"
                  >
                    Blocks ({result.outputs!.json!.blocks.length})
                  </TabsTrigger>
                )}
              </TabsList>
              
              <TabsContent value="markdown" className="flex-1 m-0 data-[state=inactive]:hidden overflow-hidden">
                <ScrollArea className="h-[420px]">
                  <div className="p-4 prose-sm overflow-hidden">
                    <MarkdownRenderer content={result.outputs?.markdown || result.content} />
                  </div>
                </ScrollArea>
              </TabsContent>
              
              {hasHtml && (
                <TabsContent value="html" className="flex-1 m-0 data-[state=inactive]:hidden">
                  <HtmlViewer html={result.outputs!.html!} />
                </TabsContent>
              )}
              
              {hasJson && (
                <TabsContent value="json" className="flex-1 m-0 data-[state=inactive]:hidden">
                  <JsonBlockViewer 
                    blocks={result.outputs!.json!.blocks} 
                    onBlockHover={onBlockHover}
                    selectedBlockId={selectedBlockId}
                  />
                </TabsContent>
              )}
            </Tabs>
          ) : (
            <ScrollArea className="h-[420px]">
              <div className="p-4 prose-sm overflow-hidden">
                <MarkdownRenderer content={result.content} />
              </div>
            </ScrollArea>
          )
        )}

        {result.status === "error" && (
          <div className="h-full p-4 flex items-center justify-center text-destructive text-sm text-center">
            {result.error || "An error occurred"}
          </div>
        )}

        {result.status === "skipped" && (
          <div className="h-full p-4 flex flex-col items-center justify-center text-center">
            <FileX className="w-8 h-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              {result.skipReason || "Skipped"}
            </p>
          </div>
        )}
      </div>

      {result.status === "complete" && result.stats && (
        <div className="p-4 border-t border-white/10 bg-white/5">
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Clock className="w-3 h-3" />
                <span className="text-[10px] uppercase tracking-wider">Time</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {result.stats.time.toFixed(2)}s
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <DollarSign className="w-3 h-3" />
                <span className="text-[10px] uppercase tracking-wider">Cost</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                ${result.stats.cost.toFixed(4)}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                {isPageBasedProvider ? <FileText className="w-3 h-3" /> : <Hash className="w-3 h-3" />}
                <span className="text-[10px] uppercase tracking-wider">
                  {isPageBasedProvider ? "Pages" : "Tokens"}
                </span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {isPageBasedProvider 
                  ? (result.stats.pages ?? 1)
                  : result.stats.tokens.toLocaleString()
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {result.status === "error" && result.stats && (
        <div className="p-4 border-t border-white/10 bg-destructive/5">
          <div className="flex items-center justify-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span className="text-xs">Failed after {result.stats.time.toFixed(2)}s</span>
          </div>
        </div>
      )}
    </div>
  );
}
