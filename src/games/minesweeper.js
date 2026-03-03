import { navigate } from "../router.js";

const CELL = 30;
const HUD_HEIGHT = 44;
const MINE_DENSITY = 0.15;
const LONG_PRESS_MS = 400;
const DOUBLE_TAP_MS = 300;

const NUM_COLORS = [
  null,
  "#4444ff", // 1 blue
  "#22aa22", // 2 green
  "#ff3333", // 3 red
  "#000088", // 4 dark blue
  "#882222", // 5 maroon
  "#008888", // 6 teal
  "#222222", // 7 black
  "#888888", // 8 gray
];

export function minesweeperGame() {
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

  let cols, rows, totalMines;
  let grid; // 2D array of cells
  let state = "idle"; // idle | playing | won | gameover
  let timer = 0;
  let timerStart = 0;
  let flagCount = 0;
  let triggeredCell = null;
  let gridOffsetX = 0;
  let gridOffsetY = 0;
  let canvasW, canvasH;

  // Touch state
  let lastTapTime = 0;
  let lastTapCell = null;
  let longPressTimer = null;
  let longPressCell = null;
  let touchMoved = false;

  function initBoard() {
    const dpr = window.devicePixelRatio || 1;
    canvasW = window.innerWidth;
    canvasH = window.innerHeight;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = canvasW + "px";
    canvas.style.height = canvasH + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const availW = canvasW - 20;
    const availH = canvasH - HUD_HEIGHT - 20;
    cols = Math.max(5, Math.floor(availW / CELL));
    rows = Math.max(5, Math.floor(availH / CELL));
    totalMines = Math.max(1, Math.round(cols * rows * MINE_DENSITY));

    gridOffsetX = Math.floor((canvasW - cols * CELL) / 2);
    gridOffsetY = HUD_HEIGHT + Math.floor((canvasH - HUD_HEIGHT - rows * CELL) / 2);

    grid = [];
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        grid[r][c] = { mine: false, revealed: false, flagged: false, adjacentMines: 0 };
      }
    }

    state = "idle";
    timer = 0;
    timerStart = 0;
    flagCount = 0;
    triggeredCell = null;
  }

  function placeMines(safeR, safeC) {
    let placed = 0;
    while (placed < totalMines) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      if (grid[r][c].mine) continue;
      if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
      grid[r][c].mine = true;
      placed++;
    }
    // Compute adjacency counts
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].mine) continue;
        let count = 0;
        forNeighbors(r, c, (nr, nc) => {
          if (grid[nr][nc].mine) count++;
        });
        grid[r][c].adjacentMines = count;
      }
    }
  }

  function forNeighbors(r, c, fn) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          fn(nr, nc);
        }
      }
    }
  }

  function reveal(r, c) {
    const cell = grid[r][c];
    if (cell.revealed || cell.flagged) return;

    if (state === "idle") {
      placeMines(r, c);
      state = "playing";
      timerStart = performance.now();
    }

    if (cell.mine) {
      cell.revealed = true;
      triggeredCell = { r, c };
      state = "gameover";
      // Reveal all mines
      for (let rr = 0; rr < rows; rr++) {
        for (let cc = 0; cc < cols; cc++) {
          if (grid[rr][cc].mine) grid[rr][cc].revealed = true;
        }
      }
      draw();
      return;
    }

    // Flood fill
    const stack = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      const cur = grid[cr][cc];
      if (cur.revealed || cur.flagged || cur.mine) continue;
      cur.revealed = true;
      if (cur.adjacentMines === 0) {
        forNeighbors(cr, cc, (nr, nc) => {
          if (!grid[nr][nc].revealed) stack.push([nr, nc]);
        });
      }
    }

    checkWin();
  }

  function chord(r, c) {
    const cell = grid[r][c];
    if (!cell.revealed || cell.adjacentMines === 0) return;

    let adjFlags = 0;
    forNeighbors(r, c, (nr, nc) => {
      if (grid[nr][nc].flagged) adjFlags++;
    });

    if (adjFlags !== cell.adjacentMines) return;

    forNeighbors(r, c, (nr, nc) => {
      if (!grid[nr][nc].revealed && !grid[nr][nc].flagged) {
        reveal(nr, nc);
      }
    });
  }

  function toggleFlag(r, c) {
    if (state !== "idle" && state !== "playing") return;
    const cell = grid[r][c];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    flagCount += cell.flagged ? 1 : -1;
    draw();
  }

  function checkWin() {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!grid[r][c].mine && !grid[r][c].revealed) return;
      }
    }
    state = "won";
  }

  function cellFromPixel(px, py) {
    const c = Math.floor((px - gridOffsetX) / CELL);
    const r = Math.floor((py - gridOffsetY) / CELL);
    if (r >= 0 && r < rows && c >= 0 && c < cols) return { r, c };
    return null;
  }

  // --- Drawing ---
  function draw() {
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, canvasW, canvasH);

    drawHUD();
    drawGrid();

    if (state === "won") drawOverlay("You Win!", "#00ff88");
    if (state === "gameover") drawOverlay("Game Over", "#ff4444");
  }

  function drawHUD() {
    ctx.save();
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvasW, HUD_HEIGHT);

    ctx.font = "bold 20px monospace";
    ctx.textBaseline = "middle";
    const y = HUD_HEIGHT / 2;

    // Mine counter
    ctx.fillStyle = "#ff4444";
    ctx.textAlign = "left";
    const remaining = totalMines - flagCount;
    ctx.fillText("\u{1F4A3} " + String(remaining).padStart(3, "0"), gridOffsetX, y);

    // Timer
    ctx.fillStyle = "#ffcc00";
    ctx.textAlign = "right";
    const t = Math.min(999, Math.floor(timer));
    ctx.fillText(String(t).padStart(3, "0") + " \u23F1", gridOffsetX + cols * CELL, y);

    ctx.restore();
  }

  function drawGrid() {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = gridOffsetX + c * CELL;
        const y = gridOffsetY + r * CELL;
        const cell = grid[r][c];

        if (cell.revealed) {
          if (cell.mine) {
            // Mine cell
            const isTriggered = triggeredCell && triggeredCell.r === r && triggeredCell.c === c;
            ctx.fillStyle = isTriggered ? "#cc0000" : "#1a1a2e";
            ctx.fillRect(x, y, CELL, CELL);
            drawMine(x, y);
          } else {
            // Revealed safe cell - slightly inset look
            ctx.fillStyle = "#1a1a2e";
            ctx.fillRect(x, y, CELL, CELL);
            ctx.strokeStyle = "#111128";
            ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);

            if (cell.adjacentMines > 0) {
              ctx.save();
              ctx.font = "bold 16px monospace";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillStyle = NUM_COLORS[cell.adjacentMines] || "#fff";
              ctx.fillText(String(cell.adjacentMines), x + CELL / 2, y + CELL / 2 + 1);
              ctx.restore();
            }
          }
        } else {
          // Unrevealed cell - 3D raised look
          ctx.fillStyle = "#3a3a5c";
          ctx.fillRect(x, y, CELL, CELL);

          // Highlight (top + left)
          ctx.fillStyle = "#5a5a7c";
          ctx.fillRect(x, y, CELL, 2);
          ctx.fillRect(x, y, 2, CELL);

          // Shadow (bottom + right)
          ctx.fillStyle = "#222244";
          ctx.fillRect(x, y + CELL - 2, CELL, 2);
          ctx.fillRect(x + CELL - 2, y, 2, CELL);

          if (cell.flagged) {
            drawFlag(x, y);
          }
        }
      }
    }

    // Grid border
    ctx.strokeStyle = "#333355";
    ctx.lineWidth = 1;
    ctx.strokeRect(gridOffsetX, gridOffsetY, cols * CELL, rows * CELL);
  }

  function drawFlag(x, y) {
    const cx = x + CELL / 2;
    const cy = y + CELL / 2;

    // Pole
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx, cy + 8);
    ctx.stroke();

    // Flag triangle
    ctx.fillStyle = "#ff3333";
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx + 8, cy - 4);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();

    // Base
    ctx.fillStyle = "#ccc";
    ctx.fillRect(cx - 4, cy + 6, 8, 2);
  }

  function drawMine(x, y) {
    const cx = x + CELL / 2;
    const cy = y + CELL / 2;
    const r = 7;

    // Body
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Spikes
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * (r - 1), cy + Math.sin(angle) * (r - 1));
      ctx.lineTo(cx + Math.cos(angle) * (r + 4), cy + Math.sin(angle) * (r + 4));
      ctx.stroke();
    }

    // Glint
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawOverlay(text, color) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = color;
    ctx.font = "bold 36px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvasW / 2, canvasH / 2 - 30);

    ctx.fillStyle = "#aaaaaa";
    ctx.font = "16px monospace";
    ctx.fillText("Tap or click to play again", canvasW / 2, canvasH / 2 + 20);
    ctx.restore();
  }

  // --- Input ---

  function handleReveal(r, c) {
    if (state === "won" || state === "gameover") return;
    const cell = grid[r][c];
    if (cell.revealed) {
      chord(r, c);
    } else {
      reveal(r, c);
    }
    draw();
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    if (state === "won" || state === "gameover") {
      initBoard();
      draw();
      return;
    }
    const pos = cellFromPixel(e.offsetX, e.offsetY);
    if (!pos) return;
    handleReveal(pos.r, pos.c);
  }

  function onContextMenu(e) {
    e.preventDefault();
    if (state === "won" || state === "gameover") return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const pos = cellFromPixel(px, py);
    if (!pos) return;
    toggleFlag(pos.r, pos.c);
  }

  // Mobile touch handling
  function onTouchStart(e) {
    if (state === "won" || state === "gameover") {
      initBoard();
      draw();
      return;
    }
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const px = touch.clientX - rect.left;
    const py = touch.clientY - rect.top;
    const pos = cellFromPixel(px, py);
    if (!pos) return;

    touchMoved = false;

    // Check double-tap
    const now = performance.now();
    if (lastTapCell && lastTapCell.r === pos.r && lastTapCell.c === pos.c && now - lastTapTime < DOUBLE_TAP_MS) {
      clearLongPress();
      lastTapTime = 0;
      lastTapCell = null;
      handleReveal(pos.r, pos.c);
      e.preventDefault();
      return;
    }
    lastTapTime = now;
    lastTapCell = { r: pos.r, c: pos.c };

    // Start long-press timer
    longPressCell = { r: pos.r, c: pos.c };
    longPressTimer = setTimeout(() => {
      if (longPressCell && !touchMoved) {
        toggleFlag(longPressCell.r, longPressCell.c);
        longPressCell = null;
      }
    }, LONG_PRESS_MS);

    e.preventDefault();
  }

  function onTouchMove(e) {
    touchMoved = true;
    clearLongPress();
  }

  function onTouchEnd(e) {
    clearLongPress();
  }

  function clearLongPress() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    longPressCell = null;
  }

  // --- Timer loop ---
  function loop(time) {
    if (signal.aborted) return;
    if (!document.contains(canvas)) {
      abort.abort();
      return;
    }

    if (state === "playing") {
      timer = (performance.now() - timerStart) / 1000;
      draw();
    }

    requestAnimationFrame(loop);
  }

  // --- Init ---
  function init() {
    initBoard();
    draw();

    // Desktop
    canvas.addEventListener("mousedown", onMouseDown, { signal });
    canvas.addEventListener("contextmenu", onContextMenu, { signal });

    // Mobile
    canvas.addEventListener("touchstart", onTouchStart, { signal, passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { signal, passive: true });
    canvas.addEventListener("touchend", onTouchEnd, { signal, passive: true });

    requestAnimationFrame(loop);
  }

  setTimeout(init, 0);

  return container;
}
