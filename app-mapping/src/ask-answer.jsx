import {Button, Card, Chip} from "@heroui/react";
import {WireScreenshot} from "./screenshot.jsx";
import {PROVENANCE} from "./ask.js";

function Evidence({block, navigate}) {
  if (block.type === "screens") {
    return (
      <div className="my-2.5 flex flex-wrap gap-2.5">
        {block.items.map((it, i) => (
          <Button key={`${i}:${it.key}:${it.label}`} variant="ghost"
            className="h-auto flex-col px-1 py-1"
            onPress={() => navigate({path: `/screens/${encodeURIComponent(it.key)}`, patch: {}})}>
            <WireScreenshot screenKey={it.key} width={56} height={112} />
            <span className={`max-w-16 text-[10px] ${it.italic ? "italic text-muted" : ""}`}>
              {it.label}
            </span>
          </Button>
        ))}
      </div>
    );
  }
  if (block.type === "diff") {
    const c = block.counts;
    return (
      <div className="my-2.5 flex flex-wrap gap-3.5 text-sm font-semibold">
        <span><span className="font-mono tabular-nums text-success">{c.onlyA}</span> only in {block.sideA}</span>
        <span><span className="font-mono tabular-nums text-danger">{c.onlyB}</span> only in {block.sideB}</span>
        <span><span className="font-mono tabular-nums text-warning">{c.changed}</span> changed</span>
        <span><span className="font-mono tabular-nums text-muted">{c.shared}</span> shared</span>
      </div>
    );
  }
  if (block.type === "cells") {
    return (
      <ul className="my-2.5 list-disc pl-4.5 text-sm">
        {block.items.map((it) => (
          <li key={it.label}>{it.label} — {it.detail}</li>
        ))}
      </ul>
    );
  }
  if (block.type === "stacks") {
    return (
      <ul className="my-2.5 list-disc pl-4.5 text-sm">
        {block.items.map((it, i) => (
          <li key={i}>{it.over} <span className="text-muted">over</span> {it.base}</li>
        ))}
      </ul>
    );
  }
  return null;
}

export function AskAnswer({result, navigate}) {
  if (result.kind === "matches") {
    return (
      <div className="flex flex-col gap-1">
        {result.matches.map((m) => (
          <Button key={m.type + m.id} variant="ghost" className="h-auto justify-start gap-3 px-2 py-2"
            onPress={() => navigate({path: m.path, patch: {}})}>
            <Chip size="sm" variant="secondary">{m.type}</Chip>
            <span className="font-semibold">{m.label}</span>
            <span className="font-mono text-[11px] text-muted">{m.sub}</span>
          </Button>
        ))}
      </div>
    );
  }
  const isMiss = result.kind === "miss";
  return (
    <Card className="gap-3 p-5">
      <Card.Content className="gap-3 p-0">
        <p className="m-0 text-sm leading-relaxed">{result.text}</p>
        {!isMiss && result.evidence.map((b, i) => <Evidence key={i} block={b} navigate={navigate} />)}
        {isMiss && (
          <>
            <ul className="my-2 list-disc pl-4.5 text-sm text-muted">
              {result.canAnswer.map((c) => <li key={c}>{c}</li>)}
            </ul>
            {result.matches.length > 0 && <AskAnswer result={{kind: "matches", matches: result.matches}} navigate={navigate} />}
          </>
        )}
        {!isMiss && result.links.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-3">
            {result.links.map((l) => (
              <Button key={l.path} size="sm" variant="ghost" onPress={() => {
                const [path, search] = l.path.split("?");
                const patch = search ? Object.fromEntries(new URLSearchParams(search)) : {};
                navigate({path, patch});
              }}>{l.label}</Button>
            ))}
          </div>
        )}
        {!isMiss && (
          <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted">
            {result.freshness ? `b${result.freshness.build}${result.freshness.ageDays != null ? ` · observed ${result.freshness.ageDays}d ago` : ""} · ` : ""}
            {PROVENANCE}
          </p>
        )}
      </Card.Content>
    </Card>
  );
}
