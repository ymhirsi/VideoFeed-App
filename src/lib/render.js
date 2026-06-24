/**
 * Annotation renderer — the single source of truth for drawing annotation
 * shapes onto a 2D canvas.
 *
 * Deliberately written as plain, dependency-free JS (no TS-only syntax) so it
 * can serve two callers without drift:
 *   1. the React app (imported normally), and
 *   2. the exported standalone player (this file's source is injected verbatim
 *      via `?raw`, so it must run untouched in a bare browser).
 *
 * All shape coordinates are normalized 0–1 relative to the video frame, so the
 * same data renders correctly at any display size.
 *
 * Point semantics by tool:
 *   arrow  — points[0] = tail, points[1] = head
 *   circle — points[0] & points[1] = opposite corners of the bounding box
 *   pen    — polyline through all points
 *
 * The on-frame text *label* is NOT rendered here — it's a separate DOM
 * overlay bound to the comment's canonical text (see TextLabelOverlay /
 * the player runtime), so it can be moved and re-edited.
 */

// strokeWidth is stored relative to a 1000px-wide reference frame.
var STROKE_REFERENCE_WIDTH = 1000;

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<any>} shapes
 * @param {number} w  canvas width in device-independent px
 * @param {number} h  canvas height in device-independent px
 */
export function drawShapes(ctx, shapes, w, h) {
  ctx.clearRect(0, 0, w, h);
  if (!shapes) return;
  for (var i = 0; i < shapes.length; i++) {
    drawShape(ctx, shapes[i], w, h);
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {any} shape
 * @param {number} w
 * @param {number} h
 */
export function drawShape(ctx, shape, w, h) {
  var pts = (shape.points || []).map(function (p) {
    return { x: p.x * w, y: p.y * h };
  });
  if (pts.length === 0) return;

  var lineWidth = Math.max(1, (shape.strokeWidth * w) / STROKE_REFERENCE_WIDTH);

  ctx.save();
  ctx.strokeStyle = shape.color;
  ctx.fillStyle = shape.color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // A soft shadow keeps annotations legible over both bright and dark frames.
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = lineWidth * 1.2;

  if (shape.tool === "pen") {
    drawPen(ctx, pts);
  } else if (shape.tool === "arrow") {
    drawArrow(ctx, pts, lineWidth);
  } else if (shape.tool === "circle") {
    drawEllipse(ctx, pts);
  }

  ctx.restore();
}

function drawPen(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

function drawArrow(ctx, pts, lineWidth) {
  var a = pts[0];
  var b = pts[pts.length - 1];
  var dx = b.x - a.x;
  var dy = b.y - a.y;
  var dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.5) return;
  var angle = Math.atan2(dy, dx);
  // Head scales with stroke but never larger than the arrow itself.
  var head = Math.min(dist, Math.max(lineWidth * 3.5, dist * 0.22));

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  var spread = Math.PI / 7;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(
    b.x - head * Math.cos(angle - spread),
    b.y - head * Math.sin(angle - spread)
  );
  ctx.lineTo(
    b.x - head * Math.cos(angle + spread),
    b.y - head * Math.sin(angle + spread)
  );
  ctx.closePath();
  ctx.fill();
}

function drawEllipse(ctx, pts) {
  var a = pts[0];
  var b = pts[pts.length - 1];
  var cx = (a.x + b.x) / 2;
  var cy = (a.y + b.y) / 2;
  var rx = Math.abs(b.x - a.x) / 2;
  var ry = Math.abs(b.y - a.y) / 2;
  if (rx < 0.5 || ry < 0.5) return;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}
