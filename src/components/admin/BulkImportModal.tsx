"use client";

import { useState, useRef } from "react";
import { Upload, X, AlertCircle, CheckCircle } from "lucide-react";

interface ImportResult {
  row: number;
  email: string;
  status: string;
  error?: string;
}

interface BulkImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkImportModal({ open, onClose, onSuccess }: BulkImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<string[][]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ created: number; errors: number; total: number; results: ImportResult[] } | null>(null);

  if (!open) return null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResults(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      setPreview(lines.slice(0, 6).map((l) => l.split(",")));
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!csvText.trim()) return;
    setImporting(true);
    setResults(null);
    try {
      const res = await fetch("/api/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await res.json();
      setResults(data);
      if (data.created > 0) onSuccess();
    } catch {
      setResults({ created: 0, errors: 1, total: 0, results: [{ row: 0, email: "", status: "error", error: "Network error" }] });
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    setCsvText("");
    setFileName("");
    setPreview([]);
    setResults(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-card rounded-xl border shadow-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-foreground">Import Users from CSV</h2>
          <button onClick={handleClose} className="p-1 rounded hover:bg-secondary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">Upload a CSV file with the following columns:</p>
            <code className="block bg-secondary px-3 py-2 rounded text-xs">name,email,role,password</code>
            <p className="mt-1 text-xs">Role must be one of: ADMIN, MANAGER, EMPLOYEE</p>
          </div>

          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-2 mx-auto text-muted-foreground hover:text-foreground transition-colors"
            >
              <Upload className="w-8 h-8" />
              <span className="text-sm">{fileName || "Click to upload CSV file"}</span>
            </button>
          </div>

          {preview.length > 0 && !results && (
            <div className="overflow-x-auto">
              <p className="text-sm font-medium text-foreground mb-2">Preview (first 5 rows):</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    {preview[0]?.map((h, i) => (
                      <th key={i} className="text-left py-1 px-2 text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(1).map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {row.map((cell, j) => (
                        <td key={j} className="py-1 px-2 text-foreground">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {results && (
            <div className="space-y-3">
              <div className="flex gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span className="text-foreground">{results.created} created</span>
                </div>
                {results.errors > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <span className="text-foreground">{results.errors} errors</span>
                  </div>
                )}
              </div>
              {results.results.filter((r) => r.status === "error").length > 0 && (
                <div className="max-h-40 overflow-y-auto text-xs space-y-1">
                  {results.results
                    .filter((r) => r.status === "error")
                    .map((r, i) => (
                      <div key={i} className="flex gap-2 text-destructive">
                        <span>Row {r.row}:</span>
                        <span>{r.error}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t">
          <button onClick={handleClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-secondary transition-colors">
            {results ? "Close" : "Cancel"}
          </button>
          {!results && (
            <button
              onClick={handleImport}
              disabled={!csvText.trim() || importing}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {importing ? "Importing..." : "Import Users"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
