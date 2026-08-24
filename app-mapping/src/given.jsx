import {Button, Dropdown} from "@heroui/react";
import {GIcon} from "./ui.jsx";

/**
 * A single slot in the Given/When sentence. Reads as a word until opened,
 * then every term stays editable. `onCompare` adds a second section so a
 * pivot is one hop away from the same menu.
 */
export function Token({value, display, options, onSelect, onCompare, mono, tone = "default",
  placeholder = "any"}) {
  const label = display ?? value ?? placeholder;
  const selected = value == null ? null : String(value);
  return (
    <Dropdown>
      <Dropdown.Trigger>
        <Button size="sm" variant={tone === "accent" ? "secondary" : "ghost"}
          className={mono ? "font-mono" : undefined}
          aria-label={`${label}, change`}>
          {label}
          <GIcon name="chevron-down" size={11} />
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Popover>
        <Dropdown.Menu
          selectedKeys={selected ? new Set([selected]) : new Set()}
          selectionMode="single"
          onAction={(key) => {
            const id = String(key);
            if (id.startsWith("compare:")) onCompare?.(id.slice(8));
            else onSelect(id);
          }}>
          {options.map((opt) => {
            const id = String(opt.id ?? opt);
            const optLabel = opt.label ?? opt;
            return (
              <Dropdown.Item key={id} id={id} textValue={optLabel}>
                {optLabel}
                {opt.sub ? <span className="block text-xs text-muted">{opt.sub}</span> : null}
              </Dropdown.Item>
            );
          })}
          {onCompare && selected != null ? (
            <Dropdown.Section title="Compare with">
              {options.map((opt) => {
                const id = String(opt.id ?? opt);
                if (id === selected) return null;
                const optLabel = opt.label ?? opt;
                return (
                  <Dropdown.Item key={`compare:${id}`} id={`compare:${id}`}
                    textValue={`Compare ${optLabel}`}>
                    {optLabel}
                  </Dropdown.Item>
                );
              })}
            </Dropdown.Section>
          ) : null}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

export function Sentence({children}) {
  return <div className="flex flex-wrap items-center gap-1.5">{children}</div>;
}

export function SentenceLead({children}) {
  return <span className="text-sm text-muted">{children}</span>;
}
