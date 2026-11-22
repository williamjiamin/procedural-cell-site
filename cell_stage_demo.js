"use strict";
/* Original MIT-licensed cell-stage scalar model. This is an isolated preview
 * of the EV1 rule contract: the game remains the authoritative simulation.
 * Units: metres, seconds and abstract gameplay resources. No biological
 * measurements or medical predictions are represented here.
 */
var CellStage;
(function (CellStage) {
    CellStage.EAT = 1;
    CellStage.GROW = 2;
    CellStage.EXHAUST = 4;
    CellStage.READY_TO_DIVIDE = 8;
    CellStage.EAT_RADIUS_M = 0.000012;
    CellStage.BASE_SPEED_M_S = 0.000003;
    CellStage.SPEED_PER_TRAIT_M_S = 0.0000006;
    CellStage.BASE_MAINTENANCE = 0.15;
    CellStage.DEFENSE_MAINTENANCE = 0.02;
    CellStage.MOTION_ENERGY_PER_M = 25000.0;
    CellStage.ENERGY_PER_FOOD = 3.5;
    CellStage.EAT_COST_PER_FOOD = 0.1;
    CellStage.BASE_EAT_RATE = 1.0;
    CellStage.EAT_RATE_PER_TRAIT = 0.2;
    CellStage.BASE_GROWTH_RATE = 0.45;
    CellStage.GROWTH_RATE_PER_TRAIT = 0.05;
    CellStage.GROWTH_ENERGY_PER_UNIT = 2.0;
    CellStage.MAX_ENERGY = 40.0;
    CellStage.MAX_NUTRIENT = 30.0;
    CellStage.DIVISION_BIOMASS = 8.0;
    CellStage.DIVISION_ENERGY = 8.0;
    CellStage.SEPARATION_M = 0.0000125;
    CellStage.MAX_TRAIT = 8;
    CellStage.RNG_ZERO_SUBSTITUTE = 0x92D68CA2;
    CellStage.SCHEMA = 'cell_stage_evolution_preset.v1';
    CellStage.KERNEL = 'EV1';
    function rngNext(current) {
        let value = current >>> 0;
        if (value === 0)
            value = CellStage.RNG_ZERO_SUBSTITUTE;
        value = (value ^ (value << 13)) >>> 0;
        value = (value ^ (value >>> 17)) >>> 0;
        value = (value ^ (value << 5)) >>> 0;
        return value;
    }
    CellStage.rngNext = rngNext;
    function makeCell(seed, cellId = 1) {
        if (!Number.isInteger(cellId) || cellId <= 0)
            throw new Error('Invalid positive cell ID');
        if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xFFFFFFFF)
            throw new Error('Invalid seed');
        return {
            schema: 1, id: cellId, generation: 0,
            rng_state: (seed >>> 0) || CellStage.RNG_ZERO_SUBSTITUTE,
            x_m: 0.0, y_m: 0.0, energy: 12.0, biomass: 3.0, nutrients: 0.0,
            speed_trait: 2, uptake_trait: 2, defense_trait: 2,
            division_count: 0, mutation_count: 0, alive: true
        };
    }
    CellStage.makeCell = makeCell;
    function makeFood(food_x_m = 0.000009, food_y_m = 0, food_units = 25) {
        return { food_x_m, food_y_m, food_units };
    }
    CellStage.makeFood = makeFood;
    function canDivide(cell) {
        return cell.alive && cell.biomass >= CellStage.DIVISION_BIOMASS && cell.energy >= CellStage.DIVISION_ENERGY;
    }
    CellStage.canDivide = canDivide;
    // All writes target the caller's cell and selected food record. No state is
    // created here, and random draws are exclusively part of discrete division.
    function tick(cell, site, dt_s) {
        if (!Number.isFinite(dt_s) || dt_s <= 0 || !cell.alive)
            return 0;
        let energy = cell.energy;
        const upkeep = (CellStage.BASE_MAINTENANCE + CellStage.DEFENSE_MAINTENANCE * cell.defense_trait) * dt_s;
        if (energy <= upkeep) {
            cell.energy = 0;
            cell.alive = false;
            return CellStage.EXHAUST;
        }
        energy -= upkeep;
        let x_m = cell.x_m;
        let y_m = cell.y_m;
        let dx = site.food_x_m - x_m;
        let dy = site.food_y_m - y_m;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed_m_s = CellStage.BASE_SPEED_M_S + CellStage.SPEED_PER_TRAIT_M_S * cell.speed_trait;
        if (distance > 0) {
            let travel = Math.min(distance, speed_m_s * dt_s);
            let cost = travel * CellStage.MOTION_ENERGY_PER_M;
            if (cost > energy) {
                travel = energy / CellStage.MOTION_ENERGY_PER_M;
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
        if (available > 0 && dx * dx + dy * dy <= CellStage.EAT_RADIUS_M * CellStage.EAT_RADIUS_M && nutrients < CellStage.MAX_NUTRIENT) {
            const take = Math.min(available, (CellStage.BASE_EAT_RATE + CellStage.EAT_RATE_PER_TRAIT * cell.uptake_trait) * dt_s, CellStage.MAX_NUTRIENT - nutrients);
            if (take > 0) {
                site.food_units = available - take;
                nutrients += take;
                energy = Math.min(CellStage.MAX_ENERGY, energy + take * (CellStage.ENERGY_PER_FOOD - CellStage.EAT_COST_PER_FOOD));
                event |= CellStage.EAT;
            }
        }
        const growth = Math.min(nutrients, (CellStage.BASE_GROWTH_RATE + CellStage.GROWTH_RATE_PER_TRAIT * cell.uptake_trait) * dt_s, energy / CellStage.GROWTH_ENERGY_PER_UNIT);
        if (growth > 0) {
            nutrients -= growth;
            energy -= growth * CellStage.GROWTH_ENERGY_PER_UNIT;
            cell.biomass += growth;
            event |= CellStage.GROW;
        }
        cell.energy = Math.max(0, energy);
        cell.nutrients = Math.max(0, nutrients);
        if (canDivide(cell))
            event |= CellStage.READY_TO_DIVIDE;
        return event;
    }
    CellStage.tick = tick;
    function divide(parent, daughterId, mutationBp = 3000) {
        if (!Number.isSafeInteger(daughterId) || daughterId <= 0 || daughterId === parent.id
            || !Number.isInteger(mutationBp) || mutationBp < 0 || mutationBp > 10000
            || !canDivide(parent))
            return null;
        const oldX = parent.x_m;
        const halfEnergy = parent.energy * 0.5;
        const halfBiomass = parent.biomass * 0.5;
        const halfNutrients = parent.nutrients * 0.5;
        const mutationRoll = rngNext(parent.rng_state);
        const nextParentRng = rngNext(mutationRoll);
        parent.energy = halfEnergy;
        parent.biomass = halfBiomass;
        parent.nutrients = halfNutrients;
        parent.x_m = oldX - CellStage.SEPARATION_M;
        parent.rng_state = nextParentRng;
        parent.division_count += 1;
        const daughter = { ...parent };
        daughter.id = daughterId;
        daughter.generation = parent.generation + 1;
        daughter.division_count = 0;
        daughter.x_m = oldX + CellStage.SEPARATION_M;
        daughter.rng_state = rngNext(nextParentRng);
        if (mutationRoll % 10000 < mutationBp) {
            const traitKeys = ['speed_trait', 'uptake_trait', 'defense_trait'];
            const traitKey = traitKeys[(mutationRoll >>> 16) % 3];
            let direction = (mutationRoll & 0x1000000) !== 0 ? 1 : -1;
            const current = daughter[traitKey];
            if (current + direction < 0 || current + direction > CellStage.MAX_TRAIT)
                direction = -direction;
            daughter[traitKey] = current + direction;
            daughter.mutation_count += 1;
        }
        return daughter;
    }
    CellStage.divide = divide;
    function creatureHandoff(cell) {
        if (!cell.alive)
            return null;
        return {
            schema: 'cell_to_creature.v1', source_cell_id: cell.id,
            generation: cell.generation,
            radius_m: 0.000005 * Math.pow(Math.max(cell.biomass, 0.000001) / 3.0, 1.0 / 3.0),
            locomotion_m_s: CellStage.BASE_SPEED_M_S + CellStage.SPEED_PER_TRAIT_M_S * cell.speed_trait,
            energy_reserve: cell.energy,
            speed_trait: cell.speed_trait,
            uptake_trait: cell.uptake_trait,
            defense_trait: cell.defense_trait
        };
    }
    CellStage.creatureHandoff = creatureHandoff;
    function referencePreset() {
        return {
            schema: CellStage.SCHEMA, kernel: CellStage.KERNEL, seed: 123456, dt_s: 0.1, mutation_bp: 3000,
            cell: makeCell(123456), food_site: makeFood()
        };
    }
    CellStage.referencePreset = referencePreset;
    function record(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }
    function keysEqual(value, expected) {
        return Object.keys(value).length === expected.length && expected.every(k => Object.prototype.hasOwnProperty.call(value, k));
    }
    function scalar(value, name, min, max, integer = false) {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) {
            throw new Error('Invalid ' + name);
        }
        return value;
    }
    // Reject unknown keys and invalid state before making any owner-facing writes.
    function parsePreset(value) {
        if (!record(value) || !keysEqual(value, ['schema', 'kernel', 'seed', 'dt_s', 'mutation_bp', 'cell', 'food_site'])
            || value.schema !== CellStage.SCHEMA || value.kernel !== CellStage.KERNEL)
            throw new Error('Invalid preset envelope');
        const seed = scalar(value.seed, 'seed', 0, 0xFFFFFFFF, true);
        const dt_s = scalar(value.dt_s, 'dt_s', 1e-16, 10);
        const mutation_bp = scalar(value.mutation_bp, 'mutation_bp', 0, 10000, true);
        if (!record(value.cell) || !keysEqual(value.cell, [
            'schema', 'id', 'generation', 'rng_state', 'x_m', 'y_m', 'energy', 'biomass', 'nutrients',
            'speed_trait', 'uptake_trait', 'defense_trait', 'division_count', 'mutation_count', 'alive'
        ]))
            throw new Error('Invalid cell fields');
        const c = value.cell;
        if (c.schema !== 1 || typeof c.alive !== 'boolean')
            throw new Error('Invalid cell metadata');
        const cell = {
            schema: 1,
            id: scalar(c.id, 'id', 1, Number.MAX_SAFE_INTEGER, true),
            generation: scalar(c.generation, 'generation', 0, Number.MAX_SAFE_INTEGER, true),
            rng_state: scalar(c.rng_state, 'rng_state', 0, 0xFFFFFFFF, true),
            x_m: scalar(c.x_m, 'x_m', -1000, 1000), y_m: scalar(c.y_m, 'y_m', -1000, 1000),
            energy: scalar(c.energy, 'energy', 0, CellStage.MAX_ENERGY),
            biomass: scalar(c.biomass, 'biomass', 0, 1000000),
            nutrients: scalar(c.nutrients, 'nutrients', 0, CellStage.MAX_NUTRIENT),
            speed_trait: scalar(c.speed_trait, 'speed_trait', 0, CellStage.MAX_TRAIT, true),
            uptake_trait: scalar(c.uptake_trait, 'uptake_trait', 0, CellStage.MAX_TRAIT, true),
            defense_trait: scalar(c.defense_trait, 'defense_trait', 0, CellStage.MAX_TRAIT, true),
            division_count: scalar(c.division_count, 'division_count', 0, Number.MAX_SAFE_INTEGER, true),
            mutation_count: scalar(c.mutation_count, 'mutation_count', 0, Number.MAX_SAFE_INTEGER, true),
            alive: c.alive
        };
        if (!record(value.food_site) || !keysEqual(value.food_site, ['food_x_m', 'food_y_m', 'food_units']))
            throw new Error('Invalid food fields');
        const s = value.food_site;
        const food_site = {
            food_x_m: scalar(s.food_x_m, 'food_x_m', -1000, 1000),
            food_y_m: scalar(s.food_y_m, 'food_y_m', -1000, 1000),
            food_units: scalar(s.food_units, 'food_units', 0, 1000000)
        };
        return { schema: CellStage.SCHEMA, kernel: CellStage.KERNEL, seed, dt_s, mutation_bp, cell, food_site };
    }
    CellStage.parsePreset = parsePreset;
})(CellStage || (CellStage = {}));
/// <reference path="cell_stage_core.ts" />
/* Offline-first demonstration UI. Canvas is presentation only; the pure
 * deterministic scalar model above owns all simulation transformations.
 */
