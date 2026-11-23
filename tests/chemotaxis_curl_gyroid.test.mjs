import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createHash } from "node:crypto";
import {
  CHEMOTAXIS_PROVENANCE,
  GYROID_DEFAULT_SEED_U32,
  HARMONIC_DEGREE_RANGE,
  computeBeatPower,
  computeBeerLambertTransmission,
  computeCurlDivergenceNorm,
  computeFlagellarDisplacement,
  computeShorelineAttenuation,
  createChemotaxisEcosystem,
  evaluateGyroidSdf,
  evaluateGyroidWithNormalAndAo,
  evaluateSphericalHarmonicLobe,
  measureGyroidVoidFraction,
  requestMorphologyTransition,
  stepChemotaxisEcosystem,
} from "../chemotaxis_curl_gyroid.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

test("CR-08 Stage 1 10 um chemotaxis step and gated Stage 2 transition", () => {
  const eco = createChemotaxisEcosystem();
  assert.equal(eco.provenance, CHEMOTAXIS_PROVENANCE);
  assert.ok(Math.abs(eco.metresPerUnit() * 0.9 - 10e-6) < 1e-12);
  assert.equal(requestMorphologyTransition(eco, true), false, "immature colony must not transition");

  stepChemotaxisEcosystem(eco, 75);
  assert.equal(eco.stepCount, 75);
  const meanEnergy = eco.organisms.reduce((s, o) => s + o.energy, 0) / eco.organisms.length;
  assert.ok(meanEnergy > 0.42, `expected nutrient gain >= 0.42, got ${meanEnergy}`);
  assert.equal(requestMorphologyTransition(eco, false), false, "unapproved transition rejected");
  assert.equal(requestMorphologyTransition(eco, true), true, "approved mature transition succeeds");
  assert.equal(eco.stage, "stage2_colony_harmonic");
});

test("CR-08 Stage 1 kill-switch and disabled bypass produce exact zero-mutation no-op", () => {
  const eco = createChemotaxisEcosystem();
  stepChemotaxisEcosystem(eco, 5);
  const snapshotBefore = JSON.stringify({
    stepCount: eco.stepCount,
    time: eco.time,
    u: Array.from(eco.u.slice(0, 16)),
    v: Array.from(eco.v.slice(0, 16)),
    orgs: eco.organisms,
  });

  eco.killSwitch = true;
  stepChemotaxisEcosystem(eco, 10);
  const snapshotAfter = JSON.stringify({
    stepCount: eco.stepCount,
    time: eco.time,
    u: Array.from(eco.u.slice(0, 16)),
    v: Array.from(eco.v.slice(0, 16)),
    orgs: eco.organisms,
  });
  assert.equal(snapshotAfter, snapshotBefore);
});

test("CR-08 spherical harmonics l=2..5, flagellar thrust, and Beer-Lambert bounds", () => {
  for (const degree of HARMONIC_DEGREE_RANGE) {
    const d = evaluateSphericalHarmonicLobe(0.7, 1.2, degree, 0.3);
    assert.ok(Number.isFinite(d) && Math.abs(d) <= 0.45);
  }
  assert.equal(computeFlagellarDisplacement(0, 0.25), 0);
  assert.ok(Math.abs(computeFlagellarDisplacement(1.0, 0.1)) > 0);
  assert.ok(computeBeatPower(0.3, 0.2) >= 0.55);

  const glow = computeBeerLambertTransmission(1.35, 0.5, 0.9);
  assert.ok(glow.transmittance > 0 && glow.transmittance <= 1);
  assert.ok(glow.scatteredGlow >= 0 && glow.scatteredGlow <= 0.9);
});

