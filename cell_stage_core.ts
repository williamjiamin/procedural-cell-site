/* Original MIT-licensed cell-stage scalar model. This is an isolated preview
 * of the EV1 rule contract: the game remains the authoritative simulation.
 * Units: metres, seconds and abstract gameplay resources. No biological
 * measurements or medical predictions are represented here.
 */
namespace CellStage {
  export const EAT = 1;
  export const GROW = 2;
  export const EXHAUST = 4;
  export const READY_TO_DIVIDE = 8;
  export const EAT_RADIUS_M = 0.000012;
  export const BASE_SPEED_M_S = 0.000003;
  export const SPEED_PER_TRAIT_M_S = 0.0000006;
  export const BASE_MAINTENANCE = 0.15;
  export const DEFENSE_MAINTENANCE = 0.02;
  export const MOTION_ENERGY_PER_M = 25000.0;
  export const ENERGY_PER_FOOD = 3.5;
  export const EAT_COST_PER_FOOD = 0.1;
  export const BASE_EAT_RATE = 1.0;
  export const EAT_RATE_PER_TRAIT = 0.2;
  export const BASE_GROWTH_RATE = 0.45;
  export const GROWTH_RATE_PER_TRAIT = 0.05;
  export const GROWTH_ENERGY_PER_UNIT = 2.0;
  export const MAX_ENERGY = 40.0;
  export const MAX_NUTRIENT = 30.0;
  export const DIVISION_BIOMASS = 8.0;
  export const DIVISION_ENERGY = 8.0;
  export const SEPARATION_M = 0.0000125;
  export const MAX_TRAIT = 8;
  export const RNG_ZERO_SUBSTITUTE = 0x92D68CA2;
  export const SCHEMA = 'cell_stage_evolution_preset.v1';
  export const KERNEL = 'EV1';

  export interface Cell {
    schema: number;
    id: number;
    generation: number;
    rng_state: number;
    x_m: number;
    y_m: number;
    energy: number;
    biomass: number;
    nutrients: number;
    speed_trait: number;
    uptake_trait: number;
    defense_trait: number;
    division_count: number;
    mutation_count: number;
    alive: boolean;
  }
  export interface FoodSite {
    food_x_m: number;
    food_y_m: number;
    food_units: number;
  }
  export interface EvolutionPreset {
    schema: typeof SCHEMA;
    kernel: typeof KERNEL;
    seed: number;
    dt_s: number;
    mutation_bp: number;
    cell: Cell;
    food_site: FoodSite;
  }

  export function rngNext(current: number): number {
    let value = current >>> 0;
    if (value === 0) value = RNG_ZERO_SUBSTITUTE;
    value = (value ^ (value << 13)) >>> 0;
    value = (value ^ (value >>> 17)) >>> 0;
    value = (value ^ (value << 5)) >>> 0;
    return value;
  }

