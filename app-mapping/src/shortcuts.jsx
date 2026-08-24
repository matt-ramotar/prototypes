import {useEffect, useRef} from "react";
import {Kbd, Modal} from "@heroui/react";
import {BUILDS} from "./fixtures.js";
import {GIcon} from "./ui.jsx";

const GOTO = {a: "/", t: "/", s: "/screens", j: "/journeys", l: "/lanes",
  b: "/builds", r: "/reports"};

export const SHORTCUTS = [
  {keys: "⌘K", label: "Ask the Map"},
  {keys: "g then a", label: "Go to Territory"},
  {keys: "g then t", label: "Go to Territory"},
  {keys: "g then s", label: "Go to Screens"},
  {keys: "g then j", label: "Go to Journeys"},
  {keys: "g then l", label: "Go to Lanes"},
  {keys: "g then b", label: "Go to Builds"},
  {keys: "g then r", label: "Go to Reports"},
  {keys: "[  /  ]", label: "Step the build back / forward"},
  {keys: "c", label: "Copy permalink"},
  {keys: "?", label: "This list"},
];

const isTyping = (el) =>
  el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable ||
    el.getAttribute?.("role") === "combobox");

/**
 * Keyboard control for the whole app. Chords (`g` then a letter) mirror the
 * conventions engineers already have in their fingers from GitHub and Linear.
 */
export function useShortcuts({navigate, query, onAsk, onHelp, onCopyLink}) {
  const chord = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    const clearChord = () => { chord.current = null; clearTimeout(timer.current); };

    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); onAsk(); return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(document.activeElement)) return;
      if (document.querySelector("[role='dialog']") && e.key !== "Escape") return;

      const k = e.key;

      if (chord.current === "g") {
        clearChord();
        const path = GOTO[k.toLowerCase()];
        if (path) { e.preventDefault(); navigate({path, patch: {}}); }
        return;
      }

      if (k === "g") {
        chord.current = "g";
        timer.current = setTimeout(clearChord, 1200);
        return;
      }

      if (k === "?") { e.preventDefault(); onHelp(); return; }
      if (k === "c") { e.preventDefault(); onCopyLink(); return; }

      if (k === "[" || k === "]") {
        const i = BUILDS.indexOf(query.build ?? BUILDS.at(-1));
        const next = BUILDS[k === "[" ? i - 1 : i + 1];
        if (next) { e.preventDefault(); navigate({patch: {...query, build: next}}); }
        return;
      }

    };

    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(timer.current); };
  }, [navigate, query, onAsk, onHelp, onCopyLink]);
}

export function ShortcutsModal({isOpen, onOpenChange}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} variant="blur">
      <Modal.Container size="sm">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Icon className="bg-default text-foreground">
              <GIcon name="keyboard" size={18} />
            </Modal.Icon>
            <Modal.Heading>Keyboard</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-2">
            {SHORTCUTS.map((s) => (
              <div key={s.keys} className="flex items-center justify-between gap-4 text-sm">
                <span>{s.label}</span>
                <Kbd><Kbd.Content>{s.keys}</Kbd.Content></Kbd>
              </div>
            ))}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
