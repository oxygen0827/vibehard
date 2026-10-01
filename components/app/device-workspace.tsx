import type { ReactNode } from "react";
import { Bug, MonitorSmartphone } from "lucide-react";
import { PageHeader } from "./page-header";

export const deviceTaskExamples = {
  debug: "先读取本项目资料，列出外设、接口与引脚依据、资料缺项，再制定逐项调试清单。本次仅分析，不操作设备。",
  embedded: "先读取本项目方案、原理图与现有源码，说明板型、工具链及资料缺项，再给出最小可验证开发计划。先不修改文件或操作设备。",
} as const;

/** Module-specific presentation; all execution still belongs to the shared controller. */
export function DeviceWorkspace({ mode, projectSelector, device, task, activity, status, approvals, resources, settings, error }: {
  mode: "debug" | "embedded";
  projectSelector: ReactNode; device: ReactNode; task: ReactNode; activity: ReactNode;
  status: ReactNode; approvals: ReactNode; resources: ReactNode; settings: ReactNode; error: ReactNode;
}) {
  const debugging = mode === "debug";
  return <div aria-label={`${debugging ? "AI 调试" : "嵌入式开发"}工作区`} className="h-full min-w-0 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:p-8">
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="[&>div]:mb-0"><PageHeader icon={debugging ? Bug : MonitorSmartphone} title={debugging ? "AI 调试" : "嵌入式开发"} helpKey={mode}
        description={debugging ? "选择项目，读取板卡状态与调试日志，让 AI 帮你逐项定位问题。" : "选择项目，描述开发需求，基于已有资料和源码推进开发。"} /></div>
      <section aria-label="工作项目" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">{projectSelector}</section>
      {error}
      {device}
      {approvals}
      <div className="grid min-w-0 gap-5 lg:grid-cols-5">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <section aria-label="任务需求" className="rounded-xl border bg-card p-5">{task}</section>
          <details className="rounded-xl border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium">会话与高级设置</summary>
            <div className="mt-4 space-y-3">{settings}</div>
          </details>
          <details className="rounded-xl border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium">项目资料与历史结果</summary>
            <div className="mt-4 min-w-0 space-y-4">{resources}</div>
          </details>
        </div>
        <section aria-label="执行日志与结果" className="flex h-[520px] min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card lg:col-span-3 lg:h-[600px]">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <h2 className="text-sm font-semibold">{debugging ? "调试日志与分析" : "开发过程与结果"}</h2>{status}
          </div>
          {activity}
        </section>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">资料和执行结果归属当前项目；连接设备不代表已经调通。编译、烧录和部署以实际执行记录为准，不显示模拟成功。</p>
    </div>
  </div>;
}
