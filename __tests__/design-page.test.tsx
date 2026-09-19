import { render, screen } from "@testing-library/react";
import DesignPage from "@/app/app/design/page";

describe("hardware design page", () => {
  it("shows the real knowledge-base and automatic price behavior", () => {
    render(<DesignPage />);
    expect(screen.getByText("已接入内置方案知识库，BOM 将自动填写人民币参考单价。")).toBeInTheDocument();
    expect(screen.queryByText(/不接入知识库|未接入知识库/)).not.toBeInTheDocument();
  });
});
