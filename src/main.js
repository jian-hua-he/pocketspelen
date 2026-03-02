import "./style.css";
import { addRoute, navigate, startRouter } from "./router.js";
import { homePage } from "./pages/home.js";
import { paddleBallGame } from "./games/paddle-ball.js";

addRoute("/", homePage);

addRoute("/game/paddle-ball", paddleBallGame);

addRoute("/game/:id", (params) => {
  const container = document.createElement("div");
  container.className =
    "flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4";

  container.innerHTML = `
    <p class="mb-6 text-lg text-gray-400">Game "${params.id}" is coming soon!</p>
  `;

  const backBtn = document.createElement("button");
  backBtn.textContent = "\u2190 Back to games";
  backBtn.className =
    "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500";
  backBtn.addEventListener("click", () => navigate("/"));
  container.appendChild(backBtn);

  return container;
});

startRouter(document.getElementById("app"));