  export function makeCell(seed: number, cellId = 1): Cell {
    if (!Number.isInteger(cellId) || cellId <= 0) throw new Error('Invalid positive cell ID');
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xFFFFFFFF) throw new Error('Invalid seed');
    return {
      schema: 1, id: cellId, generation: 0,
      rng_state: (seed >>> 0) || RNG_ZERO_SUBSTITUTE,
      x_m: 0.0, y_m: 0.0, energy: 12.0, biomass: 3.0, nutrients: 0.0,
      speed_trait: 2, uptake_trait: 2, defense_trait: 2,
      division_count: 0, mutation_count: 0, alive: true
    };
  }

  export function makeFood(food_x_m = 0.000009, food_y_m = 0, food_units = 25): FoodSite {
    return { food_x_m, food_y_m, food_units };
  }

  export function canDivide(cell: Cell): boolean {
    return cell.alive && cell.biomass >= DIVISION_BIOMASS && cell.energy >= DIVISION_ENERGY;
  }

  // All writes target the caller's cell and selected food record. No state is
  // created here, and random draws are exclusively part of discrete division.
  export function tick(cell: Cell, site: FoodSite, dt_s: number): number {
    if (!Number.isFinite(dt_s) || dt_s <= 0 || !cell.alive) return 0;
    let energy = cell.energy;
    const upkeep = (BASE_MAINTENANCE + DEFENSE_MAINTENANCE * cell.defense_trait) * dt_s;
    if (energy <= upkeep) {
      cell.energy = 0;
      cell.alive = false;
      return EXHAUST;
    }
    energy -= upkeep;

    let x_m = cell.x_m;
    let y_m = cell.y_m;
    let dx = site.food_x_m - x_m;
    let dy = site.food_y_m - y_m;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const speed_m_s = BASE_SPEED_M_S + SPEED_PER_TRAIT_M_S * cell.speed_trait;
    if (distance > 0) {
      let travel = Math.min(distance, speed_m_s * dt_s);
      let cost = travel * MOTION_ENERGY_PER_M;
      if (cost > energy) {
        travel = energy / MOTION_ENERGY_PER_M;
        cost = energy;
      }
      const ratio = travel / distance;
      x_m += dx * ratio;
      y_m += dy * ratio;
      energy -= cost;
      cell.x_m = x_m;
      cell.y_m = y_m;
    }

    let event = 0;
    dx = site.food_x_m - x_m;
    dy = site.food_y_m - y_m;
    const available = site.food_units;
    let nutrients = cell.nutrients;
    if (available > 0 && dx * dx + dy * dy <= EAT_RADIUS_M * EAT_RADIUS_M && nutrients < MAX_NUTRIENT) {
      const take = Math.min(available,
        (BASE_EAT_RATE + EAT_RATE_PER_TRAIT * cell.uptake_trait) * dt_s,
        MAX_NUTRIENT - nutrients);
      if (take > 0) {
        site.food_units = available - take;
        nutrients += take;
        energy = Math.min(MAX_ENERGY, energy + take * (ENERGY_PER_FOOD - EAT_COST_PER_FOOD));
        event |= EAT;
      }
    }

    const growth = Math.min(nutrients,
      (BASE_GROWTH_RATE + GROWTH_RATE_PER_TRAIT * cell.uptake_trait) * dt_s,
      energy / GROWTH_ENERGY_PER_UNIT);
    if (growth > 0) {
      nutrients -= growth;
      energy -= growth * GROWTH_ENERGY_PER_UNIT;
      cell.biomass += growth;
      event |= GROW;
    }
    cell.energy = Math.max(0, energy);
    cell.nutrients = Math.max(0, nutrients);
    if (canDivide(cell)) event |= READY_TO_DIVIDE;
    return event;
  }

  export function divide(parent: Cell, daughterId: number, mutationBp = 3000): Cell | null {
    if (!Number.isSafeInteger(daughterId) || daughterId <= 0 || daughterId === parent.id
      || !Number.isInteger(mutationBp) || mutationBp < 0 || mutationBp > 10000
      || !canDivide(parent)) return null;
    const oldX = parent.x_m;
    const halfEnergy = parent.energy * 0.5;
    const halfBiomass = parent.biomass * 0.5;
    const halfNutrients = parent.nutrients * 0.5;
    const mutationRoll = rngNext(parent.rng_state);
    const nextParentRng = rngNext(mutationRoll);
    parent.energy = halfEnergy;
    parent.biomass = halfBiomass;
    parent.nutrients = halfNutrients;
    parent.x_m = oldX - SEPARATION_M;
    parent.rng_state = nextParentRng;
    parent.division_count += 1;
    const daughter: Cell = { ...parent };
    daughter.id = daughterId;
    daughter.generation = parent.generation + 1;
    daughter.division_count = 0;
    daughter.x_m = oldX + SEPARATION_M;
    daughter.rng_state = rngNext(nextParentRng);
    if (mutationRoll % 10000 < mutationBp) {
      const traitKeys: (keyof Pick<Cell, 'speed_trait' | 'uptake_trait' | 'defense_trait'>)[] =
        ['speed_trait', 'uptake_trait', 'defense_trait'];
      const traitKey = traitKeys[(mutationRoll >>> 16) % 3];
      let direction = (mutationRoll & 0x1000000) !== 0 ? 1 : -1;
      const current = daughter[traitKey];
      if (current + direction < 0 || current + direction > MAX_TRAIT) direction = -direction;
      daughter[traitKey] = current + direction;
      daughter.mutation_count += 1;
    }
    return daughter;
  }

  export function creatureHandoff(cell: Cell): {
    schema: string; source_cell_id: number; generation: number;
    radius_m: number; locomotion_m_s: number; energy_reserve: number;
    speed_trait: number; uptake_trait: number; defense_trait: number;
  } | null {
    if (!cell.alive) return null;
    return {
      schema: 'cell_to_creature.v1', source_cell_id: cell.id,
      generation: cell.generation,
      radius_m: 0.000005 * Math.pow(Math.max(cell.biomass, 0.000001) / 3.0, 1.0 / 3.0),
      locomotion_m_s: BASE_SPEED_M_S + SPEED_PER_TRAIT_M_S * cell.speed_trait,
      energy_reserve: cell.energy,
      speed_trait: cell.speed_trait,
      uptake_trait: cell.uptake_trait,
      defense_trait: cell.defense_trait
    };
  }

  export function referencePreset(): EvolutionPreset {
    return {
      schema: SCHEMA, kernel: KERNEL, seed: 123456, dt_s: 0.1, mutation_bp: 3000,
      cell: makeCell(123456), food_site: makeFood()
    };
  }

  function record(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  function keysEqual(value: Record<string, unknown>, expected: readonly string[]): boolean {
    return Object.keys(value).length === expected.length && expected.every(k => Object.prototype.hasOwnProperty.call(value, k));
  }
  function scalar(value: unknown, name: string, min: number, max: number, integer = false): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) {
      throw new Error('Invalid ' + name);
    }
    return value;
  }

  // Reject unknown keys and invalid state before making any owner-facing writes.
  export function parsePreset(value: unknown): EvolutionPreset {
    if (!record(value) || !keysEqual(value, ['schema','kernel','seed','dt_s','mutation_bp','cell','food_site'])
      || value.schema !== SCHEMA || value.kernel !== KERNEL) throw new Error('Invalid preset envelope');
    const seed = scalar(value.seed, 'seed', 0, 0xFFFFFFFF, true);
    const dt_s = scalar(value.dt_s, 'dt_s', 1e-16, 10);
    const mutation_bp = scalar(value.mutation_bp, 'mutation_bp', 0, 10000, true);
    if (!record(value.cell) || !keysEqual(value.cell, [
      'schema','id','generation','rng_state','x_m','y_m','energy','biomass','nutrients',
      'speed_trait','uptake_trait','defense_trait','division_count','mutation_count','alive'
    ])) throw new Error('Invalid cell fields');
    const c = value.cell;
    if (c.schema !== 1 || typeof c.alive !== 'boolean') throw new Error('Invalid cell metadata');
    const cell: Cell = {
      schema: 1,
      id: scalar(c.id, 'id', 1, Number.MAX_SAFE_INTEGER, true),
      generation: scalar(c.generation, 'generation', 0, Number.MAX_SAFE_INTEGER, true),
      rng_state: scalar(c.rng_state, 'rng_state', 0, 0xFFFFFFFF, true),
      x_m: scalar(c.x_m, 'x_m', -1000, 1000), y_m: scalar(c.y_m, 'y_m', -1000, 1000),
      energy: scalar(c.energy, 'energy', 0, MAX_ENERGY),
      biomass: scalar(c.biomass, 'biomass', 0, 1000000),
      nutrients: scalar(c.nutrients, 'nutrients', 0, MAX_NUTRIENT),
      speed_trait: scalar(c.speed_trait, 'speed_trait', 0, MAX_TRAIT, true),
      uptake_trait: scalar(c.uptake_trait, 'uptake_trait', 0, MAX_TRAIT, true),
      defense_trait: scalar(c.defense_trait, 'defense_trait', 0, MAX_TRAIT, true),
      division_count: scalar(c.division_count, 'division_count', 0, Number.MAX_SAFE_INTEGER, true),
      mutation_count: scalar(c.mutation_count, 'mutation_count', 0, Number.MAX_SAFE_INTEGER, true),
      alive: c.alive
    };
    if (!record(value.food_site) || !keysEqual(value.food_site, ['food_x_m','food_y_m','food_units'])) throw new Error('Invalid food fields');
    const s = value.food_site;
    const food_site: FoodSite = {
      food_x_m: scalar(s.food_x_m, 'food_x_m', -1000, 1000),
      food_y_m: scalar(s.food_y_m, 'food_y_m', -1000, 1000),
      food_units: scalar(s.food_units, 'food_units', 0, 1000000)
    };
    return { schema: SCHEMA, kernel: KERNEL, seed, dt_s, mutation_bp, cell, food_site };
  }
}
