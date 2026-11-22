# Offline cell-stage preview — private draft

This add-only preview sits alongside the existing information website. The
existing landing page remains unchanged; `evolution.html` is available by
direct URL once the patch is staged. No external script,
telemetry endpoint, account connection, advertising, or remote asset is required.
The supplied generated `cell_stage_demo.js` lets the page open through a local
file URL without running a build or a server. When hosted on an ordinary static
server, the page loads the relative JSON preset from
`interop/cell_stage/presets/reference_evolution.v1.json`; for local file URLs it
uses the exact equivalent built-in default, verified in the tests. Users can
also import compatible JSON from their own device using the file chooser.

## Build and verify

- `npm run build` — compile the two TypeScript files with an existing
  TypeScript compiler; no runtime dependencies are installed or downloaded.
- `npm run test` — use the built-in Node test runner and the locally compiled JS.
- `npm run check` — compile and test in sequence.

A feature-level web kill switch is `?cell_stage_kill=1` on the demo page.
The default is ON. With the switch active, stepping, division and data
import/export are disabled. The existing site pages are not modified at
runtime.

## Contract and parity

The authoritative exchange *format* is
`interop/cell_stage/evolution_preset.schema.json`, with exactly one cell, one
selected food site, a seed, `dt_s`, and `mutation_bp`. The authoritative game
*rules* are the existing EV1 `interop/cell_stage` kernel. The TypeScript scalar
preview implements the exact v1 rule parameters from that kernel and compares
its 120-step trace with the checked-in EV1 reference fixture. It does not
attempt to own the application's cell collection, nutrient ledger, renderer,
clock, progression, or save state. The existing owner decides when to call
individual ticks and whether to register a daughter after manual division.

The simulation is for teaching and uses abstract game resources, not physical
biochemistry. Position and tick duration are measured in metres and seconds.
The graphical styling is not a microscope photograph, biological prediction,
or clinical information.

## Private-draft integration

Apply `source_patch/patches/0001-offline-ev1-cell-evolution.patch` to a clean
checkout of the source website. Do not publish or deploy as part of this order.
The patch preserves every existing page byte-for-byte. To link the preview
from the landing page during local testing, run
`python tools/add_preview_link.py --apply` explicitly after applying the patch.
The source files in `source_patch/site/` are the convenient file-by-file
overlay matching the patch; the patch is the apply mechanism.
