import { useEffect, useRef, useState } from 'react';
import { paintCircle } from './circleDraw.js';
import { CIRCLE_SPACE, mapPadPoint, scoreCircle } from './circleScore.js';

const STEP = 16;

function clampSpace(value, max) {
  return Math.min(max - 8, Math.max(8, value));
}

export function CircleSketch({ points, score }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const pad = canvas.parentElement;
    const rect = pad.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width || 300));
    const height = Math.max(1, Math.round(rect.height || 220));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    paintCircle(canvas, points, { dpr, score, showGuide: true });
    return undefined;
  }, [points, score]);

  return (
    <div className="ch-pad ch-pad--review">
      <canvas ref={canvasRef} className="ch-canvas" aria-hidden="true" />
    </div>
  );
}

export default function CircleRound({ onComplete, onAnnounce }) {
  const padRef = useRef(null);
  const canvasRef = useRef(null);
  const pointsRef = useRef([]);
  const penRef = useRef({ x: CIRCLE_SPACE.w / 2, y: CIRCLE_SPACE.h / 2 });
  const readyAt = useRef(0);
  const drawingRef = useRef(false);
  const lockedRef = useRef(false);
  const sizeRef = useRef({ dpr: 1 });
  const [live, setLive] = useState(() => scoreCircle([]));
  const liveStamp = useRef(0);

  const paint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    paintCircle(canvas, pointsRef.current, {
      dpr: sizeRef.current.dpr,
      pen: penRef.current,
    });
  };

  const publish = (force) => {
    const now = performance.now();
    if (!force && now - liveStamp.current < 80) return;
    liveStamp.current = now;
    setLive(scoreCircle(pointsRef.current, { readyAt: readyAt.current }));
  };

  useEffect(() => {
    readyAt.current = performance.now();
    const pad = padRef.current;
    const canvas = canvasRef.current;
    if (!pad || !canvas) return undefined;

    const fit = () => {
      const rect = pad.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width || 300));
      const height = Math.max(1, Math.round(rect.height || 240));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      sizeRef.current = { dpr };
      paintCircle(canvas, pointsRef.current, { dpr, pen: penRef.current });
    };

    fit();
    paintCircle(canvas, pointsRef.current, { dpr: sizeRef.current.dpr, pen: penRef.current });
    pad.focus();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(pad);

    const blockScroll = (event) => {
      if (drawingRef.current && event.cancelable) event.preventDefault();
    };
    pad.addEventListener('touchmove', blockScroll, { passive: false });

    return () => {
      observer?.disconnect();
      pad.removeEventListener('touchmove', blockScroll);
    };
  }, []);

  const finish = () => {
    if (lockedRef.current) return;
    const points = pointsRef.current;
    if (points.length < 1) {
      onAnnounce('Draw a stroke first.');
      return;
    }
    lockedRef.current = true;
    drawingRef.current = false;
    onComplete(scoreCircle(points, { readyAt: readyAt.current }), points);
  };

  const addPoint = (x, y) => {
    penRef.current = {
      x: clampSpace(x, CIRCLE_SPACE.w),
      y: clampSpace(y, CIRCLE_SPACE.h),
    };
    pointsRef.current = [
      ...pointsRef.current,
      { x: penRef.current.x, y: penRef.current.y, t: performance.now() },
    ];
    paint();
    publish(false);
  };

  const localPoint = (event) => mapPadPoint(
    event.clientX,
    event.clientY,
    padRef.current.getBoundingClientRect(),
    performance.now(),
  );

  const onPointerDown = (event) => {
    if (lockedRef.current) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    padRef.current.focus();
    try {
      padRef.current.setPointerCapture?.(event.pointerId);
    } catch {
      // jsdom may not implement capture
    }
    drawingRef.current = true;
    pointsRef.current = [];
    const point = localPoint(event);
    addPoint(point.x, point.y);
  };

  const onPointerMove = (event) => {
    if (!drawingRef.current || lockedRef.current) return;
    const samples = event.getCoalescedEvents?.() ?? [event];
    samples.forEach((sample) => {
      const point = localPoint(sample);
      addPoint(point.x, point.y);
    });
  };

  const onPointerUp = (event) => {
    if (!drawingRef.current || lockedRef.current) return;
    publish(true);
    finish();
    try {
      if (padRef.current.hasPointerCapture?.(event.pointerId)) {
        padRef.current.releasePointerCapture(event.pointerId);
      }
    } catch {
      // ignore
    }
  };

  const onKeyDown = (event) => {
    if (lockedRef.current) return;
    const key = event.key;
    let dx = 0;
    let dy = 0;
    if (key === 'ArrowRight') dx = STEP;
    else if (key === 'ArrowLeft') dx = -STEP;
    else if (key === 'ArrowDown') dy = STEP;
    else if (key === 'ArrowUp') dy = -STEP;
    else if (key === 'Enter') {
      event.preventDefault();
      publish(true);
      finish();
      return;
    } else {
      return;
    }
    event.preventDefault();
    if (!drawingRef.current) {
      drawingRef.current = true;
      pointsRef.current = [{ ...penRef.current, t: performance.now() }];
    }
    addPoint(penRef.current.x + dx, penRef.current.y + dy);
  };

  const shown = live.pointCount > 1 ? live.roundness : 0;

  return (
    <div className="ch-round">
      {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      <div
        ref={padRef}
        className="ch-pad"
        role="application"
        tabIndex={0}
        aria-label="Circle canvas. Draw one stroke with a pointer, or with the arrow keys, then press Enter."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
        <canvas ref={canvasRef} className="ch-canvas" aria-hidden="true" />
        <p className="ch-score" aria-hidden="true">
          <strong>{shown.toFixed(1)}%</strong>
          <span>circle accuracy</span>
        </p>
      </div>
      <div className="ch-meter-row">
        <span>Live roundness</span>
        <svg className="ch-meter" viewBox="0 0 100 8" aria-hidden="true">
          <rect className="ch-meter__track" x="0" y="0" width="100" height="8" rx="4" />
          <rect className="ch-meter__fill" x="0" y="0" width={Math.max(0, Math.min(100, shown))} height="8" rx="4" />
        </svg>
      </div>
      <p className="ch-hint">One stroke. No lifting. Arrow keys draw, Enter submits.</p>
    </div>
  );
}
