"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Layers,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Package,
  CircuitBoard,
  FileDown,
  ArrowRight,
  Workflow,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface DesignResult {
  architecture: string[];
  bom: { item: string; model: string; qty: number; estCost: string }[];
  interfaces: string[];
  risks: { level: "高" | "中" | "低"; desc: string }[];
}

const mockResult: DesignResult = {
  architecture: [
    "主控：ESP32-S3（Wi-Fi + BLE 双模，内置 USB）",
    "传感：SHT30 温湿度 + BH1750 光照",
    "供电：18650 电池 + TP4056 充电 + HT7833 LDO",
    "显示：0.96\" OLED (SSD1306, I2C)",
  ],
  bom: [
    { item: "主控 MCU", model: "ESP32-S3-WROOM-1", qty: 1, estCost: "¥18.5" },
    { item: "温湿度传感器", model: "SHT30-DIS", qty: 1, estCost: "¥8.2" },
    { item: "光照传感器", model: "BH1750FVI", qty: 1, estCost: "¥2.1" },
    { item: "充电管理", model: "TP4056", qty: 1, estCost: "¥0.8" },
    { item: "LDO", model: "HT7833", qty: 1, estCost: "¥0.5" },
    { item: "OLED 屏", model: "SSD1306 0.96\"", qty: 1, estCost: "¥9.0" },
  ],
  interfaces: [
    "I2C0: SHT30 + BH1750 + OLED（总线复用，地址不冲突）",
    "GPIO34: 电池电压采集（ADC 分压）",
    "USB: 充电 + 固件烧录 + 串口调试",
  ],
  risks: [
    { level: "中", desc: "TP4056 无电量计，需软件估算剩余电量" },
    { level: "低", desc: "OLED 与传感器共用 I2C，注意上拉电阻取值" },
    { level: "高", desc: "深度休眠下 Wi-Fi 重连耗时影响数据上报实时性" },
  ],
};

const example = "做一个电池供电的温湿度 + 光照监测节点，带小屏幕显示，Wi-Fi 上报数据，支持 USB 充电。";

/* 原理图网络连接表（mock） */
const netConnections = [
  { net: "3V3", from: "HT7833.OUT", to: "ESP32-S3.VDD / SHT30.VDD / BH1750.VCC / OLED.VCC" },
  { net: "I2C0_SDA", from: "ESP32-S3.GPIO8", to: "SHT30.SDA / BH1750.SDA / OLED.SDA" },
  { net: "I2C0_SCL", from: "ESP32-S3.GPIO9", to: "SHT30.SCL / BH1750.SCL / OLED.SCL" },
  { net: "VBAT_ADC", from: "分压电阻中点", to: "ESP32-S3.GPIO34" },
  { net: "USB_DP / USB_DM", from: "USB-C 座", to: "ESP32-S3.GPIO20 / GPIO19" },
  { net: "CHG_5V", from: "USB-C VBUS", to: "TP4056.IN → 18650 BAT+" },
];

