import { useState } from "react";

interface ExpandableBlockProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

export function ExpandableBlock({
  title,
  children,
  defaultExpanded = false,
}: ExpandableBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 6,
        marginTop: 4,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          padding: "6px 10px",
          background: "var(--bg-surface)",
          color: "var(--text-secondary)",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontSize: 13,
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 10 }}>{expanded ? "\u25BC" : "\u25B6"}</span>
        {title}
      </button>
      {expanded && (
        <div
          style={{
            padding: "8px 10px",
            background: "var(--bg-secondary)",
            fontSize: 13,
            whiteSpace: "pre-wrap",
            overflowX: "auto",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
