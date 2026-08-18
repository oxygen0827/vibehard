import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemeProvider } from "@/components/theme-provider";

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      {children}
    </ThemeProvider>
  );
}

describe("ThemeToggle", () => {
  it("renders theme toggle button", () => {
    render(<Wrapper>
      <ThemeToggle />
    </Wrapper>);

    expect(screen.getByRole("button", { name: /切换到亮色主题/i })).toBeInTheDocument();
  });

  it("switches theme when clicked", async () => {
    const user = userEvent.setup();
    render(<Wrapper>
      <ThemeToggle />
    </Wrapper>);

    const button = screen.getByRole("button", { name: /切换到亮色主题/i });
    await user.click(button);

    expect(document.documentElement.classList.contains("light")).toBe(true);
  });
});