var CellStageWidget;
(function (CellStageWidget) {
    const $ = (id) => {
        const element = document.getElementById(id);
        if (!element)
            throw new Error('Missing demo control: ' + id);
        return element;
    };
    const disabled = new URLSearchParams(location.search).get('cell_stage_kill');
    const isKilled = disabled === '1' || disabled === 'true' || disabled === 'yes' || disabled === 'on';
    const columns = 36;
    const rows = 26;
    const worldExtent = 0.000055;
    const cellColors = ['#84ecd6', '#f3c985', '#b8a5f2', '#f6a8af'];
    const canvas = $('evolution-canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context)
        throw new Error('2D canvas is unavailable');
    const ctx = context;
    let preset = CellStage.referencePreset();
    let cells = [];
    let food = CellStage.makeFood();
    let active = 0;
    let ticks = 0;
    let eventMask = 0;
    let lastEvent = 'Ready to explore';
    let running = false;
    let runTimer = null;
    let width = 720;
    let height = 500;
    let history = [];
    function say(message, bad = false) {
        $('feedback').textContent = message;
        $('feedback').classList.toggle('error', bad);
    }
    function stop() {
        running = false;
        if (runTimer !== null)
            window.clearInterval(runTimer);
        runTimer = null;
        $('play').textContent = 'Play evolution';
        $('play').setAttribute('aria-pressed', 'false');
    }
    function reset() {
        stop();
        ticks = 0;
        eventMask = 0;
        active = 0;
        cells = [{ ...preset.cell }];
        food = { ...preset.food_site };
        history = [cells[0].biomass];
        lastEvent = 'State restored from preset';
        update();
    }
    function oneTick() {
        if (isKilled)
            return;
        let stepMask = 0;
        for (const cell of cells) {
            stepMask |= CellStage.tick(cell, food, preset.dt_s);
        }
        eventMask |= stepMask;
        ticks += 1;
        history.push(cells[active].biomass);
        if (history.length > 96)
            history.shift();
        if ((stepMask & CellStage.EXHAUST) !== 0)
            lastEvent = 'A cell exhausted its energy';
        else if ((stepMask & CellStage.READY_TO_DIVIDE) !== 0)
            lastEvent = 'Division ready — split manually';
        else if ((stepMask & (CellStage.EAT | CellStage.GROW)) === 3)
            lastEvent = 'Nutrients absorbed and biomass grew';
        else if ((stepMask & CellStage.EAT) !== 0)
            lastEvent = 'Nutrients absorbed';
        else if ((stepMask & CellStage.GROW) !== 0)
            lastEvent = 'Biomass increased';
        else
            lastEvent = 'Cell moved or maintained its state';
    }
    function advance(n) {
        if (isKilled)
            return;
        for (let i = 0; i < n; i += 1)
            oneTick();
        update();
    }
    function maybeDivide() {
        if (isKilled)
            return;
        if (cells.length >= 24) {
            say('Preview holds at most 24 cells; the single-cell kernel remains uncapped.', true);
            return;
        }
        const parent = cells[active];
        const highestId = cells.reduce((highest, cell) => Math.max(highest, cell.id), 0);
        const daughter = CellStage.divide(parent, highestId + 1, preset.mutation_bp);
        if (!daughter) {
            say('Division requires at least 8 biomass and 8 energy game units.', true);
            return;
        }
        cells.push(daughter);
        active = cells.length - 1;
        lastEvent = 'Daughter spawned; deterministic trait roll complete';
        say('Daughter ' + daughter.id + ' added to this local preview.');
        update();
    }
    function numerical(id) {
        return Number(($(id)).value);
    }
    function applyControls() {
        if (isKilled)
            return;
        const candidate = {
            ...preset,
            seed: numerical('seed'),
            cell: CellStage.makeCell(numerical('seed')),
            food_site: { ...preset.food_site }
        };
        candidate.cell.speed_trait = numerical('speed-trait');
        candidate.cell.uptake_trait = numerical('uptake-trait');
        candidate.cell.defense_trait = numerical('defense-trait');
        candidate.food_site.food_units = numerical('food-units');
        try {
            preset = CellStage.parsePreset(candidate);
            reset();
            say('Conditions applied: this starts a new seeded evolution trace.');
        }
        catch (error) {
            say(error instanceof Error ? error.message : 'Invalid conditions', true);
        }
    }
    function reflectControls() {
        ($('seed')).value = String(preset.seed);
        ($('food-units')).max = String(Math.max(100, Math.ceil(preset.food_site.food_units)));
        ($('speed-trait')).value = String(preset.cell.speed_trait);
        ($('uptake-trait')).value = String(preset.cell.uptake_trait);
        ($('defense-trait')).value = String(preset.cell.defense_trait);
        ($('food-units')).value = String(preset.food_site.food_units);
        for (const [slider, output] of [
            ['speed-trait', 'speed-value'], ['uptake-trait', 'uptake-value'],
            ['defense-trait', 'defense-value'], ['food-units', 'food-value']
        ]) {
            $(output).textContent = ($(slider)).value;
        }
    }
    function currentPreset() {
        return {
            schema: CellStage.SCHEMA, kernel: CellStage.KERNEL,
            seed: preset.seed, dt_s: preset.dt_s, mutation_bp: preset.mutation_bp,
            cell: { ...cells[active] }, food_site: { ...food }
        };
    }
    function download() {
        if (isKilled)
            return;
        const body = JSON.stringify(CellStage.parsePreset(currentPreset()), null, 2) + '\n';
        const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'cell_stage_evolution_preset.v1.json';
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
        say('Selected cell and shared food state exported as a compatible JSON preset.');
    }
    async function importFile(file) {
        if (isKilled)
            return;
        if (file.size > 100000)
            throw new Error('Preset must be under 100 kB');
        const parsed = JSON.parse(await file.text());
        preset = CellStage.parsePreset(parsed);
        reflectControls();
        reset();
        say('Local preset loaded and validated. No file was uploaded.');
    }
    function draw() {
        const centerX = width * 0.49;
        const centerY = height * 0.50;
        const scale = Math.min(width, height) / (worldExtent * 2);
        const sx = (value) => centerX + value * scale;
        const sy = (value) => centerY - value * scale;
        ctx.fillStyle = '#071a22';
        ctx.fillRect(0, 0, width, height);
        const glow = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, Math.max(width, height) * 0.7);
        glow.addColorStop(0, '#173e45');
        glow.addColorStop(0.55, '#0d2931');
        glow.addColorStop(1, '#071a22');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#5d949825';
        ctx.lineWidth = 1;
        const gridStep = Math.min(width / columns, height / rows);
        for (let x = centerX % gridStep; x < width; x += gridStep) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = centerY % gridStep; y < height; y += gridStep) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        for (let i = 0; i < 43; i += 1) {
            const px = ((i * 173 + 31) % 997) / 997 * width;
            const py = ((i * 289 + 47) % 991) / 991 * height;
            ctx.fillStyle = i % 4 === 0 ? '#c4e9c440' : '#a5ced81c';
            ctx.beginPath();
            ctx.arc(px, py, i % 7 === 0 ? 2 : 1, 0, Math.PI * 2);
            ctx.fill();
        }
        const foodX = sx(food.food_x_m);
        const foodY = sy(food.food_y_m);
        const foodRadius = 11 + Math.min(18, Math.sqrt(food.food_units) * 3);
        if (food.food_units > 0) {
            const nutritionGlow = ctx.createRadialGradient(foodX, foodY, 0, foodX, foodY, foodRadius * 2.8);
            nutritionGlow.addColorStop(0, '#e7c878be');
            nutritionGlow.addColorStop(0.26, '#b9b06780');
            nutritionGlow.addColorStop(1, '#97a25c00');
            ctx.fillStyle = nutritionGlow;
            ctx.beginPath();
            ctx.arc(foodX, foodY, foodRadius * 2.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#f2d5968a';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(foodX, foodY, foodRadius * 0.6, 0, Math.PI * 2);
            ctx.stroke();
            for (let j = 0; j < 6; j += 1) {
                const angle = j * Math.PI / 3;
                ctx.fillStyle = '#e4cc86';
                ctx.beginPath();
                ctx.arc(foodX + Math.cos(angle) * foodRadius, foodY + Math.sin(angle) * foodRadius, 2.4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        cells.forEach((cell, index) => {
            const x = sx(cell.x_m);
            const y = sy(cell.y_m);
            const radiusM = 0.000005 * Math.pow(Math.max(cell.biomass, 0.000001) / 3, 1 / 3);
            const r = Math.min(72, Math.max(17, radiusM * scale * 1.8));
            const color = cellColors[index % cellColors.length];
            ctx.globalAlpha = cell.alive ? 1 : 0.38;
            ctx.shadowColor = color;
            ctx.shadowBlur = index === active ? 27 : 16;
            ctx.fillStyle = index === active ? '#2a7e80' : '#23545b';
            ctx.strokeStyle = color;
            ctx.lineWidth = index === active ? 3 : 2;
            ctx.beginPath();
            for (let i = 0; i <= 100; i += 1) {
                const a = i * Math.PI * 2 / 100;
                const surface = r * (1 + 0.075 * Math.sin(a * 5 + cell.id * 0.77 + ticks * 0.07)
                    + 0.04 * Math.sin(a * 9 - ticks * 0.05));
                const px = x + Math.cos(a) * surface;
                const py = y + Math.sin(a) * surface;
                if (i === 0)
                    ctx.moveTo(px, py);
                else
                    ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#cffbf77f';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(x, y, r * 0.7, r * 0.67, -0.3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#f4a59c';
            ctx.beginPath();
            ctx.ellipse(x + 0.09 * r, y + 0.05 * r, r * 0.28, r * 0.22, 0.4, 0, Math.PI * 2);
            ctx.fill();
            for (let p = 0; p < 4; p += 1) {
                const a = p * Math.PI * 0.65 + cell.id;
                ctx.fillStyle = '#d8d993c9';
                ctx.beginPath();
                ctx.ellipse(x + Math.cos(a) * r * 0.51, y + Math.sin(a) * r * 0.48, r * 0.09, r * 0.055, a, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            if (index === active) {
                ctx.font = '600 12px system-ui';
                ctx.fillStyle = '#e0f6f2';
                ctx.textAlign = 'center';
                ctx.fillText('CELL ' + cell.id, x, y + r + 23);
            }
        });
        ctx.font = '12px system-ui';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#aac5ca';
        ctx.fillText('ABSTRACT GAME SCALE   •   1 STEP = ' + preset.dt_s + ' s', 20, height - 22);
    }
    function drawHistory() {
        const box = $('timeline');
        const rect = box.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.round(rect.width * dpr));
        const h = Math.max(1, Math.round(rect.height * dpr));
        if (box.width !== w || box.height !== h) {
            box.width = w;
            box.height = h;
        }
        const chart = box.getContext('2d');
        if (!chart)
            return;
        chart.clearRect(0, 0, w, h);
        chart.strokeStyle = '#355258';
        chart.beginPath();
        chart.moveTo(0, h - 2);
        chart.lineTo(w, h - 2);
        chart.stroke();
        if (history.length < 2)
            return;
        const max = Math.max(10, ...history);
        chart.strokeStyle = '#83e9c7';
        chart.lineWidth = Math.max(1.5, dpr * 2);
        chart.beginPath();
        history.forEach((v, i) => {
            const x = (i / (history.length - 1)) * w;
            const y = h - 6 - v / max * (h - 15);
            if (i === 0)
                chart.moveTo(x, y);
            else
                chart.lineTo(x, y);
        });
        chart.stroke();
    }
    function resize() {
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        width = Math.max(320, Math.round(rect.width * ratio));
        height = Math.max(280, Math.round(rect.height * ratio));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        draw();
        drawHistory();
    }
    function update() {
        const focus = cells[active];
        $('tick-count').textContent = String(ticks);
        $('generation').textContent = String(focus.generation);
        $('cell-count').textContent = String(cells.length);
        $('energy').textContent = focus.energy.toFixed(2);
        $('biomass').textContent = focus.biomass.toFixed(2);
        $('nutrients').textContent = focus.nutrients.toFixed(2);
        $('food-remaining').textContent = food.food_units.toFixed(2);
        $('ready').textContent = CellStage.canDivide(focus) ? 'READY' : 'GROWING';
        $('ready').classList.toggle('is-ready', CellStage.canDivide(focus));
        $('active-cell').textContent = String(focus.id);
        $('event-log').textContent = lastEvent;
        $('event-summary').textContent =
            ((eventMask & CellStage.EAT) ? 'EAT ' : '') +
                ((eventMask & CellStage.GROW) ? 'GROW ' : '') +
                ((eventMask & CellStage.EXHAUST) ? 'EXHAUST ' : '') +
                ((eventMask & CellStage.READY_TO_DIVIDE) ? 'DIVISION READY' : '') || 'NONE';
        ($('divide')).disabled = isKilled || !CellStage.canDivide(focus) || cells.length >= 24;
        draw();
        drawHistory();
    }
    function bind() {
        for (const [slider, output] of [
            ['speed-trait', 'speed-value'], ['uptake-trait', 'uptake-value'],
            ['defense-trait', 'defense-value'], ['food-units', 'food-value']
        ]) {
            $(slider).addEventListener('input', () => { $(output).textContent = ($(slider)).value; });
        }
        $('apply').addEventListener('click', applyControls);
        $('reset').addEventListener('click', () => { reset(); say('Reference conditions restored from the current preset.'); });
        $('step').addEventListener('click', () => { stop(); advance(1); });
        $('burst').addEventListener('click', () => { stop(); advance(120); say('Advanced exactly 120 fixed kernel ticks.'); });
        $('divide').addEventListener('click', maybeDivide);
        $('play').addEventListener('click', () => {
            if (isKilled)
                return;
            if (running) {
                stop();
                return;
            }
            running = true;
            $('play').textContent = 'Pause evolution';
            $('play').setAttribute('aria-pressed', 'true');
            runTimer = window.setInterval(() => { oneTick(); update(); }, 100);
        });
        $('export').addEventListener('click', download);
        $('import').addEventListener('change', (event) => {
            const input = event.currentTarget;
            const file = input.files && input.files[0];
            if (file)
                importFile(file).catch((e) => say(e instanceof Error ? e.message : 'Invalid file', true));
            input.value = '';
        });
        $('evolution-canvas').addEventListener('click', () => {
            if (isKilled || cells.length <= 1)
                return;
            active = (active + 1) % cells.length;
            history = [cells[active].biomass];
            update();
        });
        window.addEventListener('resize', resize, { passive: true });
        document.addEventListener('visibilitychange', () => { if (document.hidden)
            stop(); });
        if (typeof ResizeObserver !== 'undefined')
            new ResizeObserver(resize).observe(canvas);
    }
    async function loadBundledPreset() {
        // Local sibling JSON only. Fallback keeps file:// usage fully offline too.
        if (location.protocol === 'file:')
            return;
        try {
            const response = await fetch('interop/cell_stage/presets/reference_evolution.v1.json', { cache: 'no-store' });
            if (!response.ok)
                throw new Error('Local preset not available');
            const loaded = await response.json();
            preset = CellStage.parsePreset(loaded);
            reflectControls();
            reset();
            say('Local EV1 contract preset loaded; no external service was contacted.');
        }
        catch {
            say('Bundled offline defaults active; local JSON could not be read.');
        }
    }
    function init() {
        reflectControls();
        bind();
        reset();
        resize();
        if (isKilled) {
            stop();
            $('mode').textContent = 'KILLED · NO SIMULATION';
            say('Kill switch active. No tick, division, import, or export will mutate state.');
            for (const id of ['apply', 'reset', 'step', 'burst', 'play', 'divide', 'export', 'import']) {
                ($(id)).disabled = true;
            }
        }
        else {
            $('mode').textContent = 'LIVE · DETERMINISTIC';
            void loadBundledPreset();
        }
    }
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', init, { once: true });
    else
        init();
})(CellStageWidget || (CellStageWidget = {}));
