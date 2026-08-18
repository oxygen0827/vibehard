import { CountUp } from "@/components/count-up";
import { Reveal } from "@/components/reveal";

const stats = [
  {
    value: <CountUp end={850} suffix="+" />,
    label: "提示词模板",
    desc: "覆盖主流 MCU 与硬件研发场景",
  },
  {
    value: <CountUp end={6} />,
    label: "核心工具",
    desc: "从需求、识别到方案输出",
  },
  {
    value: "PDF/图片",
    label: "识别输入",
    desc: "面向原理图和芯片资料",
  },
  {
    value: "方案+BOM",
    label: "输出内容",
    desc: "沉淀架构、选型和接口规划",
  },
];

export function StatsSection() {
  return (
    <section className="relative z-20 mx-auto max-w-5xl px-6 py-20">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Reveal key={stat.label} delay={i * 90}>
            <div className="h-full rounded-xl border border-border/80 bg-card/95 p-5 shadow-[0_14px_38px_rgba(15,23,42,0.08)] backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_22px_48px_rgba(15,23,42,0.12)] dark:shadow-[0_18px_46px_rgba(0,0,0,0.22)] dark:hover:shadow-[0_24px_54px_rgba(0,0,0,0.3)]">
              <p className="text-2xl font-bold tracking-tight text-primary">
                {stat.value}
              </p>
              <p className="mt-2 text-[13px] font-semibold text-foreground">
                {stat.label}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {stat.desc}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
