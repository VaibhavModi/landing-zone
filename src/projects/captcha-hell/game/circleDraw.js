import { CIRCLE_SPACE } from './circleScore.js';

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
  const mapX = (x) => (x / CIRCLE_SPACE.w) * width;
  const mapY = (y) => (y / CIRCLE_SPACE.h) * height;

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  context.lineCap = 'round';
  context.lineJoin = 'round';

  if (points?.length) {
    context.beginPath();
    context.strokeStyle = '#e8467c';
    context.lineWidth = 5;
    points.forEach((point, index) => {
      const x = mapX(point.x);
      const y = mapY(point.y);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  }

  if (showGuide && score && score.radius > 0) {
    context.beginPath();
    context.setLineDash([5, 5]);
    context.strokeStyle = '#9aa3b2';
    context.lineWidth = 2;
    context.ellipse(
      mapX(score.centerX),
      mapY(score.centerY),
      (score.radius / CIRCLE_SPACE.w) * width,
      (score.radius / CIRCLE_SPACE.h) * height,
      0,
      0,
      Math.PI * 2,
    );
    context.stroke();
    context.setLineDash([]);
    const bump = points?.[score.bumpIndex];
    if (bump) {
      const bx = mapX(bump.x);
      const by = mapY(bump.y);
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
    context.arc(mapX(pen.x), mapY(pen.y), 4, 0, Math.PI * 2);
    context.fill();
  }
}
