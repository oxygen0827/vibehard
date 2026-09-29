import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { AgentReasoning } from "@/components/app/agent-reasoning";

it("keeps reasoning collapsed until the user expands it", () => {
  const { container } = render(<AgentReasoning text="The user wants an analysis." />);
  const details = container.querySelector("details");
  expect(details).not.toBeNull();
  expect(details?.open).toBe(false);
  expect(screen.getByText("推理过程")).toBeInTheDocument();
  fireEvent.click(screen.getByText("推理过程"));
  expect(details?.open).toBe(true);
  expect(screen.getByText("The user wants an analysis.")).toBeInTheDocument();
});
