import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { DesignMaterials } from "@/components/app/design-materials";
import type { DesignResult } from "@/lib/agent/llm";
const result: DesignResult = { architecture: ["I2C"], bom: [{ item: "温度", model: "SHT40", qty: 1, estCost: "¥10 估算" }], interfaces: ["I2C"], risks: [{ level: "中", desc: "待核验" }],
  materialsLock: { version: "component-materials-v1", projectId: crypto.randomUUID(), designId: crypto.randomUUID(), createdAt: "2026-09-30T00:00:00.000Z", revision: "c".repeat(64), hash: "d".repeat(64), partial: false, reasons: [],
    items: [{ bomIndex: 0, model: "SHT40", status: "matched", references: [0] }], references: [{ id: crypto.randomUUID(), scope: "platform", reviewStatus: "auto-indexed", title: "SHT40 数据手册", source: "manual.pdf#page=2&part=1", version: 2, sha256: "b".repeat(64), excerpt: "资料片段，仅供参考" }] } };
it("shows per-component server versions with collapsed source/hash and no claim of hardware verification", () => {
  render(<DesignMaterials result={result} />);
  expect(screen.getByText("已锁定型号参考")).toBeVisible();
  fireEvent.click(screen.getByText(/芯片手册 · SHT40 数据手册 · v2/));
  expect(screen.getByText("未人工复核")).toBeVisible(); expect(screen.getByText(/来源：manual.pdf#page=2&part=1/)).toBeVisible();
  expect(screen.getByText(/不代表资料齐全或硬件已验证/)).toBeVisible();
  expect(screen.getByText("版本锁详情").closest("details")).not.toHaveAttribute("open");
});
it("does not show budget-exhausted components as successfully searched or fully absent", () => {
  render(<DesignMaterials result={{ ...result, materialsLock: { ...result.materialsLock!, partial: true, reasons: ["BUDGET"], references: [], items: [{ bomIndex: 0, model: "SHT40", status: "deferred", references: [] }] } }} />);
  expect(screen.getByText("补检索未完成")).toBeVisible(); expect(screen.getByRole("status")).toHaveTextContent("未命中不代表知识库没有资料");
});
