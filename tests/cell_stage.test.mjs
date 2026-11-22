import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const compiled = fs.readFileSync(path.join(root, 'cell_stage_demo.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(compiled.split('var CellStageWidget;')[0], context);
const k = vm.runInContext('CellStage', context);
const preset = JSON.parse(fs.readFileSync(path.join(root, 'interop/cell_stage/presets/reference_evolution.v1.json')));
const golden = JSON.parse(fs.readFileSync(path.join(root, 'interop/cell_stage/fixtures/reference_trace.json')));
const jsonClone = value => JSON.parse(JSON.stringify(value));

function run(seed, steps, dt) {
  const cell = k.makeCell(seed);
  const site = k.makeFood();
  let events = 0;
  for (let i = 0; i < steps; i += 1) events |= k.tick(cell, site, dt);
  return { cell: jsonClone(cell), site: jsonClone(site), events };
}

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test('reference preset and constants match original EV1 contract', () => {
  assert.deepEqual(jsonClone(k.referencePreset()), preset);
  assert.equal(k.SCHEMA, 'cell_stage_evolution_preset.v1');
  assert.equal(k.EAT_RADIUS_M, 0.000012);
  assert.equal(k.DIVISION_BIOMASS, 8.0);
  assert.equal(k.DIVISION_ENERGY, 8.0);
  assert.equal(k.RNG_ZERO_SUBSTITUTE, 0x92D68CA2);
});

test('120 fixed 0.1s ticks match reference kernel golden trace', () => {
  const {cell, site, events} = run(golden.seed, golden.steps, golden.dt_s);
  assert.equal(events, golden.events);
  for (const [name, expected] of Object.entries(golden.cell)) {
    if (typeof expected === 'number') close(cell[name], expected);
    else assert.equal(cell[name], expected);
  }
  for (const [name, expected] of Object.entries(golden.food)) close(site[name], expected);
});

test('determinism, local RNG and unsigned zero-substitution', () => {
  assert.deepEqual(run(123456, 120, 0.1), run(123456, 120, 0.1));
  assert.equal(k.rngNext(0), k.rngNext(0x92D68CA2));
  assert.ok(k.rngNext(0) > 0 && k.rngNext(0) <= 0xFFFFFFFF);
  assert.notEqual(k.rngNext(123456), k.rngNext(123457));
});

test('bad ticks and dead cells preserve caller-owned objects bit-for-bit', () => {
  for (const dt of [0, -1, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN]) {
    const cell = k.makeCell(42), site = k.makeFood();
    const before = JSON.stringify([cell, site]);
    assert.equal(k.tick(cell, site, dt), 0);
    assert.equal(JSON.stringify([cell, site]), before);
  }
  const cell = k.makeCell(1), site = k.makeFood();
  cell.alive = false;
  const before = JSON.stringify([cell, site]);
  assert.equal(k.tick(cell, site, 0.1), 0);
  assert.equal(JSON.stringify([cell, site]), before);
});

test('exhaustion never yields negative resources or moves the cell', () => {
  const cell = k.makeCell(1), site = k.makeFood();
  cell.energy = 0.0001;
  assert.equal(k.tick(cell, site, 0.1), k.EXHAUST);
  assert.equal(cell.energy, 0);
  assert.equal(cell.alive, false);
  assert.equal(cell.x_m, 0);
  assert.equal(site.food_units, 25);
});

test('chemotaxis feeds through the same selected food object and grows', () => {
  const cell = k.makeCell(17), site = k.makeFood(0.00002, 0, 10);
  assert.equal(k.tick(cell, site, 0.1), 0);
  assert.ok(cell.x_m > 0);
  site.food_x_m = cell.x_m;
  assert.equal(k.tick(cell, site, 0.1) & (k.EAT | k.GROW), 3);
  assert.ok(site.food_units < 10);
  assert.ok(cell.biomass > 3);
  assert.equal(cell.nutrients >= 0, true);
});

test('division conserves budgets and deterministic daughter mutation', () => {
  const initial = k.makeCell(1001);
  Object.assign(initial, {biomass: 10, energy: 20, nutrients: 3});
  const a = jsonClone(initial), b = jsonClone(initial);
  const child = k.divide(a, 22, 10000);
  assert.ok(child);
  assert.deepEqual(jsonClone(child), jsonClone(k.divide(b, 22, 10000)));
  for (const quantity of ['biomass', 'energy', 'nutrients']) close(a[quantity] + child[quantity], initial[quantity]);
  assert.equal(child.id, 22);
  assert.equal(child.generation, 1);
  assert.notEqual(a.rng_state, child.rng_state);
  assert.equal(child.mutation_count, 1);
  assert.equal(a.mutation_count, 0);
  assert.equal(['speed_trait','uptake_trait','defense_trait'].filter(key => a[key] !== child[key]).length, 1);
  assert.ok(['speed_trait','uptake_trait','defense_trait'].every(key => child[key] >= 0 && child[key] <= 8));
});

test('rejected division is an exact no-op', () => {
  const parent = k.makeCell(7);
  const before = JSON.stringify(parent);
  assert.equal(k.divide(parent, 2), null);
  assert.equal(k.divide(parent, 1), null);
  assert.equal(k.divide(parent, 2, 10001), null);
  assert.equal(JSON.stringify(parent), before);
});

test('versioned preset validation round-trips and fails closed', () => {
  assert.deepEqual(jsonClone(k.parsePreset(preset)), preset);
  const unknown = jsonClone(preset); unknown.extra = 'unexpected';
  assert.throws(() => k.parsePreset(unknown));
  const n = jsonClone(preset); n.cell.speed_trait = 9;
  assert.throws(() => k.parsePreset(n));
  const neg = jsonClone(preset); neg.food_site.food_units = -1;
  assert.throws(() => k.parsePreset(neg));
  const invalid = jsonClone(preset); invalid.dt_s = Infinity;
  assert.throws(() => k.parsePreset(invalid));
  const modified = jsonClone(preset); modified.cell.energy = 34.1;
  assert.equal(k.parsePreset(modified).cell.energy, 34.1);
});

test('handoff emits data only and dead state cannot transfer', () => {
  const cell = k.makeCell(2);
  const dto = k.creatureHandoff(cell);
  assert.equal(dto.schema, 'cell_to_creature.v1');
  assert.equal(dto.source_cell_id, 1);
  assert.ok(dto.radius_m > 0);
  assert.deepEqual(jsonClone(dto), jsonClone(dto));
  cell.alive = false;
  assert.equal(k.creatureHandoff(cell), null);
});

test('runtime browser output remains an offline, self-contained local script', () => {
  assert.ok(compiled.includes('var CellStage'));
  assert.ok(compiled.includes('var CellStageWidget'));
  assert.ok(!/https?:\/\//i.test(compiled));
  const page = fs.readFileSync(path.join(root, 'evolution.html'), 'utf8');
  assert.ok(page.includes('src="cell_stage_demo.js"'));
  assert.ok(!page.includes('src="https:'));
  assert.ok(!page.includes('http-equiv="refresh"'));
});

test('event-only mitosis matches the independent EV1 xorshift reference vector', () => {
  const vector = JSON.parse(fs.readFileSync(path.join(root, 'interop/cell_stage/fixtures/reference_division.json')));
  const parent = k.makeCell(vector.seed);
  Object.assign(parent, vector.parent_initial);
  const daughter = k.divide(parent, vector.daughter_id, vector.mutation_bp);
  assert.ok(daughter);
  for (const [key, value] of Object.entries(vector.parent_after)) close(parent[key], value);
  for (const [key, value] of Object.entries(vector.daughter_after)) close(daughter[key], value);
});

test('the JSON schema has the same exact envelope and state fields', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'interop/cell_stage/evolution_preset.schema.json')));
  assert.deepEqual([...schema.required].sort(), Object.keys(preset).sort());
  assert.deepEqual([...schema.properties.cell.required].sort(), Object.keys(preset.cell).sort());
  assert.deepEqual([...schema.properties.food_site.required].sort(), Object.keys(preset.food_site).sort());
  assert.equal(schema.properties.schema.const, k.SCHEMA);
  assert.equal(schema.properties.kernel.const, k.KERNEL);
  assert.equal(schema.properties.cell.properties.speed_trait.maximum, k.MAX_TRAIT);
  assert.equal(schema.properties.cell.properties.energy.maximum, k.MAX_ENERGY);
  assert.equal(schema.properties.dt_s.minimum, 1e-16);
});

