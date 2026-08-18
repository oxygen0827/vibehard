"use client";

import { useRef, useState } from "react";
import { Cpu, Upload, FileImage, Loader2, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AnalysisResult {
  components: { name: string; model: string; role: string }[];
  topology: string[];
  params: { label: string; value: string }[];
}

const mockResult: AnalysisResult = {
  components: [
    { name: "U1", model: "STM32F103C8T6", role: "主控 MCU" },
    { name: "U2", model: "AMS1117-3.3", role: "LDO 电源" },
    { name: "S1", model: "SHT30", role: "温湿度传感器" },
    { name: "J1", model: "USB Type-C", role: "供电/调试接口" },
  ],
  topology: ["电源域: 5V → 3.3V (LDO)", "通信: I2C (SCL/SDA 上拉 4.7kΩ)", "调试: SWD 四线接口"],
  params: [
    { label: "工作电压", value: "3.3V" },
    { label: "最大电流", value: "~120mA" },
    { label: "I2C 速率", value: "400kHz" },
  ],
};

export default function SchematicPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | undefined) => {
    if (f) {
      setFile(f);
      setResult(null);
    }
  };

  const analyze = () => {
    if (!file) return;
    setAnalyzing(true);
    // 模拟 AI 分析延迟
    setTimeout(() => {
      setResult(mockResult);
      setAnalyzing(false);
    }, 2000);
  };

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={Cpu}
        title="原理图识别"
        description="上传原理图图片或 PDF，AI 自动识别元器件、电路拓扑和关键参数"
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
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {file ? <FileImage className="h-7 w-7" /> : <Upload className="h-7 w-7" />}
        </div>
        {file ? (
          <>
            <p className="mt-4 text-sm font-semibold text-foreground">{file.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB · 点击重新选择
            </p>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm font-semibold text-foreground">
              拖拽文件到这里，或点击上传
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              支持 PNG / JPG / PDF，单个文件不超过 20MB
            </p>
          </>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          onClick={analyze}
          disabled={!file || analyzing}
          className="gap-2"
        >
          {analyzing && <Loader2 className="h-4 w-4 animate-spin" />}
          {analyzing ? "识别中..." : "开始识别"}
        </Button>
      </div>

      {/* 分析结果 */}
      {result && (
        <div className="animate-fade-up mt-8 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border/80 bg-card p-5 lg:col-span-1">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              识别到的元器件
            </h3>
            <div className="space-y-2">
              {result.components.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/70 px-3 py-2"
                >
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">{c.name}</span>
                    <p className="text-sm font-semibold text-foreground">{c.model}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{c.role}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">电路拓扑</h3>
            <ul className="space-y-2">
              {result.topology.map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">关键参数</h3>
            <div className="space-y-2">
              {result.params.map((p) => (
                <div key={p.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{p.label}</span>
                  <span className="font-semibold text-foreground">{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
