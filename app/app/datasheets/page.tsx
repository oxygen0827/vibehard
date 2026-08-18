"use client";

import { useRef, useState } from "react";
import { BookOpen, Upload, FileText, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DatasheetResult {
  chip: string;
  pins: { pin: string; name: string; type: string; desc: string }[];
  electrical: { label: string; min: string; typ: string; max: string; unit: string }[];
  package: string;
  constraints: string[];
}

const mockResult: DatasheetResult = {
  chip: "STM32F103C8T6",
  pins: [
    { pin: "1", name: "VBAT", type: "电源", desc: "后备电池供电" },
    { pin: "8", name: "VSSA", type: "电源", desc: "模拟地" },
    { pin: "21", name: "PB10", type: "I/O", desc: "I2C2_SCL / USART3_TX" },
    { pin: "22", name: "PB11", type: "I/O", desc: "I2C2_SDA / USART3_RX" },
    { pin: "34", name: "PA13", type: "I/O", desc: "SWDIO 调试数据" },
    { pin: "37", name: "PA14", type: "I/O", desc: "SWCLK 调试时钟" },
  ],
  electrical: [
    { label: "工作电压 VDD", min: "2.0", typ: "3.3", max: "3.6", unit: "V" },
    { label: "工作电流 (72MHz)", min: "-", typ: "36", max: "50", unit: "mA" },
    { label: "待机电流", min: "-", typ: "2", max: "3.4", unit: "µA" },
    { label: "工作温度", min: "-40", typ: "25", max: "85", unit: "°C" },
  ],
  package: "LQFP-48 (7×7mm)",
  constraints: [
    "VBAT 必须接电池或 VDD，不可悬空",
    "所有 VDD/VSS 引脚需 100nF 去耦电容就近放置",
    "BOOT0 下拉到地选择主闪存启动",
    "ADC 输入电压不得超过 VDDA",
  ],
};

export default function DatasheetsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<DatasheetResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | undefined) => {
    if (f) {
      setFile(f);
      setResult(null);
    }
  };

  const parse = () => {
    if (!file) return;
    setParsing(true);
    setTimeout(() => {
      setResult(mockResult);
      setParsing(false);
    }, 2000);
  };

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={BookOpen}
        title="芯片资料解析"
        description="上传 Datasheet PDF，提取引脚定义、电气特性、封装和关键约束"
      />

      {/* 上传区 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-16 transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border/80 bg-card/50 hover:border-primary/40 hover:bg-card"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {file ? <FileText className="h-7 w-7" /> : <Upload className="h-7 w-7" />}
        </div>
        {file ? (
          <>
            <p className="mt-4 text-sm font-semibold text-foreground">{file.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(2)} MB · 点击重新选择
            </p>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm font-semibold text-foreground">
              拖拽 Datasheet PDF 到这里，或点击上传
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              支持 PDF 格式，建议文件小于 50MB
            </p>
          </>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={parse} disabled={!file || parsing} className="gap-2">
          {parsing && <Loader2 className="h-4 w-4 animate-spin" />}
          {parsing ? "解析中..." : "开始解析"}
        </Button>
      </div>

      {/* 解析结果 */}
      {result && (
        <div className="animate-fade-up mt-8 space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">识别芯片</p>
              <p className="text-lg font-bold text-foreground">{result.chip}</p>
            </div>
            <span className="rounded-md bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {result.package}
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* 引脚定义 */}
            <div className="rounded-xl border border-border/80 bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">引脚定义（关键）</h3>
              <div className="overflow-hidden rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-background/70 text-xs text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">引脚</th>
                      <th className="px-3 py-2 text-left font-medium">名称</th>
                      <th className="px-3 py-2 text-left font-medium">类型</th>
                      <th className="px-3 py-2 text-left font-medium">说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.pins.map((p) => (
                      <tr key={p.pin} className="border-b border-border/40 last:border-0">
                        <td className="px-3 py-2 font-mono text-muted-foreground">{p.pin}</td>
                        <td className="px-3 py-2 font-mono font-medium text-foreground">{p.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{p.type}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{p.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 电气特性 */}
            <div className="rounded-xl border border-border/80 bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">电气特性</h3>
              <div className="overflow-hidden rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-background/70 text-xs text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">参数</th>
                      <th className="px-3 py-2 text-right font-medium">最小</th>
                      <th className="px-3 py-2 text-right font-medium">典型</th>
                      <th className="px-3 py-2 text-right font-medium">最大</th>
                      <th className="px-3 py-2 text-right font-medium">单位</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.electrical.map((e) => (
                      <tr key={e.label} className="border-b border-border/40 last:border-0">
                        <td className="px-3 py-2 text-foreground">{e.label}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{e.min}</td>
                        <td className="px-3 py-2 text-right font-medium text-foreground">{e.typ}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{e.max}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{e.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 设计约束 */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">设计约束与注意事项</h3>
            <ul className="space-y-2">
              {result.constraints.map((c) => (
                <li key={c} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
