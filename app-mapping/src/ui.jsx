import {Button, Card, Chip} from "@heroui/react";
import {EmptyState} from "@heroui-pro/react/empty-state";
import {Icon} from "@iconify/react";
import {Link} from "./link.jsx";
import {copyWithToast} from "./toast.jsx";

export const PAGE = "mx-auto w-full max-w-[1240px] px-4 pt-4 pb-16 md:px-8";
export const PAGE_WIDE = "mx-auto w-full max-w-[1440px] px-4 pt-4 pb-16 md:px-8";

export function GIcon({name, size = 16, className}) {
  return <Icon icon={`gravity-ui:${name}`} width={size} height={size} className={className} />;
}

export function NamedScreen({screen}) {
  if (!screen) return null;
  if (screen.label) return screen.label;
  return (
    <span className="italic font-normal text-muted border-b border-dashed border-muted/40">
      {screen.derivedLabel}
    </span>
  );
}

export function freshness(build, ageDays, fallback = "not observed") {
  if (!build) return fallback;
  return `b${build}${ageDays != null ? ` · ${ageDays}d` : ""}`;
}

export const VARIANT_COLOR = {ERROR: "danger", EMPTY: "warning", LOADING: "accent"};

const DOT = {fresh: "bg-success", stale: "bg-warning", thin: "bg-accent", none: "bg-default"};

export function StatusDot({state}) {
  return <span className={`inline-block size-2 shrink-0 rounded-full ${DOT[state] ?? DOT.none}`} />;
}

export function CopyKey({value, short}) {
  const shown = short ? `#${value.split("#")[1] ?? value}` : value;
  return (
    <Button size="sm" variant="ghost" className="font-mono text-xs"
      onPress={() => copyWithToast(value, "Key copied")}>
      {shown}
    </Button>
  );
}

export function PageHeader({chip, chipColor = "accent", id, title, description, actions}) {
  return (
    <section className="pt-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {chip ? (
            <Chip color={chipColor} size="sm" variant="soft">{chip}</Chip>
          ) : null}
          {id ? <span className="text-muted font-mono text-xs tracking-wide">{id}</span> : null}
        </div>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </div>
      <h1 className="text-foreground mt-5 text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
      {description ? (
        <p className="text-foreground/80 mt-4 max-w-2xl text-base leading-relaxed md:text-lg">
          {description}
        </p>
      ) : null}
    </section>
  );
}

export function StatCards({items}) {
  return (
    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="gap-3 p-5">
          <Card.Header className="p-0">
            <Card.Title className="text-sm font-normal text-muted">{item.label}</Card.Title>
          </Card.Header>
          <Card.Content className="p-0">
            <div className="flex items-baseline gap-2.5">
              <span className="text-3xl font-semibold tabular-nums text-foreground">{item.value}</span>
              {item.note ? (
                <span className={`text-sm font-medium ${item.tone ?? "text-muted"}`}>{item.note}</span>
              ) : item.sub ? (
                <span className="text-sm text-muted">{item.sub}</span>
              ) : null}
            </div>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}

export function CatalogList({title, meta, action, children}) {
  return (
    <Card className="mt-8 gap-0 p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-foreground text-lg font-semibold">{title}</h2>
          {meta ? <span className="text-muted text-sm">{meta}</span> : null}
        </div>
        {action}
      </div>
      <div className="flex flex-col gap-1 px-2 pb-2">
        {children}
      </div>
    </Card>
  );
}

export function CatalogRow({to, param, chip, chipColor = "default", title, description, meta, trailing, action}) {
  const inner = (
    <>
      {chip ? (
        <Chip className="mt-0.5 shrink-0" color={chipColor} size="sm" variant="soft">{chip}</Chip>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-[15px] font-medium leading-snug">{title}</p>
        {description ? (
          <p className="text-muted mt-1 text-sm leading-relaxed">{description}</p>
        ) : null}
        {meta ? <p className="text-muted mt-2 font-mono text-xs">{meta}</p> : null}
      </div>
      {trailing ? <span className="text-muted shrink-0 text-sm">{trailing}</span> : null}
    </>
  );
  const row = "bg-surface-secondary/70 flex items-start gap-4 rounded-xl px-4 py-4";
  if (to && !action) {
    return (
      <Link to={to} param={param} className={`${row} text-foreground no-underline`}>
        {inner}
      </Link>
    );
  }
  return (
    <div className={row}>
      {to ? (
        <Link to={to} param={param} className="flex min-w-0 flex-1 items-start gap-4 text-foreground no-underline">
          {inner}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-4">{inner}</div>
      )}
      {action}
    </div>
  );
}

export function EmptyPanel({icon = "square-dashed", title, description, action}) {
  return (
    <EmptyState>
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <GIcon name={icon} size={18} />
        </EmptyState.Media>
        <EmptyState.Title>{title}</EmptyState.Title>
        <EmptyState.Description>{description}</EmptyState.Description>
      </EmptyState.Header>
      {action ? <EmptyState.Content>{action}</EmptyState.Content> : null}
    </EmptyState>
  );
}
