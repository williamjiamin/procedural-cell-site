import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ART_STYLES,
  CELLULAR_EVOLUTION_SPINE,
  ISOMORPHIC_PLAY_STYLES,
  PORE_LAB_DEFAULTS,
  STAGE_1_EAT_RADIUS_UM,
  STAGE_1_ORIGIN_DIAMETER_UM,
  createBiologicalWorldState,
  evaluatePoreRecoil,
  stepMacrophageSwarm,
  switchIsomorphicLens,
} from "../micro_clinic_lab.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BANNED_GAME_OR_LEAK_RE =
  /\b(AGY|Fable|Codex|Minimax|GOAG|PR\s*#\d+|Shipyard|Guild|Spore|Diablo|Maple|Pokemon|Zelda|Mario|Persona|Nintendo|Sony|PlayStation|Xbox)\b/i;

test("Stage 1 (10 um) biological evolution spine preserves origin-to-multiverse progression", () => {
  assert.equal(STAGE_1_ORIGIN_DIAMETER_UM, 10);
  assert.equal(STAGE_1_EAT_RADIUS_UM, 12);
  assert.equal(CELLULAR_EVOLUTION_SPINE.length, 5);
  assert.equal(CELLULAR_EVOLUTION_SPINE[0].stage, 1);
  assert.equal(CELLULAR_EVOLUTION_SPINE[0].scaleLabel, "10 um");
  assert.equal(CELLULAR_EVOLUTION_SPINE[4].scaleLabel, "Multiverse");
});

test("Isomorphic play & art-style switcher mutates view only with 0 RNG draw and preserves WorldState", () => {
  const world = createBiologicalWorldState(777);
  const seed0 = world.rngSeed;
  const atp0 = world.atp;
  const integrity0 = world.integrity;

  for (const playStyle of Object.keys(ISOMORPHIC_PLAY_STYLES)) {
    for (const artStyle of Object.keys(ART_STYLES)) {
      const snap = switchIsomorphicLens(world, { playStyle, artStyle });
      assert.equal(snap.playStyle, playStyle);
      assert.equal(snap.artStyle, artStyle);
      assert.equal(snap.rngDrawCount, 0);
      assert.equal(world.rngSeed, seed0);
      assert.equal(world.atp, atp0);
      assert.equal(world.integrity, integrity0);
    }
  }
});

test("PoreLab double-exponential recoil decays monotonically and fails closed on invalid inputs", () => {
  const t0 = evaluatePoreRecoil(PORE_LAB_DEFAULTS.stretchedRadiusMm, PORE_LAB_DEFAULTS.equilibriumRadiusMm, 0);
  const t5 = evaluatePoreRecoil(PORE_LAB_DEFAULTS.stretchedRadiusMm, PORE_LAB_DEFAULTS.equilibriumRadiusMm, 5);
  const t90 = evaluatePoreRecoil(PORE_LAB_DEFAULTS.stretchedRadiusMm, PORE_LAB_DEFAULTS.equilibriumRadiusMm, 90);
  assert.ok(Math.abs(t0.radiusMm - PORE_LAB_DEFAULTS.stretchedRadiusMm) < 1e-6);
  assert.ok(t5.radiusMm < t0.radiusMm && t90.radiusMm < t5.radiusMm);
  assert.ok(t90.radiusMm > PORE_LAB_DEFAULTS.equilibriumRadiusMm);
  assert.throws(() => evaluatePoreRecoil(0.2, 0.24, 1.0));
  assert.throws(() => evaluatePoreRecoil(0.9, 0.24, -1.0));
});

test("Macrophage swarm clears biofilm deterministically without negative ATP", () => {
  const world = createBiologicalWorldState();
  const b0 = world.biofilmLoad;
  const a0 = world.atp;
  const step1 = stepMacrophageSwarm(world, 0.5, 1.5);
  assert.ok(step1.clearedUnits > 0);
  assert.ok(world.biofilmLoad < b0);
  assert.ok(world.atp < a0 && world.atp >= 0);
});

test("showcase HTML link-outs and full clean-room leak/brand audit pass", () => {
  const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const labHtml = fs.readFileSync(path.join(root, "morphogenesis-lab.html"), "utf8");
  assert.match(indexHtml, /evolution\.html/);
  assert.match(indexHtml, /morphogenesis-lab\.html#isomorphic-preview/);
  assert.match(indexHtml, /morphogenesis-lab\.html#micro-clinic/);
  assert.match(labHtml, /PoreLab/i);
  assert.match(labHtml, /Macrophage Swarm/i);
  assert.match(labHtml, /10 µm|10 um/);

  for (const name of fs.readdirSync(root)) {
    const p = path.join(root, name);
    if (fs.statSync(p).isFile() && /\.(html|mjs|ts|js|json|md)$/i.test(name)) {
      const txt = fs.readFileSync(p, "utf8");
      const m = BANNED_GAME_OR_LEAK_RE.exec(txt);
      assert.equal(m, null, `Leak or banned term in ${name}: ${m?.[0]}`);
    }
  }
});
