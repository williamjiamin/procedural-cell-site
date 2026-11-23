import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  GOLDEN_ANGLE_RAD,
  PBR_24_SURFACE_RECIPES,
  REACTION_DIFFUSION_PRESETS,
  REQUIRED_PBR_CHANNELS,
  computeHeitzNeyretHexWeights,
  createReactionDiffusionField,
  generateBotanicalPhyllotaxis,
  stepReactionDiffusionField,
} from '../morphogenesis_lab.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEAK_RE = /\b(AGY|Fable|Codex|Minimax|GOAG|PR\s*#\d+|Shipyard|Guild)\b/i;

test('Gray-Scott reaction-diffusion preserves [0,1] bounds and amplifies activator spots', () => {
  let field = createReactionDiffusionField(24, 24);
  const preset = REACTION_DIFFUSION_PRESETS.dragon_chitin;
  for (let i = 0; i < 12; i++) {
    field = stepReactionDiffusionField(field, preset);
  }
  let maxV = 0;
  for (let i = 0; i < field.v.length; i++) {
    assert.ok(field.u[i] >= 0 && field.u[i] <= 1);
    assert.ok(field.v[i] >= 0 && field.v[i] <= 1);
    if (field.v[i] > maxV) maxV = field.v[i];
  }
  assert.ok(maxV > 0.1);
});

test('Vogel phyllotaxis and Heitz-Neyret hex anti-tiling weights are deterministic and normalized', () => {
  const pts = generateBotanicalPhyllotaxis(96, 10);
  assert.equal(pts.length, 96);
  assert.ok(Math.abs(pts[1].angleRad - GOLDEN_ANGLE_RAD) < 1e-6);
  assert.ok(pts[95].radius > pts[0].radius);

  for (const [u, v] of [[0.15, 0.42], [1.9, -0.7], [-2.5, 3.1]]) {
    const hex = computeHeitzNeyretHexWeights(u, v, 2.0);
    assert.equal(hex.vertices.length, 3);
    assert.ok(Math.abs(hex.weightSum - 1) < 1e-12);
    for (const vert of hex.vertices) {
      assert.ok(vert.weight >= 0 && vert.weight <= 1);
    }
  }
});

test('24-material 5-map PBR recipes, morphogenesis-lab.html, sitemap and zero-leak checks pass', () => {
  assert.equal(PBR_24_SURFACE_RECIPES.length, 24);
  assert.deepEqual(REQUIRED_PBR_CHANNELS, ['albedo', 'normal', 'depth16', 'orm', 'cavity']);

  const html = fs.readFileSync(path.join(root, 'morphogenesis-lab.html'), 'utf8');
  assert.match(html, /Gray-Scott/i);
  assert.match(html, /phyllotaxis/i);
  assert.match(html, /Heitz-Neyret/i);
  assert.match(html, /robotforge\.org\/labs/);
  assert.match(html, /acadifi\.com\/labs/);

  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /morphogenesis-lab\.html/);

  for (const fname of ['morphogenesis-lab.html', 'morphogenesis_lab.mjs', 'morphogenesis_lab_ui.mjs', 'index.html', 'evolution.html']) {
    const txt = fs.readFileSync(path.join(root, fname), 'utf8');
    assert.equal(LEAK_RE.test(txt), false, `Leak found in ${fname}`);
  }
});
