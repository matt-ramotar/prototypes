// Shared presentational atoms for the Review surface. State-free; every
// judgment and derivation lives in review-view.js.

/** Verdict state of one proposal, list glyph included. Plain words only. */
export function verdictMeta(record) {
  if (!record) return {key: "unjudged", label: "Waiting", glyph: "●", cls: "text-accent"};
  if (record.verdict === "accept" && record.amended)
    return {key: "amended", label: "Approved · edited", glyph: "✎", cls: "text-success"};
  if (record.verdict === "accept")
    return {key: "accept", label: "Approved", glyph: "✓", cls: "text-success"};
  if (record.verdict === "changes")
    return {key: "changes", label: "Sent back", glyph: "↺", cls: "text-warning"};
  return {key: "reject", label: "Rejected", glyph: "✕", cls: "text-danger"};
}

export function VerdictGlyph({record, viewed}) {
  const meta = verdictMeta(record);
  if (!record && viewed)
    return <span className="w-4 text-center font-mono text-sm text-muted" title="Seen, not yet reviewed">○</span>;
  return (
    <span className={`w-4 text-center font-mono text-sm ${meta.cls}`} title={meta.label}>
      {meta.glyph}
    </span>
  );
}
