/**
 * Clean-room Cellular Reaction-Diffusion, Botanical Phyllotaxis,
 * Heitz-Neyret Hexagonal Anti-Tiling & 24-Material 5-Map PBR Visualizer Engine.
 */

export const REQUIRED_PBR_CHANNELS = ["albedo", "normal", "depth16", "orm", "cavity"];
export const GOLDEN_ANGLE_RAD = Math.PI * (3 - Math.sqrt(5));

export const REACTION_DIFFUSION_PRESETS = {
  mitosis: { label: "Mitosis Spots", feed: 0.0367, kill: 0.0649, du: 0.16, dv: 0.08 },
  coral: { label: "Coral Morphogenesis", feed: 0.0545, kill: 0.062, du: 0.16, dv: 0.08 },
  dragon_chitin: { label: "Chitin Scale Pattern", feed: 0.037, kill: 0.06, du: 0.16, dv: 0.08 },
  stripes: { label: "Turing Labyrinth", feed: 0.029, kill: 0.057, du: 0.16, dv: 0.08 },
};

export const PBR_24_SURFACE_RECIPES = [
  { slug: "aaa_carved_limestone", category: "architecture", metallic: 0.0, roughness: 0.78, ior: 1.52, subsurface: 0.0 },
  { slug: "aaa_dark_oak_iron", category: "metals", metallic: 0.45, roughness: 0.56, ior: 1.5, subsurface: 0.0 },
  { slug: "aaa_royal_silk_brocade", category: "fabrics", metallic: 0.08, roughness: 0.42, ior: 1.54, subsurface: 0.0 },
  { slug: "aaa_gambeson_leather", category: "fabrics", metallic: 0.0, roughness: 0.62, ior: 1.48, subsurface: 0.0 },
  { slug: "aaa_damascus_runesteel", category: "metals", metallic: 0.94, roughness: 0.28, ior: 2.5, subsurface: 0.0 },
  { slug: "aaa_forest_moss_fern", category: "botanical", metallic: 0.0, roughness: 0.82, ior: 1.45, subsurface: 0.18 },
  { slug: "aaa_dragon_chitin_hide", category: "organic", metallic: 0.06, roughness: 0.46, ior: 1.54, subsurface: 0.08 },
  { slug: "aaa_inlaid_shop_terracotta", category: "architecture", metallic: 0.0, roughness: 0.72, ior: 1.5, subsurface: 0.0 },
  { slug: "aaa_b2_wet_neon_asphalt", category: "architecture", metallic: 0.0, roughness: 0.24, ior: 1.52, subsurface: 0.0 },
  { slug: "aaa_b2_brushed_aerospace_alloy", category: "metals", metallic: 0.96, roughness: 0.26, ior: 2.4, subsurface: 0.0 },
  { slug: "aaa_b2_verdigris_boiler_copper", category: "metals", metallic: 0.68, roughness: 0.52, ior: 1.9, subsurface: 0.0 },
  { slug: "aaa_b2_tavern_wool_tapestry", category: "fabrics", metallic: 0.0, roughness: 0.88, ior: 1.46, subsurface: 0.0 },
  { slug: "aaa_b2_alabaster_marble_vein", category: "architecture", metallic: 0.0, roughness: 0.22, ior: 1.51, subsurface: 0.22 },
  { slug: "aaa_b2_basalt_dwarf_carving", category: "architecture", metallic: 0.0, roughness: 0.76, ior: 1.53, subsurface: 0.0 },
  { slug: "aaa_b2_charred_magma_crust", category: "organic", metallic: 0.04, roughness: 0.84, ior: 1.55, subsurface: 0.0 },
  { slug: "aaa_b2_cathedral_stained_glass", category: "architecture", metallic: 0.0, roughness: 0.08, ior: 1.52, subsurface: 0.0 },
  { slug: "aaa_b3_pcb_fr4_copper_traces", category: "tech", metallic: 0.52, roughness: 0.34, ior: 1.56, subsurface: 0.0 },
  { slug: "aaa_b3_clockwork_brass_gears", category: "metals", metallic: 0.95, roughness: 0.25, ior: 2.2, subsurface: 0.0 },
  { slug: "aaa_b3_walnut_shop_cabinetry", category: "architecture", metallic: 0.0, roughness: 0.44, ior: 1.49, subsurface: 0.0 },
  { slug: "aaa_b3_weathered_slate_shingles", category: "architecture", metallic: 0.0, roughness: 0.79, ior: 1.52, subsurface: 0.0 },
  { slug: "aaa_b3_tooled_scabbard_leather", category: "fabrics", metallic: 0.04, roughness: 0.48, ior: 1.49, subsurface: 0.0 },
  { slug: "aaa_b3_botanical_leaf_sprigs", category: "botanical", metallic: 0.0, roughness: 0.54, ior: 1.44, subsurface: 0.26 },
  { slug: "aaa_b3_gilded_ledger_parchment", category: "fabrics", metallic: 0.14, roughness: 0.7, ior: 1.47, subsurface: 0.0 },
  { slug: "aaa_b3_anodized_carbon_weave", category: "tech", metallic: 0.4, roughness: 0.32, ior: 1.58, subsurface: 0.0 },
];

