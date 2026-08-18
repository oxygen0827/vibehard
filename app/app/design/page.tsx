"use client";

import { useState } from "react";
import { Layers, Loader2, AlertTriangle, CheckCircle2, Package } from "lucide-react";
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

export default function DesignPage() {
  const [requirement, setRequirement] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<DesignResult | null>(null);

  const generate = () => {
    if (!requirement.trim()) return;
    setGenerating(true);
    setResult(null);
    setTimeout(() => {
      setResult(mockResult);
      setGenerating(false);
    }, 2500);
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
        </div>
      )}
    </div>
  );
}
