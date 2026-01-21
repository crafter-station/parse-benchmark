"use client";

import { cn } from "@/lib/utils";
import { CrafterStationLogo } from "@/components/logos/crafter-station";
import { GithubLogo } from "@/components/logos/github";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";

interface FloatingHeaderProps {
  className?: string;
}

export function FloatingHeader({ className }: FloatingHeaderProps) {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    fetch("https://api.github.com/repos/crafter-station/parse-benchmark")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => data && setStars(data.stargazers_count))
      .catch(() => {});
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-white/10 bg-[#131010]/95 backdrop-blur-xl",
        className
      )}
    >
      <div className="px-6 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a 
            href="https://crafterstation.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:opacity-80 transition-opacity"
          >
            <CrafterStationLogo className="w-8 h-8" />
          </a>
          <div>
            <h1 className="font-semibold text-foreground text-sm">ParseBench</h1>
            <p className="text-xs text-muted-foreground">
              Document Parsing Playground
            </p>
          </div>
        </div>

        {/* GitHub Badge */}
        <a
          href="https://github.com/crafter-station/parse-benchmark"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-white/70 hover:text-white"
        >
          <GithubLogo className="size-4" variant="invertocat" />
          <span className="text-sm hidden sm:inline">Star</span>
          {stars !== null && (
            <span className="flex items-center gap-1 text-sm">
              <Star className="size-3 fill-yellow-400 text-yellow-400" />
              {stars}
            </span>
          )}
        </a>
      </div>
    </header>
  );
}
