"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CSSProperties,
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";

import { fetchJson } from "@/lib/api-client";
import { calculateProgressPercent } from "@/lib/progress";
import { useReaderSettingsStore } from "@/lib/reader-settings-store";
import { getTheme, THEMES } from "@/lib/themes";

type BlockType = "HEADING" | "PARAGRAPH" | "LIST_ITEM" | "CODE" | "QUOTE" | "IMAGE" | "HR";

type Block = {
  id: string;
  index: number;
  type: BlockType;
  text: string | null;
  level: number | null;
  attrs: Record<string, unknown> | null;
  image: {
    id: string;
    url: string;
    mimeType: string;
    width: number | null;
    height: number | null;
  } | null;
};

type OutlineItem = {
  id: string;
  index: number;
  text: string | null;
  level: number | null;
};

type SearchResult = {
  id: string;
  index: number;
  type: BlockType;
  snippet: string;
};

type DocumentMeta = {
  id: string;
  title: string;
  sourceType: "PDF" | "DOCX" | "MD" | "TXT";
  status: "QUEUED" | "PROCESSING" | "READY" | "FAILED";
  parserVersion: string;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
};

type BlocksResponse = {
  data: Block[];
  nextCursor: number | null;
};

type ProgressPayload = {
  data: {
    lastBlockIndex: number;
    lastOffset: number;
    percent: number;
    updatedAt: string | null;
  };
};

function blockStyle(fontSize: number, lineHeight: number): CSSProperties {
  return {
    fontSize,
    lineHeight,
  };
}

function renderBlock(block: Block, style: CSSProperties) {
  switch (block.type) {
    case "HEADING": {
      const level = Math.min(Math.max(block.level ?? 2, 1), 3);
      if (level === 1) {
        return (
          <h1 style={style} className="text-3xl font-semibold tracking-tight">
            {block.text}
          </h1>
        );
      }

      if (level === 2) {
        return (
          <h2 style={style} className="text-2xl font-semibold tracking-tight">
            {block.text}
          </h2>
        );
      }

      return (
        <h3 style={style} className="text-xl font-semibold tracking-tight">
          {block.text}
        </h3>
      );
    }
    case "PARAGRAPH":
      return (
        <p style={style} className="whitespace-pre-wrap leading-[inherit]">
          {block.text}
        </p>
      );
    case "LIST_ITEM":
      return (
        <div style={style} className="flex gap-2">
          <span aria-hidden>•</span>
          <p className="whitespace-pre-wrap">{block.text}</p>
        </div>
      );
    case "CODE":
      return (
        <pre
          style={style}
          className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
        >
          <code>{block.text}</code>
        </pre>
      );
    case "QUOTE":
      return (
        <blockquote
          style={style}
          className="border-l-4 border-cyan-400/70 bg-cyan-500/10 px-4 py-2 italic whitespace-pre-wrap"
        >
          {block.text}
        </blockquote>
      );
    case "HR":
      return <hr className="border-slate-700" />;
    case "IMAGE": {
      const directImageUrl =
        typeof block.attrs?.sourceUrl === "string" ? (block.attrs?.sourceUrl as string) : null;
      const src = block.image?.url ?? directImageUrl;
      if (!src) {
        return (
          <div className="rounded-lg border border-dashed border-slate-600 px-4 py-3 text-sm text-slate-400">
            Image placeholder (source unavailable)
          </div>
        );
      }

      return (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={block.text ?? "Document image"}
            className="max-h-[520px] w-auto max-w-full rounded-lg border border-slate-700 object-contain"
          />
          {block.text ? <figcaption className="mt-2 text-xs text-slate-400">{block.text}</figcaption> : null}
        </figure>
      );
    }
    default:
      return null;
  }
}

async function loadBlockChunk(documentId: string, cursor: number | null) {
  const params = new URLSearchParams();
  if (cursor !== null) {
    params.set("cursor", String(cursor));
  }
  params.set("limit", "120");

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return fetchJson<BlocksResponse>(`/api/documents/${documentId}/blocks${suffix}`);
}

async function ensureUntilIndex(
  documentId: string,
  targetIndex: number,
  blocksRef: MutableRefObject<Block[]>,
  nextCursorRef: MutableRefObject<number | null>,
  updateState: (nextBlocks: Block[], nextCursor: number | null) => void,
) {
  while (nextCursorRef.current !== null) {
    const maxLoaded = blocksRef.current.length === 0 ? -1 : blocksRef.current[blocksRef.current.length - 1].index;
    if (maxLoaded >= targetIndex) {
      break;
    }

    const chunk = await loadBlockChunk(documentId, nextCursorRef.current);
    const merged = [...blocksRef.current, ...chunk.data];
    blocksRef.current = merged;
    nextCursorRef.current = chunk.nextCursor;
    updateState(merged, chunk.nextCursor);
  }
}

