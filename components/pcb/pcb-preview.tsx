"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Maximize, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { renderExampleBoard, type BoardView } from "./example-board";

export function PcbPreview() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; pan: [number, number] } | null>(null);
  const [view, setView] = useState<BoardView>("assembly");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<[number, number]>([0, 0]);
  const [layers, setLayers] = useState({ top: true, bottom: true, silk: true });

  useEffect(() => {
    if (canvas.current) renderExampleBoard(canvas.current, { view, zoom, pan, ...layers, ...(view === "assembly" ? { top: true, bottom: true } : {}) });
  }, [view, zoom, pan, layers]);

  const download = () => {
    if (!canvas.current) return;
    const link = document.createElement("a");
    link.download = `VibeHard-TH-Node-${view}.png`;
    link.href = canvas.current.toDataURL("image/png");
    link.click();
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-md bg-muted p-1" role="group" aria-label="PCB 视图">
          {([["assembly", "装配视图"], ["routing", "布线视图"]] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={cn("rounded px-3 py-1.5 text-xs transition-colors", view === value ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" title="缩小" aria-label="缩小 PCB" disabled={zoom <= 1} onClick={() => { setZoom(Math.max(1, zoom - .25)); setPan([0, 0]); }}><Minus /></Button>
          <span className="w-10 text-center font-mono text-[11px] text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon-sm" title="放大" aria-label="放大 PCB" disabled={zoom >= 2.5} onClick={() => setZoom(Math.min(2.5, zoom + .25))}><Plus /></Button>
          <Button variant="ghost" size="icon-sm" title="适应画布" aria-label="适应画布" onClick={() => { setZoom(1); setPan([0, 0]); }}><Maximize /></Button>
          <Button variant="ghost" size="icon-sm" title="下载预览 PNG" aria-label="下载 PCB 预览 PNG" onClick={download}><Download /></Button>
        </div>
      </div>
      <canvas ref={canvas} width={1830} height={1220} className={cn("block aspect-[3/2] h-auto w-full rounded-md", zoom > 1 ? "touch-none cursor-grab active:cursor-grabbing" : "touch-pan-y")} role="img" aria-label={`温湿度监测节点 PCB ${view === "assembly" ? "装配" : "布线"}预览，ESP32-S3、USB-C、SHT30、光照传感器与电源电路`}
        onPointerDown={(event) => { if (zoom <= 1) return; drag.current = { x: event.clientX, y: event.clientY, pan }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => { if (!drag.current) return; const scale = 61 / event.currentTarget.getBoundingClientRect().width; setPan([Math.max(-20, Math.min(20, drag.current.pan[0] + (event.clientX - drag.current.x) * scale)), Math.max(-15, Math.min(15, drag.current.pan[1] + (event.clientY - drag.current.y) * scale))]); }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span className="font-mono">TH-NODE / REV 0.2</span>
        <div className="flex flex-wrap items-center gap-4">
          {view === "routing" && ( [["top", "顶层铜", "#e3a269"], ["bottom", "底层铜", "#648cd3"]] as const).map(([key, label, color]) => (
            <label key={key} className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={layers[key]} onChange={(event) => setLayers({ ...layers, [key]: event.target.checked })} className="accent-primary" /><span className="size-2 rounded-sm" style={{ backgroundColor: color }} />{label}</label>
          ))}
          <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={layers.silk} onChange={(event) => setLayers({ ...layers, silk: event.target.checked })} className="accent-primary" />丝印</label>
          <span>2 层 / 1.6 mm / 绿色阻焊</span>
        </div>
      </div>
    </div>
  );
}
