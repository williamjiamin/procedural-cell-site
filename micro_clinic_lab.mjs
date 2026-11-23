/**
 * Clean-room MIT Cellular Origin (10 um) to Multiverse Evolution Spine,
 * Isomorphic Play / Art-Style WorldState Lens Switcher, PoreLab Viscoelastic Recoil,
 * and Macrophage Swarm Micro-Clinic Mechanics.
 * Educational simulation only; not medical diagnosis or physiological measurement.
 */

export const STAGE_1_ORIGIN_DIAMETER_UM = 10;
export const STAGE_1_EAT_RADIUS_UM = 12;

export const CELLULAR_EVOLUTION_SPINE = Object.freeze([
  Object.freeze({
    stage: 1,
    id: "single_cell_10um",
    scaleLabel: "10 um",
    title: "Stage 1: 10 um Single-Cell Origin",
    focus: "Chemotaxis, nutrient engulfment & mitotic threshold (10 um membrane / 12 um uptake field).",
    href: "evolution.html",
  }),
  Object.freeze({
    stage: 2,
    id: "colony_250um",
    scaleLabel: "250 um",
    title: "Stage 2: 250 um Protist Colony & Turing Signaling",
    focus: "Gray-Scott morphogen waves coordinate multicellular boundary specialization.",
    href: "morphogenesis-lab.html#rd-canvas",
  }),
  Object.freeze({
    stage: 3,
    id: "micro_clinic_2mm",
    scaleLabel: "2.4 mm",
    title: "Stage 3: PoreLab & Macrophage Swarm Micro-Clinic",
    focus: "Viscoelastic pore closure mechanics paired with leukocyte swarm clearance.",
    href: "morphogenesis-lab.html#micro-clinic",
  }),
  Object.freeze({
    stage: 4,
    id: "organism_168cm",
    scaleLabel: "1.68 m",
    title: "Stage 4: 1.68 m Organism & Articulated Frame",
    focus: "Full macroscopic anatomy, multi-joint kinematics & structural PBR surfaces.",
    href: "morphogenesis-lab.html#cutaway-asset",
  }),
  Object.freeze({
    stage: 5,
    id: "multiverse_lens",
    scaleLabel: "Multiverse",
    title: "Stage 5: Single-Truth Multiverse View Lenses",
    focus: "Switch between Action Chemotaxis, Turn Triage, and Ink Atlas over one biological state.",
    href: "morphogenesis-lab.html#isomorphic-preview",
  }),
]);

export const ISOMORPHIC_PLAY_STYLES = Object.freeze({
  action_chemotaxis: Object.freeze({
    id: "action_chemotaxis",
    label: "Real-Time Chemotaxis (3D Action)",
    pacing: "continuous_60hz",
    camera: "third_person_membrane",
  }),
  turn_triage: Object.freeze({
    id: "turn_triage",
    label: "ATP Allocation Triage (Turn-Based)",
    pacing: "discrete_turn_queue",
    camera: "tactical_cross_section",
  }),
  isometric_patrol: Object.freeze({
    id: "isometric_patrol",
    label: "Isometric Tissue Patrol",
    pacing: "hybrid_arena",
    camera: "oblique_top_down",
  }),
});

export const ART_STYLES = Object.freeze({
  bioluminescent: Object.freeze({
    id: "bioluminescent",
    label: "Bioluminescent Darkfield",
    palette: ["#0b1925", "#22d3ee", "#f59e0b"],
  }),
  ink_watercolor: Object.freeze({
    id: "ink_watercolor",
    label: "Botanical Ink & Chiaroscuro",
    palette: ["#f6f2e8", "#1f2937", "#b45309"],
  }),
  technical_blueprint: Object.freeze({
    id: "technical_blueprint",
    label: "Vector Scale Blueprint",
    palette: ["#0f172a", "#38bdf8", "#a7f3d0"],
  }),
});

export function createBiologicalWorldState(seed = 20261123) {
  return {
    rngSeed: seed >>> 0 || 0x92d68ca2,
    rngDrawCount: 0,
    mutationRevision: 0,
    playStyle: "action_chemotaxis",
    artStyle: "bioluminescent",
    cellDiameterUm: STAGE_1_ORIGIN_DIAMETER_UM,
    atp: 42.0,
    biomass: 3.0,
    integrity: 100.0,
    macrophageCount: 14,
    biofilmLoad: 36.0,
  };
}

