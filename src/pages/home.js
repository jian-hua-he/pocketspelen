import { navigate } from "../router.js";

const games = [
  {
    id: "snake",
    title: "Snake",
    description: "Eat food and grow without hitting yourself",
    emoji: "🐍",
    playable: true,
  },
  {
    id: "paddle-ball",
    title: "Paddle Ball",
    description: "Bounce the ball with a perimeter paddle",
    emoji: "🏓",
    playable: true,
  },
  {
    id: "memory",
    title: "Memory",
    description: "Flip cards and find matching pairs",
    emoji: "🃏",
  },
  {
    id: "tic-tac-toe",
    title: "Tic Tac Toe",
    description: "Classic X and O strategy game",
    emoji: "❌",
  },
  {
    id: "breakout",
    title: "Breakout",
    description: "Bounce the ball and smash all the bricks",
    emoji: "🧱",
  },
  {
    id: "whack-a-mole",
    title: "Whack-a-Mole",
    description: "Test your reflexes by whacking moles",
    emoji: "🔨",
  },
  {
    id: "puzzle-slide",
    title: "Puzzle Slide",
    description: "Slide tiles to solve the picture puzzle",
    emoji: "🧩",
  },
];

function createGameCard(game) {
  const card = document.createElement("button");
  card.className = [
    "group relative flex flex-col items-center gap-4 rounded-2xl",
    "bg-white/5 p-6 text-center ring-1 ring-white/10",
    "transition hover:bg-white/10 hover:ring-white/25",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
  ].join(" ");

  card.innerHTML = `
    <span class="text-5xl">${game.emoji}</span>
    <div>
      <h2 class="text-lg font-semibold text-white">${game.title}</h2>
      <p class="mt-1 text-sm text-gray-400">${game.description}</p>
    </div>
    <span class="mt-auto inline-block rounded-full ${game.playable ? "bg-green-500/20 text-green-300" : "bg-indigo-500/20 text-indigo-300"} px-3 py-1 text-xs font-medium">
      ${game.playable ? "Play Now" : "Coming Soon"}
    </span>
  `;

  card.addEventListener("click", () => navigate(`/game/${game.id}`));
  return card;
}

export function homePage() {
  const container = document.createElement("div");
  container.className = "min-h-screen bg-gray-950 px-4 py-12";

  const inner = document.createElement("div");
  inner.className = "mx-auto max-w-5xl";

  inner.innerHTML = `
    <header class="mb-12 text-center">
      <h1 class="text-4xl font-bold tracking-tight text-white sm:text-5xl">
        Pocketspelen
      </h1>
      <p class="mt-3 text-lg text-gray-400">Pick a game and start playing</p>
    </header>
  `;

  const grid = document.createElement("div");
  grid.className =
    "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

  games.forEach((game) => grid.appendChild(createGameCard(game)));

  inner.appendChild(grid);
  container.appendChild(inner);
  return container;
}
