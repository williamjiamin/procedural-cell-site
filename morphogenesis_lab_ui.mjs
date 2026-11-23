import {
  PBR_32_SURFACE_RECIPES,
  REACTION_DIFFUSION_PRESETS,
  REQUIRED_PBR_CHANNELS,
  computeHeitzNeyretHexWeights,
  createReactionDiffusionField,
  generateBotanicalPhyllotaxis,
  stepReactionDiffusionField,
} from "./morphogenesis_lab.mjs";
import {
  ARCH_ORDERS,
  TILE_LAG_WITNESSES,
  WORKSHOP_CUTAWAY_ASSETS,
  evaluateOrderBay,
  solveCutawayPose,
} from "./arch_actuator_lab.mjs";
import {
  ART_STYLES,
  ISOMORPHIC_PLAY_STYLES,
  PORE_LAB_DEFAULTS,
  createBiologicalWorldState,
  evaluatePoreRecoil,
  stepMacrophageSwarm,
  switchIsomorphicLens,
} from "./micro_clinic_lab.mjs";

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
  const recipe = PBR_32_SURFACE_RECIPES.find((r) => r.slug === matEl.value) ?? PBR_32_SURFACE_RECIPES[0];
  const scale = Number(uvScaleEl.value);
  const hex = computeHeitzNeyretHexWeights(0.42, 0.71, scale);
  const wText = hex.vertices.map((vt) => vt.weight.toFixed(2)).join(" / ");
  pbrSummaryEl.textContent = `${recipe.slug} (${recipe.category}) · Metallic ${recipe.metallic.toFixed(2)} · Roughness ${recipe.roughness.toFixed(2)} · IOR ${recipe.ior.toFixed(2)} · 5 Maps [${REQUIRED_PBR_CHANNELS.join(", ")}] · Hex weights @ (0.42,0.71): ${wText}`;
}

const cutawayAssetEl = document.getElementById("cutaway-asset");
const shoulderEl = document.getElementById("cutaway-shoulder");
const elbowEl = document.getElementById("cutaway-elbow");
const shoulderValEl = document.getElementById("cutaway-shoulder-val");
const elbowValEl = document.getElementById("cutaway-elbow-val");
const cutawaySummaryEl = document.getElementById("cutaway-summary");

const archOrderEl = document.getElementById("arch-order");
const archScaleEl = document.getElementById("arch-scale");
const archLoadEl = document.getElementById("arch-load");
const archScaleValEl = document.getElementById("arch-scale-val");
const archLoadValEl = document.getElementById("arch-load-val");
const archSummaryEl = document.getElementById("arch-summary");

function renderCutawaySummary() {
  if (!cutawayAssetEl || !cutawaySummaryEl) return;
  const asset = WORKSHOP_CUTAWAY_ASSETS.find((a) => a.id === cutawayAssetEl.value) ?? WORKSHOP_CUTAWAY_ASSETS[0];
  const sh = Number(shoulderEl?.value ?? 35);
  const el = Number(elbowEl?.value ?? -25);
  if (shoulderValEl) shoulderValEl.textContent = String(sh);
  if (elbowValEl) elbowValEl.textContent = String(el);
  const pose = solveCutawayPose([0, sh, el, 0, 15, 0]);
  cutawaySummaryEl.textContent = `${asset.label} · LOD0/1/2: ${asset.lod0Tris}/${asset.lod1Tris}/${asset.lod2Tris} tris · Mat: ${asset.material} · Reach ${pose.radialReachM} m · Tip [${pose.endEffectorM.join(", ")}] m`;
}

function renderArchSummary() {
  if (!archOrderEl || !archSummaryEl) return;
  const scaleFactor = Number(archScaleEl?.value ?? 1.0);
  const roofLoadKnPerM = Number(archLoadEl?.value ?? 12);
  if (archScaleValEl) archScaleValEl.textContent = scaleFactor.toFixed(2);
  if (archLoadValEl) archLoadValEl.textContent = String(roofLoadKnPerM);
  const bay = evaluateOrderBay(archOrderEl.value, { scaleFactor, roofLoadKnPerM });
  const lag = TILE_LAG_WITNESSES[0];
  archSummaryEl.textContent = `${bay.label} · Aperture ${bay.apertureWidthM} x ${bay.apertureHeightM} m (${bay.clearsPrism ? "CLEAR >= 0.80x1.68 m" : "BLOCKED"}) · Arch thrust ${bay.horizontalThrustKn} kN · LOD2 reduction ${bay.lodReductionPct}% · Tile-lag ${lag.straightRepeatCorr.toFixed(3)} -> ${lag.stochasticCorr.toFixed(3)}`;
}