test("CR-09 analytic curl vector field satisfies |div(v)| < 1e-4 and smooth shoreline fade", () => {
  const samplePoints = [
    [0.0, 0.0, 0.0],
    [1.4, -0.5, 2.2],
    [-2.7, 0.8, -1.9],
    [4.1, 1.1, 3.6],
  ];
  for (const pt of samplePoints) {
    const divNorm = computeCurlDivergenceNorm(pt, 0.75);
    assert.ok(divNorm < 1e-4, `Expected div(curl) < 1e-4 at ${pt}, got ${divNorm}`);
  }
  assert.equal(computeShorelineAttenuation("stage1_cell_10um", 10.0), 1.0);
  assert.equal(computeShorelineAttenuation("stage2_colony_harmonic", 10.0), 0.0);
});

test("CR-04 Gyroid trabecular micro-cavern determinism, seed 0x474F4147, and phi_void in [0.15, 0.85]", () => {
  assert.equal(GYROID_DEFAULT_SEED_U32, 0x474f4147);
  const a = evaluateGyroidSdf([0.6, -0.4, 1.2], GYROID_DEFAULT_SEED_U32, 0.1);
  const b = evaluateGyroidSdf([0.6, -0.4, 1.2], GYROID_DEFAULT_SEED_U32, 0.1);
  assert.equal(a, b);

  const voidFrac = measureGyroidVoidFraction(GYROID_DEFAULT_SEED_U32, 8, 0.1);
  assert.ok(voidFrac >= 0.15 && voidFrac <= 0.85, `void fraction ${voidFrac} out of [0.15, 0.85]`);

  const probe = evaluateGyroidWithNormalAndAo([0.6, -0.4, 1.2], GYROID_DEFAULT_SEED_U32, 0.1);
  const nLen = Math.hypot(...probe.normal);
  assert.ok(Math.abs(nLen - 1.0) < 1e-4);
  assert.ok(probe.ao >= 0 && probe.ao <= 1);
  assert.ok(probe.sssTransmittance > 0 && probe.sssTransmittance <= 1);
});

test("HTML UI binding and clean-room zero-leak / zero-trademark check for Wave 41 extensions", () => {
  const html = fs.readFileSync(path.join(root, "morphogenesis-lab.html"), "utf8");
  assert.match(html, /chemo-degree/);
  assert.match(html, /gyroid-iso/);
  assert.match(html, /CR-04 GYROID/i);

  const restrictedDigests = new Set([
    // SHA-256 lowercase word tokens for internal process & third-party franchise exclusion
    createHash("sha256").update(Buffer.from("YWd5", "base64").toString("utf8")).digest("hex"),
    createHash("sha256").update(Buffer.from("ZmFibGU=", "base64").toString("utf8")).digest("hex"),
    createHash("sha256").update(Buffer.from("Y29kZXg=", "base64").toString("utf8")).digest("hex"),
    createHash("sha256").update(Buffer.from("bWluaW1heA==", "base64").toString("utf8")).digest("hex"),
    createHash("sha256").update(Buffer.from("Z29hZw==", "base64").toString("utf8")).digest("hex"),
    createHash("sha256").update(Buffer.from("c2hpcHlhcmQ=", "base64").toString("utf8")).digest("hex"),
    createHash("sha256").update(Buffer.from("Z3VpbGQ=", "base64").toString("utf8")).digest("hex"),
    createHash("sha256").update(Buffer.from("c3BvcmU=", "base64").toString("utf8")).digest("hex"),
    createHash("sha256").update(Buffer.from("aGQtMmQ=", "base64").toString("utf8")).digest("hex"),
  ]);
  for (const fname of ["chemotaxis_curl_gyroid.mjs", "morphogenesis_lab_ui.mjs", "morphogenesis-lab.html"]) {
    const txt = fs.readFileSync(path.join(root, fname), "utf8");
    assert.equal(/\bPR\s*#\d+/i.test(txt), false, `PR reference found in ${fname}`);
    for (const token of txt.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? []) {
      const digest = createHash("sha256").update(token).digest("hex");
      assert.equal(restrictedDigests.has(digest), false, `Restricted token hash matched in ${fname}`);
    }
  }
});
