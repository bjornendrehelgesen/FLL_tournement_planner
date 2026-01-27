import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the header", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "FLL Tournament Planner" })
    ).toBeInTheDocument();
  });

  it("renders engine status", () => {
    render(<App />);
    expect(screen.getByText("Setup OK")).toBeInTheDocument();
  });
});
