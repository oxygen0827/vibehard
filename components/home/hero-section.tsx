import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  SearchCheck,
} from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative z-10 overflow-hidden px-6 pb-14 pt-20 text-center sm:pb-20 lg:pb-24 lg:pt-28">
      <div className="relative z-10 mx-auto max-w-4xl">
        <div className="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-4 py-1.5 text-[13px] font-semibold text-primary">
          <span className="relative flex h-2 w-2">
            <span className="animate-pulse-dot absolute inline-flex h-full w-full rounded-full bg-primary" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          面向智能硬件研发的 Agent 工具平台
        </div>

        <h1
          className="animate-fade-up text-[40px] font-bold leading-[1.06] tracking-tight text-foreground sm:text-[52px] lg:text-[64px]"
          style={{ animationDelay: "80ms" }}
        >
          VibeHard AI
          <br />
          <span className="bg-gradient-to-r from-primary via-[color-mix(in_oklch,var(--primary),white_25%)] to-primary bg-clip-text text-transparent">
            嵌入式开发工作台
          </span>
        </h1>

        <p
          className="animate-fade-up mx-auto mt-6 max-w-2xl text-[15px] font-medium leading-7 text-muted-foreground sm:text-base"
          style={{ animationDelay: "160ms" }}
        >
          把提示词模板、原理图识别、硬件方案生成和芯片资料解析集中到一个工作台，
          让智能硬件项目从需求到设计评审更快落地。
        </p>

        <div
          className="animate-fade-up mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ animationDelay: "240ms" }}
        >
          <Link
            href="/register"
            className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/25 transition-all duration-200 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/30 active:scale-[0.97] sm:w-auto"
          >
            使用邀请码注册
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card/95 px-6 text-sm font-semibold text-foreground shadow-[0_10px_28px_rgba(15,23,42,0.08)] transition-all duration-200 hover:border-ring/45 hover:bg-muted active:scale-[0.97] dark:shadow-none sm:w-auto"
          >
            已有账号登录
          </Link>
        </div>

        <div
          className="animate-fade-up mt-6 flex flex-wrap items-center justify-center gap-2"
          style={{ animationDelay: "320ms" }}
        >
          {["原理图识别", "硬件方案生成", "Skills / MCP", "芯片资料解析"].map(
            (tag) => (
              <span
                key={tag}
                className="rounded-md border border-border/70 bg-card/80 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:text-foreground"
              >
                {tag}
              </span>
            )
          )}
        </div>
      </div>

      <div
        className="animate-fade-up pointer-events-none relative z-0 mx-auto mt-12 hidden w-[min(1120px,calc(100%-2rem))] sm:block"
        style={{ animationDelay: "420ms" }}
      >
        <div className="animate-float-soft overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-4 shadow-[0_28px_90px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-card/70 dark:shadow-[0_32px_90px_rgba(0,0,0,0.36)]">
          <div className="mb-4 flex items-center justify-between border-b border-border/70 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              VibeHard AI Console
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1.08fr_0.92fr_0.92fr]">
            {/* 项目分析结果 */}
            <div className="rounded-xl border border-border/70 bg-background/70 p-4 text-left">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <SearchCheck className="h-4 w-4 text-primary" />
                项目分析结果
              </div>
              <div className="space-y-3">
                {[
                  { label: "原理图识别", status: "已分析", desc: "STM32 电源域 / 接口拓扑" },
                  { label: "方案生成", status: "生成中", desc: "主控选型、传感器、电源树" },
                  { label: "Prompt 模板", status: "可复用", desc: "驱动移植 / 量产排障" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-border/60 bg-card/75 p-3"
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-muted-foreground">
                        {item.label}
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                        {item.status === "生成中" && (
                          <span className="animate-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                        {item.status}
                      </span>
                    </div>
                    <p className="truncate text-sm font-semibold text-foreground">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 硬件约束 */}
            <div className="rounded-xl border border-border/70 bg-background/70 p-4 text-left">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Cpu className="h-4 w-4 text-primary" />
                硬件约束
              </div>
              <div className="space-y-2">
                {[
                  "低功耗电池供电",
                  "BLE + UART 调试",
                  "量产测试点预留",
                  "BOM 成本约束",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* 输出文档 */}
            <div className="rounded-xl border border-border/70 bg-background/70 p-4 text-left">
              <div className="mb-4 text-sm font-semibold text-foreground">输出文档</div>
              <div className="space-y-2">
                <div className="skeleton-shimmer h-2 rounded-full" />
                <div className="skeleton-shimmer h-2 w-10/12 rounded-full" />
                <div className="skeleton-shimmer h-2 w-8/12 rounded-full" />
                <div className="mt-4 rounded-lg border border-primary/20 bg-primary/10 p-3 text-xs font-medium leading-5 text-primary">
                  方案建议、接口规划、BOM 风险和验证清单已整理。
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
