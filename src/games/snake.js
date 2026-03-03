import { navigate } from "../router.js";

const LS_KEY = "pocketspelen-snake-highscore";
const CELL = 20;
const BASE_INTERVAL = 150;
const MIN_INTERVAL = 60;

export function snakeGame() {
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

  const MARGIN = 20;

  let cols, rows, W, H, ox, oy;
  let state = "start";
  let score = 0;
  let highScore = parseInt(localStorage.getItem(LS_KEY)) || 0;

  // Snake state
  let snake = [];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food = { x: 0, y: 0 };
  let foodEaten = 0;

  // Timing
  let lastMoveTime = 0;
  let rafId = 0;

  let isMobile = false;
  let touchStartX = 0;
  let touchStartY = 0;

  function getInterval() {
    const speedups = Math.floor(foodEaten / 5);
    return Math.max(MIN_INTERVAL, BASE_INTERVAL - speedups * 5);
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cols = Math.floor((cw - MARGIN * 2) / CELL);
    rows = Math.floor((ch - MARGIN * 2) / CELL);
    if (cols < 10) cols = 10;
    if (rows < 10) rows = 10;
    W = cols * CELL;
    H = rows * CELL;
    ox = Math.floor((cw - W) / 2);
    oy = Math.floor((ch - H) / 2);
  }

  function spawnFood() {
    const occupied = new Set(snake.map((s) => `${s.x},${s.y}`));
    let attempts = 0;
    do {
      food.x = Math.floor(Math.random() * cols);
      food.y = Math.floor(Math.random() * rows);
      attempts++;
    } while (occupied.has(`${food.x},${food.y}`) && attempts < 1000);
  }

  function startGame() {
    score = 0;
    foodEaten = 0;
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };

    const cx = Math.floor(cols / 2);
    const cy = Math.floor(rows / 2);
    snake = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ];

    spawnFood();
    lastMoveTime = performance.now();
    state = "playing";
  }

  function gameOver() {
    state = "gameover";
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(LS_KEY, String(highScore));
    }
  }

  function update(now) {
    if (state !== "playing") return;

    const elapsed = now - lastMoveTime;
    if (elapsed < getInterval()) return;
    lastMoveTime = now;

    // Apply queued direction
    dir = { ...nextDir };

    const head = snake[0];
    const nx = head.x + dir.x;
    const ny = head.y + dir.y;

    // Wall collision
    if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) {
      gameOver();
      return;
    }

    // Self collision
    for (let i = 0; i < snake.length; i++) {
      if (snake[i].x === nx && snake[i].y === ny) {
        gameOver();
        return;
      }
    }

    // Move snake
    snake.unshift({ x: nx, y: ny });

    // Check food
    if (nx === food.x && ny === food.y) {
      score++;
      foodEaten++;
      spawnFood();
    } else {
      snake.pop();
    }
  }

  function setDirection(dx, dy) {
    // Prevent reversing
    if (dir.x === -dx && dir.y === -dy) return;
    // Prevent setting same direction
    if (dir.x === dx && dir.y === dy) return;
    nextDir = { x: dx, y: dy };
  }

  // --- Input ---
  function onKeyDown(e) {
    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        e.preventDefault();
        if (state === "playing") setDirection(0, -1);
        break;
      case "ArrowDown":
      case "s":
      case "S":
        e.preventDefault();
        if (state === "playing") setDirection(0, 1);
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        e.preventDefault();
        if (state === "playing") setDirection(-1, 0);
        break;
      case "ArrowRight":
      case "d":
      case "D":
        e.preventDefault();
        if (state === "playing") setDirection(1, 0);
        break;
      case " ":
        e.preventDefault();
        if (state === "start" || state === "gameover") startGame();
        else if (state === "playing") state = "paused";
        else if (state === "paused") state = "playing";
        break;
    }
  }

  function onTouchStart(e) {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }

  function onTouchEnd(e) {
    if (state === "start" || state === "gameover") {
      startGame();
      return;
    }
    if (state === "paused") {
      state = "playing";
      return;
    }
    if (state !== "playing") return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Minimum swipe distance
    if (absDx < 20 && absDy < 20) {
      // Tap — toggle pause
      state = "paused";
      return;
    }

    if (absDx > absDy) {
      setDirection(dx > 0 ? 1 : -1, 0);
    } else {
      setDirection(0, dy > 0 ? 1 : -1);
    }
  }

  // --- Rendering ---
  function draw() {
    const cw = canvas.width / (window.devicePixelRatio || 1);
    const ch = canvas.height / (window.devicePixelRatio || 1);

    // Background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.translate(ox, oy);

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, H);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(W, y * CELL);
      ctx.stroke();
    }

    // Border
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, W, H);

    // Food
    if (state === "playing" || state === "paused") {
      ctx.save();
      ctx.shadowColor = "#ff6600";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "#ff4422";
      ctx.beginPath();
      ctx.arc(
        food.x * CELL + CELL / 2,
        food.y * CELL + CELL / 2,
        CELL / 2 - 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    }

    // Snake
    if (state === "playing" || state === "paused") {
      for (let i = snake.length - 1; i >= 0; i--) {
        const seg = snake[i];
        const isHead = i === 0;

        ctx.save();
        if (isHead) {
          ctx.shadowColor = "#00ff44";
          ctx.shadowBlur = 15;
          ctx.fillStyle = "#00ff44";
        } else {
          ctx.fillStyle = "#00cc33";
        }
        ctx.fillRect(
          seg.x * CELL + 1,
          seg.y * CELL + 1,
          CELL - 2,
          CELL - 2,
        );
        ctx.restore();
      }
    }

    ctx.restore();

    // HUD
    if (state === "playing" || state === "paused") {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold 24px monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(String(score), ox + W - 12, oy + 12);
      ctx.restore();
    }

    // Overlays
    if (state === "start") drawStartOverlay(cw, ch);
    if (state === "paused") drawPausedOverlay(cw, ch);
    if (state === "gameover") drawGameOverOverlay(cw, ch);
  }

  function drawStartOverlay(cw, ch) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, cw, ch);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Snake", cw / 2, ch / 2 - 60);

    ctx.font = "16px monospace";
    ctx.fillStyle = "#aaaaaa";
    if (isMobile) {
      ctx.fillText("Swipe to change direction", cw / 2, ch / 2);
      ctx.fillText("Tap to start", cw / 2, ch / 2 + 30);
    } else {
      ctx.fillText("Arrow keys or WASD to move", cw / 2, ch / 2);
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

    if (score >= highScore && score > 0) {
      ctx.fillStyle = "#ffcc00";
      ctx.font = "20px monospace";
      ctx.fillText("New High Score!", cw / 2, ch / 2 + 25);
    } else if (highScore > 0) {
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

    update(time);
    draw();

    rafId = requestAnimationFrame(loop);
  }

  // --- Init ---
  function init() {
    isMobile =
      navigator.maxTouchPoints > 0 ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    resize();

    window.addEventListener("resize", resize, { signal });
    window.addEventListener("keydown", onKeyDown, { signal });
    canvas.addEventListener("touchstart", onTouchStart, {
      signal,
      passive: true,
    });
    canvas.addEventListener("touchend", onTouchEnd, {
      signal,
      passive: true,
    });

    draw();
    rafId = requestAnimationFrame(loop);
  }

  setTimeout(init, 0);

  return container;
}
