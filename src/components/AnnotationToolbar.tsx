import { ANNOTATION_COLORS, STROKE_WIDTHS } from "../config";
import type { AnnotationTool } from "../types";

interface AnnotationToolbarProps {
  tool: AnnotationTool;
  setTool: (t: AnnotationTool) => void;
  color: string;
  setColor: (c: string) => void;
  strokeWidth: number;
  setStrokeWidth: (w: number) => void;
  onUndo: () => void;
  onClear: () => void;
  canUndo: boolean;
}

const TOOLS: { id: AnnotationTool; label: string; key: string }[] = [
  { id: "arrow", label: "Arrow", key: "A" },
  { id: "circle", label: "Circle", key: "C" },
  { id: "pen", label: "Pen", key: "P" },
  { id: "text", label: "Text", key: "T" },
];

export function AnnotationToolbar({
  tool,
  setTool,
  color,
  setColor,
  strokeWidth,
  setStrokeWidth,
  onUndo,
  onClear,
  canUndo,
}: AnnotationToolbarProps) {
  return (
    <div className="atoolbar">
      <div className="atoolbar__group" role="radiogroup" aria-label="Annotation tool">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={"atoolbar__tool" + (tool === t.id ? " is-active" : "")}
            aria-pressed={tool === t.id}
            title={`${t.label} (${t.key})`}
            onClick={() => setTool(t.id)}
          >
            <ToolIcon tool={t.id} />
            <span className="atoolbar__tool-label">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="atoolbar__group" aria-label="Color">
        {ANNOTATION_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={"atoolbar__swatch" + (color === c ? " is-active" : "")}
            style={{ background: c }}
            aria-label={`Color ${c}`}
            aria-pressed={color === c}
            onClick={() => setColor(c)}
          />
        ))}
      </div>

      <div className="atoolbar__group" aria-label="Stroke width">
        {STROKE_WIDTHS.map((w, i) => (
          <button
            key={w}
            type="button"
            className={"atoolbar__stroke" + (strokeWidth === w ? " is-active" : "")}
            title={["Thin", "Medium", "Thick"][i]}
            aria-pressed={strokeWidth === w}
            onClick={() => setStrokeWidth(w)}
          >
            <span
              className="atoolbar__stroke-dot"
              style={{ width: w + 2, height: w + 2 }}
            />
          </button>
        ))}
      </div>

      <div className="atoolbar__group atoolbar__group--end">
        <button
          type="button"
          className="atoolbar__action"
          onClick={onUndo}
          disabled={!canUndo}
        >
          Undo
        </button>
        <button
          type="button"
          className="atoolbar__action"
          onClick={onClear}
          disabled={!canUndo}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function ToolIcon({ tool }: { tool: AnnotationTool }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (tool) {
    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 19L19 5M19 5h-7M19 5v7" />
        </svg>
      );
    case "circle":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="12" rx="8" ry="6" />
        </svg>
      );
    case "pen":
      return (
        <svg {...common}>
          <path d="M4 20s2-6 8-12 6-4 6-4-2 0-4 6-12 8-12 8 1-1 2 2z" />
        </svg>
      );
    case "text":
      return (
        <svg {...common}>
          <path d="M5 6h14M12 6v13M9 19h6" />
        </svg>
      );
  }
}
