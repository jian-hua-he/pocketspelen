const routes = {};
let rootEl = null;

function matchRoute(hash) {
  const path = hash.replace(/^#/, "") || "/";

  for (const [pattern, handler] of Object.entries(routes)) {
    const paramNames = [];
    const regexStr = pattern.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return "([^/]+)";
    });
    const match = path.match(new RegExp(`^${regexStr}$`));
    if (match) {
      const params = {};
      paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      return { handler, params };
    }
  }
  return null;
}

function render() {
  const result = matchRoute(window.location.hash);
  if (result) {
    rootEl.innerHTML = "";
    rootEl.appendChild(result.handler(result.params));
  }
}

export function navigate(path) {
  window.location.hash = path;
}

export function addRoute(pattern, handler) {
  routes[pattern] = handler;
}

export function startRouter(el) {
  rootEl = el;
  window.addEventListener("hashchange", render);
  render();
}
