/**
 * Clean-room MIT Workshop Cutaway, Four Architecture Orders, Chiaroscuro Plane,
 * and Tile-Lag Parameter Evaluators.
 */

export const WORKSHOP_TABLETOP_SPEC = {
  lengthM: 1.9,
  heightM: 0.92,
  depthM: 0.84,
  scaleGaugeM: 1.68,
};

export const WORKSHOP_CUTAWAY_ASSETS = [
  { id: "bench", label: "Workshop Custom Bench", lod0Tris: 14944, lod1Tris: 5984, lod2Tris: 2640, material: "aaa_b3_walnut_shop_cabinetry" },
  { id: "controller_carrier", label: "Control Carrier PCB", lod0Tris: 43328, lod1Tris: 16240, lod2Tris: 3780, material: "aaa_b3_pcb_fr4_copper_traces" },
  { id: "pulse_output_carrier", label: "PWM Carrier PCB", lod0Tris: 55580, lod1Tris: 19468, lod2Tris: 5356, material: "aaa_b3_pcb_fr4_copper_traces" },
  { id: "six_joint_actuator_cutaway", label: "Six-Joint Actuator Cutaway", lod0Tris: 65888, lod1Tris: 28784, lod2Tris: 14500, material: "aaa_b3_clockwork_brass_gears" },
  { id: "signal_instrument", label: "CRT Signal Instrument", lod0Tris: 22996, lod1Tris: 6824, lod2Tris: 3000, material: "aaa_b2_brushed_aerospace_alloy" },
  { id: "condenser_exhibit", label: "Transparent Condenser Display", lod0Tris: 13632, lod1Tris: 5522, lod2Tris: 2248, material: "aaa_b2_cathedral_stained_glass" },
  { id: "burette_stand", label: "Burette Display Stand", lod0Tris: 18416, lod1Tris: 6326, lod2Tris: 3006, material: "aaa_b2_verdigris_boiler_copper" },
];

export const ACTUATOR_JOINT_LIMITS = [
  { name: "base_yaw", minDeg: -180, maxDeg: 180, lengthM: 0.085 },
  { name: "shoulder_pitch", minDeg: -90, maxDeg: 115, lengthM: 0.14 },
  { name: "elbow_pitch", minDeg: -135, maxDeg: 135, lengthM: 0.125 },
  { name: "forearm_roll", minDeg: -180, maxDeg: 180, lengthM: 0.09 },
  { name: "wrist_pitch", minDeg: -110, maxDeg: 110, lengthM: 0.075 },
  { name: "tool_roll", minDeg: -360, maxDeg: 360, lengthM: 0.045 },
];

export const ARCH_ORDERS = {
  gothic: {
    key: "gothic",
    label: "Gothic Rib & Lancet",
    widthM: 4.4,
    heightM: 4.673,
    depthM: 0.978,
    apertureWidthM: 0.95,
    apertureHeightM: 1.68,
    lod0Tris: 100880,
    lod1Tris: 47076,
    lod2Tris: 22072,
    clearRays: 1333,
    obstructedRays: 0,
    archSpanM: 1.68,
    archRiseM: 1.18,
    primaryMaterial: "aaa_carved_limestone",
  },
  tudor: {
    key: "tudor",
    label: "Tudor Timber Jetty",
    widthM: 3.104,
    heightM: 4.121,
    depthM: 1.035,
    apertureWidthM: 1.1,
    apertureHeightM: 2.05,
    lod0Tris: 50024,
    lod1Tris: 8280,
    lod2Tris: 4208,
    clearRays: 1886,
    obstructedRays: 0,
    archSpanM: 1.1,
    archRiseM: 0.45,
    primaryMaterial: "aaa_dark_oak_iron",
  },
  classical_ionic: {
    key: "classical_ionic",
    label: "Classical Ionic Portico",
    widthM: 3.3,
    heightM: 3.388,
    depthM: 0.798,
    apertureWidthM: 0.95,
    apertureHeightM: 1.68,
    lod0Tris: 36192,
    lod1Tris: 14664,
    lod2Tris: 5276,
    clearRays: 1302,
    obstructedRays: 4,
    archSpanM: 1.44,
    archRiseM: 0.72,
    primaryMaterial: "aaa_b2_alabaster_marble_vein",
  },
  cyber: {
    key: "cyber",
    label: "Cyber Rain-Ready Louver",
    widthM: 3.896,
    heightM: 3.351,
    depthM: 0.987,
    apertureWidthM: 0.95,
    apertureHeightM: 1.68,
    lod0Tris: 32180,
    lod1Tris: 5124,
    lod2Tris: 1596,
    clearRays: 1320,
    obstructedRays: 0,
    archSpanM: 1.85,
    archRiseM: 0.22,
    primaryMaterial: "aaa_b3_anodized_carbon_weave",
  },
};