export function createReactionDiffusionField(rows = 32, cols = 32) {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 8 || cols < 8) {
    throw new Error("Grid dimensions must be integers >= 8");
  }
  const size = rows * cols;
  const u = new Float64Array(size).fill(1.0);
  const v = new Float64Array(size).fill(0.0);
  const cr = Math.floor(rows / 2);
  const cc = Math.floor(cols / 2);
  const half = Math.max(2, Math.floor(Math.min(rows, cols) / 8));
  for (let r = cr - half; r <= cr + half; r++) {
    for (let c = cc - half; c <= cc + half; c++) {
      const idx = r * cols + c;
      u[idx] = 0.5;
      v[idx] = 0.25;
    }
  }
  return { rows, cols, u, v };
}

export function stepReactionDiffusionField(
  field,
  { feed = 0.0367, kill = 0.0649, du = 0.16, dv = 0.08, dt = 1.0 } = {},
) {
  const { rows, cols, u, v } = field;
  const nextU = new Float64Array(u.length);
  const nextV = new Float64Array(v.length);
  for (let r = 0; r < rows; r++) {
    const rp = (r - 1 + rows) % rows;
    const rn = (r + 1) % rows;
    for (let c = 0; c < cols; c++) {
      const cp = (c - 1 + cols) % cols;
      const cn = (c + 1) % cols;
      const idx = r * cols + c;
      const uVal = u[idx];
      const vVal = v[idx];
      const lapU =
        0.2 * (u[rp * cols + c] + u[rn * cols + c] + u[r * cols + cp] + u[r * cols + cn]) +
        0.05 *
          (u[rp * cols + cp] + u[rp * cols + cn] + u[rn * cols + cp] + u[rn * cols + cn]) -
        uVal;
      const lapV =
        0.2 * (v[rp * cols + c] + v[rn * cols + c] + v[r * cols + cp] + v[r * cols + cn]) +
        0.05 *
          (v[rp * cols + cp] + v[rp * cols + cn] + v[rn * cols + cp] + v[rn * cols + cn]) -
        vVal;
      const reaction = uVal * vVal * vVal;
      const nu = uVal + dt * (du * lapU - reaction + feed * (1 - uVal));
      const nv = vVal + dt * (dv * lapV + reaction - (feed + kill) * vVal);
      nextU[idx] = Math.min(1, Math.max(0, nu));
      nextV[idx] = Math.min(1, Math.max(0, nv));
    }
  }
  return { rows, cols, u: nextU, v: nextV };
}

export function generateBotanicalPhyllotaxis(
  count = 120,
  scale = 1.0,
  divergenceDeg = (GOLDEN_ANGLE_RAD * 180) / Math.PI,
) {
  if (!Number.isInteger(count) || count < 1 || count > 5000) {
    throw new Error("count must be integer 1..5000");
  }
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error("scale must be positive");
  }
  const radPerStep = (divergenceDeg * Math.PI) / 180;
  const norm = Math.sqrt(count);
  const points = [];
  for (let i = 0; i < count; i++) {
    const radius = (scale * Math.sqrt(i + 0.5)) / norm;
    const angleRad = i * radPerStep;
    points.push({
      index: i,
      radius,
      angleRad,
      x: radius * Math.cos(angleRad),
      y: radius * Math.sin(angleRad),
    });
  }
  return points;
}

function hash2d(ix, iy) {
  const frac = (n) => n - Math.floor(n);
  return [
    frac(Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123),
    frac(Math.sin(ix * 269.5 + iy * 183.3) * 43758.5453123),
    frac(Math.sin(ix * 419.2 + iy * 371.9) * 43758.5453123),
  ];
}

export function computeHeitzNeyretHexWeights(u, v, scale = 1.0) {
  if (!Number.isFinite(u) || !Number.isFinite(v) || !Number.isFinite(scale) || scale <= 0) {
    throw new Error("u, v must be finite and scale must be > 0");
  }
  const su = u * scale;
  const sv = v * scale;
  const skewU = su - sv / Math.sqrt(3);
  const skewV = (sv * 2) / Math.sqrt(3);
  const iu = Math.floor(skewU);
  const iv = Math.floor(skewV);
  const fu = skewU - iu;
  const fv = skewV - iv;
  const rem = 1 - fu - fv;

  const verts =
    rem >= 0
      ? [
          [iu, iv, rem],
          [iu, iv + 1, fv],
          [iu + 1, iv, fu],
        ]
      : [
          [iu + 1, iv + 1, -rem],
          [iu + 1, iv, 1 - fu],
          [iu, iv + 1, 1 - fv],
        ];

  const sqSum = verts.reduce((acc, item) => acc + item[2] * item[2], 0) || 1;
  const vertices = verts.map(([vx, vy, rawW]) => {
    const [ox, oy, rot] = hash2d(vx, vy);
    const theta = rot * 2 * Math.PI;
    const ca = Math.cos(theta);
    const sa = Math.sin(theta);
    return {
      lattice: [vx, vy],
      weight: (rawW * rawW) / sqSum,
      uv: [su * ca - sv * sa + ox, su * sa + sv * ca + oy],
    };
  });
  return {
    vertices,
    weightSum: vertices.reduce((acc, item) => acc + item.weight, 0),
  };
}
