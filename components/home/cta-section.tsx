import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Reveal } from "@/components/reveal";

export function CTASection() {
  return (
    <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card px-6 py-8 shadow-[0_18px_48px_rgba(15,23,42,0.09)] dark:shadow-[0_22px_58px_rgba(0,0,0,0.24)] lg:grid lg:grid-cols-[1fr_auto] lg:items-center lg:gap-8 lg:px-10">
          <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-primary/[0.08] blur-[64px]" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-48 w-48 rounded-full bg-primary/[0.06] blur-[56px]" />
          <div className="relative">
            <h2 className="text-[28px] font-bold tracking-tight text-foreground">
              开始整理你的硬件项目工作流
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
              内测阶段通过邀请码加入。注册后即可使用提示词模板、原理图识别和硬件方案生成等核心工具。
            </p>
          </div>

          <div className="relative mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
            <Link
              href="/register"
              className="group inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/25 transition-all duration-200 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/30 active:scale-[0.97]"
            >
              获取邀请码注册
              <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-6 text-sm font-semibold text-foreground transition-all duration-200 hover:border-ring/45 hover:bg-muted active:scale-[0.97]"
            >
              登录工作台
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
