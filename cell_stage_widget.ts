/// <reference path="cell_stage_core.ts" />
/* Offline-first demonstration UI. Canvas is presentation only; the pure
 * deterministic scalar model above owns all simulation transformations.
 */
namespace CellStageWidget {
  type Id =
    'evolution-canvas' | 'seed' | 'speed-trait' | 'uptake-trait' | 'defense-trait' |
    'food-units' | 'apply' | 'reset' | 'step' | 'burst' | 'play' | 'divide' |
    'export' | 'import' | 'mode' | 'tick-count' | 'generation' | 'energy' |
    'biomass' | 'nutrients' | 'food-remaining' | 'event-log' | 'active-cell' |
    'cell-count' | 'ready' | 'feedback' | 'speed-value' | 'uptake-value' |
    'defense-value' | 'food-value' | 'event-summary' | 'timeline';
  const $ = <T extends HTMLElement>(id: Id): T => {
    const element = document.getElementById(id);
    if (!element) throw new Error('Missing demo control: ' + id);
    return element as T;
  };
  const disabled = new URLSearchParams(location.search).get('cell_stage_kill');
  const isKilled = disabled === '1' || disabled === 'true' || disabled === 'yes' || disabled === 'on';
  const columns = 36;
  const rows = 26;
  const worldExtent = 0.000055;
  const cellColors = ['#84ecd6', '#f3c985', '#b8a5f2', '#f6a8af'];
  const canvas = $<HTMLCanvasElement>('evolution-canvas');
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('2D canvas is unavailable');
  const ctx: CanvasRenderingContext2D = context;
  let preset = CellStage.referencePreset();
  let cells: CellStage.Cell[] = [];
  let food: CellStage.FoodSite = CellStage.makeFood();
  let active = 0;
  let ticks = 0;
  let eventMask = 0;
  let lastEvent = 'Ready to explore';
  let running = false;
  let runTimer: number | null = null;
  let width = 720;
  let height = 500;
  let history: number[] = [];

  function say(message: string, bad = false): void {
    $('feedback').textContent = message;
    $('feedback').classList.toggle('error', bad);
  }

  function stop(): void {
    running = false;
    if (runTimer !== null) window.clearInterval(runTimer);
    runTimer = null;
    $('play').textContent = 'Play evolution';
    $('play').setAttribute('aria-pressed', 'false');
  }

