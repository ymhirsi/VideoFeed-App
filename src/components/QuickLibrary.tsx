import { useMemo, useState } from "react";
import type { CategoryKey } from "../types";
import {
  CATEGORY_HINTS,
  CATEGORY_LABELS,
  newPresetId,
  type LibraryPreset,
  type QuickLibrary,
} from "../library";

interface QuickLibraryProps {
  library: QuickLibrary;
  setLibrary: (next: QuickLibrary) => void;
  /** Categories to show — Enunciation is gated by review.mode. */
  visible: CategoryKey[];
  /** Tap a preset to insert it into the composer text field. */
  onInsert: (preset: LibraryPreset, category: CategoryKey) => void;
}

/**
 * Quick-comment picker. The category tabs are ALWAYS VISIBLE so the library
 * is discoverable without focusing anything. Opening a category lists its
 * presets; tapping a preset inserts the line into the composer's text field
 * and keeps the panel open so the teacher can stack several. The teacher's
 * own library — they can edit any preset's wording in place, add new ones,
 * or remove ones they don't use (session state for the prototype; saved per
 * teacher in Solmido).
 *
 * Score-study presets are sub-grouped (Notes / Rhythm / Articulation /
 * Expression / Dynamics); new presets there prompt for a group.
 *
 * Click handling: every interactive control uses `onMouseDown` with
 * `preventDefault` so clicking a preset does NOT blur the composer textarea.
 * Without this the click would shift focus, fire blur on the textarea, and
 * (if a focus-driven open state were used) tear down the panel before the
 * insert lands.
 */
export function QuickLibrary({
  library,
  setLibrary,
  visible,
  onInsert,
}: QuickLibraryProps) {
  const [open, setOpen] = useState<CategoryKey | null>("technique");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [newGroup, setNewGroup] = useState("");

  // If the active category is hidden (e.g. Enunciation when mode flips back to
  // Instrument), fall back to the first visible one so the panel stays useful.
  const activeCategory =
    open && visible.includes(open) ? open : visible[0] ?? null;

  const updateCategory = (
    category: CategoryKey,
    nextPresets: LibraryPreset[],
  ) => {
    setLibrary({ ...library, [category]: nextPresets });
  };

  const startEdit = (preset: LibraryPreset) => {
    setEditingId(preset.id);
    setEditValue(preset.text);
  };

  const commitEdit = (category: CategoryKey) => {
    if (!editingId) return;
    const text = editValue.trim();
    if (text) {
      updateCategory(
        category,
        library[category].map((p) =>
          p.id === editingId ? { ...p, text } : p,
        ),
      );
    }
    setEditingId(null);
    setEditValue("");
  };

  const remove = (category: CategoryKey, id: string) => {
    updateCategory(
      category,
      library[category].filter((p) => p.id !== id),
    );
  };

  const startAdd = () => {
    setAdding(true);
    setNewText("");
    setNewGroup("");
  };

  const commitAdd = (category: CategoryKey) => {
    const text = newText.trim();
    if (!text) {
      setAdding(false);
      return;
    }
    const preset: LibraryPreset = {
      id: newPresetId(),
      text,
      group:
        category === "score-study" && newGroup.trim()
          ? newGroup.trim()
          : undefined,
    };
    updateCategory(category, [...library[category], preset]);
    setAdding(false);
    setNewText("");
    setNewGroup("");
  };

  const presetsByGroup = useMemo(() => {
    if (!activeCategory) return null;
    const presets = library[activeCategory];
    const groups = new Map<string, LibraryPreset[]>();
    for (const preset of presets) {
      const key = preset.group ?? "";
      const list = groups.get(key) ?? [];
      list.push(preset);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [library, activeCategory]);

  /** Block focus stealing on every control inside the panel. */
  const keepFocus = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div className="qlib">
      <div className="qlib__head">
        <span className="qlib__head-label">Quick comments</span>
      </div>
      <div className="qlib__cats" role="tablist" aria-label="Quick comments">
        {visible.map((c) => {
          const isOpen = activeCategory === c;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={isOpen}
              className={"qlib__cat" + (isOpen ? " is-open" : "")}
              onMouseDown={keepFocus}
              onClick={() => {
                setOpen(c);
                setEditingId(null);
                setAdding(false);
              }}
              title={CATEGORY_HINTS[c]}
            >
              {CATEGORY_LABELS[c]}
            </button>
          );
        })}
      </div>

      {activeCategory && presetsByGroup && (
        <div className="qlib__panel" role="tabpanel">
          {presetsByGroup.length === 0 ? (
            <p className="qlib__empty">No presets yet — add one below.</p>
          ) : (
            presetsByGroup.map(([group, presets]) => (
              <div key={group || "_"} className="qlib__group">
                {group && <div className="qlib__group-head">{group}</div>}
                <ul className="qlib__list">
                  {presets.map((preset) => (
                    <li key={preset.id} className="qlib__item">
                      {editingId === preset.id ? (
                        <div className="qlib__edit">
                          <input
                            className="qlib__edit-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitEdit(activeCategory);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                setEditingId(null);
                                setEditValue("");
                              }
                              e.stopPropagation();
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            className="qlib__mini"
                            onMouseDown={keepFocus}
                            onClick={() => commitEdit(activeCategory)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="qlib__mini qlib__mini--ghost"
                            onMouseDown={keepFocus}
                            onClick={() => {
                              setEditingId(null);
                              setEditValue("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="qlib__preset"
                            onMouseDown={keepFocus}
                            onClick={() => onInsert(preset, activeCategory)}
                            title="Insert into the comment"
                          >
                            {preset.text}
                          </button>
                          <div className="qlib__row-tools">
                            <button
                              type="button"
                              className="qlib__mini qlib__mini--ghost"
                              onMouseDown={keepFocus}
                              onClick={() => startEdit(preset)}
                              aria-label="Edit preset"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="qlib__mini qlib__mini--ghost qlib__mini--danger"
                              onMouseDown={keepFocus}
                              onClick={() => remove(activeCategory, preset.id)}
                              aria-label="Remove preset"
                            >
                              Remove
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}

          {adding ? (
            <div className="qlib__add">
              {activeCategory === "score-study" && (
                <input
                  className="qlib__edit-input qlib__edit-input--group"
                  placeholder="Sub-group (e.g. Rhythm)"
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              )}
              <input
                className="qlib__edit-input"
                placeholder="New preset wording…"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitAdd(activeCategory);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setAdding(false);
                  }
                  e.stopPropagation();
                }}
                autoFocus
              />
              <button
                type="button"
                className="qlib__mini"
                onMouseDown={keepFocus}
                onClick={() => commitAdd(activeCategory)}
              >
                Add
              </button>
              <button
                type="button"
                className="qlib__mini qlib__mini--ghost"
                onMouseDown={keepFocus}
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="qlib__addbtn"
              onMouseDown={keepFocus}
              onClick={startAdd}
            >
              + Add preset to {CATEGORY_LABELS[activeCategory]}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
