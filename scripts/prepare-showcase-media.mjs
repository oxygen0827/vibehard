import { execFileSync } from "node:child_process";
import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = join(root, "public/demo/recordings");
const importDirectory = process.argv[2] && resolve(process.argv[2]);
const recordings = [
  { file: "4.gif", slug: "design", crop: "crop=1780:916:222:56" },
  { file: "5.gif", slug: "datasheets", crop: "crop=1780:916:222:56" },
  { file: "1.gif", slug: "pcb", crop: null },
  { file: "3.gif", slug: "debug", crop: "crop=1780:916:222:56" },
  { file: "2.gif", slug: "embedded", crop: null },
];
const manifest = {};
await mkdir(output, { recursive: true });

for (const recording of recordings) {
  const original = join(output, `${recording.slug}.gif`);
  if (importDirectory) await copyFile(join(importDirectory, recording.file), original);
  const info = JSON.parse(execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "json", original,
  ], { encoding: "utf8" }));
  const duration = Number(info.format.duration);
  // Remove only the surrounding navigation; preserve all recorded actions and timing.
  const filters = [recording.crop, "scale=1600:900:force_original_aspect_ratio=decrease:force_divisible_by=2", "pad=1600:900:(ow-iw)/2:(oh-ih)/2:white", "setsar=1"].filter(Boolean).join(",");
  const video = join(output, `${recording.slug}.mp4`);
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", original,
    "-vf", filters, "-an", "-c:v", "libx264", "-preset", "slow",
    "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", video,
  ]);
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-ss", String(Math.max(0, duration - 0.4)),
    "-i", video, "-frames:v", "1", "-q:v", "2", join(output, `${recording.slug}.jpg`),
  ]);
  manifest[recording.slug] = { source: recording.file, duration, width: 1600, height: 900 };
  console.log(`${recording.file} -> ${recording.slug}: ${duration}s, ${Math.round((await stat(video)).size / 1024)} KB`);
}

await writeFile(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
