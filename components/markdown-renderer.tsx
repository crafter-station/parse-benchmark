"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-lg font-bold text-foreground mb-3 mt-4 first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-semibold text-foreground mb-2 mt-3 first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-foreground mb-2 mt-3 first:mt-0">
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-sm font-medium text-foreground mb-1 mt-2 first:mt-0">
            {children}
          </h4>
        ),
        p: ({ children }) => (
          <p className="text-sm text-muted-foreground mb-2 leading-relaxed break-words">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside text-sm text-muted-foreground mb-2 space-y-1">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside text-sm text-muted-foreground mb-2 space-y-1">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="text-sm text-muted-foreground">{children}</li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic">{children}</em>
        ),
        code: ({ children, className }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="px-1 py-0.5 bg-white/10 text-xs font-mono text-foreground break-all">
                {children}
              </code>
            );
          }
          return (
            <code className="block p-3 bg-black/40 text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words mb-2">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="mb-2 overflow-x-auto max-w-full">{children}</pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-white/20 pl-3 my-2 text-sm text-muted-foreground italic">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto mb-3 max-w-full">
            <table className="min-w-full text-sm border-collapse">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-white/20">{children}</thead>
        ),
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => (
          <tr className="border-b border-white/10">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="px-2 py-1.5 text-left font-semibold text-foreground text-xs">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-2 py-1.5 text-muted-foreground text-xs break-words">
            {children}
          </td>
        ),
        hr: () => <hr className="border-white/10 my-3" />,
        a: ({ children, href }) => (
          <a
            href={href}
            className="text-blue-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        img: ({ src, alt }) => {
          // Skip rendering if src is empty or invalid
          if (!src || (typeof src === "string" && src.trim() === "")) {
            return alt ? (
              <span className="text-xs text-muted-foreground italic">[Image: {alt}]</span>
            ) : null;
          }
          const imgSrc = typeof src === "string" ? src : undefined;
          if (!imgSrc) return null;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt={alt || ""}
              className="max-w-full h-auto my-2 border border-white/10"
              loading="lazy"
            />
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
