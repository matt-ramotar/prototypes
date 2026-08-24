import {Button, Chip, Separator} from "@heroui/react";
import {Sheet} from "@heroui-pro/react/sheet";
import {useState} from "react";
import {BUILDS, EDGES, OBSERVATIONS, SCREENS} from "./fixtures.js";
import {WireScreenshot} from "./screenshot.jsx";
import {screenOccurrences} from "./screen-sheet-view.js";
import {CopyKey, GIcon, NamedScreen, VARIANT_COLOR} from "./ui.jsx";

export function ScreenSheet({screenKey, answer, onClose, navigate}) {
  const screen = SCREENS[screenKey];
  const [buildIdx, setBuildIdx] = useState(BUILDS.length - 1);
  if (!screen) return null;

  const {occurrences, compositions, variantUnion, isBase} = screenOccurrences(answer, screenKey);
  const inEdges = EDGES.filter((e) => e.to === screenKey);
  const outEdges = EDGES.filter((e) => e.from === screenKey);
  const captures = OBSERVATIONS.filter((ob) =>
    ob.walk.some((w) => w.stack.includes(screenKey)));

  return (
    <Sheet isOpen onOpenChange={(open) => { if (!open) onClose(); }} placement="right">
      <Sheet.Backdrop>
        <Sheet.Content className="w-[420px]">
          <Sheet.Dialog>
            <Sheet.Header>
              <Sheet.Heading>
                <NamedScreen screen={screen} />
              </Sheet.Heading>
              {navigate ? (
                <Button size="sm" variant="ghost" onPress={() => { onClose(); navigate({path: `/screens/${encodeURIComponent(screen.key)}`, patch: {}}); }}>
                  Full page
                  <GIcon name="arrow-right" size={14} />
                </Button>
              ) : null}
              <Sheet.CloseTrigger />
            </Sheet.Header>
            <Sheet.Body className="flex flex-col gap-4">
              <CopyKey value={screen.key} />
              {!screen.label && screen.suggestedLabel && (
                <p className="text-sm text-muted">
                  suggested: “{screen.suggestedLabel}” · model-proposed, provisional — naming flows through the registry
                </p>
              )}

              <div className="flex gap-3">
                <WireScreenshot screenKey={screen.key} width={140} height={280} variantSeed={BUILDS[buildIdx]} />
                <div>
                  <div className="text-xs font-medium text-muted">Full resolution</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {BUILDS.map((b, i) => (
                      <Button key={b} size="sm" variant={i === buildIdx ? "secondary" : "ghost"}
                        onPress={() => setBuildIdx(i)}>b{b}</Button>
                    ))}
                  </div>
                  <p className="mt-2 max-w-[200px] text-xs text-muted">
                    current + previous build kept hot; older tiers cold, never deleted
                  </p>
                </div>
              </div>

              {occurrences.length > 0 ? (
                <>
                  {compositions.map(({signature, step: s}, i) => (
                    <div key={signature}>
                      {compositions.length > 1 && (
                        <p className="text-xs text-muted">
                          observed composition {i + 1} of {compositions.length}
                        </p>
                      )}
                      <div className="text-xs font-medium text-muted">Stack · top-first</div>
                      <ol className="mt-1.5 mb-2 list-decimal pl-5 text-sm">
                        {s.stack.map((n) => (
                          <li key={n.key}>
                            <NamedScreen screen={n} />
                            {s.occluded.includes(n.key) && <span className="text-muted"> · occluded</span>}
                            {n.kind === "SCREEN" && <span className="text-muted"> · base</span>}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                  {isBase && (
                    <div>
                      <div className="text-xs font-medium text-muted">Variant set</div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {variantUnion.map((v) => (
                          <Chip key={v} size="sm" color={VARIANT_COLOR[v] ?? "default"}
                            variant={VARIANT_COLOR[v] ? "soft" : "secondary"}>
                            {v}
                          </Chip>
                        ))}
                        <span className="text-xs text-muted">
                          · {answer.obsCount} {answer.obsCount === 1 ? "observation" : "observations"}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted">
                  Not in this answer's walk — this screen was observed under a different Given (another
                  lane, build, or comparison side). Stack and variant data belong to the Given that observed
                  it; edges and captures below are map-wide.
                </p>
              )}

              <div>
                <div className="text-xs font-medium text-muted">Edges</div>
                <ul className="mt-1.5 list-disc pl-5 text-sm">
                  {inEdges.map((e) => (
                    <li key={e.from}>in · {e.role.toLowerCase()} from <NamedScreen screen={SCREENS[e.from]} />
                      {!e.traversable && <span className="text-danger"> · non-traversable</span>}</li>
                  ))}
                  {outEdges.map((e) => (
                    <li key={e.to}>out · {e.role.toLowerCase()} to <NamedScreen screen={SCREENS[e.to]} />
                      {!e.traversable && <span className="text-danger"> · non-traversable</span>}</li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="text-xs font-medium text-muted">Captures</div>
                <ul className="mt-1.5 list-disc pl-5 font-mono text-xs text-muted">
                  {captures.map((ob) => (
                    <li key={ob.runId}>b{ob.build} · {ob.lane} · {ob.market} · {ob.runId}</li>
                  ))}
                </ul>
              </div>

              <Separator />
              <p className="text-xs text-muted">
                Pulse signals — slot reserved (PR11) · empty in v1
              </p>
            </Sheet.Body>
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
}