  function reset(): void {
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

  function oneTick(): void {
    if (isKilled) return;
    let stepMask = 0;
    for (const cell of cells) {
      stepMask |= CellStage.tick(cell, food, preset.dt_s);
    }
    eventMask |= stepMask;
    ticks += 1;
    history.push(cells[active].biomass);
    if (history.length > 96) history.shift();
    if ((stepMask & CellStage.EXHAUST) !== 0) lastEvent = 'A cell exhausted its energy';
    else if ((stepMask & CellStage.READY_TO_DIVIDE) !== 0) lastEvent = 'Division ready — split manually';
    else if ((stepMask & (CellStage.EAT | CellStage.GROW)) === 3) lastEvent = 'Nutrients absorbed and biomass grew';
    else if ((stepMask & CellStage.EAT) !== 0) lastEvent = 'Nutrients absorbed';
    else if ((stepMask & CellStage.GROW) !== 0) lastEvent = 'Biomass increased';
    else lastEvent = 'Cell moved or maintained its state';
  }

  function advance(n: number): void {
    if (isKilled) return;
    for (let i = 0; i < n; i += 1) oneTick();
    update();
  }

  function maybeDivide(): void {
    if (isKilled) return;
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

  function numerical(id: Id): number {
    return Number(($<HTMLInputElement>(id)).value);
  }

  function applyControls(): void {
    if (isKilled) return;
    const candidate: CellStage.EvolutionPreset = {
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
    } catch (error) {
      say(error instanceof Error ? error.message : 'Invalid conditions', true);
    }
  }

  function reflectControls(): void {
    ($<HTMLInputElement>('seed')).value = String(preset.seed);
    ($<HTMLInputElement>('food-units')).max = String(Math.max(100, Math.ceil(preset.food_site.food_units)));
    ($<HTMLInputElement>('speed-trait')).value = String(preset.cell.speed_trait);
    ($<HTMLInputElement>('uptake-trait')).value = String(preset.cell.uptake_trait);
    ($<HTMLInputElement>('defense-trait')).value = String(preset.cell.defense_trait);
    ($<HTMLInputElement>('food-units')).value = String(preset.food_site.food_units);
    for (const [slider, output] of [
      ['speed-trait', 'speed-value'], ['uptake-trait', 'uptake-value'],
      ['defense-trait', 'defense-value'], ['food-units', 'food-value']
    ] as [Id, Id][]) {
      $(output).textContent = ($<HTMLInputElement>(slider)).value;
    }
  }

  function currentPreset(): CellStage.EvolutionPreset {
    return {
      schema: CellStage.SCHEMA, kernel: CellStage.KERNEL,
      seed: preset.seed, dt_s: preset.dt_s, mutation_bp: preset.mutation_bp,
      cell: { ...cells[active] }, food_site: { ...food }
    };
  }

  function download(): void {
    if (isKilled) return;
    const body = JSON.stringify(CellStage.parsePreset(currentPreset()), null, 2) + '\n';
    const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cell_stage_evolution_preset.v1.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    say('Selected cell and shared food state exported as a compatible JSON preset.');
  }

  async function importFile(file: File): Promise<void> {
    if (isKilled) return;
    if (file.size > 100000) throw new Error('Preset must be under 100 kB');
    const parsed: unknown = JSON.parse(await file.text());
    preset = CellStage.parsePreset(parsed);
    reflectControls();
    reset();
    say('Local preset loaded and validated. No file was uploaded.');
  }

  function draw(): void {
    const centerX = width * 0.49;
    const centerY = height * 0.50;
    const scale = Math.min(width, height) / (worldExtent * 2);
    const sx = (value: number) => centerX + value * scale;
    const sy = (value: number) => centerY - value * scale;
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
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = centerY % gridStep; y < height; y += gridStep) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    for (let i = 0; i < 43; i += 1) {
      const px = ((i * 173 + 31) % 997) / 997 * width;
      const py = ((i * 289 + 47) % 991) / 991 * height;
      ctx.fillStyle = i % 4 === 0 ? '#c4e9c440' : '#a5ced81c';
      ctx.beginPath(); ctx.arc(px, py, i % 7 === 0 ? 2 : 1, 0, Math.PI * 2); ctx.fill();
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
      ctx.beginPath(); ctx.arc(foodX, foodY, foodRadius * 2.8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f2d5968a';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(foodX, foodY, foodRadius * 0.6, 0, Math.PI * 2); ctx.stroke();
      for (let j = 0; j < 6; j += 1) {
        const angle = j * Math.PI / 3;
        ctx.fillStyle = '#e4cc86';
        ctx.beginPath(); ctx.arc(foodX + Math.cos(angle) * foodRadius, foodY + Math.sin(angle) * foodRadius, 2.4, 0, Math.PI * 2); ctx.fill();
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
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#cffbf77f';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y, r * 0.7, r * 0.67, -0.3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#f4a59c';
      ctx.beginPath(); ctx.ellipse(x + 0.09 * r, y + 0.05 * r, r * 0.28, r * 0.22, 0.4, 0, Math.PI * 2); ctx.fill();
      for (let p = 0; p < 4; p += 1) {
        const a = p * Math.PI * 0.65 + cell.id;
        ctx.fillStyle = '#d8d993c9';
        ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 0.51, y + Math.sin(a) * r * 0.48, r * 0.09, r * 0.055, a, 0, Math.PI * 2); ctx.fill();
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

  function drawHistory(): void {
    const box = $<HTMLCanvasElement>('timeline');
    const rect = box.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (box.width !== w || box.height !== h) { box.width = w; box.height = h; }
    const chart = box.getContext('2d');
    if (!chart) return;
    chart.clearRect(0, 0, w, h);
    chart.strokeStyle = '#355258';
    chart.beginPath(); chart.moveTo(0, h - 2); chart.lineTo(w, h - 2); chart.stroke();
    if (history.length < 2) return;
    const max = Math.max(10, ...history);
    chart.strokeStyle = '#83e9c7';
    chart.lineWidth = Math.max(1.5, dpr * 2);
    chart.beginPath();
    history.forEach((v, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = h - 6 - v / max * (h - 15);
      if (i === 0) chart.moveTo(x, y); else chart.lineTo(x, y);
    });
    chart.stroke();
  }

  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(320, Math.round(rect.width * ratio));
    height = Math.max(280, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width; canvas.height = height;
    }
    draw(); drawHistory();
  }

  function update(): void {
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
    ($<HTMLButtonElement>('divide')).disabled = isKilled || !CellStage.canDivide(focus) || cells.length >= 24;
    draw(); drawHistory();
  }

  function bind(): void {
    for (const [slider, output] of [
      ['speed-trait','speed-value'], ['uptake-trait','uptake-value'],
      ['defense-trait','defense-value'], ['food-units','food-value']
    ] as [Id, Id][]) {
      $(slider).addEventListener('input', () => { $(output).textContent = ($<HTMLInputElement>(slider)).value; });
    }
    $('apply').addEventListener('click', applyControls);
    $('reset').addEventListener('click', () => { reset(); say('Reference conditions restored from the current preset.'); });
    $('step').addEventListener('click', () => { stop(); advance(1); });
    $('burst').addEventListener('click', () => { stop(); advance(120); say('Advanced exactly 120 fixed kernel ticks.'); });
    $('divide').addEventListener('click', maybeDivide);
    $('play').addEventListener('click', () => {
      if (isKilled) return;
      if (running) { stop(); return; }
      running = true;
      $('play').textContent = 'Pause evolution';
      $('play').setAttribute('aria-pressed', 'true');
      runTimer = window.setInterval(() => { oneTick(); update(); }, 100);
    });
    $('export').addEventListener('click', download);
    $<HTMLInputElement>('import').addEventListener('change', (event) => {
      const input = event.currentTarget as HTMLInputElement;
      const file = input.files && input.files[0];
      if (file) importFile(file).catch((e: unknown) => say(e instanceof Error ? e.message : 'Invalid file', true));
      input.value = '';
    });
    $('evolution-canvas').addEventListener('click', () => {
      if (isKilled || cells.length <= 1) return;
      active = (active + 1) % cells.length;
      history = [cells[active].biomass];
      update();
    });
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(canvas);
  }

  async function loadBundledPreset(): Promise<void> {
    // Local sibling JSON only. Fallback keeps file:// usage fully offline too.
    if (location.protocol === 'file:') return;
    try {
      const response = await fetch('interop/cell_stage/presets/reference_evolution.v1.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Local preset not available');
      const loaded: unknown = await response.json();
      preset = CellStage.parsePreset(loaded);
      reflectControls(); reset();
      say('Local EV1 contract preset loaded; no external service was contacted.');
    } catch {
      say('Bundled offline defaults active; local JSON could not be read.');
    }
  }

  function init(): void {
    reflectControls(); bind(); reset(); resize();
    if (isKilled) {
      stop();
      $('mode').textContent = 'KILLED · NO SIMULATION';
      say('Kill switch active. No tick, division, import, or export will mutate state.');
      for (const id of ['apply','reset','step','burst','play','divide','export','import'] as Id[]) {
        ($<HTMLInputElement>(id)).disabled = true;
      }
    } else {
      $('mode').textContent = 'LIVE · DETERMINISTIC';
      void loadBundledPreset();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}
