"use client";

import { cn } from "@/lib/utils";
import { Check, FileText, Sparkles } from "lucide-react";
import { PROVIDERS, type ProviderConfig } from "@/lib/providers";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Re-export for convenience
export type { ProviderConfig };
export { PROVIDERS as providers };

interface ProviderSelectorProps {
  selected: string[];
  onToggle: (id: string) => void;
  compact?: boolean;
}

// Category icons and descriptions
const categoryInfo = {
  parser: {
    icon: FileText,
    label: "Document Parser",
    description: "Specialized OCR/parsing service with layout extraction",
  },
  "vision-llm": {
    icon: Sparkles,
    label: "Vision LLM",
    description: "Large language model with vision capabilities",
  },
};

// Compact provider chip with tooltip
function ProviderChip({
  provider,
  isSelected,
  onToggle,
}: {
  provider: ProviderConfig;
  isSelected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => onToggle(provider.id)}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 text-xs font-medium transition-all duration-200",
            isSelected
              ? "bg-white/15 text-white"
              : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
          )}
          style={{
            borderLeft: `3px solid ${isSelected ? provider.color : 'transparent'}`,
          }}
        >
          <div
            className={cn(
              "w-3 h-3 flex items-center justify-center transition-all shrink-0",
              isSelected ? "" : "border border-white/30"
            )}
            style={{
              backgroundColor: isSelected ? provider.color : "transparent",
            }}
          >
            {isSelected && <Check className="w-2 h-2 text-background" />}
          </div>
          <span className="truncate">{provider.name}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium text-xs">{provider.name}</p>
          <p className="text-[10px] text-muted-foreground">{provider.model}</p>
          <p className="text-[10px] text-muted-foreground">{provider.description}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function ProviderSelector({ selected, onToggle, compact = false }: ProviderSelectorProps) {
  // Group providers by category for compact view
  const parsers = PROVIDERS.filter(p => p.category === "parser");
  const visionLLMs = PROVIDERS.filter(p => p.category === "vision-llm");

  // Group providers by company for expanded view
  const grouped = PROVIDERS.reduce((acc, provider) => {
    if (!acc[provider.description]) {
      acc[provider.description] = [];
    }
    acc[provider.description].push(provider);
    return acc;
  }, {} as Record<string, ProviderConfig[]>);

  if (compact) {
    return (
      <TooltipProvider delayDuration={200}>
        <div className="space-y-3">
          {/* Document Parsers */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <FileText className="w-3 h-3 text-white/40" />
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-medium">
                Document Parsers
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[10px] text-white/30 cursor-help">(?)</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">Specialized services for document parsing with layout extraction, tables, and bounding boxes</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {parsers.map((provider) => (
                <ProviderChip
                  key={provider.id}
                  provider={provider}
                  isSelected={selected.includes(provider.id)}
                  onToggle={onToggle}
                />
              ))}
            </div>
          </div>

          {/* Vision LLMs */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3 h-3 text-white/40" />
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-medium">
                Vision LLMs
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[10px] text-white/30 cursor-help">(?)</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">Large language models with vision capabilities via AI Gateway</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {visionLLMs.map((provider) => (
                <ProviderChip
                  key={provider.id}
                  provider={provider}
                  isSelected={selected.includes(provider.id)}
                  onToggle={onToggle}
                />
              ))}
            </div>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([company, providers]) => (
        <div key={company}>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 px-1">
            {company}
          </p>
          <div className="space-y-0.5">
            {providers.map((provider) => {
              const isSelected = selected.includes(provider.id);
              return (
                <button
                  key={provider.id}
                  onClick={() => onToggle(provider.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 border transition-all duration-200 text-left backdrop-blur-sm",
                    isSelected
                      ? "border-white/20 bg-white/10"
                      : "border-transparent hover:bg-white/5"
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 border-2 flex items-center justify-center transition-all shrink-0",
                      isSelected ? "border-transparent" : "border-border"
                    )}
                    style={{
                      backgroundColor: isSelected ? provider.color : "transparent",
                    }}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 text-background" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 shrink-0"
                        style={{ backgroundColor: provider.color }}
                      />
                      <span className="text-sm font-medium text-foreground truncate">
                        {provider.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate pl-3">
                      {provider.model}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