function simulatedPage(search = '') {
  const html = fs.readFileSync(path.join(root, 'evolution.html'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  const elements = new Map();
  for (const id of ids) {
    const el = {
      id, value: '', textContent: '', disabled: false, width: 0, height: 0,
      listeners: new Map(),
      classList: { toggle() {} },
      setAttribute() {},
      addEventListener(type, callback) { this.listeners.set(type, callback); },
      getBoundingClientRect() { return {width: id === 'timeline' ? 280 : 720, height: id === 'timeline' ? 56 : 500}; }
    };
    if (id === 'evolution-canvas' || id === 'timeline') {
      el.getContext = () => ({
        clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
        arc() {}, ellipse() {}, fill() {}, stroke() {}, closePath() {}, fillText() {},
        createRadialGradient() { return {addColorStop() {}}; }
      });
    }
    elements.set(id, el);
  }
  const defaults = {'seed':'123456', 'speed-trait':'2', 'uptake-trait':'2', 'defense-trait':'2', 'food-units':'25'};
  for (const [id, value] of Object.entries(defaults)) elements.get(id).value = value;
  const document = {
    readyState: 'complete', hidden: false,
    getElementById(id) { return elements.get(id) || null; },
    addEventListener() {}
  };
  const window = {
    devicePixelRatio: 1,
    addEventListener() {},
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout(callback) { callback(); }
  };
  const sandbox = {document, window, location:{search, protocol:'file:'}, URLSearchParams};
  vm.runInNewContext(compiled, sandbox);
  return {
    text(id) { return elements.get(id).textContent; },
    element(id) { return elements.get(id); },
    click(id) { elements.get(id).listeners.get('click')(); }
  };
}

test('offline page boots without network and exposes working deterministic controls', () => {
  const page = simulatedPage();
  assert.equal(page.text('tick-count'), '0');
  assert.equal(page.text('mode'), 'LIVE · DETERMINISTIC');
  page.click('step');
  assert.equal(page.text('tick-count'), '1');
  page.click('reset');
  assert.equal(page.text('tick-count'), '0');
  page.click('burst');
  assert.equal(page.text('tick-count'), '120');
  assert.equal(Number(page.text('biomass')), 9.60);
  assert.equal(page.text('ready'), 'READY');
  page.click('divide');
  assert.equal(page.text('cell-count'), '2');
  assert.equal(page.text('generation'), '1');
});

test('web kill switch is OFF-identity for interactive simulation writes', () => {
  const page = simulatedPage('?cell_stage_kill=1');
  assert.equal(page.text('mode'), 'KILLED · NO SIMULATION');
  assert.equal(page.element('step').disabled, true);
  const before = [page.text('tick-count'), page.text('biomass'), page.text('cell-count')];
  page.click('step');
  assert.deepEqual([page.text('tick-count'), page.text('biomass'), page.text('cell-count')], before);
});
