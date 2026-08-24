import {Alert} from "@heroui/react";
import {Segment} from "@heroui-pro/react/segment";
import {DIRECTIONS} from "./direction.js";
import {ControlRoomLanding} from "./landing-control.jsx";
import {EvidenceWallLanding} from "./landing-evidence.jsx";
import {LedgerLanding} from "./landing-ledger.jsx";

const BODIES = {
  control: ControlRoomLanding,
  evidence: EvidenceWallLanding,
  ledger: LedgerLanding,
};

export function DirectionBar({direction, onChange}) {
  const active = DIRECTIONS.find((d) => d.id === direction) ?? DIRECTIONS[0];
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-separator px-8 py-2">
      <Segment size="sm" variant="ghost" selectedKey={active.id}
        onSelectionChange={(k) => onChange(String(k))} aria-label="Landing design direction">
        {DIRECTIONS.map((d) => (
          <Segment.Item key={d.id} id={d.id}>{d.label}</Segment.Item>
        ))}
      </Segment>
      <span className="text-sm text-muted">{active.blurb}</span>
    </div>
  );
}

export function Landing({direction, query, notes, navigate, onNavigate}) {
  const Body = BODIES[direction] ?? ControlRoomLanding;
  return (
    <>
      {notes?.length ? (
        <Alert status="warning" className="mx-8 mt-4">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{notes.join(" · ")}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      <Body key={direction} query={query} navigate={navigate} onNavigate={onNavigate} />
    </>
  );
}
