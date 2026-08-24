import {useCallback, useEffect, useLayoutEffect, useRef, useState} from "react";
import {WireScreenshot} from "./screenshot.jsx";
import {fitTransform, zoomAt} from "./thread-layout.js";
import {Button, Tooltip} from "@heroui/react";
import {GIcon, NamedScreen} from "./ui.jsx";

const ZOOM_STEP = 1.22;

/** Screen-space delta -> world-space, so panning feels 1:1 at every zoom level. */
const pan = (view, dx, dy) => ({...view, x: view.x + dx, y: view.y + dy});

function useViewport(ref) {
  const [size, setSize] = useState({width: 0, height: 0});
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const {width, height} = entry.contentRect;
      setSize((prev) => (prev.width === width && prev.height === height ? prev : {width, height}));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function Node({node, box, state, dim, active, onHover, onSelect}) {
  const screen = node.screen;
  return (
    <button
      type="button"
      className="am-tnode"
      data-state={state}
      data-kind={screen.kind}
      data-dim={dim ? "true" : undefined}
      data-active={active ? "true" : undefined}
      style={{left: box.x, top: box.y, width: box.w, height: box.h}}
      onMouseEnter={() => onHover(node.key)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(node.key)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(node.key)}>
      <span className="am-tnode-shot">
        <WireScreenshot screenKey={node.key} width={72} height={112} kind={screen.kind} />
      </span>
      <span className="am-tnode-name"><NamedScreen screen={screen} /></span>
      <span className="am-tnode-phase">{screen.phase}</span>
    </button>
  );
}

export function ThreadCanvas({
  layout, stateOf, highlight, selected, onSelect, onHover, hovered, fitToken,
}) {
  const shellRef = useRef(null);
  const viewport = useViewport(shellRef);
  const [view, setView] = useState({scale: 1, x: 0, y: 0});
  const drag = useRef(null);

  const fit = useCallback(() => {
    if (viewport.width === 0) return;
    setView(fitTransform(layout.bounds, viewport));
  }, [layout.bounds, viewport]);

  // Refit whenever the graph or the box changes shape; fitToken lets the parent ask.
  useEffect(fit, [fit, fitToken]);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const point = {x: e.clientX - rect.left, y: e.clientY - rect.top};
      if (e.ctrlKey || e.metaKey) {
        setView((v) => zoomAt(v, point, Math.pow(ZOOM_STEP, -e.deltaY / 100)));
      } else {
        setView((v) => pan(v, -e.deltaX, -e.deltaY));
      }
    };
    el.addEventListener("wheel", onWheel, {passive: false});
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e) => {
    if (e.target.closest(".am-tnode")) return;
    drag.current = {id: e.pointerId, x: e.clientX, y: e.clientY};
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setView((v) => pan(v, e.clientX - d.x, e.clientY - d.y));
    drag.current = {...d, x: e.clientX, y: e.clientY};
  };
  const endDrag = (e) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  const nudge = (factor) => {
    const c = {x: viewport.width / 2, y: viewport.height / 2};
    setView((v) => zoomAt(v, c, factor));
  };

  const onKeyDown = (e) => {
    const step = e.shiftKey ? 240 : 80;
    const moves = {ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step]};
    if (moves[e.key]) {
      e.preventDefault();
      setView((v) => pan(v, ...moves[e.key]));
    } else if (e.key === "+" || e.key === "=") { e.preventDefault(); nudge(ZOOM_STEP); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); nudge(1 / ZOOM_STEP); }
    else if (e.key === "0" || e.key === "f") { e.preventDefault(); fit(); }
  };

  const at = new Map(layout.nodes.map((n) => [n.key, n]));
  const lit = highlight;

  return (
    <div className="am-tcanvas" ref={shellRef}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={endDrag} onPointerCancel={endDrag}
      onKeyDown={onKeyDown} tabIndex={0} role="application"
      aria-label="Thread map canvas — arrow keys pan, plus and minus zoom, f fits">
      <div className="am-tworld"
        style={{transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`}}>

        {layout.lanes.map((lane) => (
          <div key={lane.journeyId} className="am-tlane"
            style={{top: lane.y, height: lane.height, width: lane.width}}>
            <span className="am-tlane-label">
              {lane.label}
              <span className="am-tlane-team">{lane.team}</span>
            </span>
          </div>
        ))}

        <svg className="am-tedges" width={layout.bounds.width} height={layout.bounds.height}
          aria-hidden focusable="false">
          <defs>
            <marker id="am-arrow" viewBox="0 0 8 8" refX="7" refY="4"
              markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 7 4 L 0 7 z" fill="context-stroke" />
            </marker>
          </defs>
          {layout.edges.map((e) => {
            const on = lit == null || lit.edges.has(e.id);
            return (
              <path key={e.id} d={e.path}
                className="am-tedge"
                data-state={e.state}
                data-declared={e.declared ? "true" : "false"}
                data-traversable={e.traversable ? "true" : "false"}
                data-dim={on ? undefined : "true"}
                markerEnd={e.traversable ? "url(#am-arrow)" : undefined} />
            );
          })}
        </svg>

        {layout.nodes.map((n) => {
          const node = at.get(n.key);
          return (
            <Node key={n.key} node={{key: n.key, screen: stateOf(n.key).screen}} box={n}
              state={stateOf(n.key).state}
              dim={lit != null && !lit.nodes.has(n.key)}
              active={selected === n.key || hovered === n.key}
              onHover={onHover} onSelect={onSelect} />
          );
        })}
      </div>

      <div className="am-tzoom">
        <Tooltip>
          <Tooltip.Trigger>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Zoom in"
              onPress={() => nudge(ZOOM_STEP)}>
              <GIcon name="plus" size={14} />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>Zoom in</Tooltip.Content>
        </Tooltip>
        <Tooltip>
          <Tooltip.Trigger>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Zoom out"
              onPress={() => nudge(1 / ZOOM_STEP)}>
              <GIcon name="minus" size={14} />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>Zoom out</Tooltip.Content>
        </Tooltip>
        <Tooltip>
          <Tooltip.Trigger>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Fit to view" onPress={fit}>
              <GIcon name="square-dashed" size={14} />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>Fit to view</Tooltip.Content>
        </Tooltip>
        <span className="min-w-[42px] px-1.5 text-right font-mono text-[11px] text-muted">
          {Math.round(view.scale * 100)}%
        </span>
      </div>
    </div>
  );
}
