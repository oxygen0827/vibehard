import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const sourceRoot = "/tmp/vibehard-live-recording";
const outputDir = join(root, "public", "demo");
const pnpmStore = join(root, "node_modules", ".pnpm");
const sharpPackage = readdirSync(pnpmStore).find((name) => name.startsWith("sharp@"));
if (!sharpPackage) throw new Error("sharp is required to prepare live demo GIFs");
const { default: sharp } = await import(
  pathToFileURL(join(pnpmStore, sharpPackage, "node_modules", "sharp", "dist", "index.mjs")),
);

const demos = [
  {
    id: "01-requirement-to-design",
    frames: ["design-00-idle.jpg", "design-01-filled.jpg", "design-02-generating.jpg", "design-03-result.jpg", "design-04-result.jpg"],
  },
  {
    id: "02-design-to-bom",
    frames: ["bom/01-table.jpg", "bom/02-export.jpg", "bom/01-table.jpg"],
  },
  {
    id: "03-bom-to-schematic",
    frames: ["schematic-01-generating.jpg", "schematic-02-result.jpg", "schematic-02-result.jpg"],
  },
  {
    id: "04-schematic-to-pcb",
    frames: ["pcb/01-idle.jpg", "pcb/02-generating.jpg", "pcb/03-result.jpg", "pcb/03-result.jpg"],
  },
  {
    id: "05-pcb-to-debug",
    frames: ["debug/01-idle.jpg", "debug/02-connected.jpg", "debug/04-running.jpg", "debug/05-complete.jpg", "debug/05-complete.jpg"],
  },
  {
    id: "06-debug-to-firmware",
    frames: ["embedded/01-idle.jpg", "embedded/02-filled.jpg", "embedded/03-generating.jpg", "embedded/04-result.jpg", "embedded/04-result.jpg"],
  },
];

const workDir = mkdtempSync(join(tmpdir(), "vibehard-live-demo-gifs-"));
await mkdir(outputDir, { recursive: true });

for (const demo of demos) {
  const demoDir = join(workDir, demo.id);
  await mkdir(demoDir, { recursive: true });
  const frameSources = [...demo.frames, ...Array(Math.max(0, 6 - demo.frames.length)).fill(demo.frames.at(-1))];

  for (let i = 0; i < frameSources.length; i += 1) {
    const input = join(sourceRoot, frameSources[i]);
    const output = join(demoDir, `frame-${String(i).padStart(2, "0")}.png`);
    await sharp(input)
      // Safari chrome occupies the first 54 px in every computer-use capture.
      .extract({ left: 0, top: 54, width: 909, height: 714 })
      .resize({ width: 960, height: 754, fit: "fill" })
      .png()
      .toFile(output);
  }

  const palette = join(demoDir, "palette.png");
  const input = join(demoDir, "frame-%02d.png");
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-framerate", "2", "-i", input, "-vf", "palettegen=max_colors=128:stats_mode=diff", palette]);
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-framerate", "2", "-i", input, "-i", palette, "-lavfi", "paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle", "-loop", "0", join(outputDir, `${demo.id}.gif`)]);
  await copyFile(join(demoDir, `frame-${String(frameSources.length - 1).padStart(2, "0")}.png`), join(outputDir, `${demo.id}.png`));
}

// The website's current PCB preview is intentionally schematic. Replace that
// stage with real KiCad layout and 3D Viewer reference frames.
execFileSync(process.execPath, [join(root, "scripts", "prepare-pcb-reference-gif.mjs")]);

await writeFile(
  join(outputDir, "README.md"),
  "The workflow GIFs were recorded from the authenticated VibeHard website at https://ldcx.tech/vibehard/app. Safari browser chrome was removed; the remaining frames are real product UI states captured during the six-step workflow.\n\nThe PCB stage uses higher-fidelity reference frames to show real PCB Editor and 3D Viewer output rather than a synthetic board illustration. Sources: https://commons.wikimedia.org/wiki/File:KiCad_V6_PCB_Full_View.png (Jon Neal, CC BY-SA 4.0) and https://www.kicad.org/img/frontpage/kicad_3dviewer.png. KiCad website media is available under the site's stated Creative Commons/GPL terms; see https://www.kicad.org/about/licenses/.\n",
  "utf8",
);

console.log(`Prepared ${demos.length} live demo GIFs in ${outputDir}`);
