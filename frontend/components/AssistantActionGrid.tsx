type AssistantActionGridProps = {
  items: string[];
  onSelect: (value: string) => void;
};

export function AssistantActionGrid({ items, onSelect }: AssistantActionGridProps) {
  return (
    <section className="lm-assistant-actions" aria-label="Assistant actions">
      <div className="lm-assistant-actions-head">
        <span className="eyebrow">Assistant actions</span>
      </div>
      <div className="lm-assistant-actions-grid">
        {items.map((item) => (
          <button
            className="lm-assistant-action"
            key={`assistant-action-${item}`}
            onClick={() => onSelect(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}