export default function DesignPage() {
  const [requirement, setRequirement] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<DesignResult | null>(null);
  const [schematicState, setSchematicState] = useState<"idle" | "generating" | "done">("idle");

  const generate = () => {
    if (!requirement.trim()) return;
    setGenerating(true);
    setResult(null);
    setSchematicState("idle");
    setTimeout(() => {
      setResult(mockResult);
      setGenerating(false);
    }, 2500);
  };

  const generateSchematic = () => {
    setSchematicState("generating");
    setTimeout(() => setSchematicState("done"), 2200);
  };

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={Layers}
        title="硬件方案生成"
        description="用自然语言描述需求，AI 生成架构建议、BOM、接口规划和风险检查"
      />

      {/* 需求输入 */}
      <div className="rounded-xl border border-border/80 bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <label className="text-sm font-semibold text-foreground">功能需求</label>
          <button
            onClick={() => setRequirement(example)}
            className="text-xs font-medium text-primary hover:underline"
          >
            填入示例
          </button>
        </div>
        <Textarea
          value={requirement}
          onChange={(e) => setRequirement(e.target.value)}
          placeholder="例如：做一个电池供电的温湿度监测节点，带屏幕显示，Wi-Fi 上报数据..."
          className="min-h-[140px]"
        />
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            描述越具体（供电方式、通信协议、尺寸约束），生成结果越准确
          </span>
          <Button onClick={generate} disabled={!requirement.trim() || generating} className="gap-2">
            {generating && <Loader2 className="h-4 w-4 animate-spin" />}
            {generating ? "生成中..." : "生成方案"}
          </Button>
        </div>
      </div>

      {/* 生成结果 */}
      {result && (
        <div className="animate-fade-up mt-8 space-y-4">
          {/* 架构建议 */}
          <div className="rounded-xl border border-border/80 bg-card p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              架构建议
            </h3>
            <ul className="space-y-2">
              {result.architecture.map((a) => (
                <li key={a} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {a}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* BOM */}
            <div className="rounded-xl border border-border/80 bg-card p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Package className="h-4 w-4 text-primary" />
                BOM 预估
              </h3>
              <div className="overflow-hidden rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-background/70 text-xs text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">器件</th>
                      <th className="px-3 py-2 text-left font-medium">型号</th>
                      <th className="px-3 py-2 text-right font-medium">数量</th>
                      <th className="px-3 py-2 text-right font-medium">预估价</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.bom.map((b) => (
                      <tr key={b.model} className="border-b border-border/40 last:border-0">
                        <td className="px-3 py-2 text-foreground">{b.item}</td>
                        <td className="px-3 py-2 text-muted-foreground">{b.model}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{b.qty}</td>
                        <td className="px-3 py-2 text-right font-medium text-foreground">{b.estCost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 接口规划 + 风险 */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border/80 bg-card p-5">
                <h3 className="mb-4 text-sm font-semibold text-foreground">接口规划</h3>
                <ul className="space-y-2">
                  {result.interfaces.map((i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {i}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-border/80 bg-card p-5">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  风险检查
                </h3>
                <div className="space-y-2">
                  {result.risks.map((r) => (
                    <div
                      key={r.desc}
                      className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/70 p-3"
                    >
                      <span
                        className={
                          r.level === "高"
                            ? "rounded bg-red-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-red-500"
                            : r.level === "中"
                              ? "rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-500"
                              : "rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-500"
                        }
                      >
                        {r.level}
                      </span>
                      <p className="text-sm leading-5 text-muted-foreground">{r.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 原理图生成入口 */}
          {schematicState === "idle" && (
            <div className="animate-fade-up flex flex-wrap items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
              <Workflow className="h-5 w-5 text-primary" />
              <p className="flex-1 text-sm text-foreground">
                方案已确认可行，下一步让 AI 基于库中最小电路与器件档案生成原理图
              </p>
              <Button onClick={generateSchematic} className="gap-2">
                <CircuitBoard className="h-4 w-4" />
                生成原理图与电路图
              </Button>
            </div>
          )}

          {schematicState === "generating" && (
            <div className="animate-fade-up rounded-xl border border-primary/40 bg-card p-5">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <p className="text-sm font-medium text-foreground">
                  正在生成原理图：复用库中最小电路 → 分配引脚与网络标签 → 连线与电气规则检查...
                </p>
              </div>
            </div>
          )}

          {/* 原理图结果 */}
          {schematicState === "done" && (
            <div className="animate-fade-up space-y-4">
              <div className="rounded-xl border border-border/80 bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <CircuitBoard className="h-4 w-4 text-primary" />
                    原理图预览
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-500">
                      ERC 通过
                    </span>
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    最小电路复用 4 组 · 新增连线 12 条
                  </span>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border/60 bg-background/70">
                  <SchematicPreview />
                </div>
              </div>

              {/* 网络连接表 */}
              <div className="rounded-xl border border-border/80 bg-card p-5">
                <h3 className="mb-4 text-sm font-semibold text-foreground">网络连接表（Netlist）</h3>
                <div className="overflow-hidden rounded-lg border border-border/60">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 bg-background/70 text-xs text-muted-foreground">
                        <th className="px-3 py-2 text-left font-medium">网络</th>
                        <th className="px-3 py-2 text-left font-medium">起点</th>
                        <th className="px-3 py-2 text-left font-medium">连接</th>
                      </tr>
                    </thead>
                    <tbody>
                      {netConnections.map((n) => (
                        <tr key={n.net} className="border-b border-border/40 last:border-0">
                          <td className="px-3 py-2 font-mono font-medium text-primary">{n.net}</td>
                          <td className="px-3 py-2 font-mono text-xs text-foreground">{n.from}</td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{n.to}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 后续操作 */}
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/80 bg-card px-5 py-4">
                <p className="flex-1 text-sm text-muted-foreground">
                  原理图已同步为立创 EDA 工程格式，可导出或直接进入 PCB 布局布线
                </p>
                <Button variant="outline" className="gap-2">
                  <FileDown className="h-4 w-4" />
                  导出立创 EDA 工程
                </Button>
                <Link
                  href="/app/pcb"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  前往 PCB 生成
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------- 原理图预览（SVG mock） -------------------- */

function SchematicPreview() {
  const sensors = [
    { name: "SHT30", sub: "温湿度 · 0x44", c: 90 },
    { name: "BH1750", sub: "光照 · 0x23", c: 170 },
    { name: "SSD1306 OLED", sub: '0.96" 显示 · 0x3C', c: 250 },
  ];

  return (
    <svg
      viewBox="0 0 880 400"
      className="min-w-[720px] text-muted-foreground"
      role="img"
      aria-label="原理图预览"
    >
      {/* 左侧电源链 */}
      {[
        { y: 40, title: "USB-C 座", sub: "5V 输入" },
        { y: 128, title: "TP4056", sub: "充电管理" },
        { y: 216, title: "18650", sub: "锂电池 3.7V" },
        { y: 304, title: "HT7833", sub: "LDO 3.3V" },
      ].map((b) => (
        <g key={b.title}>
          <rect x={30} y={b.y} width={130} height={48} rx={8} className="fill-card stroke-border" strokeWidth={1.2} />
          <text x={95} y={b.y + 21} textAnchor="middle" className="fill-foreground text-[13px] font-semibold">
            {b.title}
          </text>
          <text x={95} y={b.y + 37} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            {b.sub}
          </text>
        </g>
      ))}
      <line x1={95} y1={88} x2={95} y2={128} stroke="currentColor" strokeWidth={1.2} />
      <line x1={95} y1={176} x2={95} y2={216} stroke="currentColor" strokeWidth={1.2} />
      <line x1={95} y1={264} x2={95} y2={304} stroke="currentColor" strokeWidth={1.2} />

      {/* 3V3 电源轨 */}
      <path d="M160 328 H240 V260 H300" fill="none" className="stroke-primary" strokeWidth={1.5} />
      <text x={198} y={322} textAnchor="middle" className="fill-primary font-mono text-[11px] font-semibold">
        3V3
      </text>
      <circle cx={300} cy={260} r={2.5} className="fill-primary" />
      <text x={308} y={252} className="fill-foreground text-[11px]">VDD</text>

      {/* MCU */}
      <rect x={300} y={90} width={230} height={200} rx={10} className="fill-card stroke-border" strokeWidth={1.2} />
      <text x={415} y={116} textAnchor="middle" className="fill-foreground text-[14px] font-bold">
        ESP32-S3-WROOM-1
      </text>
      <text x={415} y={134} textAnchor="middle" className="fill-muted-foreground text-[10px]">
        主控 · Wi-Fi + BLE 双模
      </text>

      {/* MCU 右侧引脚 */}
      {[
        { y: 150, pin: "GPIO8", net: "I2C0_SDA" },
        { y: 180, pin: "GPIO9", net: "I2C0_SCL" },
        { y: 210, pin: "GPIO34", net: "VBAT_ADC" },
        { y: 262, pin: "GPIO19/20", net: "USB_D- / D+" },
      ].map((p) => (
        <g key={p.pin}>
          <line x1={530} y1={p.y} x2={560} y2={p.y} stroke="currentColor" strokeWidth={1.2} />
          <text x={522} y={p.y + 4} textAnchor="end" className="fill-foreground font-mono text-[11px]">
            {p.pin}
          </text>
          <text x={536} y={p.y - 6} className="fill-primary font-mono text-[10px]">
            {p.net}
          </text>
        </g>
      ))}

      {/* I2C 总线 */}
      <line x1={560} y1={150} x2={628} y2={150} stroke="currentColor" strokeWidth={1.2} />
      <line x1={560} y1={180} x2={652} y2={180} stroke="currentColor" strokeWidth={1.2} />
      <line x1={628} y1={90} x2={628} y2={250} stroke="currentColor" strokeWidth={1.2} />
      <line x1={652} y1={90} x2={652} y2={250} stroke="currentColor" strokeWidth={1.2} />
      <circle cx={628} cy={150} r={2.5} className="fill-primary" />
      <circle cx={652} cy={180} r={2.5} className="fill-primary" />
      <text x={620} y={84} textAnchor="end" className="fill-primary font-mono text-[10px]">SDA</text>
      <text x={660} y={84} className="fill-primary font-mono text-[10px]">SCL</text>

      {/* ADC / USB 标注 */}
      <line x1={560} y1={210} x2={620} y2={210} stroke="currentColor" strokeWidth={1.2} strokeDasharray="4 3" />
      <text x={566} y={204} className="fill-muted-foreground text-[10px]">← 电池分压</text>
      <line x1={560} y1={262} x2={620} y2={262} stroke="currentColor" strokeWidth={1.2} strokeDasharray="4 3" />
      <text x={566} y={278} className="fill-muted-foreground text-[10px]">→ USB-C 座</text>

      {/* 右侧传感器 / 显示 */}
      {sensors.map((s) => (
        <g key={s.name}>
          <rect x={700} y={s.c - 26} width={150} height={52} rx={8} className="fill-card stroke-border" strokeWidth={1.2} />
          <text x={775} y={s.c - 4} textAnchor="middle" className="fill-foreground text-[13px] font-semibold">
            {s.name}
          </text>
          <text x={775} y={s.c + 14} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            {s.sub}
          </text>
          <line x1={628} y1={s.c} x2={700} y2={s.c} stroke="currentColor" strokeWidth={1.2} />
          <line x1={652} y1={s.c + 6} x2={700} y2={s.c + 6} stroke="currentColor" strokeWidth={1.2} />
          <circle cx={628} cy={s.c} r={2.5} className="fill-primary" />
          <circle cx={652} cy={s.c + 6} r={2.5} className="fill-primary" />
          {/* 3V3 供电标记 */}
          <line x1={820} y1={s.c - 26} x2={820} y2={s.c - 38} className="stroke-primary" strokeWidth={1} strokeDasharray="3 3" />
          <text x={820} y={s.c - 42} textAnchor="middle" className="fill-primary font-mono text-[9px]">
            3V3
          </text>
        </g>
      ))}

      {/* 图签 */}
      <rect x={700} y={330} width={150} height={48} rx={6} fill="none" className="stroke-border" strokeWidth={1} />
      <text x={775} y={348} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
        VibeHard AI
      </text>
      <text x={775} y={364} textAnchor="middle" className="fill-muted-foreground text-[9px]">
        温湿度监测节点 · sch v0.1
      </text>
    </svg>
  );
}
