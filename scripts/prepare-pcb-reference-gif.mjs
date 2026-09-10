import { execFileSync } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outputDir = join(root, "public", "demo");
const sourceDir = join(outputDir, "pcb-sources");
const workDir = "/tmp/vibehard-pcb-reference-gif";
const layout = join(sourceDir, "kicad-v6.png");
const viewer = join(sourceDir, "kicad_3dviewer.png");

await mkdir(workDir, { recursive: true });

// Keep the real KiCad UI visible and use subtle framing to mark the start and
// successful end of the flow. The page supplies the explanatory copy.
const frames = [
  { source: layout, filter: "scale=960:540:force_original_aspect_ratio=increase,crop=960:540,drawbox=x=12:y=12:w=936:h=516:color=0x48a5ff@0.9:t=3" },
  { source: layout, filter: "scale=1056:594,crop=960:540:x=48:y=27" },
  { source: layout, filter: "scale=1152:648,crop=960:540:x=96:y=54,drawbox=x=12:y=12:w=936:h=516:color=0xf4b942@0.85:t=3" },
  { source: viewer, filter: "scale=960:540:force_original_aspect_ratio=increase,crop=960:540" },
  { source: viewer, filter: "scale=1056:594,crop=960:540:x=48:y=27" },
  { source: layout, filter: "scale=960:540:force_original_aspect_ratio=increase,crop=960:540,drawbox=x=12:y=12:w=936:h=516:color=0x36d399@0.9:t=3" },
];

for (let index = 0; index < frames.length; index += 1) {
  const frame = frames[index];
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    frame.source,
    "-vf",
    frame.filter,
    join(workDir, `frame-${String(index).padStart(2, "0")}.png`),
  ]);
}

const palette = join(workDir, "palette.png");
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-framerate", "2", "-i", join(workDir, "frame-%02d.png"), "-vf", "palettegen=max_colors=128:stats_mode=diff", palette]);
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-framerate", "2", "-i", join(workDir, "frame-%02d.png"), "-i", palette, "-lavfi", "paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle", "-loop", "0", join(outputDir, "04-schematic-to-pcb.gif")]);
await copyFile(join(workDir, "frame-05.png"), join(outputDir, "04-schematic-to-pcb.png"));
console.log("Prepared high-fidelity PCB reference GIF");
