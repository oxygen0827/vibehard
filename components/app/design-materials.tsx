import type { DesignResult } from "@/lib/agent/llm";
import { MATERIAL_CHECK_BOUNDARY, materialKinds, materialStates, referenceKind } from "@/lib/agent/design-materials";
import { materialLockStates } from "@/lib/agent/material-lock";

export function DesignMaterials({ result }: { result: DesignResult }) {
  const lock = result.materialsLock;
  if (lock) return <section aria-label="方案资料配套检查" className="space-y-3 rounded-xl border bg-card p-5">
    <h2 className="font-semibold">逐器件资料与版本锁</h2>
    <p className="text-sm text-muted-foreground">按最终 BOM 的完整型号补检索，锁定来源版本和哈希。每个新 Agent 回合会检查资料是否仍可用；版本变化或停用后重新检索。原件保留在私有 OSS，项目保存有界摘录。</p>
    {lock.partial && <p role="status" className="text-sm text-amber-600">部分补检索未完成；未命中不代表知识库没有资料。</p>}
    <p className="text-xs text-muted-foreground">生成时锁定 · {new Date(lock.createdAt).toLocaleString("zh-CN")} · {lock.references.length} 条来源 · 不代表资料齐全或硬件已验证</p>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">BOM 器件 / 型号</th><th className="p-2">补检索情况</th><th className="p-2">锁定资料</th></tr></thead><tbody>
      {lock.items.map(item => <tr key={item.bomIndex} className="border-b border-border/50">
        <td className="p-2">{result.bom[item.bomIndex]?.item}<div className="text-xs text-muted-foreground">{result.bom[item.bomIndex]?.model}</div></td>
        <td className="p-2">{materialLockStates[item.status]}</td>
        <td className="p-2">{item.references.length ? item.references.map(index => {
          const ref = lock.references[index];
          return ref && <details key={index} className="mb-2"><summary className="cursor-pointer">{materialKinds[referenceKind(ref.title, ref.source)]} · {ref.title} · v{ref.version}</summary>
            <div className="mt-1 space-y-1 break-all text-xs text-muted-foreground"><p>{ref.reviewStatus === "auto-indexed" ? "未人工复核" : "锁定时已发布，适配性未验证"}</p><p>来源：{ref.source}</p><p>来源 SHA256：{ref.sha256}</p><p>{ref.excerpt}</p></div>
          </details>;
        }) : item.status === "ambiguous" ? "请先明确完整型号和板卡版本" : "请补充本型号资料"}</td>
      </tr>)}
    </tbody></table></div>
    <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">版本锁详情</summary><p className="mt-2 break-all">清单 SHA256：{lock.hash}<br />检索版本：{lock.revision}</p></details>
    <p className="text-xs text-muted-foreground">资料锁随方案文件归档到项目 designs/；下载资料包还包含 materials/lock.json 和 references/components/。旧文件保留历史版本，不能作为当前有效证据。</p>
  </section>;
  const report = result.materials;
  return <section aria-label="方案资料配套检查" className="space-y-3 rounded-xl border bg-card p-5">
    <h2 className="font-semibold">方案资料配套检查</h2>
    {!report ? <p className="text-sm text-muted-foreground">历史方案没有配套检查记录，不能据此判断资料完整性；原方案文件保持不变。</p> : <>
      <p className="text-sm text-muted-foreground">{MATERIAL_CHECK_BOUNDARY}</p>
      {report.retrievalStatus === "partial" && <p role="status" className="text-sm text-amber-600">部分知识不可用，检查不完整。</p>}
      <p className="text-xs text-muted-foreground">生成时快照 · {new Date(report.checkedAt).toLocaleString("zh-CN")} · 检查清单随方案 Markdown 保存，并经既有归档链路同步到本项目 designs/。</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">BOM 器件 / 型号</th><th className="p-2">配套情况</th><th className="p-2">实际来源</th></tr></thead><tbody>
        {report.items.map(item => <tr key={item.bomIndex} className="border-b border-border/50">
          <td className="p-2">{result.bom[item.bomIndex]?.item}<div className="text-xs text-muted-foreground">{result.bom[item.bomIndex]?.model}</div></td>
          <td className="p-2">{materialStates[item.status]}<div className="text-xs text-muted-foreground">{item.status === "ambiguous" ? "先确认完整型号/板卡版本" : "资料完整性与电气适配未验证"}</div></td>
          <td className="p-2">{item.references.length ? item.references.map(ref => {
            const source = result.retrieval?.references[ref.index];
            return source ? <div key={ref.index} className="mb-1">{materialKinds[ref.kind]} · {source.title} · v{source.version}<span className="block text-xs text-muted-foreground">{source.reviewStatus === "auto-indexed" ? "未人工复核" : "已发布资料，适配性待核对"}；位置与哈希见上方检索记录</span></div> : <span key={ref.index}>来源记录不可用</span>;
          }) : "请补充本型号手册、原理图、引脚或驱动资料"}</td>
        </tr>)}
      </tbody></table></div>
      <p className="text-xs text-muted-foreground">资料包包含需求、方案、BOM、检查清单和有界来源摘录，不含全部原件。原件保留在私有 OSS；停用/版本变化后，历史摘录不能当作当前有效证据。</p>
    </>}
  </section>;
}
