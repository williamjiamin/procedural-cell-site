/**
 * Clean-room MIT Morphogenesis Extensions:
 * - CR-08: Chemotaxis two-substrate reaction-diffusion, l=2..5 spherical/flagellar
 *   harmonics, and Beer-Lambert bioluminescence transmission (zero blood/gore).
 * - CR-09: Analytic 3-octave divergence-free vector-potential curl filaments
 *   with shoreline damping (div(v) < 1e-4).
 * - CR-04: Deterministic 2-octave smooth-min Gyroid trabecular pore SDF
 *   (seed_u32 = 0x474F4147, void fraction phi_void in [0.15, 0.85]).
 */

export const CHEMOTAXIS_PROVENANCE = "clean_room_original";
export const GYROID_DEFAULT_SEED_U32 = 0x474f4147;
export const HARMONIC_DEGREE_RANGE = Object.freeze([2, 3, 4, 5]);

export const CHEMOTAXIS_DEFAULT_CONFIG = Object.freeze({
  grid: 24,
  extent: 16.0,
  dt: 0.12,
  diffusionU: 0.18,
  diffusionV: 0.09,
  feed: 0.036,
  removal: 0.06,
  sourceGain: 0.14,
  chemotaxisStrength: 0.85,
  separationStrength: 0.4,
  cohesionStrength: 0.25,
  alignmentStrength: 0.22,
  flowStrength: 0.28,
  beatFrequencyHz: 1.6,
  currentOctaves: 3,
  maturitySteps: 72,
  maturityEnergy: 0.42,
  agentCount: 10,
  seed: GYROID_DEFAULT_SEED_U32,
});

