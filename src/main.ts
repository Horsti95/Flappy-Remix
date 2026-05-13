import "./style.css";

const app = document.getElementById("app");
if (!app) throw new Error("missing #app");

app.innerHTML = `
  <div class="text-center font-display">
    <h1 class="text-4xl font-bold tracking-tight">Pflug</h1>
    <p class="mt-2 text-sm opacity-70">scaffold up. game loop next.</p>
  </div>
`;
