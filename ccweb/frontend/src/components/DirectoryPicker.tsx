import { useCallback, useEffect, useState } from "react";

interface DirectoryPickerProps {
  onSelect: (path: string, name?: string) => void;
  onCancel: () => void;
}

interface DirEntry {
  name: string;
  path: string;
}

interface BrowseResult {
  path: string;
  parent: string | null;
  dirs: DirEntry[];
  error?: string;
}

const RECENT_DIRS_KEY = "ccweb_recent_dirs";
const MAX_RECENT = 5;

function getRecentDirs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_DIRS_KEY) || "[]");
  } catch {
    return [];
  }
}

function addRecentDir(path: string) {
  const recent = getRecentDirs().filter((d) => d !== path);
  recent.unshift(path);
  localStorage.setItem(
    RECENT_DIRS_KEY,
    JSON.stringify(recent.slice(0, MAX_RECENT)),
  );
}

export function DirectoryPicker({ onSelect, onCancel }: DirectoryPickerProps) {
  const [currentPath, setCurrentPath] = useState("");
  const [dirs, setDirs] = useState<DirEntry[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [pathInput, setPathInput] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recentDirs] = useState(getRecentDirs);

  const browse = useCallback(async (path: string) => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(
        `/api/browse?path=${encodeURIComponent(path)}`,
      );
      const data: BrowseResult = await resp.json();
      setCurrentPath(data.path);
      setPathInput(data.path);
      setDirs(data.dirs);
      setParentPath(data.parent);
      if (data.error) setError(data.error);
    } catch {
      setError("Failed to browse directory");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load initial directory
  useEffect(() => {
    browse("");
  }, [browse]);

  const handleConfirm = () => {
    const path = pathInput.trim() || currentPath;
    if (!path) return;
    addRecentDir(path);
    const parts = path.split("/");
    const name = sessionName.trim() || parts[parts.length - 1];
    onSelect(path, name);
  };

  const handlePathSubmit = () => {
    if (pathInput.trim()) {
      browse(pathInput.trim());
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 20,
      }}
    >
      <div
        style={{
          background: "var(--bg-primary)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          width: 500,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px 12px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>New Session</h3>

          {/* Path input */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePathSubmit()}
              placeholder="/path/to/project"
              style={{
                flex: 1,
                padding: "6px 10px",
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
            <button
              onClick={handlePathSubmit}
              style={{
                padding: "6px 12px",
                background: "var(--bg-surface)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Go
            </button>
          </div>

          {/* Session name */}
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="Session name (optional)"
            style={{
              width: "100%",
              padding: "6px 10px",
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
        </div>

        {/* Recent directories */}
        {recentDirs.length > 0 && !loading && (
          <div
            style={{
              padding: "8px 20px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                fontWeight: 600,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Recent
            </div>
            {recentDirs.map((d) => (
              <div
                key={d}
                onClick={() => {
                  setPathInput(d);
                  browse(d);
                }}
                style={{
                  padding: "4px 0",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--accent)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {d}
              </div>
            ))}
          </div>
        )}

        {/* Directory list */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 200 }}>
          {error && (
            <div
              style={{
                padding: "8px 20px",
                color: "var(--error)",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <div
              style={{
                padding: "20px",
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              Loading...
            </div>
          ) : (
            <>
              {parentPath && (
                <div
                  onClick={() => browse(parentPath)}
                  style={{
                    padding: "8px 20px",
                    cursor: "pointer",
                    color: "var(--accent)",
                    fontSize: 13,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  .. (parent directory)
                </div>
              )}
              {dirs.map((d) => (
                <div
                  key={d.path}
                  onClick={() => browse(d.path)}
                  style={{
                    padding: "8px 20px",
                    cursor: "pointer",
                    fontSize: 13,
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ color: "var(--accent)" }}>{'>'}</span>
                  {d.name}
                </div>
              ))}
              {dirs.length === 0 && !error && (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: 13,
                  }}
                >
                  No subdirectories
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!pathInput.trim() && !currentPath}
            style={{
              padding: "8px 20px",
              background: "var(--accent)",
              color: "#1e1e2e",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            Create Session
          </button>
        </div>
      </div>
    </div>
  );
}
