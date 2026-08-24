import {Card, Chip} from "@heroui/react";
import {WireScreenshot} from "./screenshot.jsx";
import {CopyKey, NamedScreen, VARIANT_COLOR} from "./ui.jsx";

function StackVisual({step}) {
  const base = step.baseScreen;
  const overlays = step.stack.slice(0, -1);
  const primaryVariant = step.variants.find((v) => v !== "POPULATED") ?? step.variants[0];
  return (
    <div className="relative h-[176px] w-[88px]">
      <WireScreenshot screenKey={base.key} kind="SCREEN" variant={primaryVariant} />
      {overlays.length > 0 && (
        <>
          <div className="absolute inset-0 rounded-[11px] bg-foreground/20" />
          <div className="absolute top-10 right-[-10px] left-2.5 rounded-lg bg-overlay px-2 py-1.5 text-[9.5px] leading-snug shadow-overlay">
            {overlays.map((o) => (
              <div key={o.key} className={step.occluded.includes(o.key) ? "opacity-45" : ""}>
                <NamedScreen screen={o} />
                {step.occluded.includes(o.key) && <span className="text-muted"> · occluded</span>}
              </div>
            ))}
          </div>
          <span className="am-stack-badge">{step.stack.length}</span>
        </>
      )}
    </div>
  );
}

export function ScreenCard({step, answer, onOpen}) {
  const base = step.baseScreen;
  const overlays = step.stack.slice(0, -1);
  return (
    <Card className="w-[112px] gap-2 p-2">
      <button type="button" className="text-left" onClick={() => onOpen(step.stack[0].key)}>
        <StackVisual step={step} />
        <span className="mt-2 block text-xs font-medium leading-snug">
          {overlays.length > 0
            ? <><NamedScreen screen={overlays[0]} />{" "}
              <span className="font-normal text-muted">over</span>{" "}
              <NamedScreen screen={base} /></>
            : <NamedScreen screen={base} />}
        </span>
      </button>
      <CopyKey short value={step.stack[0].key} />
      <span className="flex flex-wrap gap-1">
        {step.variants.map((v) => (
          <Chip key={v} size="sm" color={VARIANT_COLOR[v] ?? "default"}
            variant={VARIANT_COLOR[v] ? "soft" : "secondary"}>
            {v}
          </Chip>
        ))}
      </span>
      <span className="font-mono text-[10px] text-muted">
        b{answer.given.build} · {answer.obsCount} obs
      </span>
    </Card>
  );
}
