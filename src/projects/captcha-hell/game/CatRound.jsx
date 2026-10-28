import { useEffect, useRef, useState } from 'react';
import CatArt from './CatArt.jsx';
import { CAT_SPACE, scorePetting, zoneFromPoint } from './petMetrics.js';

const ANCHORS = {
  head: { x: 112, y: 86 },
  back: { x: 112, y: 160 },
  belly: { x: 112, y: 210 },
  tail: { x: 200, y: 170 },
};

function zoneForKey(key) {
  if (key === 'ArrowUp') return 'head';
  if (key === 'ArrowDown') return 'belly';
  if (key === 'ArrowLeft') return 'tail';
  if (key === 'ArrowRight' || key === ' ' || key === 'Spacebar') return 'back';
  return null;
}

function trailOf(points) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
}

export default function CatRound({ onComplete, onAnnounce }) {
  const stageRef = useRef(null);
  const strokesRef = useRef([]);
  const activeRef = useRef(null);
  const readyAt = useRef(0);
  const frameRef = useRef(0);
  const mountedRef = useRef(true);
  const [live, setLive] = useState(() => scorePetting([]));
  const [trails, setTrails] = useState([]);

  const publish = (strokes) => {
    setLive(scorePetting(strokes, { readyAt: readyAt.current }));
    setTrails(strokes.slice(-8).map((stroke) => trailOf(stroke.points)));
  };

  useEffect(() => {
    mountedRef.current = true;
    readyAt.current = performance.now();
    stageRef.current?.focus();
    const stage = stageRef.current;
    if (!stage) return undefined;
    const blockScroll = (event) => {
      if (activeRef.current && event.cancelable) event.preventDefault();
    };
    stage.addEventListener('touchmove', blockScroll, { passive: false });
    return () => {
      mountedRef.current = false;
      stage.removeEventListener('touchmove', blockScroll);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const closeActive = () => {
    const active = activeRef.current;
    if (!active) return;
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }
    if (active.points.length < 2) {
      const last = active.points[active.points.length - 1];
      active.points.push({
        x: last.x + 28,
        y: last.y,
        t: last.t + 120,
        zone: active.zone,
      });
    }
    const counts = { head: 0, back: 0, belly: 0, tail: 0 };
    active.points.forEach((point) => {
      counts[point.zone] += 1;
    });
    const zone = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    strokesRef.current = [
      ...strokesRef.current,
      { zone, points: active.points.map(({ x, y, t }) => ({ x, y, t })) },
    ];
    activeRef.current = null;
    publish(strokesRef.current);
  };

  const localPoint = (event) => {
    const rect = stageRef.current.getBoundingClientRect();
    const width = rect.width || CAT_SPACE.w;
    const height = rect.height || CAT_SPACE.h;
    const x = ((event.clientX - rect.left) / width) * CAT_SPACE.w;
    const y = ((event.clientY - rect.top) / height) * CAT_SPACE.h;
    return { x, y, t: performance.now(), zone: zoneFromPoint(x, y) };
  };

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    stageRef.current.focus();
    closeActive();
    try {
      stageRef.current.setPointerCapture?.(event.pointerId);
    } catch {
      // jsdom
    }
    const point = localPoint(event);
    activeRef.current = { zone: point.zone, points: [point] };
  };

  const onPointerMove = (event) => {
    const active = activeRef.current;
    if (!active) return;
    const samples = event.getCoalescedEvents?.() ?? [event];
    samples.forEach((sample) => {
      active.points.push(localPoint(sample));
    });
    if (active.points.length % 3 === 0) {
      const preview = [
        ...strokesRef.current,
        { zone: active.zone, points: active.points },
      ];
      setLive(scorePetting(preview, { readyAt: readyAt.current }));
      setTrails([
        ...strokesRef.current.slice(-7).map((stroke) => trailOf(stroke.points)),
        trailOf(active.points),
      ]);
    }
  };

  const onPointerUp = (event) => {
    if (!activeRef.current) return;
    closeActive();
    try {
      if (stageRef.current.hasPointerCapture?.(event.pointerId)) {
        stageRef.current.releasePointerCapture(event.pointerId);
      }
    } catch {
      // ignore
    }
  };

  const stepHeld = (zone, timestamp) => {
    const active = activeRef.current;
    if (!mountedRef.current || !active || active.zone !== zone) return;
    const anchor = ANCHORS[zone];
    const index = active.points.length;
    active.points.push({
      x: anchor.x + ((index * 7) % 24) - 12,
      y: anchor.y + ((index * 5) % 16) - 8,
      t: timestamp,
      zone,
    });
    const preview = [...strokesRef.current, { zone, points: active.points }];
    setLive(scorePetting(preview, { readyAt: readyAt.current }));
    frameRef.current = requestAnimationFrame((next) => stepHeld(zone, next));
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
      return;
    }
    const zone = zoneForKey(event.key);
    if (!zone) return;
    event.preventDefault();
    if (event.repeat || activeRef.current) return;
    const anchor = ANCHORS[zone];
    activeRef.current = {
      zone,
      points: [{ x: anchor.x, y: anchor.y, t: event.timeStamp, zone }],
    };
    frameRef.current = requestAnimationFrame((timestamp) => stepHeld(zone, timestamp));
  };

  const onKeyUp = (event) => {
    const zone = zoneForKey(event.key);
    if (!zone || !activeRef.current) return;
    event.preventDefault();
    closeActive();
  };

  const submit = () => {
    closeActive();
    if (strokesRef.current.length < 1) {
      onAnnounce('Pet the cat first.');
      return;
    }
    onComplete(scorePetting(strokesRef.current, { readyAt: readyAt.current }));
  };

  const hearts = Math.min(4, Math.floor(live.purr / 25));

  return (
    <div className="ch-round">
      {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      <div
        ref={stageRef}
        className="ch-cat"
        role="application"
        tabIndex={0}
        aria-label="Cat. Pet with a pointer, or hold Space or the arrow keys. Arrow up is the head, down the belly, left the tail, right the back."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      >
        {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
        <CatArt trails={trails} />
        <div className="ch-hearts" aria-hidden="true">
          {Array.from({ length: hearts }, (_, index) => (
            <span key={index} className="ch-heart">♥</span>
          ))}
        </div>
      </div>
      <p className="ch-purr">
        purr level {Math.round(live.purr)}%
        <span aria-hidden="true">{' '}{hearts > 0 ? '♥'.repeat(hearts) : ''}</span>
      </p>
      <div className="ch-meter-row">
        <span>
          Strokes {live.strokeCount}
          {' · '}
          {Math.round(live.avgSpeed)} px/s
        </span>
        <svg className="ch-meter" viewBox="0 0 100 8" aria-hidden="true">
          <rect className="ch-meter__track" x="0" y="0" width="100" height="8" rx="4" />
          <rect className="ch-meter__fill ch-meter__fill--purr" x="0" y="0" width={Math.max(0, Math.min(100, live.purr))} height="8" rx="4" />
        </svg>
      </div>
      <p className="ch-hint">Stroke the cat. Hold Space or an arrow key. Up head, down belly, left tail, right back.</p>
      <button className="ch-go" type="button" onClick={submit} disabled={live.strokeCount < 1}>
        Done petting
      </button>
    </div>
  );
}
