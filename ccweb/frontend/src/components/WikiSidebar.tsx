import { useEffect, useState } from "react";

interface DocEntry {
  path: string;
  title: string;
  description: string;
  order: number;
  section: string;
}

interface WikiSidebarProps {
  activePath: string;
  onNavigate: (path: string) => void;
  onClose: () => void;
}

export function WikiSidebar({ activePath, onNavigate, onClose }: WikiSidebarProps) {
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ path: string; title: string; snippet: string }>
  >([]);

  useEffect(() => {
    fetch("/api/docs")
      .then((r) => r.json())
      .then(setDocs)
      .catch(() => setDocs([]));
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/docs-search?q=${encodeURIComponent(search)}`)
        .then((r) => r.json())
        .then(setSearchResults)
        .catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // Group docs by section
  const sections = new Map<string, DocEntry[]>();
  for (const doc of docs) {
    const key = doc.section || "(root)";
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key)!.push(doc);
  }

  const sectionLabels: Record<string, string> = {
    "(root)": "",
    "getting-started": "Getting Started",
    features: "Features",
    architecture: "Architecture",
    configuration: "Configuration",
    troubleshooting: "Troubleshooting",
  };

  return (
    <div
      style={{
        width: 280,
        minWidth: 280,
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 15 }}>Wiki</span>
        <button
          onClick={onClose}
          style={{
            background: "var(--bg-surface)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "4px 10px",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Back
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: "8px 12px" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search docs..."
          style={{
            width: "100%",
            padding: "6px 10px",
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
          }}
        />
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <div
          style={{
            padding: "0 12px 8px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {searchResults.map((r) => (
            <div
              key={r.path}
              onClick={() => {
                onNavigate(r.path);
                setSearch("");
              }}
              style={{
                padding: "6px 8px",
                cursor: "pointer",
                fontSize: 12,
                borderRadius: 4,
                marginBottom: 2,
                background:
                  activePath === r.path ? "var(--bg-surface)" : "transparent",
              }}
            >
              <div style={{ fontWeight: 500 }}>{r.title}</div>
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: 11,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.snippet}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Navigation tree */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {[...sections.entries()].map(([section, entries]) => (
          <div key={section}>
            {section !== "(root)" && (
              <div
                style={{
                  padding: "8px 12px 4px",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {sectionLabels[section] || section}
              </div>
            )}
            {entries.map((doc) => (
              <div
                key={doc.path}
                onClick={() => onNavigate(doc.path)}
                style={{
                  padding: "6px 12px 6px 20px",
                  cursor: "pointer",
                  fontSize: 13,
                  background:
                    activePath === doc.path ? "var(--bg-surface)" : "transparent",
                  borderLeft:
                    activePath === doc.path
                      ? "3px solid var(--accent)"
                      : "3px solid transparent",
                  color:
                    activePath === doc.path
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                }}
              >
                {doc.title}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
