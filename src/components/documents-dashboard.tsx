"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchJson } from "@/lib/api-client";

type DocumentItem = {
  id: string;
  title: string;
  sourceType: "PDF" | "DOCX" | "MD" | "TXT";
  status: "QUEUED" | "PROCESSING" | "READY" | "FAILED";
  parserVersion: string;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
};

type DocumentsResponse = {
  data: DocumentItem[];
  nextCursor: string | null;
};

type UploadUrlResponse = {
  uploadUrl: string;
  objectKey: string;
  sourceType: DocumentItem["sourceType"];
  maxBytes: number;
};

type IngestResponse = {
  documentId: string;
  jobId: string;
  queueJobId: string;
};

type JobResponse = {
  data: {
    id: string;
    status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
    errorCode: string | null;
    errorText: string | null;
  };
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

async function uploadFileAndIngest(file: File) {
  const uploadTarget = await fetchJson<UploadUrlResponse>("/api/documents/upload-url", {
    method: "POST",
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    }),
  });

  const uploadResponse = await fetch(uploadTarget.uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
  });
  if (!uploadResponse.ok) {
    throw new Error(`Upload failed with status ${uploadResponse.status}`);
  }

  const ingest = await fetchJson<IngestResponse>("/api/documents/ingest", {
    method: "POST",
    body: JSON.stringify({
      objectKey: uploadTarget.objectKey,
      fileName: file.name,
    }),
  });

  return ingest;
}

export function DocumentsDashboard({
  user,
}: {
  user: { id: string; email: string; displayName: string | null };
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const docsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: () => fetchJson<DocumentsResponse>("/api/documents"),
  });

  const jobQuery = useQuery({
    queryKey: ["job", activeJobId],
    queryFn: () => fetchJson<JobResponse>(`/api/jobs/${activeJobId}`),
    enabled: Boolean(activeJobId),
    refetchInterval: (query) => {
      if (!query.state.data) {
        return 2_000;
      }

      const status = query.state.data.data.status;
      if (status === "COMPLETED" || status === "FAILED") {
        return false;
      }
      return 2_000;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) {
        throw new Error("Select a file first");
      }
      return uploadFileAndIngest(selectedFile);
    },
    onMutate: () => {
      setError(null);
    },
    onSuccess: (result) => {
      setActiveJobId(result.jobId);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Upload failed");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetchJson<{ ok: true }>("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({}),
      });
    },
    onSuccess: () => {
      router.push("/login");
      router.refresh();
    },
  });

  const documents = docsQuery.data?.data ?? [];

  const statusText = useMemo(() => {
    const status = jobQuery.data?.data.status;
    if (!status) {
      return null;
    }

    if (status === "QUEUED") return "Ingest queued";
    if (status === "PROCESSING") return "Ingest processing";
    if (status === "COMPLETED") return "Ingest completed";
    return `Ingest failed: ${jobQuery.data?.data.errorCode ?? "UNKNOWN"}`;
  }, [jobQuery.data]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 md:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">TypingMonkey Workspace</h1>
              <p className="mt-2 text-sm text-slate-400">
                Signed in as {user.displayName || user.email}. Upload PDF, DOCX, MD, TXT and read with synced progress.
              </p>
            </div>
            <button
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:border-slate-400 disabled:opacity-50"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold">Import document</h2>
          <p className="mt-1 text-sm text-slate-400">Maximum file size: 50MB. OCR and external images are disabled by scope.</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".pdf,.docx,.md,.markdown,.txt"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
              }}
              className="max-w-sm text-sm"
            />
            <button
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-40"
              onClick={() => uploadMutation.mutate()}
              disabled={!selectedFile || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload & ingest"}
            </button>
          </div>

          {selectedFile ? <p className="mt-2 text-xs text-slate-400">Selected: {selectedFile.name}</p> : null}
          {statusText ? <p className="mt-3 text-sm text-cyan-300">{statusText}</p> : null}
          {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold">My documents</h2>
          {docsQuery.isLoading ? <p className="mt-3 text-sm text-slate-400">Loading documents...</p> : null}

          {!docsQuery.isLoading && documents.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No documents yet.</p>
          ) : null}

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="pb-2 pr-4">Title</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Words</th>
                  <th className="pb-2 pr-4">Updated</th>
                  <th className="pb-2 pr-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-t border-slate-800">
                    <td className="py-3 pr-4">{doc.title}</td>
                    <td className="py-3 pr-4">{doc.sourceType}</td>
                    <td className="py-3 pr-4">{doc.status}</td>
                    <td className="py-3 pr-4">{doc.wordCount}</td>
                    <td className="py-3 pr-4">{formatDate(doc.updatedAt)}</td>
                    <td className="py-3 pr-4">
                      <Link className="text-cyan-300 hover:underline" href={`/documents/${doc.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