export function createMulberry32(seedU32 = GYROID_DEFAULT_SEED_U32) {
  let state = seedU32 >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(val, lo, hi) {
  return Math.max(lo, Math.min(hi, val));
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function smoothMin(a, b, k = 0.25) {
  const safeK = Math.max(k, 1e-6);
  const h = clamp(0.5 + (0.5 * (b - a)) / safeK, 0, 1);
  return a * h + b * (1 - h) - safeK * h * (1 - h);
}

export function periodicDelta(target, origin, extent) {
  return ((target - origin + extent * 0.5) % extent + extent) % extent - extent * 0.5;
}

/** CR-08: Beer-Lambert exponential attenuation & scattered bioluminescence emission. */
export function computeBeerLambertTransmission(kappa, opticalDepth, incidentRadiance = 1.0) {
  const safeKappa = Math.max(0, Number(kappa) || 0);
  const safeDepth = Math.max(0, Number(opticalDepth) || 0);
  const safeIncident = Math.max(0, Number(incidentRadiance) || 0);
  const transmittance = Math.exp(-safeKappa * safeDepth);
  return {
    transmittance,
    scatteredGlow: (1 - transmittance) * safeIncident,
  };
}

/** CR-08: Clean spherical/flagellar harmonic lobe displacement for degrees l = 2..5. */
export function evaluateSphericalHarmonicLobe(theta, phi, degree = 3, phase = 0, amplitude = 0.14) {
  const l = HARMONIC_DEGREE_RANGE.includes(degree) ? degree : clamp(Math.round(degree), 2, 5);
  const cTheta = Math.cos(theta);
  const sTheta = Math.sin(theta);
  let angularMode;
  if (l === 2) {
    angularMode = 0.5 * (3 * cTheta * cTheta - 1) + 0.35 * sTheta * sTheta * Math.cos(2 * phi + phase);
  } else if (l === 3) {
    angularMode = 0.5 * cTheta * (5 * cTheta * cTheta - 3) + 0.3 * Math.pow(sTheta, 3) * Math.cos(3 * phi + phase);
  } else if (l === 4) {
    const c2 = cTheta * cTheta;
    angularMode = 0.125 * (35 * c2 * c2 - 30 * c2 + 3) + 0.25 * Math.pow(sTheta, 4) * Math.cos(4 * phi + phase);
  } else {
    const c2 = cTheta * cTheta;
    angularMode = 0.125 * cTheta * (63 * c2 * c2 - 70 * c2 + 15) + 0.22 * Math.pow(sTheta, 5) * Math.cos(5 * phi + phase);
  }
  return clamp(amplitude * angularMode, -0.45, 0.45);
}

/** CR-08: Traveling flagellar wave (zero at soma anchor s=0) and nonnegative thrust. */
export function computeFlagellarDisplacement(s, t, phase = 0, amplitude = 0.23, frequencyHz = 1.6) {
  const clS = clamp(s, 0, 1);
  if (clS === 0) return 0;
  return amplitude * Math.pow(clS, 1.35) * Math.sin(2 * Math.PI * (1.7 * clS - frequencyHz * t) + phase);
}

export function computeBeatPower(t, phase = 0, frequencyHz = 1.6) {
  const s = Math.sin(2 * Math.PI * frequencyHz * t + phase);
  return 0.55 + 0.45 * s * s;
}

/** CR-09: Analytic curl of 3-octave periodic vector potential; div(v) === 0 identically. */
export function evaluateCurlVectorField(pos, time = 0, octaves = 3) {
  const [px, py, pz] = pos;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  for (let i = 0; i < octaves; i++) {
    const frequency = Math.pow(2, i) * 0.33;
    const amplitude = Math.pow(0.58, i) / frequency;
    const qx = frequency * px + 0.23 * time + 1.31 * i;
    const qy = frequency * py - 0.17 * time + 2.07 * i;
    const qz = frequency * pz + 0.11 * time + 0.79 * i;
    const sx = Math.sin(qx);
    const sy = Math.sin(qy);
    const sz = Math.sin(qz);
    const cx = Math.cos(qx);
    const cy = Math.cos(qy);
    const cz = Math.cos(qz);
    const scale = amplitude * frequency;
    vx += scale * (-sx * sy - cz * cx);
    vy += scale * (-sy * sz - cx * cy);
    vz += scale * (-sz * sx - cy * cz);
  }
  return [vx, vy, vz];
}

export function computeCurlDivergenceNorm(pos, time = 0, h = 1e-4, octaves = 3) {
  const [x, y, z] = pos;
  const vx1 = evaluateCurlVectorField([x + h, y, z], time, octaves)[0];
  const vx0 = evaluateCurlVectorField([x - h, y, z], time, octaves)[0];
  const vy1 = evaluateCurlVectorField([x, y + h, z], time, octaves)[1];
  const vy0 = evaluateCurlVectorField([x, y - h, z], time, octaves)[1];
  const vz1 = evaluateCurlVectorField([x, y, z + h], time, octaves)[2];
  const vz0 = evaluateCurlVectorField([x, y, z - h], time, octaves)[2];
  return Math.abs((vx1 - vx0 + vy1 - vy0 + vz1 - vz0) / (2 * h));
}

export function computeShorelineAttenuation(stage, zCoord) {
  return stage === "stage1_cell_10um" ? 1.0 : 1.0 - smoothstep(2.0, 8.0, zCoord);
}

/** CR-04: Deterministic 2-octave smooth-min Gyroid trabecular pore SDF (seed_u32 = 0x474F4147). */
export function evaluateGyroidSdf(pos, seedU32 = GYROID_DEFAULT_SEED_U32, poreIso = 0.0, scale = 1.65) {
  const rng = createMulberry32(seedU32);
  const ph1x = rng() * Math.PI * 2;
  const ph1y = rng() * Math.PI * 2;
  const ph1z = rng() * Math.PI * 2;
  const ph2x = rng() * Math.PI * 2;
  const ph2y = rng() * Math.PI * 2;
  const ph2z = rng() * Math.PI * 2;

  const [px, py, pz] = pos;
  const evalOctave = (x, y, z, freq, ox, oy, oz) => {
    const u = x * freq + ox;
    const v = y * freq + oy;
    const w = z * freq + oz;
    return Math.sin(u) * Math.cos(v) + Math.sin(v) * Math.cos(w) + Math.sin(w) * Math.cos(u);
  };

  const primary = evalOctave(px, py, pz, scale, ph1x, ph1y, ph1z) - poreIso;
  const secondary = evalOctave(px, py, pz, scale * 2.05, ph2x, ph2y, ph2z) * 0.45 - poreIso;
  return smoothMin(primary, secondary, 0.28);
}

export function evaluateGyroidWithNormalAndAo(pos, seedU32 = GYROID_DEFAULT_SEED_U32, poreIso = 0.0) {
  const eps = 1e-3;
  const [x, y, z] = pos;
  const sdf = evaluateGyroidSdf(pos, seedU32, poreIso);
  const gx = evaluateGyroidSdf([x + eps, y, z], seedU32, poreIso) - evaluateGyroidSdf([x - eps, y, z], seedU32, poreIso);
  const gy = evaluateGyroidSdf([x, y + eps, z], seedU32, poreIso) - evaluateGyroidSdf([x, y - eps, z], seedU32, poreIso);
  const gz = evaluateGyroidSdf([x, y, z + eps], seedU32, poreIso) - evaluateGyroidSdf([x, y, z - eps], seedU32, poreIso);
  const mag = Math.hypot(gx, gy, gz) || 1.0;
  const normal = [gx / mag, gy / mag, gz / mag];

  let aoAccum = 0;
  let weight = 0.5;
  for (let i = 1; i <= 4; i++) {
    const step = 0.08 * i;
    const samplePos = [x + normal[0] * step, y + normal[1] * step, z + normal[2] * step];
    const sampleSdf = evaluateGyroidSdf(samplePos, seedU32, poreIso);
    aoAccum += weight * Math.max(0, step - sampleSdf);
    weight *= 0.5;
  }
  const ao = clamp(1 - aoAccum * 1.4, 0, 1);
  const sss = computeBeerLambertTransmission(1.35, Math.max(0, -sdf) + 0.15, 0.85);
  return {
    sdf,
    normal,
    ao,
    sssTransmittance: sss.transmittance,
    glowIntensity: sss.scatteredGlow,
    seedU32: seedU32 >>> 0,
    provenance: CHEMOTAXIS_PROVENANCE,
  };
}

export function measureGyroidVoidFraction(seedU32 = GYROID_DEFAULT_SEED_U32, samplesPerAxis = 8, poreIso = 0.1) {
  let voidCount = 0;
  const total = samplesPerAxis * samplesPerAxis * samplesPerAxis;
  const span = Math.PI * 2;
  for (let ix = 0; ix < samplesPerAxis; ix++) {
    for (let iy = 0; iy < samplesPerAxis; iy++) {
      for (let iz = 0; iz < samplesPerAxis; iz++) {
        const p = [(ix / samplesPerAxis) * span, (iy / samplesPerAxis) * span, (iz / samplesPerAxis) * span];
        if (evaluateGyroidSdf(p, seedU32, poreIso) > 0) voidCount++;
      }
    }
  }
  return voidCount / total;
}

export function createChemotaxisEcosystem(overrides = {}) {
  const cfg = { ...CHEMOTAXIS_DEFAULT_CONFIG, ...overrides };
  const n = cfg.grid;
  const u = new Float64Array(n * n).fill(1.0);
  const v = new Float64Array(n * n).fill(0.0);
  const sources = new Float64Array(n * n).fill(0.0);
  const attractors = [
    { x: -5, z: -3, radius: 1.8, intensity: 1.0 },
    { x: 5, z: 4, radius: 2.0, intensity: 0.9 },
    { x: -1, z: 6, radius: 1.3, intensity: 0.7 },
  ];

  for (let rz = 0; rz < n; rz++) {
    const cz = ((rz + 0.5) / n - 0.5) * cfg.extent;
    for (let rx = 0; rx < n; rx++) {
      const cx = ((rx + 0.5) / n - 0.5) * cfg.extent;
      const idx = rz * n + rx;
      for (const att of attractors) {
        const dx = periodicDelta(cx, att.x, cfg.extent);
        const dz = periodicDelta(cz, att.z, cfg.extent);
        const plume = att.intensity * Math.exp(-(dx * dx + dz * dz) / (2 * att.radius * att.radius));
        sources[idx] = clamp(sources[idx] + plume, 0, 2);
        v[idx] = clamp(v[idx] + 0.17 * plume, 0, 1);
        u[idx] = clamp(u[idx] - 0.09 * plume, 0, 1);
      }
    }
  }

  const rng = createMulberry32(cfg.seed);
  const organisms = [];
  for (let i = 0; i < cfg.agentCount; i++) {
    const theta = rng() * Math.PI * 2;
    organisms.push({
      id: i,
      position: [(rng() - 0.5) * 0.84 * cfg.extent, (rng() - 0.5) * 1.2, (rng() - 0.5) * 0.84 * cfg.extent],
      velocity: [Math.cos(theta) * 0.18, 0, Math.sin(theta) * 0.18],
      phase: rng() * Math.PI * 2,
      energy: 0.18,
      harmonicDegree: HARMONIC_DEGREE_RANGE[i % HARMONIC_DEGREE_RANGE.length],
    });
  }

  return {
    provenance: CHEMOTAXIS_PROVENANCE,
    config: cfg,
    enabled: true,
    killSwitch: false,
    stage: "stage1_cell_10um",
    stepCount: 0,
    time: 0,
    u,
    v,
    sources,
    organisms,
    metresPerUnit() {
      return this.stage === "stage1_cell_10um" ? 10e-6 / 0.9 : 0.5;
    },
  };
}

function samplePeriodicV(eco, x, z) {
  const n = eco.config.grid;
  const mod = (val) => ((val % n) + n) % n;
  const sx = mod(((x / eco.config.extent + 0.5) * n) - 0.5);
  const sz = mod(((z / eco.config.extent + 0.5) * n) - 0.5);
  const ix = Math.floor(sx);
  const iz = Math.floor(sz);
  const fx = sx - ix;
  const fz = sz - iz;
  const ix1 = (ix + 1) % n;
  const iz1 = (iz + 1) % n;
  return (
    (1 - fx) * (1 - fz) * eco.v[iz * n + ix] +
    fx * (1 - fz) * eco.v[iz * n + ix1] +
    (1 - fx) * fz * eco.v[iz1 * n + ix] +
    fx * fz * eco.v[iz1 * n + ix1]
  );
}

export function stepChemotaxisEcosystem(eco, count = 1) {
  if (count < 0) throw new RangeError("count must be nonnegative");
  if (!eco.enabled || eco.killSwitch) return eco;
  const cfg = eco.config;
  const n = cfg.grid;

  for (let iter = 0; iter < count; iter++) {
    const nextU = new Float64Array(n * n);
    const nextV = new Float64Array(n * n);
    for (let r = 0; r < n; r++) {
      const rUp = (r - 1 + n) % n;
      const rDn = (r + 1) % n;
      for (let c = 0; c < n; c++) {
        const cLt = (c - 1 + n) % n;
        const cRt = (c + 1) % n;
        const idx = r * n + c;
        const uC = eco.u[idx];
        const vC = eco.v[idx];
        const lapU = eco.u[rUp * n + c] + eco.u[rDn * n + c] + eco.u[r * n + cLt] + eco.u[r * n + cRt] - 4 * uC;
        const lapV = eco.v[rUp * n + c] + eco.v[rDn * n + c] + eco.v[r * n + cLt] + eco.v[r * n + cRt] - 4 * vC;
        const rxn = uC * vC * vC;
        nextU[idx] = clamp(uC + cfg.dt * (cfg.diffusionU * lapU - rxn + cfg.feed * (1 - uC)), 0, 1);
        nextV[idx] = clamp(vC + cfg.dt * (cfg.diffusionV * lapV + rxn - (cfg.feed + cfg.removal) * vC + cfg.sourceGain * eco.sources[idx]), 0, 1);
      }
    }
    eco.u = nextU;
    eco.v = nextV;

    for (const org of eco.organisms) {
      const [px, py, pz] = org.position;
      const h = 0.15;
      const gx = (samplePeriodicV(eco, px + h, pz) - samplePeriodicV(eco, px - h, pz)) / (2 * h);
      const gz = (samplePeriodicV(eco, px, pz + h) - samplePeriodicV(eco, px, pz - h)) / (2 * h);
      const gMag = Math.hypot(gx, gz);
      const chemScale = gMag > 1e-7 ? (cfg.chemotaxisStrength * Math.min(1, gMag * 30)) / gMag : 0;
      const curl = evaluateCurlVectorField([px * 0.4, py * 0.4, pz * 0.4], eco.time, cfg.currentOctaves);
      const water = computeShorelineAttenuation(eco.stage, pz);
      const hx = gx * chemScale + curl[0] * cfg.flowStrength * water + org.velocity[0] * 0.7;
      const hy = (curl[1] * cfg.flowStrength * water + org.velocity[1] * 0.7) * (0.25 + water * 0.45);
      const hz = gz * chemScale + curl[2] * cfg.flowStrength * water + org.velocity[2] * 0.7;
      const hMag = Math.hypot(hx, hy, hz) || 1.0;
      const thrust = computeBeatPower(eco.time, org.phase, cfg.beatFrequencyHz);
      const speed = (eco.stage === "stage1_cell_10um" ? 0.19 : 0.27) * thrust;
      const vx = 0.72 * org.velocity[0] + 0.28 * (hx / hMag) * speed;
      const vy = 0.72 * org.velocity[1] + 0.28 * (hy / hMag) * speed;
      const vz = 0.72 * org.velocity[2] + 0.28 * (hz / hMag) * speed;
      const wrap = (val) => (((val + cfg.extent * 0.5) % cfg.extent) + cfg.extent) % cfg.extent - cfg.extent * 0.5;
      const nx = wrap(px + cfg.dt * vx);
      const ny = clamp(py + cfg.dt * vy, water > 0.2 ? -1.2 : -0.2, water > 0.2 ? 1.2 : 0.2);
      const nz = wrap(pz + cfg.dt * vz);
      const nutrient = samplePeriodicV(eco, nx, nz);
      org.position = [nx, ny, nz];
      org.velocity = [vx, vy, vz];
      org.energy = clamp(org.energy + cfg.dt * (0.1 + nutrient * 0.9 - 0.035 * thrust), 0, 1);
    }

    eco.time += cfg.dt;
    eco.stepCount += 1;
  }
  return eco;
}

export function requestMorphologyTransition(eco, approved = false) {
  if (!eco.enabled || eco.killSwitch || !approved || eco.stage !== "stage1_cell_10um") return false;
  const meanEnergy = eco.organisms.reduce((acc, o) => acc + o.energy, 0) / Math.max(1, eco.organisms.length);
  if (eco.stepCount < eco.config.maturitySteps || meanEnergy < eco.config.maturityEnergy) return false;
  eco.stage = "stage2_colony_harmonic";
  return true;
}
