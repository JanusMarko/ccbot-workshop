import { useEffect, useState } from "react";
import type { WsDecisionGrid, ClientSubmitDecisions } from "../protocol";

interface DecisionGridProps {
  grid: WsDecisionGrid;
  onSubmit: (submission: ClientSubmitDecisions) => void;
  onDismiss: () => void;
}

interface RowState {
  choice: string | null;
  notes: string;
}

function initRows(grid: WsDecisionGrid): RowState[] {
  return grid.grid.items.map((item) => {
    const recommended = item.options.find((o) => o.recommended);
    return { choice: recommended?.label ?? null, notes: "" };
  });
}

export function DecisionGrid({ grid, onSubmit, onDismiss }: DecisionGridProps) {
  const data = grid.grid;
  const [rows, setRows] = useState<RowState[]>(() => initRows(grid));

  // Reset rows when the grid changes (e.g., new grid arrives)
  useEffect(() => {
    setRows(initRows(grid));
  }, [grid]);

  const updateRow = (index: number, update: Partial<RowState>) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...update } : r)),
    );
  };

  const handleSubmit = () => {
    const selections = data.items.map((item, i) => ({
      topic: item.topic,
      choice: rows[i].choice,
      notes: rows[i].notes,
    }));
    onSubmit({
      type: "submit_decisions",
      window_id: grid.window_id,
      title: data.title,
      selections,
    });
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
          maxWidth: 900,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>{data.title}</h2>
          <button
            onClick={onDismiss}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            x
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {data.items.map((item, i) => (
            <div
              key={item.topic}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 16,
                background: "var(--bg-secondary)",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>
                {item.topic}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  marginBottom: 12,
                }}
              >
                {item.description}
              </div>

              {/* Options */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                {item.options.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => updateRow(i, { choice: opt.label })}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: 13,
                      fontFamily: "inherit",
                      cursor: "pointer",
                      border:
                        rows[i].choice === opt.label
                          ? "2px solid var(--accent)"
                          : "1px solid var(--border)",
                      background:
                        rows[i].choice === opt.label
                          ? "rgba(137,180,250,0.15)"
                          : "var(--bg-surface)",
                      color:
                        rows[i].choice === opt.label
                          ? "var(--accent)"
                          : "var(--text-primary)",
                    }}
                  >
                    {opt.recommended && "\u2605 "}
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Notes */}
              <input
                type="text"
                value={rows[i].notes}
                onChange={(e) => updateRow(i, { notes: e.target.value })}
                placeholder="Add notes, provide a custom option, or ask a question..."
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
          ))}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 20,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onDismiss}
            style={{
              padding: "8px 20px",
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
              fontFamily: "inherit",
            }}
          >
            Dismiss
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: "8px 24px",
              background: "var(--accent)",
              color: "#1e1e2e",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            Submit All
          </button>
        </div>
      </div>
    </div>
  );
}
