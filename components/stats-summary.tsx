"use client";

import { Trophy, Zap, Hash } from "lucide-react";
import type { ParseResult } from "@/lib/types";
import type { ProviderConfig } from "@/lib/providers";

interface StatsSummaryProps {
  results: ParseResult[];
  providers: ProviderConfig[];
}

export function StatsSummary({ results, providers }: StatsSummaryProps) {
  const completedResults = results.filter(
    (r) => r.status === "complete" && r.stats
  );

  if (completedResults.length === 0) {
    return null;
  }

  const fastest = completedResults.reduce((prev, curr) =>
    (curr.stats?.time ?? Infinity) < (prev.stats?.time ?? Infinity)
      ? curr
      : prev
  );

  const cheapest = completedResults.reduce((prev, curr) =>
    (curr.stats?.cost ?? Infinity) < (prev.stats?.cost ?? Infinity)
      ? curr
      : prev
  );

  const mostTokens = completedResults.reduce((prev, curr) =>
    (curr.stats?.tokens ?? 0) > (prev.stats?.tokens ?? 0) ? curr : prev
  );

  const getProviderName = (id: string) =>
    providers.find((p) => p.id === id)?.name ?? id;

  const getProviderColor = (id: string) =>
    providers.find((p) => p.id === id)?.color ?? "#71717a";

  const stats = [
    {
      label: "Fastest",
      value: getProviderName(fastest.providerId),
      detail: `${fastest.stats?.time.toFixed(2)}s`,
      icon: Zap,
      color: getProviderColor(fastest.providerId),
    },
    {
      label: "Cheapest",
      value: getProviderName(cheapest.providerId),
      detail: `$${cheapest.stats?.cost.toFixed(4)}`,
      icon: Trophy,
      color: getProviderColor(cheapest.providerId),
    },
    {
      label: "Most Detailed",
      value: getProviderName(mostTokens.providerId),
      detail: `${mostTokens.stats?.tokens.toLocaleString()} tokens`,
      icon: Hash,
      color: getProviderColor(mostTokens.providerId),
    },
  ];

  return (
    <div className="border border-white/10 bg-black/40 backdrop-blur-md p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
        Benchmark Summary
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 p-3 bg-white/5"
          >
            <div
              className="p-2"
              style={{ backgroundColor: `${stat.color}20` }}
            >
              <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="font-medium text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
