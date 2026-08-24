import {Chip} from "@heroui/react";
import {STATUS_LABEL} from "./report-view.js";
import {GIcon} from "./ui.jsx";

export const STATUS_META = {
  pass: {icon: "circle-check-fill", tone: "success"},
  fail: {icon: "circle-xmark-fill", tone: "danger"},
  flaky: {icon: "arrows-rotate-right", tone: "warning"},
  review: {icon: "eye", tone: "accent"},
  blocked: {icon: "ban", tone: "muted"},
  skip: {icon: "circle-minus", tone: "faint"},
  running: {icon: "circle-dashed", tone: "accent"},
  queued: {icon: "clock", tone: "faint"},
};

const CHIP_COLOR = {success: "success", danger: "danger", warning: "warning",
  accent: "accent", muted: "default", faint: "default"};

const ICON = {
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
  accent: "text-accent",
  muted: "text-muted",
  faint: "text-muted/60",
};

const BAR = {
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  accent: "bg-accent",
  muted: "bg-muted",
  faint: "bg-default",
};

export function StatusIcon({status, size = 15}) {
  const meta = STATUS_META[status] ?? STATUS_META.queued;
  return (
    <GIcon name={meta.icon} size={size}
      className={`${ICON[meta.tone]} ${status === "running" ? "animate-pulse" : ""}`} />
  );
}

export function StatusChip({status}) {
  const meta = STATUS_META[status] ?? STATUS_META.queued;
  return (
    <Chip size="sm" color={CHIP_COLOR[meta.tone]} variant="soft">
      {STATUS_LABEL[status] ?? status}
    </Chip>
  );
}

export function StatusBar({segments, total}) {
  return (
    <span className="flex h-1.5 w-28 overflow-hidden rounded-full bg-surface-tertiary" role="img"
      aria-label={segments.map((s) => `${s.count} ${STATUS_LABEL[s.status]}`).join(", ")}>
      {segments.map((s) => (
        <span key={s.status} className={BAR[STATUS_META[s.status]?.tone] ?? BAR.faint}
          style={{flexGrow: s.count / total, minWidth: 3}} />
      ))}
    </span>
  );
}