export const TILE_LAG_WITNESSES = [
  { material: "limestone", straightRepeatCorr: 1.0, stochasticCorr: 0.004 },
  { material: "basalt", straightRepeatCorr: 1.0, stochasticCorr: 0.001 },
  { material: "marble", straightRepeatCorr: 1.0, stochasticCorr: 0.012 },
  { material: "dark_oak", straightRepeatCorr: 1.0, stochasticCorr: 0.006 },
  { material: "metal_inlay", straightRepeatCorr: 1.0, stochasticCorr: 0.006 },
];

export function solveCutawayPose(anglesDeg) {
  if (!Array.isArray(anglesDeg) || anglesDeg.length !== ACTUATOR_JOINT_LIMITS.length) {
    throw new Error("anglesDeg must have 6 joint values");
  }
  const clamped = {};
  for (let i = 0; i < ACTUATOR_JOINT_LIMITS.length; i++) {
    const spec = ACTUATOR_JOINT_LIMITS[i];
    const v = Number(anglesDeg[i]);
    if (!Number.isFinite(v)) throw new Error(`Invalid angle for ${spec.name}`);
    clamped[spec.name] = Math.min(spec.maxDeg, Math.max(spec.minDeg, v));
  }
  const yaw = (clamped.base_yaw * Math.PI) / 180;
  const t1 = (clamped.shoulder_pitch * Math.PI) / 180;
  const t2 = t1 + (clamped.elbow_pitch * Math.PI) / 180;
  const t3 = t2 + (clamped.wrist_pitch * Math.PI) / 180;
  const radial =
    ACTUATOR_JOINT_LIMITS[1].lengthM * Math.cos(t1) +
    ACTUATOR_JOINT_LIMITS[2].lengthM * Math.cos(t2) +
    (ACTUATOR_JOINT_LIMITS[4].lengthM + ACTUATOR_JOINT_LIMITS[5].lengthM) * Math.cos(t3);
  const z =
    ACTUATOR_JOINT_LIMITS[0].lengthM +
    ACTUATOR_JOINT_LIMITS[1].lengthM * Math.sin(t1) +
    ACTUATOR_JOINT_LIMITS[2].lengthM * Math.sin(t2) +
    (ACTUATOR_JOINT_LIMITS[4].lengthM + ACTUATOR_JOINT_LIMITS[5].lengthM) * Math.sin(t3);
  return {
    clamped,
    radialReachM: Number(Math.abs(radial).toFixed(4)),
    endEffectorM: [
      Number((radial * Math.cos(yaw)).toFixed(4)),
      Number((radial * Math.sin(yaw)).toFixed(4)),
      Number(z.toFixed(4)),
    ],
  };
}

export function evaluateOrderBay(
  orderKey,
  { scaleFactor = 1.0, entityWidthM = 0.8, entityHeightM = 1.68, roofLoadKnPerM = 12.0 } = {},
) {
  const order = ARCH_ORDERS[orderKey];
  if (!order) throw new Error(`Unknown order ${orderKey}`);
  if (scaleFactor <= 0 || entityWidthM <= 0 || entityHeightM <= 0 || roofLoadKnPerM <= 0) {
    throw new Error("Scale, entity dimensions, and roof load must be positive");
  }
  const apertureW = order.apertureWidthM * scaleFactor;
  const apertureH = order.apertureHeightM * scaleFactor;
  const span = order.archSpanM * scaleFactor;
  const rise = order.archRiseM * scaleFactor;
  const horizontalThrustKn = (roofLoadKnPerM * span * span) / (8 * rise);
  const lodReductionPct = (1 - order.lod2Tris / order.lod0Tris) * 100;
  return {
    order: order.key,
    label: order.label,
    apertureWidthM: Number(apertureW.toFixed(3)),
    apertureHeightM: Number(apertureH.toFixed(3)),
    clearsPrism: apertureW >= entityWidthM && apertureH >= entityHeightM,
    horizontalThrustKn: Number(horizontalThrustKn.toFixed(3)),
    lodReductionPct: Number(lodReductionPct.toFixed(2)),
    primaryMaterial: order.primaryMaterial,
  };
}

export function computeChiaroscuroPlane(lightAngleDeg, planeNormalDeg, ambient = 0.16) {
  const deltaRad = ((lightAngleDeg - planeNormalDeg) * Math.PI) / 180;
  const lambert = Math.max(0, Math.cos(deltaRad));
  return Number((ambient + (1 - ambient) * lambert).toFixed(4));
}

export function solveRelativeLuminanceContrast(l1, l2) {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return Number(((hi + 0.05) / (lo + 0.05)).toFixed(3));
}
