import type { MessageFilter } from "../hooks/useSession";

interface FilterBarProps {
  filter: MessageFilter;
  onFilterChange: (f: MessageFilter) => void;
}

const FILTERS: Array<{ value: MessageFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "chat", label: "Chat" },
  { value: "no_thinking", label: "No Thinking" },
  { value: "tools", label: "Tools" },
];

export function FilterBar({ filter, onFilterChange }: FilterBarProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        padding: "6px 12px",
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => onFilterChange(f.value)}
          style={{
            padding: "3px 10px",
            borderRadius: 12,
            fontSize: 12,
            border:
              filter === f.value
                ? "1px solid var(--accent)"
                : "1px solid var(--border)",
            background:
              filter === f.value ? "rgba(137,180,250,0.15)" : "transparent",
            color:
              filter === f.value ? "var(--accent)" : "var(--text-muted)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
