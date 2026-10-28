import { CIRCLE_SIDE } from './circleScore.js';

function canvasSquare(cssWidth, cssHeight) {
  const side = Math.min(cssWidth, cssHeight);
  return {
    side,
    originX: (cssWidth - side) / 2,
    originY: (cssHeight - side) / 2,
    scale: side / CIRCLE_SIDE,
  };
}

export function paintCircle(canvas, points, { dpr = 1, score = null, showGuide = false, pen = null } = {}) {
  if (!canvas) return;
  let context;
  try {
    context = canvas.getContext('2d');
  } catch {
    context = null;
  }
  if (!context) return;

  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  const square = canvasSquare(width, height);
  const mapPoint = (x, y) => ({
    x: square.originX + x * square.scale,
    y: square.originY + y * square.scale,
  });

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  context.lineCap = 'round';
  context.lineJoin = 'round';

  if (points?.length) {
    context.beginPath();
    context.strokeStyle = '#e8467c';
    context.lineWidth = 5;
    points.forEach((point, index) => {
      const mapped = mapPoint(point.x, point.y);
      if (index === 0) context.moveTo(mapped.x, mapped.y);
      else context.lineTo(mapped.x, mapped.y);
    });
    context.stroke();
  }

  if (showGuide && score && score.radius > 0) {
    context.beginPath();
    context.setLineDash([5, 5]);
    context.strokeStyle = '#9aa3b2';
    context.lineWidth = 2;
    const center = mapPoint(score.centerX, score.centerY);
    context.arc(center.x, center.y, score.radius * square.scale, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    const bump = points?.[score.bumpIndex];
    if (bump) {
      const mappedBump = mapPoint(bump.x, bump.y);
      const bx = mappedBump.x;
      const by = mappedBump.y;
      context.beginPath();
      context.strokeStyle = '#ff5a6e';
      context.lineWidth = 2;
      context.arc(bx, by, 12, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = '#ff5a6e';
      context.font = '12px sans-serif';
      context.textAlign = 'center';
      context.fillText('suspicious bump', bx, Math.min(height - 8, by + 26));
    }
  }

  if (pen) {
    context.beginPath();
    context.fillStyle = '#e8467c';
    const cursor = mapPoint(pen.x, pen.y);
    context.arc(cursor.x, cursor.y, 4, 0, Math.PI * 2);
    context.fill();
  }
}
