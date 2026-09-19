"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/utils";
import type { PublicLlm } from "@/lib/agent/llm";

export function LlmSettings() {
  const [settings, setSettings] = useState<PublicLlm[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void fetch(apiPath("/api/admin/llm"), { cache: "no-store" }).then(async (res) => {
      const data = await res.json(); if (!res.ok) throw new Error(data.error ?? "模型配置加载失败");
      if (active) setSettings(data.settings);
    }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  return <section className="mb-8 rounded-xl border border-primary/25 bg-card p-5" aria-label="LLM 设置">
    <h2 className="font-semibold">LLM 服务设置</h2>
    <p className="mt-2 text-sm text-muted-foreground">保存后用于后续请求，正在运行的任务不受影响。API Key 加密保存在服务器，读取时不返回原文。留空保留原 Key；更换服务地址时需重新输入。</p>
    {error && <p role="alert" className="mt-4 text-sm text-red-500">{error}</p>}
    {!error && !settings.length && <p className="mt-4 text-sm">正在读取模型配置...</p>}
    <div className="mt-5 grid gap-6 lg:grid-cols-2">{settings.map((setting) => <ModelForm key={setting.purpose} initial={setting} />)}</div>
  </section>;
}
function ModelForm({ initial }: { initial: PublicLlm }) {
  const [value, setValue] = useState(initial);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const title = value.purpose === "agent" ? "云端 Agent 对话与执行" : "硬件方案生成";
  const submit = async (action: "save" | "test") => {
    setBusy(action); setMessage(""); setFailed(false);
    try {
      const response = await fetch(apiPath(action === "test" ? "/api/admin/llm/test" : "/api/admin/llm"), {
        method: action === "test" ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(50_000),
        body: JSON.stringify({ purpose: value.purpose, baseUrl: value.baseUrl, model: value.model, protocol: value.protocol, revision: value.revision, apiKey: apiKey || undefined }),
      });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "请求失败");
      if (action === "save") { setValue(data.setting); setApiKey(""); setMessage("已保存。后续请求使用此配置；已打开的 Agent 工作台请刷新模型列表。"); }
      else setMessage(`${data.message} 耗时 ${(data.latencyMs / 1000).toFixed(1)} 秒。测试未保存配置。`);
    } catch (error) { setFailed(true); setMessage(error instanceof Error && error.name === "TimeoutError" ? "测试超时，请检查服务商状态" : error instanceof Error ? error.message : "请求失败"); }
    finally { setBusy(null); }
  };
  const field = (key: "baseUrl" | "model", label: string, placeholder: string) => <label className="block text-sm">{label}<Input className="mt-1.5" value={value[key]} onChange={(e) => { setValue({ ...value, [key]: e.target.value }); setMessage(""); }} placeholder={placeholder} disabled={Boolean(busy)} autoComplete="off" /></label>;
  return <div className="space-y-4 rounded-lg border border-border p-4">
    <div><h3 className="font-medium">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{value.purpose === "agent" ? "供 cloud-runner 使用，要求 Responses API、流式输出与工具调用兼容。" : "直接从云端调用 LLM，不依赖知识库。"}</p></div>
    {field("baseUrl", `${title} Base URL`, "https://api.example.com/v1")}
    {field("model", `${title} 模型名称`, "填写服务商实际提供的模型 ID")}
    <label className="block text-sm">{title} 接口协议<select className="mt-1.5 block h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={value.protocol} disabled={Boolean(busy) || value.purpose === "agent"} onChange={(e) => setValue({ ...value, protocol: e.target.value as PublicLlm["protocol"] })}><option value="responses">Responses API</option><option value="chat-completions">Chat Completions API</option></select></label>
    <label className="block text-sm">{title} API Key<Input className="mt-1.5" type="password" autoComplete="new-password" value={apiKey} disabled={Boolean(busy)} onChange={(e) => { setApiKey(e.target.value); setMessage(""); }} placeholder={value.hasApiKey ? "已配置，留空保留原 Key" : "请输入 API Key"} /></label>
    <p className="text-xs text-muted-foreground">{value.hasApiKey ? "已保存密钥" : "尚未保存密钥"}{value.updatedAt ? ` · 更新于 ${new Date(value.updatedAt).toLocaleString("zh-CN")}` : ""}</p>
    <div className="flex gap-2"><Button variant="outline" disabled={Boolean(busy) || !value.baseUrl || !value.model} onClick={() => void submit("test")}>{busy === "test" ? "测试中..." : "测试连接"}</Button><Button disabled={Boolean(busy) || !value.baseUrl || !value.model} onClick={() => void submit("save")}>{busy === "save" ? "保存中..." : "保存配置"}</Button></div>
    {message && <p role={failed ? "alert" : "status"} className={`text-sm ${failed ? "text-red-500" : "text-emerald-600"}`}>{message}</p>}
  </div>;
}
