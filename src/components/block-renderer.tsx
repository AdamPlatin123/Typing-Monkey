import type { CSSProperties } from "react";
import type { Block } from "@/lib/types/api";

export interface BlockRendererProps {
  block: Block;
  style?: CSSProperties;
  className?: string;
}

export function BlockRenderer({ block, style, className }: BlockRendererProps) {
  const pageOrSlide = (block.attrs?.slide ?? block.attrs?.page) as number | undefined;

  if (block.type === "HEADING") {
    const level = block.level ?? 2;
    if (level <= 1) {
      return (
        <h1 style={style} className={`text-3xl font-semibold tracking-tight mt-6 mb-3 ${className ?? ""}`}>
          {block.text}
        </h1>
      );
    }
    if (level === 2) {
      return (
        <h2 style={style} className={`text-2xl font-semibold tracking-tight mt-5 mb-3 ${className ?? ""}`}>
          {block.text}
        </h2>
      );
    }
    return (
      <h3 style={style} className={`text-xl font-semibold tracking-tight mt-4 mb-2 ${className ?? ""}`}>
        {block.text}
      </h3>
    );
  }

  if (block.type === "LIST_ITEM") {
    return (
      <div style={style} className={`flex gap-2 my-1 ${className ?? ""}`}>
        <span aria-hidden>*</span>
        <p className="whitespace-pre-wrap">{block.text}</p>
      </div>
    );
  }

  if (block.type === "CODE") {
    return (
      <pre
        style={style}
        className={`my-3 rounded-lg bg-slate-950 border border-slate-700 p-3 overflow-x-auto text-sm ${className ?? ""}`}
      >
        <code>{block.text}</code>
      </pre>
    );
  }

  if (block.type === "QUOTE") {
    return (
      <blockquote
        style={style}
        className={`my-3 border-l-4 border-cyan-500/70 bg-cyan-500/10 px-3 py-2 italic whitespace-pre-wrap ${className ?? ""}`}
      >
        {block.text}
      </blockquote>
    );
  }

  if (block.type === "HR") {
    return <hr className={`my-6 border-slate-700 ${className ?? ""}`} />;
  }

  if (block.type === "IMAGE") {
    const fallback = typeof block.attrs?.sourceUrl === "string" ? (block.attrs.sourceUrl as string) : null;
    const src = block.image?.url ?? fallback;

    if (!src) {
      return (
        <div
          style={style}
          className={`my-4 rounded-md border border-dashed border-slate-600 p-3 text-sm text-slate-400 ${className ?? ""}`}
        >
          Image unavailable
        </div>
      );
    }

    return (
      <figure style={style} className={`my-4 ${className ?? ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={block.text ?? "image"}
          className="max-h-[520px] max-w-full rounded-md border border-slate-700 object-contain"
        />
        <figcaption className="mt-2 text-xs text-slate-400">
          {block.text || "Image"}
          {typeof pageOrSlide === "number" ? ` p.${pageOrSlide}` : ""}
        </figcaption>
      </figure>
    );
  }

  // PARAGRAPH (default)
  return (
    <p style={style} className={`my-2 whitespace-pre-wrap leading-7 ${className ?? ""}`}>
      {block.text}
      {typeof pageOrSlide === "number" ? <span className="ml-2 text-xs text-slate-500">[{pageOrSlide}]</span> : null}
    </p>
  );
}
