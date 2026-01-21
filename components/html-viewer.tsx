"use client";

import { ScrollArea } from "@/components/ui/scroll-area";

interface HtmlViewerProps {
  html: string;
}

export function HtmlViewer({ html }: HtmlViewerProps) {
  if (!html || html.trim().length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4">
        No HTML content available
      </div>
    );
  }

  return (
    <ScrollArea className="h-[420px]">
      <div className="p-4">
        <div 
          className="prose prose-sm prose-invert max-w-none
            prose-table:border-collapse prose-table:w-full
            prose-th:border prose-th:border-white/20 prose-th:p-2 prose-th:bg-white/5 prose-th:text-left
            prose-td:border prose-td:border-white/20 prose-td:p-2
            prose-tr:border-b prose-tr:border-white/10
            prose-headings:text-foreground prose-p:text-foreground
            prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
            prose-code:text-pink-400 prose-code:bg-white/10 prose-code:px-1 prose-code:rounded
            prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </ScrollArea>
  );
}