for (const [key, cfg] of Object.entries(REACTION_DIFFUSION_PRESETS)) {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = cfg.label;
  presetEl.appendChild(opt);
}
for (const recipe of PBR_32_SURFACE_RECIPES) {
  const opt = document.createElement("option");
  opt.value = recipe.slug;
  opt.textContent = `${recipe.slug} (${recipe.category})`;
  matEl.appendChild(opt);
}
for (const asset of WORKSHOP_CUTAWAY_ASSETS) {
  if (!cutawayAssetEl) break;
  const opt = document.createElement("option");
  opt.value = asset.id;
  opt.textContent = asset.label;
  cutawayAssetEl.appendChild(opt);
}
for (const order of Object.values(ARCH_ORDERS)) {
  if (!archOrderEl) break;
  const opt = document.createElement("option");
  opt.value = order.key;
  opt.textContent = order.label;
  archOrderEl.appendChild(opt);
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
cutawayAssetEl?.addEventListener("change", renderCutawaySummary);
shoulderEl?.addEventListener("input", renderCutawaySummary);
elbowEl?.addEventListener("input", renderCutawaySummary);
archOrderEl?.addEventListener("change", renderArchSummary);
archScaleEl?.addEventListener("input", renderArchSummary);
archLoadEl?.addEventListener("input", renderArchSummary);

stepRd(15);
drawPhyllotaxis();
renderPbrSummary();
renderCutawaySummary();
renderArchSummary();

const lensPlayEl = document.getElementById("lens-play");
const lensArtEl = document.getElementById("lens-art");
const lensCanvasEl = document.getElementById("lens-canvas");
const lensSummaryEl = document.getElementById("lens-summary");
const poreStretchedEl = document.getElementById("pore-stretched");
const poreElapsedEl = document.getElementById("pore-elapsed");
const poreStretchedValEl = document.getElementById("pore-stretched-val");
const poreElapsedValEl = document.getElementById("pore-elapsed-val");
const poreSummaryEl = document.getElementById("pore-summary");
const swarmBoostEl = document.getElementById("swarm-boost");
const swarmBoostValEl = document.getElementById("swarm-boost-val");
const swarmSummaryEl = document.getElementById("swarm-summary");

let clinicWorld = createBiologicalWorldState();

function renderLensPreview() {
  if (!lensPlayEl || !lensArtEl || !lensSummaryEl) return;
  const snap = switchIsomorphicLens(clinicWorld, {
    playStyle: lensPlayEl.value,
    artStyle: lensArtEl.value,
  });
  const art = ART_STYLES[snap.artStyle];
  const play = ISOMORPHIC_PLAY_STYLES[snap.playStyle];
  lensSummaryEl.textContent = `${play.label} · Art: ${art.label} · 10 µm cell world · ATP ${snap.atp.toFixed(1)} · Integrity ${snap.integrity.toFixed(0)}% · RNG draws on switch: ${snap.rngDrawCount}`;
  if (lensCanvasEl && lensCanvasEl.getContext) {
    const ctx = lensCanvasEl.getContext("2d");
    const [bg, accent, core] = art.palette;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, lensCanvasEl.width, lensCanvasEl.height);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(90, 70, 38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(90, 70, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.font = "12px monospace";
    ctx.fillText(`STAGE 1 · 10 um | ${play.pacing}`, 148, 56);
    ctx.fillText(`ATP=${snap.atp.toFixed(1)}  RNG_DRAW=${snap.rngDrawCount}`, 148, 82);
  }
}

function renderPoreSummary() {
  if (!poreStretchedEl || !poreElapsedEl || !poreSummaryEl) return;
  const stretched = Number(poreStretchedEl.value);
  const elapsed = Number(poreElapsedEl.value);
  if (poreStretchedValEl) poreStretchedValEl.textContent = stretched.toFixed(2);
  if (poreElapsedValEl) poreElapsedValEl.textContent = elapsed.toFixed(1);
  const res = evaluatePoreRecoil(stretched, PORE_LAB_DEFAULTS.equilibriumRadiusMm, elapsed);
  poreSummaryEl.textContent = `Pore radius @ ${elapsed.toFixed(1)} min = ${res.radiusMm.toFixed(3)} mm (eq ${PORE_LAB_DEFAULTS.equilibriumRadiusMm} mm · closure ${res.closurePct.toFixed(1)}% · fast=${res.fastRemaining.toFixed(2)} slow=${res.slowRemaining.toFixed(2)})`;
}

function renderSwarmSummary(stepResult = null) {
  if (!swarmSummaryEl) return;
  const boost = Number(swarmBoostEl?.value ?? 1.0);
  if (swarmBoostValEl) swarmBoostValEl.textContent = boost.toFixed(2);
  const deltaTxt = stepResult ? `Cleared +${stepResult.clearedUnits.toFixed(2)} biofilm · ` : "";
  swarmSummaryEl.textContent = `${deltaTxt}Macrophages: ${clinicWorld.macrophageCount} · Biofilm load: ${clinicWorld.biofilmLoad.toFixed(2)} · Shared ATP: ${clinicWorld.atp.toFixed(2)}`;
}

if (lensPlayEl && lensArtEl) {
  for (const ps of Object.values(ISOMORPHIC_PLAY_STYLES)) {
    const opt = document.createElement("option");
    opt.value = ps.id;
    opt.textContent = ps.label;
    lensPlayEl.appendChild(opt);
  }
  for (const ar of Object.values(ART_STYLES)) {
    const opt = document.createElement("option");
    opt.value = ar.id;
    opt.textContent = ar.label;
    lensArtEl.appendChild(opt);
  }
  lensPlayEl.addEventListener("change", renderLensPreview);
  lensArtEl.addEventListener("change", renderLensPreview);
  renderLensPreview();
}

poreStretchedEl?.addEventListener("input", renderPoreSummary);
poreElapsedEl?.addEventListener("input", renderPoreSummary);
renderPoreSummary();

swarmBoostEl?.addEventListener("input", () => renderSwarmSummary());
document.getElementById("swarm-step")?.addEventListener("click", () => {
  const stepRes = stepMacrophageSwarm(clinicWorld, 0.5, Number(swarmBoostEl?.value ?? 1.0));
  renderSwarmSummary(stepRes);
  renderLensPreview();
});
document.getElementById("swarm-reset")?.addEventListener("click", () => {
  clinicWorld = createBiologicalWorldState();
  renderSwarmSummary();
  renderLensPreview();
});
renderSwarmSummary();
