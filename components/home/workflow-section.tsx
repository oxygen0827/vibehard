import { Cpu, FileCode2, Layers, Sparkles } from "lucide-react";
import { Reveal } from "@/components/reveal";

const workflows = [
  {
    step: "01",
    category: "需求定义",
    title: "智能提示词模板",
    description:
      "沉淀智能硬件产品定义、芯片选型、驱动开发和调试流程，减少从空白开始的时间。",
    tag: "850+ 模板",
    icon: Sparkles,
  },
  {
    step: "02",
    category: "电路理解",
    title: "原理图 Agent 识别",
    description:
      "上传原理图图片或 PDF，识别元器件型号、电路拓扑和关键参数，输出结构化分析。",
    tag: "PDF / 图片",
    icon: Cpu,
  },
  {
    step: "03",
    category: "方案输出",
    title: "硬件方案生成",
    description:
      "用自然语言描述需求，生成架构建议、BOM 思路、接口规划和落地风险检查。",
    tag: "方案 + BOM",
    icon: Layers,
  },
  {
    step: "04",
    category: "资料提取",
    title: "芯片手册解析",
    description:
      "从 Datasheet 中提取引脚、电气特性、封装和关键约束，辅助后续设计评审。",
    tag: "关键参数",
    icon: FileCode2,
  },
];

export function WorkflowSection() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
      <div className="mb-10 grid gap-4 md:grid-cols-[0.8fr_1.2fr] md:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            Workflow
          </p>
          <h2 className="mt-3 text-[30px] font-bold tracking-tight text-foreground md:text-[36px]">
            按硬件研发流程组织工具
          </h2>
        </div>
        <p className="max-w-2xl text-sm font-medium leading-7 text-muted-foreground md:justify-self-end">
          不只是把功能堆在一起，而是围绕需求定义、电路理解、方案输出和资料提取这几步来组织入口。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {workflows.map((item, i) => {
          const Icon = item.icon;
          return (
            <Reveal key={item.title} delay={i * 100} className="h-full">
              <div className="group relative flex h-full min-h-[280px] flex-col overflow-hidden rounded-xl border border-border/80 bg-card p-5 shadow-[0_14px_34px_rgba(15,23,42,0.07)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_20px_48px_rgba(15,23,42,0.1)] dark:shadow-[0_16px_42px_rgba(0,0,0,0.2)]">
                <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-primary/10 opacity-0 blur-[54px] transition-opacity duration-500 group-hover:opacity-100" />
                <span className="pointer-events-none absolute -bottom-5 right-1 select-none text-[88px] font-bold leading-none tracking-tighter text-foreground/[0.04] transition-colors duration-500 group-hover:text-primary/[0.07] dark:text-foreground/[0.05]">
                  {item.step}
                </span>

                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 transition-transform duration-300 group-hover:scale-110">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {item.step}
                  </span>
                </div>

                <div className="relative mt-8 flex flex-1 flex-col">
                  <p className="text-xs font-semibold text-primary">{item.category}</p>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm font-medium leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                  <span className="mt-5 inline-flex w-fit rounded-md border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors duration-300 group-hover:border-primary/30 group-hover:text-primary">
                    {item.tag}
                  </span>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