export function DocumentReader({
  documentId,
}: {
  documentId: string;
}) {
  const router = useRouter();

  const parentRef = useRef<HTMLDivElement | null>(null);
  const blocksRef = useRef<Block[]>([]);
  const nextCursorRef = useRef<number | null>(null);
  const restoredRef = useRef(false);
  const lastProgressSentRef = useRef<number>(-1);

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [searchText, setSearchText] = useState("");

  const theme = getTheme(useReaderSettingsStore((state) => state.theme));
  const fontSize = useReaderSettingsStore((state) => state.fontSize);
  const lineHeight = useReaderSettingsStore((state) => state.lineHeight);
  const layoutMode = useReaderSettingsStore((state) => state.layoutMode);
  const showOutline = useReaderSettingsStore((state) => state.showOutline);
  const setTheme = useReaderSettingsStore((state) => state.setTheme);
  const setFontSize = useReaderSettingsStore((state) => state.setFontSize);
  const setLineHeight = useReaderSettingsStore((state) => state.setLineHeight);
  const setLayoutMode = useReaderSettingsStore((state) => state.setLayoutMode);
  const setShowOutline = useReaderSettingsStore((state) => state.setShowOutline);

  const documentQuery = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => fetchJson<{ data: DocumentMeta }>(`/api/documents/${documentId}`),
  });

  const outlineQuery = useQuery({
    queryKey: ["outline", documentId],
    queryFn: () => fetchJson<{ data: OutlineItem[] }>(`/api/documents/${documentId}/outline`),
  });

  const progressQuery = useQuery({
    queryKey: ["progress", documentId],
    queryFn: () => fetchJson<ProgressPayload>(`/api/documents/${documentId}/progress`),
  });

  const searchMutation = useMutation({
    mutationFn: async (query: string) =>
      fetchJson<{ data: SearchResult[] }>(`/api/documents/${documentId}/search?q=${encodeURIComponent(query)}`),
  });

  const progressMutation = useMutation({
    mutationFn: async (lastBlockIndex: number) => {
      const percent = calculateProgressPercent(lastBlockIndex, Math.max(blocksRef.current.length, 1));
      await fetchJson(`/api/documents/${documentId}/progress`, {
        method: "PATCH",
        body: JSON.stringify({
          lastBlockIndex,
          lastOffset: 0,
          percent,
        }),
      });
    },
  });

  const virtualizer = useVirtualizer({
    count: blocks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => fontSize * lineHeight * 2.6,
    overscan: 8,
  });

  const virtualItems = virtualizer.getVirtualItems();

  const updateBlocksState = useCallback((nextBlocksValue: Block[], nextCursorValue: number | null) => {
    setBlocks(nextBlocksValue);
    setNextCursor(nextCursorValue);
  }, []);

  const loadMore = useCallback(
    async (cursorValue: number | null = null) => {
      if (loadingBlocks) {
        return;
      }
      setLoadingBlocks(true);
      try {
        const response = await loadBlockChunk(documentId, cursorValue);
        const merged = cursorValue === null ? response.data : [...blocksRef.current, ...response.data];
        blocksRef.current = merged;
        nextCursorRef.current = response.nextCursor;
        updateBlocksState(merged, response.nextCursor);
      } finally {
        setLoadingBlocks(false);
      }
    },
    [documentId, loadingBlocks, updateBlocksState],
  );

  useEffect(() => {
    void loadMore(null);
  }, [loadMore]);

  useEffect(() => {
    if (nextCursor === null || loadingBlocks) {
      return;
    }

    const el = parentRef.current;
    if (!el) {
      return;
    }

    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distance < 600 && !loadingBlocks && nextCursorRef.current !== null) {
        void loadMore(nextCursorRef.current);
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [loadMore, loadingBlocks, nextCursor]);

  useEffect(() => {
    if (restoredRef.current) {
      return;
    }

    const target = progressQuery.data?.data.lastBlockIndex;
    if (target === undefined || blocks.length === 0) {
      return;
    }

    restoredRef.current = true;
    const indexInLoaded = blocks.findIndex((block) => block.index >= target);
    if (indexInLoaded >= 0) {
      virtualizer.scrollToIndex(indexInLoaded, { align: "start" });
    }
  }, [blocks, progressQuery.data, virtualizer]);

  useEffect(() => {
    if (blocks.length === 0) {
      return;
    }

    const timer = setInterval(() => {
      const visible = virtualizer.getVirtualItems();
      const last = visible[visible.length - 1];
      if (!last) {
        return;
      }

      const block = blocks[last.index];
      if (!block) {
        return;
      }

      if (block.index === lastProgressSentRef.current) {
        return;
      }

      lastProgressSentRef.current = block.index;
      progressMutation.mutate(block.index);
    }, 3500);

    return () => clearInterval(timer);
  }, [blocks, progressMutation, virtualizer]);

  const searchResults = searchMutation.data?.data ?? [];

  const contentStyle = blockStyle(fontSize, lineHeight);

  const openSearchHit = useCallback(
    async (index: number) => {
      await ensureUntilIndex(documentId, index, blocksRef, nextCursorRef, updateBlocksState);

      const targetPosition = blocksRef.current.findIndex((block) => block.index >= index);
      if (targetPosition >= 0) {
        virtualizer.scrollToIndex(targetPosition, { align: "start" });
      }
    },
    [documentId, updateBlocksState, virtualizer],
  );

  const title = documentQuery.data?.data.title ?? "Loading...";
  const docStatus = documentQuery.data?.data.status;

  return (
    <main className={`min-h-screen ${theme.appClass} ${theme.textClass} px-4 py-6 md:px-8`}>
      <div className="mx-auto flex max-w-[1680px] gap-4">
        <aside className={`hidden w-72 shrink-0 rounded-2xl border p-4 lg:block ${theme.panelClass}`}>
          <Link href="/documents" className={`text-sm ${theme.accentClass} hover:underline`}>
            ← Back to documents
          </Link>
          <h2 className="mt-4 text-lg font-semibold">Outline</h2>

          <label className="mt-3 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={showOutline}
              onChange={(event) => setShowOutline(event.target.checked)}
            />
            Show outline
          </label>

          {showOutline ? (
            <div className="mt-4 max-h-[40vh] overflow-y-auto text-sm">
              {(outlineQuery.data?.data ?? []).map((item) => (
                <button
                  key={item.id}
                  className="block w-full truncate py-1 text-left hover:underline"
                  style={{ paddingLeft: `${(item.level ?? 1) * 8}px` }}
                  onClick={() => {
                    void openSearchHit(item.index);
                  }}
                >
                  {item.text}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-6 space-y-4 border-t border-slate-700/50 pt-4">
            <h3 className="text-sm font-semibold">Reader settings</h3>

            <label className="block text-xs">
              Theme
              <select
                className="mt-1 w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1"
                value={theme.key}
                onChange={(event) =>
                  setTheme(event.target.value as "paper" | "midnight" | "forest")
                }
              >
                {THEMES.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs">
              Font size: {fontSize}px
              <input
                className="mt-1 w-full"
                type="range"
                min={14}
                max={28}
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
              />
            </label>

            <label className="block text-xs">
              Line height: {lineHeight.toFixed(1)}
              <input
                className="mt-1 w-full"
                type="range"
                min={1.2}
                max={2.4}
                step={0.1}
                value={lineHeight}
                onChange={(event) => setLineHeight(Number(event.target.value))}
              />
            </label>

            <label className="block text-xs">
              Layout
              <select
                className="mt-1 w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1"
                value={layoutMode}
                onChange={(event) =>
                  setLayoutMode(event.target.value as "infinite" | "paginated")
                }
              >
                <option value="infinite">Infinite scroll</option>
                <option value="paginated">Page-like canvas</option>
              </select>
            </label>
          </div>
        </aside>

        <section className="flex min-h-[80vh] flex-1 flex-col gap-4">
          <header className={`rounded-2xl border p-4 ${theme.panelClass}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={`text-xs uppercase tracking-wide ${theme.mutedClass}`}>{docStatus}</p>
                <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              </div>
              <button
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm hover:border-slate-400"
                onClick={() => {
                  router.push("/documents");
                }}
              >
                Close
              </button>
            </div>

            <form
              className="mt-4 flex flex-wrap gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!searchText.trim()) {
                  return;
                }
                searchMutation.mutate(searchText.trim());
              }}
            >
              <input
                className="min-w-[220px] flex-1 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Search in document..."
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
              <button className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950" type="submit">
                Search
              </button>
            </form>

            {searchResults.length > 0 ? (
              <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950/60 p-2 text-sm">
                {searchResults.map((hit) => (
                  <button
                    key={hit.id}
                    className="block w-full rounded px-2 py-1 text-left hover:bg-slate-800"
                    onClick={() => {
                      void openSearchHit(hit.index);
                    }}
                  >
                    <span className="mr-2 text-xs text-slate-400">#{hit.index}</span>
                    {hit.snippet}
                  </button>
                ))}
              </div>
            ) : null}
          </header>

          <div
            ref={parentRef}
            className={`relative flex-1 overflow-auto rounded-2xl border ${theme.panelClass} p-4 md:p-8`}
          >
            <div
              className={layoutMode === "paginated" ? "mx-auto max-w-[900px]" : "mx-auto max-w-4xl"}
              style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}
            >
              {virtualItems.map((item) => {
                const block = blocks[item.index];
                if (!block) {
                  return null;
                }

                return (
                  <article
                    key={block.id}
                    data-block-index={block.index}
                    className="absolute left-0 top-0 w-full px-2 py-3"
                    style={{
                      transform: `translateY(${item.start}px)`,
                    }}
                  >
                    {renderBlock(block, contentStyle)}
                  </article>
                );
              })}
            </div>

            {loadingBlocks ? <p className={`mt-3 text-sm ${theme.mutedClass}`}>Loading blocks...</p> : null}
            {!loadingBlocks && nextCursor !== null ? (
              <div className="mt-4 flex justify-center">
                <button
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm hover:border-slate-400"
                  onClick={() => {
                    void loadMore(nextCursor);
                  }}
                >
                  Load more
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
