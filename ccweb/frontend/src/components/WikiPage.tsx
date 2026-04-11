import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface WikiPageProps {
  path: string;
  onNavigate: (path: string) => void;
}

export function WikiPage({ path, onNavigate }: WikiPageProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    const controller = new AbortController();
    fetch(`/api/docs/${encodeURIComponent(path)}`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.text();
      })
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.message || "Failed to load");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [path]);

  // Resolve relative links in markdown to wiki navigation
  const resolveLink = (href: string): string => {
    if (href.startsWith("http") || href.startsWith("#")) return href;
    // Resolve relative to current path's directory
    const dir = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
    const parts = (dir ? `${dir}/${href}` : href).split("/");
    const resolved: string[] = [];
    for (const part of parts) {
      if (part === "..") resolved.pop();
      else if (part !== ".") resolved.push(part);
    }
    return resolved.join("/");
  };

  // Breadcrumbs
  const breadcrumbs = path.split("/").filter(Boolean);
  const breadcrumbParts: Array<{ label: string; path: string }> = [
    { label: "Wiki", path: "index.md" },
  ];
  let accumulated = "";
  for (let i = 0; i < breadcrumbs.length; i++) {
    accumulated += (i > 0 ? "/" : "") + breadcrumbs[i];
    const label = breadcrumbs[i].replace(".md", "").replace(/-/g, " ");
    breadcrumbParts.push({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      path: accumulated,
    });
  }

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
        }}
      >
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--error)",
        }}
      >
        Error loading document: {error}
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "20px 32px",
        maxWidth: 800,
      }}
    >
      {/* Breadcrumbs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          fontSize: 12,
          color: "var(--text-muted)",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {breadcrumbParts.map((b, i) => (
          <span key={b.path}>
            {i > 0 && <span style={{ margin: "0 4px" }}>/</span>}
            <span
              onClick={() => onNavigate(b.path)}
              style={{
                cursor: "pointer",
                color:
                  i === breadcrumbParts.length - 1
                    ? "var(--text-primary)"
                    : "var(--accent)",
              }}
            >
              {b.label}
            </span>
          </span>
        ))}
      </div>

      {/* Content */}
      <div className="wiki-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a({ href, children }) {
              if (!href) return <>{children}</>;
              if (href.startsWith("http")) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent)" }}
                  >
                    {children}
                  </a>
                );
              }
              // Internal link — navigate within wiki
              const resolved = resolveLink(href);
              return (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(resolved);
                  }}
                  style={{ color: "var(--accent)" }}
                >
                  {children}
                </a>
              );
            },
            code({ className, children, ...props }) {
              const isBlock = className?.startsWith("language-");
              if (isBlock) {
                return (
                  <pre
                    style={{
                      background: "var(--bg-secondary)",
                      padding: 12,
                      borderRadius: 6,
                      overflow: "auto",
                      fontSize: 13,
                    }}
                  >
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                );
              }
              return (
                <code
                  style={{
                    background: "var(--bg-surface)",
                    padding: "2px 5px",
                    borderRadius: 3,
                    fontSize: 13,
                  }}
                  {...props}
                >
                  {children}
                </code>
              );
            },
            table({ children }) {
              return (
                <table
                  style={{
                    borderCollapse: "collapse",
                    width: "100%",
                    fontSize: 13,
                    marginBottom: 16,
                  }}
                >
                  {children}
                </table>
              );
            },
            th({ children }) {
              return (
                <th
                  style={{
                    borderBottom: "2px solid var(--border)",
                    padding: "8px 12px",
                    textAlign: "left",
                  }}
                >
                  {children}
                </th>
              );
            },
            td({ children }) {
              return (
                <td
                  style={{
                    borderBottom: "1px solid var(--border)",
                    padding: "6px 12px",
                  }}
                >
                  {children}
                </td>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
