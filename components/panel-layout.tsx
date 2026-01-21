"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface PanelLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PanelLayout({ sidebar, children, className }: PanelLayoutProps) {
  return (
    <div className={cn("max-w-6xl mx-auto px-4 sm:px-6", className)}>
      {/* Guide lines container */}
      <div className="relative">
        {/* Vertical guide lines from header */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Left line */}
          <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-white/20 via-white/5 to-transparent" />
          {/* Divider line between sidebar and content */}
          <div className="absolute left-[25%] top-0 bottom-0 w-px bg-gradient-to-b from-white/15 via-white/5 to-transparent hidden lg:block" />
          {/* Right line */}
          <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-white/20 via-white/5 to-transparent" />
        </div>

        {/* Top connector line */}
        <div className="h-px bg-gradient-to-r from-white/20 via-white/10 to-white/20 mb-6" />

        {/* Content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
          {/* Sidebar Panel */}
          <aside className="lg:col-span-3 relative">
            <div className="lg:pr-6 lg:border-r lg:border-white/[0.06] min-h-[calc(100vh-8rem)]">
              <div className="sticky top-24 space-y-5">
                {sidebar}
              </div>
            </div>
          </aside>

          {/* Main Content Panel */}
          <div className="lg:col-span-9 lg:pl-6">
            <div className="min-h-[calc(100vh-8rem)]">
              {children}
            </div>
          </div>
        </div>

        {/* Bottom fade line */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mt-8" />
      </div>
    </div>
  );
}

interface PanelProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

export function Panel({ children, title, className }: PanelProps) {
  return (
    <div className={cn("relative", className)}>
      {title && (
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-3 bg-white/20" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>
      )}
      {children}
    </div>
  );
}
