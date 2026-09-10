import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, Bug, CircuitBoard, Code2, FileSearch, Layers } from "lucide-react";
import { assetPath } from "@/lib/utils";
import { ChapterNav, DemoPlayer, ShareButton } from "./showcase-controls";
import styles from "./showcase.module.css";

export const metadata: Metadata = {
  title: "VibeHard 产品实录 | 从硬件想法到嵌入式应用",
  description: "五段 VibeHard 产品实录：硬件方案与 BOM、芯片资料、PCB 生成、AI 调试和嵌入式应用。看见想法一步步成形。",
  openGraph: {
    title: "VibeHard | 让硬件想法，一步步成形",
    description: "从需求与选型，到电路、调试和应用。五段产品实录，串起软硬件开发。",
    locale: "zh_CN",
    type: "website",
  },
};

const chapters = [
  {
    id: "requirement-to-design", slug: "design", label: "方案与 BOM", icon: Layers,
    kicker: "DEFINE / 定义需求", title: "一句需求，展开硬件方案。",
    description: "从供电、传感到无线连接，把一个环境监测节点的想法，展开成架构建议、BOM 预估与接口规划。",
    introduction: "输入一段产品需求，VibeHard 会拆解使用场景、核心功能与硬件约束，并给出可继续细化的系统方案和器件清单。",
    specimen: "环境监测节点 · ESP32-S3", outputs: ["架构建议", "BOM 预估", "接口与风险"],
  },
  {
    id: "chip-resources", slug: "datasheets", label: "芯片资料", icon: FileSearch,
    kicker: "RESEARCH / 理解器件", title: "芯片资料，变成开发依据。",
    description: "从芯片型号出发，检索技术文档，提取关键参数与接口信息，让选型和后续开发有据可查。",
    introduction: "选定核心芯片后，系统会集中整理数据手册、参考设计与开发资源，提取真正影响电路和固件实现的关键参数。",
    specimen: "芯片资源检索与参数分析", outputs: ["技术文档", "关键参数", "器件档案"],
  },
  {
    id: "schematic-to-pcb", slug: "pcb", label: "PCB 生成", icon: CircuitBoard,
    kicker: "LAYOUT / 连接电路", title: "从电路连接，到板上布局。",
    description: "将原理图中的器件与连接带入 PCB 流程，查看布局、布线预览和规则检查信息。",
    introduction: "原理图确认后，VibeHard 将器件、网络连接和板框约束带入 PCB 设计，生成可检查的布局布线与板级预览。",
    specimen: "原理图到 PCB 的生成流程", outputs: ["器件布局", "布线预览", "规则检查"],
  },
  {
    id: "pcb-to-debug", slug: "debug", label: "AI 调试", icon: Bug,
    kicker: "DEBUG / 逐步验证", title: "每一个外设，都有调试脉络。",
    description: "围绕板级外设展开调试，集中查看过程日志与状态，让问题定位和下一步排查更加清楚。",
    introduction: "板卡进入验证阶段后，系统围绕接口和外设逐项组织调试任务，把运行状态、异常线索与下一步建议放在同一条脉络中。",
    specimen: "外设调试与过程日志", outputs: ["外设清单", "过程日志", "异常定位"],
  },
  {
    id: "debug-to-firmware", slug: "embedded", label: "嵌入式应用", icon: Code2,
    kicker: "BUILD / 构建应用", title: "让硬件，拥有自己的应用。",
    description: "描述应用需求，结合硬件驱动生成代码，并在屏幕模拟器中预览交互与显示效果。",
    introduction: "硬件能力验证完成后，VibeHard 根据目标功能生成嵌入式应用代码，匹配底层驱动，并提前预览设备端的交互效果。",
    specimen: "应用代码生成与屏幕模拟", outputs: ["应用代码", "驱动匹配", "屏幕预览"],
  },
] as const;

export default function DemoPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.topbar} aria-label="主导航">
        <div className={styles.container}>
          <Link href="/" className={styles.brand} aria-label="返回 VibeHard 首页">
            <Image src={assetPath("/vibehard-icon.svg")} alt="" width={28} height={28} unoptimized />
            <span>VibeHard</span><span className={styles.navLabel}>产品演示</span>
          </Link>
          <div className={styles.navActions}>
            <ShareButton />
            <Link href="/login" className={styles.primaryLink}>进入工作台 <ArrowRight size={15} /></Link>
          </div>
        </div>
      </nav>

      <header className={`${styles.container} ${styles.intro}`}>
        <div>
          <p className={styles.eyebrow}><span /> AI 硬件开发工作台</p>
          <h1>VibeHard<span className={styles.brandDot}>.</span></h1>
          <p className={styles.tagline}>让硬件想法，一步步成形。</p>
        </div>
        <div className={styles.introAside}>
          <p>从需求与选型，到电路、调试和应用。<br />五段产品实录，串起软硬件开发。</p>
          <a href="#requirement-to-design" className={styles.textLink}>探索开发流程 <ArrowDown size={16} /></a>
        </div>
      </header>

      <ChapterNav chapters={chapters.map(({ id, label }) => ({ id, label }))} />

      {chapters.map((chapter, index) => {
        const Icon = chapter.icon;
        return (
          <section id={chapter.id} key={chapter.id} className={styles.chapter} data-tone={chapter.slug} aria-labelledby={`${chapter.id}-title`}>
            <div className={styles.container}>
              <div className={styles.chapterHeading}>
                <div>
                  <p className={styles.kicker}><Icon size={17} />{chapter.kicker}</p>
                  <h2 id={`${chapter.id}-title`}>{chapter.title}</h2>
                </div>
                <p className={styles.description}>{chapter.description}</p>
              </div>
              <DemoPlayer slug={chapter.slug} label={chapter.label} index={index + 1} />
              <div className={styles.chapterIntroduction}>
                <span>模块简介</span>
                <p>{chapter.introduction}</p>
              </div>
              <div className={styles.chapterDetails}>
                <p>{chapter.specimen}</p>
                <ul>{chapter.outputs.map((output) => <li key={output}>{output}</li>)}</ul>
              </div>
            </div>
          </section>
        );
      })}

      <section className={styles.closing}>
        <div className={styles.container}>
          <div><p className={styles.eyebrow}>YOUR NEXT BUILD</p><h2>下一个想法，轮到你。</h2><p>从一段需求开始，探索你的硬件项目。</p></div>
          <Link href="/register" className={styles.closingLink}>邀请码注册 <ArrowRight size={18} /></Link>
        </div>
      </section>
      <footer className={`${styles.container} ${styles.footer}`}><span>VibeHard · 从想法到硬件</span><Link href="/">返回首页 <ArrowRight size={14} /></Link></footer>
    </main>
  );
}