export function switchIsomorphicLens(worldState, { playStyle, artStyle } = {}) {
  if (!worldState || typeof worldState !== "object") {
    throw new Error("worldState required");
  }
  if (playStyle !== undefined) {
    if (!Object.prototype.hasOwnProperty.call(ISOMORPHIC_PLAY_STYLES, playStyle)) {
      throw new Error(`Unknown playStyle: ${playStyle}`);
    }
    worldState.playStyle = playStyle;
  }
  if (artStyle !== undefined) {
    if (!Object.prototype.hasOwnProperty.call(ART_STYLES, artStyle)) {
      throw new Error(`Unknown artStyle: ${artStyle}`);
    }
    worldState.artStyle = artStyle;
  }
  // Isomorphic lens transition MUST NOT advance combat RNG or alter biological budgets.
  return {
    playStyle: worldState.playStyle,
    artStyle: worldState.artStyle,
    rngDrawCount: worldState.rngDrawCount,
    atp: worldState.atp,
    integrity: worldState.integrity,
  };
}

export const PORE_LAB_DEFAULTS = Object.freeze({
  stretchedRadiusMm: 0.92,
  equilibriumRadiusMm: 0.24,
  fastShare: 0.55,
  tauFastMin: 1.5,
  tauSlowMin: 45.0,
});

export function evaluatePoreRecoil(
  stretchedRadiusMm,
  equilibriumRadiusMm,
  elapsedMin,
  {
    fastShare = PORE_LAB_DEFAULTS.fastShare,
    tauFastMin = PORE_LAB_DEFAULTS.tauFastMin,
    tauSlowMin = PORE_LAB_DEFAULTS.tauSlowMin,
  } = {},
) {
  if (
    !Number.isFinite(stretchedRadiusMm) ||
    !Number.isFinite(equilibriumRadiusMm) ||
    !Number.isFinite(elapsedMin) ||
    !Number.isFinite(fastShare) ||
    !Number.isFinite(tauFastMin) ||
    !Number.isFinite(tauSlowMin)
  ) {
    throw new Error("All PoreLab parameters must be finite");
  }
  if (equilibriumRadiusMm <= 0 || stretchedRadiusMm < equilibriumRadiusMm || elapsedMin < 0) {
    throw new Error("Invalid pore radius or elapsed time bounds");
  }
  if (fastShare < 0 || fastShare > 1 || tauFastMin <= 0 || tauSlowMin <= tauFastMin) {
    throw new Error("Invalid relaxation time-constant configuration");
  }

  const dr = stretchedRadiusMm - equilibriumRadiusMm;
  const fastRem = fastShare * Math.exp(-elapsedMin / tauFastMin);
  const slowRem = (1 - fastShare) * Math.exp(-elapsedMin / tauSlowMin);
  const radiusMm = equilibriumRadiusMm + dr * (fastRem + slowRem);
  const closureRatio = dr <= 1e-12 ? 1.0 : Math.min(1.0, Math.max(0.0, 1.0 - (fastRem + slowRem)));
  return {
    radiusMm: Number(radiusMm.toFixed(6)),
    fastRemaining: Number(fastRem.toFixed(6)),
    slowRemaining: Number(slowRem.toFixed(6)),
    closurePct: Number((closureRatio * 100).toFixed(2)),
  };
}

export const MACROPHAGE_SWARM_DEFAULTS = Object.freeze({
  arenaScaleRatio: 0.005 / 0.012,
  clearancePerMacrophagePerS: 0.14,
  atpCostPerClearanceUnit: 0.22,
});

export function stepMacrophageSwarm(worldState, dtS = 0.5, immuneBoost = 1.0) {
  if (!Number.isFinite(dtS) || dtS <= 0 || !Number.isFinite(immuneBoost) || immuneBoost < 0) {
    throw new Error("Invalid swarm step parameters");
  }
  const potentialClearance =
    worldState.macrophageCount *
    MACROPHAGE_SWARM_DEFAULTS.clearancePerMacrophagePerS *
    immuneBoost *
    dtS;
  const maxAffordableClearance =
    worldState.atp / MACROPHAGE_SWARM_DEFAULTS.atpCostPerClearanceUnit;
  const actualCleared = Math.min(worldState.biofilmLoad, potentialClearance, maxAffordableClearance);
  worldState.biofilmLoad = Math.max(0, Number((worldState.biofilmLoad - actualCleared).toFixed(4)));
  worldState.atp = Math.max(
    0,
    Number((worldState.atp - actualCleared * MACROPHAGE_SWARM_DEFAULTS.atpCostPerClearanceUnit).toFixed(4)),
  );
  worldState.mutationRevision += 1;
  return {
    clearedUnits: Number(actualCleared.toFixed(4)),
    remainingBiofilm: worldState.biofilmLoad,
    remainingAtp: worldState.atp,
  };
}
