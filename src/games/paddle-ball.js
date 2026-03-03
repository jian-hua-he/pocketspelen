import { navigate } from "../router.js";

const LS_KEY = "pocketspelen-paddle-ball-highscore";

const SHRINK_TABLE = [
  { score: 0, coverage: 0.5 },
  { score: 5, coverage: 0.45 },
  { score: 10, coverage: 0.4 },
  { score: 20, coverage: 0.35 },
  { score: 35, coverage: 0.3 },
  { score: 50, coverage: 0.25 },
  { score: 75, coverage: 0.22 },
  { score: 100, coverage: 0.2 },
];

function getCoverage(score) {
  let coverage = SHRINK_TABLE[0].coverage;
  for (const entry of SHRINK_TABLE) {
    if (score >= entry.score) coverage = entry.coverage;
  }
  return coverage;
}

function getBallSpeed(score, mobile) {
  if (mobile) return Math.min(280 + score * 2, 480);
  return Math.min(400 + score * 3, 700);
}

export function paddleBallGame() {
  const container = document.createElement("div");
  container.className =
    "flex min-h-screen flex-col items-center justify-center bg-gray-950";
  container.style.touchAction = "none";

  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  container.appendChild(canvas);

  const backBtn = document.createElement("button");
  backBtn.textContent = "\u2190 Back";
  backBtn.className =
    "fixed top-4 left-4 z-10 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/20";
  backBtn.addEventListener("click", () => navigate("/"));
  container.appendChild(backBtn);

  const ctx = canvas.getContext("2d");
  const abort = new AbortController();
  const signal = abort.signal;

  // Game area constants
  const MARGIN = 20;
  const BALL_RADIUS = 8;

  // State
  let W, H, P; // play area width, height, perimeter
  let ox, oy; // play area origin on canvas
  let state = "start"; // start | playing | paused | gameover
  let score = 0;
  let highScore = parseInt(localStorage.getItem(LS_KEY)) || 0;

  // Ball
  let bx, by, bvx, bvy;

  // Paddle (perimeter coordinate)
  let paddleCenter = 0; // t in [0, P)
  let paddleHalf = 0;

  // Input state
  let inputDir = 0; // -1 left, 0 none, 1 right
  let isMobile = false;
  let tiltPermissionGranted = false;
  let tiltGammaRaw = 0;
  let tiltBetaRaw = 0;
  let tiltGamma = 0; // smoothed
  let tiltBeta = 0; // smoothed
  let touchStartX = null;
  let touchLastX = null;

  // Animation
  let lastTime = 0;
  let rafId = 0;
  let pulsePhase = 0;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    W = cw - MARGIN * 2;
    H = ch - MARGIN * 2;
    if (W < 100) W = 100;
    if (H < 100) H = 100;
    ox = (cw - W) / 2;
    oy = (ch - H) / 2;
    P = 2 * (W + H);

    paddleHalf = (getCoverage(score) * P) / 2;
  }

  function resetBall() {
    bx = W / 2;
    by = H / 2;
    const angle = Math.random() * Math.PI * 2;
    const speed = getBallSpeed(0, isMobile);
    bvx = Math.cos(angle) * speed;
    bvy = Math.sin(angle) * speed;
    // Ensure ball isn't moving too horizontally or vertically
    if (Math.abs(bvx) < speed * 0.3) bvx = speed * 0.3 * Math.sign(bvx || 1);
    if (Math.abs(bvy) < speed * 0.3) bvy = speed * 0.3 * Math.sign(bvy || 1);
  }

  function startGame() {
    score = 0;
    paddleCenter = 0; // top center
    paddleHalf = (getCoverage(0) * P) / 2;
    resetBall();
    state = "playing";
  }

  // Perimeter helpers: t=0 at top-left corner, going clockwise
  // top: 0..W, right: W..W+H, bottom: W+H..2W+H, left: 2W+H..2W+2H
  function tToXY(t) {
    t = ((t % P) + P) % P;
    if (t <= W) return { x: t, y: 0 };
    if (t <= W + H) return { x: W, y: t - W };
    if (t <= 2 * W + H) return { x: W - (t - W - H), y: H };
    return { x: 0, y: H - (t - 2 * W - H) };
  }

  function xyToT(x, y) {
    // Find which edge the point is on and return perimeter t
    // Top edge
    if (y <= 0) return Math.max(0, Math.min(W, x));
    // Right edge
    if (x >= W) return W + Math.max(0, Math.min(H, y));
    // Bottom edge
    if (y >= H) return W + H + Math.max(0, Math.min(W, W - x));
    // Left edge
    return 2 * W + H + Math.max(0, Math.min(H, H - y));
  }

  function arcDist(a, b) {
    let d = Math.abs(a - b);
    if (d > P / 2) d = P - d;
    return d;
  }

  function isPaddleCovering(t) {
    return arcDist(paddleCenter, t) <= paddleHalf;
  }

  // Detect mobile
  function detectMobile() {
    isMobile =
      navigator.maxTouchPoints > 0 ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  // --- Input handlers ---
  function onKeyDown(e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      inputDir = -1;
      e.preventDefault();
    } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      inputDir = 1;
      e.preventDefault();
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (state === "start" || state === "gameover") startGame();
      else if (state === "playing") state = "paused";
      else if (state === "paused") state = "playing";
    }
  }

  function onKeyUp(e) {
    if (
      e.key === "ArrowLeft" ||
      e.key === "a" ||
      e.key === "A" ||
      e.key === "ArrowRight" ||
      e.key === "d" ||
      e.key === "D"
    ) {
      inputDir = 0;
    }
  }

  function onDeviceOrientation(e) {
    if (e.gamma != null) tiltGammaRaw = e.gamma;
    if (e.beta != null) tiltBetaRaw = e.beta;
  }

  function enableTiltListener() {
    if (!tiltPermissionGranted) return;
    window.addEventListener("deviceorientation", onDeviceOrientation, {
      signal,
    });
  }

  // iOS 13+ requires requestPermission() called synchronously inside a
  // click handler (not touchstart, not deferred via async/await).
  // We use a click listener on the canvas to handle start/restart AND
  // request gyroscope permission in one gesture.
  function onCanvasClick() {
    if (state === "start" || state === "gameover") {
      if (
        !tiltPermissionGranted &&
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function"
      ) {
        // Must call requestPermission synchronously in this click handler
        DeviceOrientationEvent.requestPermission()
          .then((perm) => {
            if (perm === "granted") {
              tiltPermissionGranted = true;
              enableTiltListener();
            }
          })
          .catch(() => {});
      } else if (!tiltPermissionGranted) {
        // Android / other browsers: no permission API needed
        tiltPermissionGranted = true;
        enableTiltListener();
      }
      startGame();
      return;
    }
    if (state === "paused") {
      state = "playing";
      return;
    }
  }

  function onTouchStart(e) {
    // click handler deals with start/gameover/paused
    if (state !== "playing") return;
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchLastX = touch.clientX;
  }

  function onTouchMove(e) {
    if (state !== "playing" || !e.touches.length) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - (touchLastX ?? touch.clientX);
    touchLastX = touch.clientX;
    // Map pixel drag to perimeter movement
    paddleCenter = ((paddleCenter + dx * 2) % P + P) % P;
  }

  function onTouchEnd() {
    touchStartX = null;
    touchLastX = null;
  }

  // --- Physics ---
  function update(dt) {
    if (state !== "playing") return;

    pulsePhase += dt * 3;

    // Move paddle
    const PADDLE_SPEED = 900; // px/s along perimeter

    if (isMobile && tiltPermissionGranted) {
      // Low-pass filter: smooth raw sensor noise
      const smooth = 0.12;
      tiltGamma += (tiltGammaRaw - tiltGamma) * smooth;
      tiltBeta += (tiltBetaRaw - tiltBeta) * smooth;

      // Dead zone: ignore tiny tilts (sensor drift)
      const DEAD_ZONE = 3;
      let gx = tiltGamma / 45;
      let gy = (tiltBeta - 45) / 45;
      if (Math.abs(tiltGamma) < DEAD_ZONE) gx = 0;
      if (Math.abs(tiltBeta - 45) < DEAD_ZONE) gy = 0;

      // Compute smoothly blended tangent direction.
      // Corners are at t=0, W, W+H, 2W+H. Near corners, blend the
      // tangents of the two meeting edges to prevent oscillation.
      const t = ((paddleCenter % P) + P) % P;
      const B = 50; // blend zone radius in px
      // Edge tangents (clockwise): top(1,0) right(0,1) bottom(-1,0) left(0,-1)
      // Corners: 0/P=top-left, W=top-right, W+H=bottom-right, 2W+H=bottom-left
      const corners = [0, W, W + H, 2 * W + H];
      const tangents = [
        [1, 0], [0, 1], [-1, 0], [0, -1],
      ];
      // Start with the sharp tangent for current edge
      let edgeIdx;
      if (t <= W) edgeIdx = 0;
      else if (t <= W + H) edgeIdx = 1;
      else if (t <= 2 * W + H) edgeIdx = 2;
      else edgeIdx = 3;
      let tx = tangents[edgeIdx][0];
      let ty = tangents[edgeIdx][1];

      // Blend near each corner
      for (let ci = 0; ci < 4; ci++) {
        let dist = Math.abs(t - corners[ci]);
        if (dist > P / 2) dist = P - dist; // wrap around
        if (dist < B) {
          const blend = dist / B; // 0 at corner, 1 at edge of zone
          const prevEdge = (ci + 3) % 4; // edge before corner
          const nextEdge = ci % 4; // edge after corner
          tx = tangents[prevEdge][0] * (1 - blend) + tangents[nextEdge][0] * blend;
          ty = tangents[prevEdge][1] * (1 - blend) + tangents[nextEdge][1] * blend;
          // Normalise
          const len = Math.sqrt(tx * tx + ty * ty) || 1;
          tx /= len;
          ty /= len;
          break;
        }
      }

      // Project tilt onto blended tangent → instant velocity
      const tiltStrength = gx * tx + gy * ty;
      const TILT_SPEED = 2500;
      paddleCenter += tiltStrength * TILT_SPEED * dt;
    }

    paddleCenter += inputDir * PADDLE_SPEED * dt;
    paddleCenter = ((paddleCenter % P) + P) % P;

    // Update paddle size
    paddleHalf = (getCoverage(score) * P) / 2;

    // Move ball
    const speed = getBallSpeed(score, isMobile);
    const len = Math.sqrt(bvx * bvx + bvy * bvy);
    if (len > 0) {
      bvx = (bvx / len) * speed;
      bvy = (bvy / len) * speed;
    }

    bx += bvx * dt;
    by += bvy * dt;

    // Wall collisions
    const r = BALL_RADIUS;

    // Check each wall
    let hitWall = false;
    let contactT = 0;

    if (bx - r <= 0) {
      // Left wall
      bx = r;
      contactT = xyToT(0, by);
      hitWall = true;
      if (isPaddleCovering(contactT)) {
        bvx = Math.abs(bvx);
        addScoreAndPerturb();
      } else {
        gameOver();
        return;
      }
    } else if (bx + r >= W) {
      // Right wall
      bx = W - r;
      contactT = xyToT(W, by);
      hitWall = true;
      if (isPaddleCovering(contactT)) {
        bvx = -Math.abs(bvx);
        addScoreAndPerturb();
      } else {
        gameOver();
        return;
      }
    }

    if (by - r <= 0) {
      // Top wall
      by = r;
      contactT = xyToT(bx, 0);
      hitWall = true;
      if (isPaddleCovering(contactT)) {
        bvy = Math.abs(bvy);
        addScoreAndPerturb();
      } else {
        gameOver();
        return;
      }
    } else if (by + r >= H) {
      // Bottom wall
      by = H - r;
      contactT = xyToT(bx, H);
      hitWall = true;
      if (isPaddleCovering(contactT)) {
        bvy = -Math.abs(bvy);
        addScoreAndPerturb();
      } else {
        gameOver();
        return;
      }
    }
  }

  function addScoreAndPerturb() {
    score++;
    // Random angle perturbation +-15 degrees
    const angle = (Math.random() - 0.5) * (Math.PI / 6);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const nvx = bvx * cos - bvy * sin;
    const nvy = bvx * sin + bvy * cos;
    bvx = nvx;
    bvy = nvy;
    // Ensure minimum velocity on each axis
    const speed = getBallSpeed(score, isMobile);
    const minComponent = speed * 0.2;
    if (Math.abs(bvx) < minComponent) bvx = minComponent * Math.sign(bvx || 1);
    if (Math.abs(bvy) < minComponent) bvy = minComponent * Math.sign(bvy || 1);
  }

  function gameOver() {
    state = "gameover";
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(LS_KEY, String(highScore));
    }
  }

  // --- Rendering ---
  function draw() {
    const cw = canvas.width / (window.devicePixelRatio || 1);
    const ch = canvas.height / (window.devicePixelRatio || 1);

    // Background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, cw, ch);

    // Subtle grid
    ctx.save();
    ctx.translate(ox, oy);
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x <= W; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Draw exposed edges (dim pulsing red)
    drawEdges();

    // Draw paddle (neon green with glow)
    drawPaddle();

    // Draw ball
    if (state === "playing" || state === "paused") {
      drawBall();
    }

    ctx.restore();

    // HUD
    drawHUD(cw, ch);

    // Overlays
    if (state === "start") drawStartOverlay(cw, ch);
    if (state === "paused") drawPausedOverlay(cw, ch);
    if (state === "gameover") drawGameOverOverlay(cw, ch);
  }

  function drawEdges() {
    const pulse = 0.3 + 0.15 * Math.sin(pulsePhase);

    // Draw entire perimeter as exposed (red), then overdraw paddle (green)
    ctx.lineWidth = 4;
    ctx.strokeStyle = `rgba(255, 60, 60, ${pulse})`;

    // We need to draw the exposed parts of each edge
    // Walk around the perimeter and draw segments that are NOT covered by paddle
    const steps = 200;
    const stepSize = P / steps;

    ctx.beginPath();
    let drawing = false;
    for (let i = 0; i <= steps; i++) {
      const t = (i * stepSize) % P;
      const covered = isPaddleCovering(t);
      const pt = tToXY(t);

      if (!covered) {
        if (!drawing) {
          ctx.moveTo(pt.x, pt.y);
          drawing = true;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      } else {
        if (drawing) {
          ctx.stroke();
          ctx.beginPath();
          drawing = false;
        }
      }
    }
    if (drawing) ctx.stroke();
  }

  function drawPaddle() {
    ctx.lineWidth = 6;

    // Glow
    ctx.save();
    ctx.shadowColor = "#00ff88";
    ctx.shadowBlur = 15;
    ctx.strokeStyle = "#00ff88";

    const steps = 100;
    const startT = ((paddleCenter - paddleHalf) % P + P) % P;
    const totalLen = paddleHalf * 2;
    const stepSize = totalLen / steps;

    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = (startT + i * stepSize) % P;
      const pt = tToXY(t);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawBall() {
    ctx.save();
    // Cyan glow
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(bx, by, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Inner cyan
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0, 229, 255, 0.4)";
    ctx.beginPath();
    ctx.arc(bx, by, BALL_RADIUS * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHUD(cw, ch) {
    if (state !== "playing" && state !== "paused") return;

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 24px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(String(score), ox + W - 12, oy + 12);
    ctx.restore();
  }

  function drawStartOverlay(cw, ch) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, cw, ch);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Paddle Ball", cw / 2, ch / 2 - 60);

    ctx.font = "16px monospace";
    ctx.fillStyle = "#aaaaaa";
    if (isMobile) {
      ctx.fillText("Tilt phone or drag to move paddle", cw / 2, ch / 2);
      ctx.fillText("Tap to start", cw / 2, ch / 2 + 30);
    } else {
      ctx.fillText("Arrow keys or A/D to move paddle", cw / 2, ch / 2);
      ctx.fillText("Press Space to start", cw / 2, ch / 2 + 30);
    }

    if (highScore > 0) {
      ctx.fillStyle = "#ffcc00";
      ctx.fillText(`High Score: ${highScore}`, cw / 2, ch / 2 + 70);
    }
    ctx.restore();
  }

  function drawPausedOverlay(cw, ch) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, cw, ch);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Paused", cw / 2, ch / 2 - 20);

    ctx.font = "16px monospace";
    ctx.fillStyle = "#aaaaaa";
    if (isMobile) {
      ctx.fillText("Tap to resume", cw / 2, ch / 2 + 20);
    } else {
      ctx.fillText("Press Space to resume", cw / 2, ch / 2 + 20);
    }
    ctx.restore();
  }

  function drawGameOverOverlay(cw, ch) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, cw, ch);

    ctx.fillStyle = "#ff4444";
    ctx.font = "bold 36px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Game Over", cw / 2, ch / 2 - 60);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px monospace";
    ctx.fillText(`Score: ${score}`, cw / 2, ch / 2 - 10);

    if (score >= highScore) {
      ctx.fillStyle = "#ffcc00";
      ctx.font = "20px monospace";
      ctx.fillText("New High Score!", cw / 2, ch / 2 + 25);
    } else {
      ctx.fillStyle = "#888888";
      ctx.font = "16px monospace";
      ctx.fillText(`Best: ${highScore}`, cw / 2, ch / 2 + 25);
    }

    ctx.fillStyle = "#aaaaaa";
    ctx.font = "16px monospace";
    if (isMobile) {
      ctx.fillText("Tap to play again", cw / 2, ch / 2 + 70);
    } else {
      ctx.fillText("Press Space to play again", cw / 2, ch / 2 + 70);
    }
    ctx.restore();
  }

  // --- Game loop ---
  function loop(time) {
    if (signal.aborted) return;
    if (!document.contains(canvas)) {
      abort.abort();
      return;
    }

    if (lastTime === 0) lastTime = time;
    let dt = (time - lastTime) / 1000;
    lastTime = time;

    // Cap dt to prevent tunneling
    if (dt > 0.05) dt = 0.05;

    update(dt);
    draw();

    rafId = requestAnimationFrame(loop);
  }

  // --- Init ---
  function init() {
    detectMobile();
    resize();

    // Initial paddle position: center of top edge
    paddleCenter = W / 2;
    paddleHalf = (getCoverage(0) * P) / 2;

    // Event listeners
    window.addEventListener("resize", resize, { signal });
    window.addEventListener("keydown", onKeyDown, { signal });
    window.addEventListener("keyup", onKeyUp, { signal });

    if (isMobile) {
      canvas.addEventListener("click", onCanvasClick, { signal });
      canvas.addEventListener("touchstart", onTouchStart, {
        signal,
        passive: true,
      });
      canvas.addEventListener("touchmove", onTouchMove, {
        signal,
        passive: false,
      });
      canvas.addEventListener("touchend", onTouchEnd, {
        signal,
        passive: true,
      });
    }

    draw();
    rafId = requestAnimationFrame(loop);
  }

  // Use setTimeout to ensure canvas is in DOM before init
  setTimeout(init, 0);

  return container;
}
