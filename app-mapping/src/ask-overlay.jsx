import {useEffect, useState} from "react";
import {Chip, Kbd} from "@heroui/react";
import {Command} from "@heroui-pro/react/command";
import {SUGGESTIONS, ask, entityMatches} from "./ask.js";
import {AskAnswer} from "./ask-answer.jsx";
import {GIcon} from "./ui.jsx";

const RECENTS_KEY = "am.asks";
const TYPE_ICON = {screen: "square-list-ul", journey: "route", lane: "layers-3-diagonal", build: "cube"};

function readRecents() {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]").slice(0, 4); }
  catch { return []; }
}

function rememberAsk(text) {
  try {
    const next = [text, ...readRecents().filter((t) => t !== text)].slice(0, 4);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch { /* private mode */ }
}

export function AskOverlay({open, onClose, navigate}) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [recents, setRecents] = useState(readRecents);

  useEffect(() => {
    if (open) { setInput(""); setResult(null); setRecents(readRecents()); }
  }, [open]);

  const typed = input.trim();
  const live = typed.length >= 2 && !result ? entityMatches(input) : [];
  const go = (args) => { onClose(); navigate(args); };
  const run = (text) => {
    if (!text.trim()) return;
    rememberAsk(text.trim());
    setInput(text);
    setResult(ask(text, new Date()));
  };

  return (
    <Command>
      <Command.Backdrop isOpen={open} variant="blur" onOpenChange={(v) => { if (!v) onClose(); }}>
        <Command.Container size="lg">
          <Command.Dialog
            inputValue={input}
            onInputChange={(v) => { setInput(v); setResult(null); }}>
            <Command.InputGroup>
              <Command.InputGroup.Prefix>
                <GIcon name="magnifier" size={16} />
              </Command.InputGroup.Prefix>
              <Command.InputGroup.Input
                placeholder="Ask the map, or jump to a screen, journey, lane, or build…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && typed && live.length === 0) {
                    e.preventDefault();
                    run(input);
                  }
                }} />
              <Command.InputGroup.ClearButton />
            </Command.InputGroup>

            {!result && (
              <Command.List renderEmptyState={() => (
                <div className="px-3.5 py-4 text-sm leading-relaxed text-muted">
                  Nothing in the map matches that name. Press <b>Enter</b> to ask it as a question
                  instead — the answer will cite what it read.
                </div>
              )}>
                {typed ? (
                  <Command.Group heading="Ask">
                    <Command.Item textValue={`Ask the map ${input}`} onAction={() => run(input)}>
                      <GIcon name="magnifier" size={14} />
                      <span>Ask the map</span>
                      <Chip size="sm" variant="secondary" className="ml-auto">Enter</Chip>
                    </Command.Item>
                  </Command.Group>
                ) : null}

                {live.length > 0 ? (
                  <Command.Group heading="Jump to">
                    {live.map((m) => (
                      <Command.Item key={m.type + m.id} textValue={`${m.label} ${m.sub}`}
                        onAction={() => go({path: m.path, patch: {}})}>
                        <GIcon name={TYPE_ICON[m.type] ?? "square-dashed"} size={14} />
                        <span className="font-semibold">{m.label}</span>
                        <span className="font-mono text-[11px] text-muted">{m.sub}</span>
                        <Chip size="sm" variant="secondary" className="ml-auto">{m.type}</Chip>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null}

                {!typed && recents.length > 0 ? (
                  <Command.Group heading="Recent">
                    {recents.map((r) => (
                      <Command.Item key={r} textValue={r} onAction={() => run(r)}>
                        <GIcon name="clock-arrow-rotate-left" size={14} />
                        <span>{r}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null}

                {!typed ? (
                  <Command.Group heading="The map can answer">
                    {SUGGESTIONS.map((s) => (
                      <Command.Item key={s} textValue={s} onAction={() => run(s)}>
                        <GIcon name="nodes-right" size={14} />
                        <span>{s}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null}
              </Command.List>
            )}

            {result && (
              <div className="max-h-[52vh] overflow-y-auto px-3.5 pt-2.5 pb-4">
                <AskAnswer result={result} navigate={go} />
              </div>
            )}

            <Command.Footer className="justify-between">
              <span className="flex items-center gap-2.5 text-[11px] text-muted">
                <span className="flex items-center gap-1.5">
                  <Kbd><Kbd.Content>↑</Kbd.Content></Kbd>
                  <Kbd><Kbd.Content>↓</Kbd.Content></Kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1.5">
                  <Kbd><Kbd.Abbr keyValue="enter" /></Kbd> ask
                </span>
                <span className="flex items-center gap-1.5">
                  <Kbd><Kbd.Content>Esc</Kbd.Content></Kbd> close
                </span>
              </span>
              <span className="text-[11px] text-muted">
                answers cite the published map
              </span>
            </Command.Footer>
          </Command.Dialog>
        </Command.Container>
      </Command.Backdrop>
    </Command>
  );
}
