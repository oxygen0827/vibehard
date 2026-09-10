# Current showcase media

The `/demo` page uses the five GIF recordings supplied by the project owner on 2026-09-05. Original files are preserved byte-for-byte in `recordings/` for download. The page plays optimized MP4 copies, with static JPEG posters when motion is reduced or media has not loaded.

| Supplied file | Stored name | Showcase chapter |
| --- | --- | --- |
| 4.gif | design | Hardware design and BOM |
| 5.gif | datasheets | Chip documentation |
| 1.gif | pcb | PCB generation |
| 3.gif | debug | AI debugging |
| 2.gif | embedded | Embedded application |

Regenerate with `node scripts/prepare-showcase-media.mjs` (requires FFmpeg and ffprobe). To import replacement originals, pass a directory containing `1.gif` through `5.gif`. The script removes surrounding navigation from the full-workbench recordings, preserves timing, and fits each clip into a 1600 x 900 canvas without stretching. `recordings/manifest.json` stores source names and durations.

These are product-interface recordings, not evidence of physical-board verification or successful firmware builds.

## Legacy assets (not used by the current showcase)

The earlier six-step workflow GIFs remain in this directory for reference. Their original provenance note states that they were recorded from the authenticated VibeHard website at https://ldcx.tech/vibehard/app, with Safari browser chrome removed.

The legacy PCB stage used PCB Editor and 3D Viewer reference frames. Sources: https://commons.wikimedia.org/wiki/File:KiCad_V6_PCB_Full_View.png (Jon Neal, CC BY-SA 4.0) and https://www.kicad.org/img/frontpage/kicad_3dviewer.png. KiCad website media is available under the site's stated Creative Commons/GPL terms; see https://www.kicad.org/about/licenses/.
