import { useCallback, useRef, useState } from "react";

interface FileUploadProps {
  windowId: string;
  disabled?: boolean;
}

export function FileUpload({ windowId, disabled }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const resp = await fetch(
          `/api/sessions/${encodeURIComponent(windowId)}/upload`,
          { method: "POST", body: form },
        );
        const data = await resp.json();
        if (data.error) {
          console.error("Upload failed:", data.error);
        }
      } catch (err) {
        console.error("Upload error:", err);
      } finally {
        setUploading(false);
      }
    },
    [windowId],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset input so the same file can be re-uploaded
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile],
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        disabled={disabled || uploading}
        title="Upload file"
        style={{
          padding: "4px 10px",
          background: dragOver ? "var(--accent)" : "var(--bg-surface)",
          color: dragOver ? "#1e1e2e" : "var(--text-secondary)",
          border: `1px solid ${dragOver ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 4,
          cursor: disabled || uploading ? "default" : "pointer",
          fontSize: 12,
          opacity: uploading ? 0.5 : 1,
        }}
      >
        {uploading ? "Uploading..." : "Attach"}
      </button>
    </>
  );
}
