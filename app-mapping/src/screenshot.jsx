import {SCREENS} from "./fixtures.js";

// Deterministic wireframe placeholder — stands in for capture thumbnails.
// Shape is derived from the frozen key, so a screen always renders the same
// way across the reel, the catalog and the sheet.
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const LAYOUTS = ["hero", "list", "form", "map"];

/** Pure so the layout choice is testable without rendering. */
export function wireLayout(screenKey, kind) {
  const h = hash(screenKey);
  return {
    layout: kind === "OVERLAY" ? "sheet" : LAYOUTS[h % LAYOUTS.length],
    rows: 3 + (h % 3),
    seed: h,
  };
}

const INK = "color-mix(in oklab, currentColor 13%, transparent)";
const INK_SOFT = "color-mix(in oklab, currentColor 8%, transparent)";

function Bars({x, y, w, count, seed, gap = 9, h = 5}) {
  return Array.from({length: count}, (_, i) => (
    <rect key={i} x={x} y={y + i * gap} rx={2}
      width={w * (0.55 + (((seed >> (i * 3)) % 5) / 11))} height={h} fill={INK} />
  ));
}

export function WireScreenshot({screenKey, width = 88, height = 176, variant, kind}) {
  const screen = SCREENS[screenKey];
  const k = kind ?? screen?.kind ?? "SCREEN";
  const {layout, rows, seed} = wireLayout(screenKey, k);
  const pad = Math.max(5, Math.round(width * 0.07));
  const inner = width - pad * 2;
  const isError = variant === "ERROR";
  const isEmpty = variant === "EMPTY";
  const isLoading = variant === "LOADING";
  const body = [];
  let y = Math.round(height * 0.115);

  if (isEmpty) {
    body.push(
      <g key="empty" opacity={0.8}>
        <circle cx={width / 2} cy={height * 0.42} r={Math.max(7, width * 0.11)}
          fill="none" stroke={INK} strokeWidth={1.5} />
        <rect x={width * 0.26} y={height * 0.55} width={width * 0.48} height={5} rx={2.5} fill={INK} />
      </g>,
    );
  } else if (isLoading) {
    for (let i = 0; i < 4; i++) {
      body.push(<rect key={`l${i}`} x={pad} y={y + i * 14} width={inner} height={9} rx={3} fill={INK_SOFT} />);
    }
  } else {
    if (layout === "hero" || layout === "map") {
      body.push(
        <rect key="hero" x={pad} y={y} width={inner} height={Math.round(height * 0.24)} rx={4}
          fill={layout === "map" ? INK_SOFT : INK} />,
      );
      if (layout === "map") {
        body.push(<path key="route" d={`M${pad + 6} ${y + height * 0.19} q ${inner * 0.3} -${height * 0.13} ${inner * 0.55} -${height * 0.04} t ${inner * 0.34} -${height * 0.07}`}
          fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />);
      }
      y += Math.round(height * 0.24) + 10;
      body.push(<Bars key="b" x={pad} y={y} w={inner} count={rows} seed={seed} />);
    } else if (layout === "list") {
      for (let i = 0; i < rows + 1; i++) {
        const ry = y + i * Math.round(height * 0.115);
        if (ry > height * 0.78) break;
        body.push(
          <g key={`r${i}`}>
            <rect x={pad} y={ry} width={Math.round(height * 0.075)} height={Math.round(height * 0.075)} rx={3} fill={INK} />
            <rect x={pad + Math.round(height * 0.075) + 5} y={ry + 2} rx={2}
              width={(inner - height * 0.075 - 5) * (0.55 + (((seed >> i) % 4) / 9))} height={4.5} fill={INK} />
            <rect x={pad + Math.round(height * 0.075) + 5} y={ry + 10} rx={2}
              width={(inner - height * 0.075 - 5) * 0.4} height={4} fill={INK_SOFT} />
          </g>,
        );
      }
    } else {
      for (let i = 0; i < rows; i++) {
        const ry = y + i * Math.round(height * 0.135);
        if (ry > height * 0.72) break;
        body.push(
          <g key={`f${i}`}>
            <rect x={pad} y={ry} width={inner * 0.34} height={4} rx={2} fill={INK_SOFT} />
            <rect x={pad} y={ry + 8} width={inner} height={Math.round(height * 0.075)} rx={3}
              fill="none" stroke={INK} strokeWidth={1} />
          </g>,
        );
      }
    }
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="am-shot"
      role="img" aria-label={`${screen?.label ?? screen?.derivedLabel ?? screenKey} capture`}>
      {/* status bar */}
      <rect x={width * 0.34} y={Math.max(4, height * 0.028)} width={width * 0.32} height={3} rx={1.5} fill={INK_SOFT} />

      {body}

      {isError && (
        <g>
          <rect x={pad} y={height * 0.62} width={inner} height={Math.round(height * 0.1)} rx={4}
            fill="color-mix(in oklab, var(--danger) 20%, transparent)" />
          <rect x={pad + 5} y={height * 0.655} width={inner * 0.6} height={4} rx={2}
            fill="color-mix(in oklab, var(--danger) 70%, transparent)" />
        </g>
      )}

      {layout === "sheet" && (
        <g>
          <rect x={0} y={0} width={width} height={height} rx={11}
            fill="color-mix(in oklab, currentColor 12%, transparent)" />
          <rect x={pad * 0.6} y={height * 0.44} width={width - pad * 1.2} height={height * 0.56} rx={9}
            fill="var(--surface)" stroke={INK} strokeWidth={1} />
          <rect x={width * 0.42} y={height * 0.48} width={width * 0.16} height={3} rx={1.5} fill={INK} />
          <Bars x={pad + 2} y={height * 0.56} w={inner - 4} count={2} seed={seed} gap={11} />
        </g>
      )}

      {/* primary action */}
      {!isEmpty && (
        <rect x={pad} y={height - Math.round(height * 0.13)} width={inner}
          height={Math.round(height * 0.075)} rx={Math.round(height * 0.0375)}
          fill="color-mix(in oklab, var(--accent) 26%, transparent)" />
      )}
    </svg>
  );
}
