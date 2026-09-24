# KiCad library subset

Source: KiCad official libraries distributed with KiCad 10.0.6 (2026-08-29 Windows release).
Authors: KiCad library contributors, https://gitlab.com/kicad/libraries
License: CC BY-SA 4.0 with KiCad design exception; see LICENSE.md and https://www.kicad.org/libraries/license/.

`parts.json` contains seven extracted symbol/footprint pairs, their raw native forms, derived display/pin/pad geometry, source version and per-pair SHA-256. These are library data, not AI-invented packages. Original native geometry is embedded into exported files. The collection retains the upstream license. Values, placement, trace rules, electrical suitability and fabrication constraints remain project-specific decisions.

Rebuild: `pnpm exec tsx scripts/build-eda-catalog.ts <KiCad share/kicad directory>`.
