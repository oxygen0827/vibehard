"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  CircuitBoard,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileDown,
  ShoppingCart,
  Layers2,
  Package,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PipelineStep {
  title: string;
  desc: string;
}

const pipelineSteps: PipelineStep[] = [
  { title: "复用库中最小电路", desc: "ESP32-S3 / TP4056 / SHT30 等 4 组已验证电路直接复用" },
  { title: "器件布局", desc: "按信号流与热设计自动摆放 24 个器件，接口器件靠边" },
  { title: "自动布线", desc: "38 个网络布线完成，电源走线加粗至 0.5mm" },
  { title: "DRC 规则检查", desc: "0 错误 · 2 警告（丝印重叠，可自动修复）" },
];

export default function PcbPage() {
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [step, setStep] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const generate = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setState("running");
    setStep(0);
    pipelineSteps.forEach((_, i) => {
      timers.current.push(setTimeout(() => setStep(i + 1), 900 * (i + 1)));
    });
    timers.current.push(setTimeout(() => setState("done"), 900 * pipelineSteps.length + 500));
  };

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={CircuitBoard}
        title="PCB 生成"
        description="基于原理图与库中已验证最小电路，自动完成布局布线，一键导出生产资料或下单打板"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 左：参数 + 流水线 */}
        <div className="space-y-4">
          {/* 来源与参数 */}
          <div className="rounded-xl border border-border/80 bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">来源与板框参数</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                <span className="text-muted-foreground">来源方案</span>
                <span className="font-medium text-foreground">温湿度监测节点 v0.1</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">板框尺寸</p>
                  <p className="font-mono font-medium text-foreground">50 × 35 mm</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">层数 / 板厚</p>
                  <p className="font-mono font-medium text-foreground">2 层 · 1.6mm</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                <span className="text-muted-foreground">外壳开孔</span>
                <span className="text-xs font-medium text-foreground">USB-C + 复位键（自动生成）</span>
              </div>
            </div>
            <Button
              onClick={generate}
              disabled={state === "running"}
              className="mt-4 w-full gap-2"
            >
              {state === "running" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CircuitBoard className="h-4 w-4" />
              )}
              {state === "running" ? "生成中..." : state === "done" ? "重新生成" : "开始生成 PCB"}
            </Button>
          </div>

          {/* 流水线 */}
          {state !== "idle" && (
            <div className="animate-fade-up rounded-xl border border-border/80 bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">生成流水线</h3>
              <div className="space-y-3">
                {pipelineSteps.map((s, i) => {
                  const done = i < step;
                  const active = i === step && state === "running";
                  return (
                    <div key={s.title} className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                          done
                            ? "bg-emerald-500/10 text-emerald-500"
                            : active
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {done ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : active ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <span className="text-[10px] font-bold">{i + 1}</span>
                        )}
                      </span>
                      <div>
                        <p
                          className={cn(
                            "text-sm font-medium",
                            done || active ? "text-foreground" : "text-muted-foreground"
                          )}
                        >
                          {s.title}
                        </p>
                        {(done || active) && (
                          <p className="animate-fade-up mt-0.5 text-xs text-muted-foreground">
                            {s.desc}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 右：PCB 预览 */}
        <div className="rounded-xl border border-border/80 bg-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">PCB 预览</h3>
            {state === "done" && (
              <div className="flex gap-2 text-[11px]">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                  24 器件
                </span>
                <span className="rounded-md bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                  38 网络
                </span>
                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-500">
                  DRC 0 错误
                </span>
              </div>
            )}
          </div>

          {state === "done" ? (
            <div className="animate-fade-up">
              <div className="overflow-hidden rounded-lg border border-border/60 bg-[#0d3b24]">
                <PcbPreview />
              </div>

              {/* DRC 警告 */}
              <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <p className="flex items-center gap-2 text-xs text-amber-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  2 个丝印重叠警告（U3、C7），导出前将自动修复
                </p>
              </div>

              {/* 操作 */}
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="outline" className="gap-2">
                  <FileDown className="h-4 w-4" />
                  导出 Gerber
                </Button>
                <Button variant="outline" className="gap-2">
                  <Layers2 className="h-4 w-4" />
                  导出 3D 外壳（STEP）
                </Button>
                <Link
                  href="/app/bom"
                  className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <Package className="h-4 w-4" />
                  查看 BOM 与选型
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Button className="gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  嘉立创一键下单 + SMT
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                下单将同步 Gerber、BOM 与坐标文件到嘉立创，SMT 贴片自动匹配基础库/推荐库物料
              </p>
            </div>
          ) : (
            <div className="flex h-72 flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-background/50">
              {state === "running" ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {pipelineSteps[Math.min(step, pipelineSteps.length - 1)].title}...
                  </p>
                </>
              ) : (
                <>
                  <CircuitBoard className="h-6 w-6 text-muted-foreground/50" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    设置板框参数后点击「开始生成 PCB」
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    也可以先在「方案生成」中生成原理图后跳转过来
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------- PCB 2D 预览（SVG mock） -------------------- */

function PcbPreview() {
  // 器件焊盘块：x, y, w, h, 丝印
  const parts = [
    { x: 120, y: 60, w: 92, h: 64, label: "U1 ESP32-S3", pads: "both" },
    { x: 260, y: 52, w: 40, h: 40, label: "U2 SHT30", pads: "h" },
    { x: 330, y: 52, w: 40, h: 40, label: "U3 BH1750", pads: "h" },
    { x: 412, y: 46, w: 44, h: 24, label: "OLED", pads: "h" },
    { x: 30, y: 56, w: 34, h: 52, label: "USB-C", pads: "h" },
    { x: 250, y: 130, w: 34, h: 26, label: "TP4056", pads: "h" },
    { x: 330, y: 130, w: 30, h: 24, label: "HT7833", pads: "h" },
  ];
  const passives = [
    { x: 236, y: 66 }, { x: 236, y: 86 }, { x: 236, y: 106 },
    { x: 310, y: 60 }, { x: 380, y: 60 }, { x: 380, y: 78 },
    { x: 300, y: 138 }, { x: 310, y: 100 }, { x: 90, y: 130 },
    { x: 120, y: 140 }, { x: 150, y: 140 },
  ];

  return (
    <svg viewBox="0 0 480 190" className="w-full" role="img" aria-label="PCB 预览">
      {/* 板框 */}
      <rect x={6} y={6} width={468} height={178} rx={10} fill="#0f5e35" stroke="#1a7a47" strokeWidth={2} />
      {/* 安装孔 */}
      {[
        [24, 24], [456, 24], [24, 166], [456, 166],
      ].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r={7} fill="#c9a227" />
          <circle cx={cx} cy={cy} r={3.5} fill="#0f5e35" />
        </g>
      ))}

      {/* 走线 */}
      <g stroke="#e8b23a" strokeWidth={2} fill="none" opacity={0.9}>
        <path d="M212 76 H236 M212 92 H236 M212 108 H236" />
        <path d="M64 70 H96 Q104 70 108 78 L118 88" />
        <path d="M260 92 Q260 110 267 130" />
        <path d="M300 72 H330 M340 92 Q340 120 345 130" />
        <path d="M370 66 H412 V70" />
        <path d="M166 108 Q200 140 250 143" />
        <path d="M284 143 H330" />
        <path d="M150 140 Q150 110 166 100" />
      </g>
      {/* 电源走线加粗 */}
      <g stroke="#e8b23a" strokeWidth={3.5} fill="none" opacity={0.95}>
        <path d="M64 96 H86 Q96 96 100 104 L110 118" />
        <path d="M250 156 Q200 170 130 152" />
      </g>

      {/* 器件 */}
      {parts.map((p) => (
        <g key={p.label}>
          <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={3} fill="#1c1f26" stroke="#4b5261" strokeWidth={1} />
          <text
            x={p.x + p.w / 2}
            y={p.y + p.h / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#e5e7eb"
            fontSize={9}
            fontFamily="monospace"
          >
            {p.label}
          </text>
          {/* 焊盘 */}
          {p.pads === "both" && (
            <>
              {Array.from({ length: 8 }).map((_, i) => (
                <rect key={`l${i}`} x={p.x - 5} y={p.y + 6 + i * 7} width={5} height={3.5} fill="#c9a227" />
              ))}
              {Array.from({ length: 8 }).map((_, i) => (
                <rect key={`r${i}`} x={p.x + p.w} y={p.y + 6 + i * 7} width={5} height={3.5} fill="#c9a227" />
              ))}
            </>
          )}
          {p.pads === "h" && (
            <>
              <rect x={p.x + 4} y={p.y - 4} width={8} height={4} fill="#c9a227" />
              <rect x={p.x + p.w - 12} y={p.y - 4} width={8} height={4} fill="#c9a227" />
            </>
          )}
        </g>
      ))}

      {/* 阻容贴片 */}
      {passives.map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={10} height={5} rx={1} fill="#8a8f99" stroke="#c9a227" strokeWidth={0.8} />
      ))}

      {/* 丝印 */}
      <text x={240} y={178} textAnchor="middle" fill="#ffffff" fontSize={10} fontFamily="monospace" opacity={0.85}>
        VibeHard · TH-Node v0.1
      </text>
    </svg>
  );
}
