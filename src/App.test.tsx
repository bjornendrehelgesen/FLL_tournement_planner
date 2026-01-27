import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the header", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "FLL Tournament Planner" })
    ).toBeInTheDocument();
  });

  it("disables generate when minimum gap is too small", async () => {
    const user = userEvent.setup();
    render(<App />);

    const minGapInput = screen.getByLabelText(/minimum gap/i);
    await user.clear(minGapInput);
    await user.type(minGapInput, "10");

    expect(
      screen.getByText("Minimum gap must be at least 15 minutes.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate schedule/i })
    ).toBeDisabled();
  });

  it("flags too few teams", async () => {
    const user = userEvent.setup();
    render(<App />);

    const teamsInput = screen.getByLabelText(/number of teams/i);
    await user.clear(teamsInput);
    await user.type(teamsInput, "1");

    expect(
      screen.getByText("At least two teams are required.")
    ).toBeInTheDocument();
  });
});
