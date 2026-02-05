// Discussed Treatments Modal – left column (plan list with sections and drag-and-drop)

import type { DiscussedItem } from "../../../types";

export interface NewItemPreview {
  primary: string;
  product: string | null;
  interest: string | null;
  timeline: string | null;
  quantity: string | null;
}

interface PlanListColumnProps {
  clientName: string;
  items: DiscussedItem[];
  itemsBySection: Record<string, DiscussedItem[]>;
  sectionLabels: readonly string[];
  newItemPreview: NewItemPreview;
  selectedPlanItemId: string | null;
  editingId: string | null;
  showAddForm: boolean;
  draggedItemId: string | null;
  dragOverSection: string | null;
  onSelectItem: (id: string) => void;
  onShowAddForm: () => void;
  onDragStart: (e: React.DragEvent<HTMLElement>, itemId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent<HTMLElement>, sectionLabel: string) => void;
  onDragLeave: (e?: React.DragEvent<HTMLElement>) => void;
  onDrop: (e: React.DragEvent<HTMLElement>, sectionLabel: string) => void;
}

export default function PlanListColumn({
  clientName,
  items,
  itemsBySection,
  sectionLabels,
  newItemPreview,
  selectedPlanItemId,
  editingId,
  showAddForm,
  draggedItemId,
  dragOverSection,
  onSelectItem,
  onShowAddForm,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: PlanListColumnProps) {
  const firstName = clientName?.trim().split(/\s+/)[0] || "Patient";

  return (
    <aside
      className="discussed-treatments-column discussed-treatments-column-plan discussed-treatments-column-master"
      aria-label="Treatment plan list"
    >
      <div className="discussed-treatments-list-section discussed-treatments-master-list">
        <div className="discussed-treatments-master-list-header">
          <h3 className="discussed-treatments-list-title">
            {firstName}&apos;s plan ({items.length}{" "}
            {items.length === 1 ? "item" : "items"})
          </h3>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={onShowAddForm}
          >
            + Add new
          </button>
        </div>
        <p className="discussed-treatments-list-hint">
          Click a row to view details. Drag items to reorder between sections.
        </p>
        {!selectedPlanItemId && !editingId && showAddForm && (
          <div
            className="discussed-treatments-record-row discussed-treatments-record-row-new selected"
            role="listitem"
            aria-label={`New item${
              newItemPreview.primary !== "New item"
                ? `: ${newItemPreview.primary}${
                    newItemPreview.product
                      ? ` / ${newItemPreview.product}`
                      : newItemPreview.interest
                      ? ` for ${newItemPreview.interest}`
                      : ""
                  }`
                : ""
            }`}
          >
            <div className="discussed-treatments-record-primary">
              {newItemPreview.primary}
            </div>
            {(newItemPreview.product ||
              newItemPreview.interest ||
              newItemPreview.timeline ||
              newItemPreview.quantity) && (
              <div className="discussed-treatments-record-meta">
                {newItemPreview.product ? (
                  <span className="discussed-treatments-record-product">
                    {newItemPreview.product}
                  </span>
                ) : newItemPreview.interest ? (
                  <span className="discussed-treatments-record-for">
                    {newItemPreview.interest}
                  </span>
                ) : null}
                {newItemPreview.quantity && (
                  <span className="discussed-treatments-record-quantity">
                    Qty: {newItemPreview.quantity}
                  </span>
                )}
                {newItemPreview.timeline && (
                  <span className="discussed-treatments-record-timeline">
                    {newItemPreview.timeline}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
        <div className="discussed-treatments-plan-sections">
          {sectionLabels.map((sectionLabel) => {
            const sectionItems = itemsBySection[sectionLabel] ?? [];
            return (
              <div
                key={sectionLabel}
                className={`discussed-treatments-plan-section ${
                  dragOverSection === sectionLabel ? "drag-over" : ""
                }`}
                aria-label={`${sectionLabel} (${sectionItems.length} items)`}
                onDragOver={(e) => onDragOver(e, sectionLabel)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, sectionLabel)}
              >
                <h4 className="discussed-treatments-plan-section-title">
                  {sectionLabel}
                </h4>
                <div
                  className="discussed-treatments-master-records-list"
                  role="list"
                  aria-label={`${sectionLabel} items`}
                >
                  {sectionItems.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, item.id)}
                      onDragEnd={onDragEnd}
                      className={`discussed-treatments-record-row ${
                        selectedPlanItemId === item.id || editingId === item.id
                          ? "selected"
                          : ""
                      } ${draggedItemId === item.id ? "dragging" : ""}`}
                      onClick={() => onSelectItem(item.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectItem(item.id);
                        }
                      }}
                      aria-label={`Select ${item.treatment}${
                        item.product
                          ? ` / ${item.product}`
                          : item.interest
                          ? ` for ${item.interest}`
                          : ""
                      }`}
                      aria-selected={
                        selectedPlanItemId === item.id || editingId === item.id
                      }
                    >
                      <div
                        className="discussed-treatments-drag-handle"
                        aria-label="Drag to move"
                      >
                        ⋮⋮
                      </div>
                      <div className="discussed-treatments-record-row-main">
                        <div className="discussed-treatments-record-primary">
                          {item.treatment || "—"}
                        </div>
                        {(item.region ||
                          item.product ||
                          item.interest ||
                          item.quantity) && (
                          <div className="discussed-treatments-record-meta">
                            {item.region ? (
                              <span className="discussed-treatments-record-region">
                                {item.region}
                              </span>
                            ) : item.product ? (
                              <span className="discussed-treatments-record-product">
                                {item.product}
                              </span>
                            ) : item.interest ? (
                              <span className="discussed-treatments-record-for">
                                {item.interest}
                              </span>
                            ) : null}
                            {item.quantity && (
                              <span className="discussed-treatments-record-quantity">
                                Qty: {item.quantity}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
