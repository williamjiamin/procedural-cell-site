import {
  PBR_24_SURFACE_RECIPES,
  REACTION_DIFFUSION_PRESETS,
  REQUIRED_PBR_CHANNELS,
  computeHeitzNeyretHexWeights,
  createReactionDiffusionField,
  generateBotanicalPhyllotaxis,
  stepReactionDiffusionField,
} from "./morphogenesis_lab.mjs";

const rdCanvas = document.getElementById("rd-canvas");
const rdCtx = rdCanvas.getContext("2d");
const presetEl = document.getElementById("rd-preset");
const feedEl = document.getElementById("rd-feed");
const killEl = document.getElementById("rd-kill");
const feedValEl = document.getElementById("rd-feed-val");
const killValEl = document.getElementById("rd-kill-val");
const rdReadoutEl = document.getElementById("rd-readout");

const phCanvas = document.getElementById("phyllo-canvas");
const phCtx = phCanvas.getContext("2d");
const countEl = document.getElementById("phyllo-count");
const angleEl = document.getElementById("phyllo-angle");
const countValEl = document.getElementById("phyllo-count-val");
const angleValEl = document.getElementById("phyllo-angle-val");

const matEl = document.getElementById("pbr-material");
const uvScaleEl = document.getElementById("pbr-scale");
const pbrSummaryEl = document.getElementById("pbr-summary");

let rdField = createReactionDiffusionField(40, 40);
let rdTimer = null;

function drawReactionDiffusion() {
  const { rows, cols, v } = rdField;
  const cw = rdCanvas.width / cols;
  const ch = rdCanvas.height / rows;
  let maxV = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = v[r * cols + c];
      if (val > maxV) maxV = val;
      const g = Math.min(255, Math.round(25 + val * 360));
      const b = Math.min(255, Math.round(45 + val * 310));
      rdCtx.fillStyle = `rgb(18, ${g}, ${b})`;
      rdCtx.fillRect(c * cw, r * ch, cw + 0.5, ch + 0.5);
    }
  }
  rdReadoutEl.textContent = `Peak activator V = ${maxV.toFixed(3)} · F=${Number(feedEl.value).toFixed(4)} k=${Number(killEl.value).toFixed(4)}`;
}

function stepRd(iterations) {
  const feed = Number(feedEl.value);
  const kill = Number(killEl.value);
  for (let i = 0; i < iterations; i++) {
    rdField = stepReactionDiffusionField(rdField, { feed, kill });
  }
  drawReactionDiffusion();
}

function drawPhyllotaxis() {
  const count = Number(countEl.value);
  const deg = Number(angleEl.value);
  countValEl.textContent = String(count);
  angleValEl.textContent = deg.toFixed(2);
  const pts = generateBotanicalPhyllotaxis(count, 130, deg);
  phCtx.clearRect(0, 0, phCanvas.width, phCanvas.height);
  const cx = phCanvas.width / 2;
  const cy = phCanvas.height / 2;
  for (const pt of pts) {
    const ratio = pt.index / count;
    phCtx.fillStyle = `hsl(${155 - ratio * 55}, 72%, ${68 - ratio * 22}%)`;
    phCtx.beginPath();
    phCtx.arc(cx + pt.x, cy + pt.y, 2.5 + ratio * 2.5, 0, Math.PI * 2);
    phCtx.fill();
  }
}

function renderPbrSummary() {
  const recipe = PBR_24_SURFACE_RECIPES.find((r) => r.slug === matEl.value) ?? PBR_24_SURFACE_RECIPES[0];
  const scale = Number(uvScaleEl.value);
  const hex = computeHeitzNeyretHexWeights(0.42, 0.71, scale);
  const wText = hex.vertices.map((vt) => vt.weight.toFixed(2)).join(" / ");
  pbrSummaryEl.textContent = `${recipe.slug} (${recipe.category}) · Metallic ${recipe.metallic.toFixed(2)} · Roughness ${recipe.roughness.toFixed(2)} · IOR ${recipe.ior.toFixed(2)} · 5 Maps [${REQUIRED_PBR_CHANNELS.join(", ")}] · Hex weights @ (0.42,0.71): ${wText}`;
}

for (const [key, cfg] of Object.entries(REACTION_DIFFUSION_PRESETS)) {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = cfg.label;
  presetEl.appendChild(opt);
}
for (const recipe of PBR_24_SURFACE_RECIPES) {
  const opt = document.createElement("option");
  opt.value = recipe.slug;
  opt.textContent = `${recipe.slug} (${recipe.category})`;
  matEl.appendChild(opt);
}

presetEl.addEventListener("change", () => {
  const cfg = REACTION_DIFFUSION_PRESETS[presetEl.value];
  feedEl.value = String(cfg.feed);
  killEl.value = String(cfg.kill);
  feedValEl.textContent = cfg.feed.toFixed(4);
  killValEl.textContent = cfg.kill.toFixed(4);
  rdField = createReactionDiffusionField(40, 40);
  stepRd(12);
});
feedEl.addEventListener("input", () => {
  feedValEl.textContent = Number(feedEl.value).toFixed(4);
});
killEl.addEventListener("input", () => {
  killValEl.textContent = Number(killEl.value).toFixed(4);
});
document.getElementById("rd-step").addEventListener("click", () => stepRd(12));
document.getElementById("rd-reset").addEventListener("click", () => {
  rdField = createReactionDiffusionField(40, 40);
  drawReactionDiffusion();
});
document.getElementById("rd-toggle").addEventListener("click", (e) => {
  if (rdTimer !== null) {
    clearInterval(rdTimer);
    rdTimer = null;
    e.currentTarget.textContent = "Run animation";
  } else {
    rdTimer = setInterval(() => stepRd(4), 60);
    e.currentTarget.textContent = "Pause animation";
  }
});

countEl.addEventListener("input", drawPhyllotaxis);
angleEl.addEventListener("input", drawPhyllotaxis);
matEl.addEventListener("change", renderPbrSummary);
uvScaleEl.addEventListener("input", renderPbrSummary);

stepRd(15);
drawPhyllotaxis();
renderPbrSummary();
