"use client";

import { useEffect, useMemo, useState, type InputHTMLAttributes } from "react";
import JSZip from "jszip";
import {
  AlertCircle,
  Archive,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  Settings,
  Upload,
  X,
} from "lucide-react";

import type {
  ApiImportMode,
  Block,
  BlocksResponse,
  DocumentItem,
  ImportBatch,
} from "@/lib/types/api";
import { fetchJson } from "@/lib/api-client";
import { BlockRenderer } from "@/components/block-renderer";

const folderPickerProps = {
  webkitdirectory: "",
  directory: "",
} as unknown as InputHTMLAttributes<HTMLInputElement>;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function HomePage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [query, setQuery] = useState("");

  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setApiImportMode] = useState<ApiImportMode>("single");
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);

  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((doc) => doc.title.toLowerCase().includes(q));
  }, [documents, query]);

  const currentDoc = documents.find((doc) => doc.id === selectedDocId) ?? null;

  async function loadDocuments(selectNewest = false) {
    setLoadingDocuments(true);
    try {
      const response = await fetchJson<{ data: DocumentItem[] }>("/api/documents?take=100");
      setDocuments(response.data);

      if (response.data.length > 0) {
        if (!selectedDocId || selectNewest) {
          setSelectedDocId(response.data[0].id);
        }
      } else {
        setSelectedDocId(null);
      }
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to load documents");
    } finally {
      setLoadingDocuments(false);
    }
  }

  async function loadBlocks(documentId: string) {
    setLoadingBlocks(true);
    try {
      const merged: Block[] = [];
      let cursor: number | null = null;
      let safety = 0;

      while (safety < 1000) {
        const suffix: string = cursor === null ? "?limit=300" : `?cursor=${cursor}&limit=300`;
        const chunk: BlocksResponse = await fetchJson<BlocksResponse>(`/api/documents/${documentId}/blocks${suffix}`);
        merged.push(...chunk.data);

        if (chunk.nextCursor === null) {
          break;
        }

        cursor = chunk.nextCursor;
        safety += 1;
      }

      setBlocks(merged);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to load blocks");
      setBlocks([]);
    } finally {
      setLoadingBlocks(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedDocId) {
      setBlocks([]);
      return;
    }

    void loadBlocks(selectedDocId);
  }, [selectedDocId]);

  async function uploadBlobAndGetObjectKey(params: {
    blob: Blob;
    fileName: string;
    contentType: string;
    importKind: ApiImportMode;
  }) {
    const targetUrl = params.importKind === "single" ? "/api/documents/upload-url" : "/api/imports/upload-url";
    const payload =
      params.importKind === "single"
        ? {
            fileName: params.fileName,
            contentType: params.contentType,
            size: params.blob.size,
          }
        : {
            fileName: params.fileName,
            contentType: params.contentType,
            size: params.blob.size,
            importKind: params.importKind,
          };

    const uploadTarget = await fetchJson<{ uploadUrl: string; objectKey: string }>(targetUrl, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const uploadResponse = await fetch(uploadTarget.uploadUrl, {
      method: "PUT",
      body: params.blob,
      headers: {
        "Content-Type": params.contentType || "application/octet-stream",
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    return uploadTarget.objectKey;
  }

  async function pollSingleJob(jobId: string) {
    for (let i = 0; i < 240; i += 1) {
      const result = await fetchJson<{ data: { status: string; errorCode: string | null; errorText: string | null } }>(
        `/api/jobs/${jobId}`,
      );

      const status = result.data.status;
      setStatusText(`Job status: ${status}`);

      if (status === "COMPLETED") return;
      if (status === "FAILED") {
        throw new Error(result.data.errorText || result.data.errorCode || "Ingest failed");
      }

      await sleep(1500);
    }

    throw new Error("Job timeout");
  }

  async function pollBatch(batchId: string) {
    for (let i = 0; i < 300; i += 1) {
      const result = await fetchJson<{ data: ImportBatch }>(`/api/imports/${batchId}`);
      const b = result.data;
      setStatusText(`Batch ${b.status} | total ${b.totalCount} success ${b.successCount} failed ${b.failedCount} skipped ${b.skippedCount}`);

      if (b.status === "COMPLETED" || b.status === "PARTIAL_SUCCESS") return;
      if (b.status === "FAILED") {
        throw new Error("Batch ingest failed");
      }

      await sleep(1500);
    }

    throw new Error("Batch timeout");
  }

  async function handleSingleImport() {
    if (!singleFile) return;

    setBusy(true);
    setErrorText("");
    setStatusText("Uploading single file...");

    try {
      const objectKey = await uploadBlobAndGetObjectKey({
        blob: singleFile,
        fileName: singleFile.name,
        contentType: singleFile.type || "application/octet-stream",
        importKind: "single",
      });

      const ingest = await fetchJson<{ documentId: string; jobId: string }>("/api/documents/ingest", {
        method: "POST",
        body: JSON.stringify({
          objectKey,
          fileName: singleFile.name,
        }),
      });

      await pollSingleJob(ingest.jobId);
      await loadDocuments(true);
      setStatusText("Single import completed");
      setImportOpen(false);
      setSingleFile(null);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Single import failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchiveImport() {
    if (!archiveFile) return;

    setBusy(true);
    setErrorText("");
    setStatusText("Uploading archive...");

    try {
      const objectKey = await uploadBlobAndGetObjectKey({
        blob: archiveFile,
        fileName: archiveFile.name,
        contentType: archiveFile.type || "application/octet-stream",
        importKind: "archive",
      });

      const ingest = await fetchJson<{ batchId: string }>("/api/imports/ingest", {
        method: "POST",
        body: JSON.stringify({
          objectKey,
          fileName: archiveFile.name,
          importKind: "archive",
        }),
      });

      await pollBatch(ingest.batchId);
      await loadDocuments(true);
      setStatusText("Archive import completed");
      setImportOpen(false);
      setArchiveFile(null);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Archive import failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleFolderImport() {
    if (folderFiles.length === 0) return;

    setBusy(true);
    setErrorText("");
    setStatusText("Packing folder to zip...");

    try {
      const zip = new JSZip();
      let rootName = "folder-import";

      for (const file of folderFiles) {
        const relativePath = (((file as unknown as { webkitRelativePath?: string }).webkitRelativePath) || file.name).replace(/\\/g, "/");
        if (relativePath.includes("/")) {
          rootName = relativePath.split("/")[0] || rootName;
        }
        zip.file(relativePath, file);
      }

      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const archiveName = `${rootName || "folder-import"}.zip`;

      const objectKey = await uploadBlobAndGetObjectKey({
        blob,
        fileName: archiveName,
        contentType: "application/zip",
        importKind: "folder",
      });

      const ingest = await fetchJson<{ batchId: string }>("/api/imports/ingest", {
        method: "POST",
        body: JSON.stringify({
          objectKey,
          fileName: archiveName,
          importKind: "folder",
          rootName,
        }),
      });

      await pollBatch(ingest.batchId);
      await loadDocuments(true);
      setStatusText("Folder import completed");
      setImportOpen(false);
      setFolderFiles([]);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Folder import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-slate-950 text-slate-100 flex flex-col">
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 flex items-center justify-between">
        <div className="flex items-center gap-3 font-semibold tracking-wide">
          <FileText className="w-5 h-5 text-cyan-400" />
          TypingMonkey Workspace
        </div>

        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-700 hover:border-slate-500 text-sm"
            onClick={() => void loadDocuments()}
            disabled={loadingDocuments}
          >
            {loadingDocuments ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-cyan-500 text-slate-900 text-sm font-medium hover:bg-cyan-400"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="w-4 h-4" /> Import
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 border-r border-slate-800 bg-slate-900/60 p-3 flex flex-col gap-3">
          <div className="relative">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search document..."
              className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-cyan-500"
            />
          </div>

          <div className="text-xs text-slate-400">Support: MD TXT PDF DOCX PPTX PPT ZIP 7Z RAR</div>

          <div className="flex-1 overflow-y-auto space-y-1">
            {filteredDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className={`w-full text-left rounded-md px-3 py-2 border text-sm transition-colors ${
                  selectedDocId === doc.id
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-transparent hover:border-slate-700 hover:bg-slate-800/60"
                }`}
              >
                <div className="truncate font-medium">{doc.title}</div>
                <div className="mt-1 text-xs text-slate-400 flex gap-2">
                  <span>{doc.sourceType}</span>
                  <span>{doc.status}</span>
                  <span>{doc.wordCount} words</span>
                </div>
              </button>
            ))}
            {!loadingDocuments && filteredDocs.length === 0 ? <div className="text-sm text-slate-500 p-2">No documents</div> : null}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          {currentDoc ? (
            <div className="mx-auto max-w-5xl rounded-xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="border-b border-slate-800 pb-4 mb-4">
                <h1 className="text-2xl font-semibold">{currentDoc.title}</h1>
                <div className="text-sm text-slate-400 mt-1">
                  Type {currentDoc.sourceType} 路 Status {currentDoc.status} 路 Parser {currentDoc.parserVersion}
                </div>
              </div>

              {loadingBlocks ? (
                <div className="text-sm text-slate-400 inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading document blocks...
                </div>
              ) : blocks.length === 0 ? (
                <div className="text-sm text-slate-500">No renderable blocks.</div>
              ) : (
                <div className="leading-7">{blocks.map((block) => <BlockRenderer key={`${block.id}-${block.index}`} block={block} />)}</div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">Import and select a document to start reading</div>
          )}
        </main>
      </div>

      {(statusText || errorText) && (
        <div className="fixed bottom-4 right-4 w-[460px] rounded-lg border border-slate-700 bg-slate-900/95 p-3 shadow-2xl">
          {statusText ? <div className="text-sm text-cyan-300">{statusText}</div> : null}
          {errorText ? (
            <div className="text-sm text-rose-300 mt-1 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <span>{errorText}</span>
            </div>
          ) : null}
        </div>
      )}

      {importOpen ? (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold inline-flex items-center gap-2">
                <Settings className="w-5 h-5 text-cyan-400" />
                Import and Parse
              </h2>
              <button className="text-slate-400 hover:text-slate-200" onClick={() => setImportOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <button
                className={`rounded-md border px-3 py-2 inline-flex items-center justify-center gap-2 ${
                  importMode === "single" ? "border-cyan-500 bg-cyan-500/10" : "border-slate-700"
                }`}
                onClick={() => setApiImportMode("single")}
              >
                <FileText className="w-4 h-4" /> Single
              </button>
              <button
                className={`rounded-md border px-3 py-2 inline-flex items-center justify-center gap-2 ${
                  importMode === "folder" ? "border-cyan-500 bg-cyan-500/10" : "border-slate-700"
                }`}
                onClick={() => setApiImportMode("folder")}
              >
                <FolderOpen className="w-4 h-4" /> Folder
              </button>
              <button
                className={`rounded-md border px-3 py-2 inline-flex items-center justify-center gap-2 ${
                  importMode === "archive" ? "border-cyan-500 bg-cyan-500/10" : "border-slate-700"
                }`}
                onClick={() => setApiImportMode("archive")}
              >
                <Archive className="w-4 h-4" /> Archive
              </button>
            </div>

            {importMode === "single" ? (
              <div className="mt-4 space-y-3">
                <input
                  type="file"
                  accept=".md,.markdown,.txt,.pdf,.docx,.pptx,.ppt"
                  onChange={(event) => setSingleFile(event.target.files?.[0] ?? null)}
                  className="block w-full text-sm"
                />
                <button
                  className="w-full rounded-md bg-cyan-500 text-slate-900 py-2 font-medium disabled:opacity-40"
                  disabled={!singleFile || busy}
                  onClick={() => void handleSingleImport()}
                >
                  {busy ? "Processing..." : "Upload and ingest single file"}
                </button>
              </div>
            ) : null}

            {importMode === "folder" ? (
              <div className="mt-4 space-y-3">
                <input
                  type="file"
                  multiple
                  {...folderPickerProps}
                  onChange={(event) => setFolderFiles(Array.from(event.target.files ?? []))}
                  className="block w-full text-sm"
                />
                <div className="text-xs text-slate-400">Selected {folderFiles.length} files. Folder will be zipped before upload.</div>
                <button
                  className="w-full rounded-md bg-cyan-500 text-slate-900 py-2 font-medium disabled:opacity-40"
                  disabled={folderFiles.length === 0 || busy}
                  onClick={() => void handleFolderImport()}
                >
                  {busy ? "Processing..." : "Upload and ingest folder"}
                </button>
              </div>
            ) : null}

            {importMode === "archive" ? (
              <div className="mt-4 space-y-3">
                <input
                  type="file"
                  accept=".zip,.7z,.rar"
                  onChange={(event) => setArchiveFile(event.target.files?.[0] ?? null)}
                  className="block w-full text-sm"
                />
                <button
                  className="w-full rounded-md bg-cyan-500 text-slate-900 py-2 font-medium disabled:opacity-40"
                  disabled={!archiveFile || busy}
                  onClick={() => void handleArchiveImport()}
                >
                  {busy ? "Processing..." : "Upload and ingest archive"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}



