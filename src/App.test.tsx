import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { generateSchedule } from "./engine";
import { AssignmentType, Track } from "./domain";

function formatShortTime(valueMs: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(valueMs));
}

function formatTimeRange(startMs: number, endMs: number): string {
  return `${formatShortTime(startMs)} - ${formatShortTime(endMs)}`;
}

vi.mock("./engine", async () => {
  const actual = await vi.importActual<typeof import("./engine")>("./engine");
  return {
    ...actual,
    generateSchedule: vi.fn(actual.generateSchedule),
  };
});

const mockedGenerateSchedule = vi.mocked(generateSchedule);

describe("App", () => {
  afterEach(() => {
    mockedGenerateSchedule.mockReset();
  });

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

  it("renders a successful schedule result", async () => {
    const user = userEvent.setup();
    mockedGenerateSchedule.mockReturnValue({
      ok: true,
      schedule: {
        slots: [],
        assignments: [
          {
            id: "assignment-1",
            teamId: 1,
            type: AssignmentType.PRESENTATION,
            slotId: "slot-1",
            resourceId: "room-1",
            sequence: 1,
          },
          {
            id: "assignment-2",
            teamId: 2,
            type: AssignmentType.ROBOT_MATCH,
            slotId: "slot-2",
            resourceId: "table-1",
            sequence: 1,
          },
        ],
        warnings: ["Robot track is tight."],
      },
    });

    render(<App />);
    await user.click(screen.getByRole("button", { name: /generate schedule/i }));

    expect(
      screen.getByRole("heading", { name: /valid schedule generated/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Presentation slots")).toBeInTheDocument();
    expect(screen.getByText("Robot matches")).toBeInTheDocument();
    expect(screen.getByText("Total assignments")).toBeInTheDocument();
    expect(screen.getByText("Robot track is tight.")).toBeInTheDocument();
  });

  it("renders a team-centric schedule table", async () => {
    const user = userEvent.setup();
    const presentationStart = new Date(2026, 0, 15, 9, 30).getTime();
    const presentationEnd = new Date(2026, 0, 15, 10, 0).getTime();
    const robotStart = new Date(2026, 0, 15, 9, 0).getTime();
    const robotEnd = new Date(2026, 0, 15, 9, 5).getTime();
    const robotStart2 = new Date(2026, 0, 15, 9, 10).getTime();
    const robotEnd2 = new Date(2026, 0, 15, 9, 15).getTime();
    const robotStart3 = new Date(2026, 0, 15, 9, 20).getTime();
    const robotEnd3 = new Date(2026, 0, 15, 9, 25).getTime();

    mockedGenerateSchedule.mockReturnValue({
      ok: true,
      schedule: {
        slots: [
          {
            id: `PRESENTATION-${presentationStart}`,
            track: Track.PRESENTATION,
            startMs: presentationStart,
            endMs: presentationEnd,
            resources: { roomIds: [1, 2] },
          },
          {
            id: `ROBOT-${robotStart}`,
            track: Track.ROBOT,
            startMs: robotStart,
            endMs: robotEnd,
            resources: { tableIds: [1, 2] },
          },
          {
            id: `ROBOT-${robotStart2}`,
            track: Track.ROBOT,
            startMs: robotStart2,
            endMs: robotEnd2,
            resources: { tableIds: [1, 2] },
          },
          {
            id: `ROBOT-${robotStart3}`,
            track: Track.ROBOT,
            startMs: robotStart3,
            endMs: robotEnd3,
            resources: { tableIds: [1, 2] },
          },
        ],
        assignments: [
          {
            id: "presentation-1",
            teamId: 1,
            type: AssignmentType.PRESENTATION,
            slotId: `PRESENTATION-${presentationStart}`,
            resourceId: "2",
            sequence: null,
          },
          {
            id: "robot-1-1",
            teamId: 1,
            type: AssignmentType.ROBOT_MATCH,
            slotId: `ROBOT-${robotStart}`,
            resourceId: "1",
            sequence: 1,
          },
          {
            id: "robot-1-2",
            teamId: 1,
            type: AssignmentType.ROBOT_MATCH,
            slotId: `ROBOT-${robotStart2}`,
            resourceId: "2",
            sequence: 2,
          },
          {
            id: "robot-1-3",
            teamId: 1,
            type: AssignmentType.ROBOT_MATCH,
            slotId: `ROBOT-${robotStart3}`,
            resourceId: "1",
            sequence: 3,
          },
        ],
        warnings: [],
      },
    });

    render(<App />);
    await user.click(screen.getByRole("button", { name: /generate schedule/i }));

    const presentationCell = `${formatTimeRange(
      presentationStart,
      presentationEnd
    )} | Room 2`;
    const robotCell1 = `${formatTimeRange(robotStart, robotEnd)} | Table 1`;
    const robotCell2 = `${formatTimeRange(robotStart2, robotEnd2)} | Table 2`;
    const robotCell3 = `${formatTimeRange(robotStart3, robotEnd3)} | Table 1`;

    expect(screen.getByText("Team schedule")).toBeInTheDocument();
    expect(screen.getByText("Team 1")).toBeInTheDocument();
    expect(screen.getByText(presentationCell)).toBeInTheDocument();
    expect(screen.getByText(robotCell1)).toBeInTheDocument();
    expect(screen.getByText(robotCell2)).toBeInTheDocument();
    expect(screen.getByText(robotCell3)).toBeInTheDocument();
  });

  it("renders a failure schedule result with suggestions", async () => {
    const user = userEvent.setup();
    mockedGenerateSchedule.mockReturnValue({
      ok: false,
      errors: [
        {
          code: "INSUFFICIENT_ROBOT_CAPACITY",
          message: "Not enough robot slots.",
          kind: "FEASIBILITY",
        },
      ],
      suggestions: [
        {
          action: "INCREASE_ROBOT_TABLES",
          by: 1,
        },
      ],
    });

    render(<App />);
    await user.click(screen.getByRole("button", { name: /generate schedule/i }));

    expect(
      screen.getByRole("heading", { name: /unable to generate schedule/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText("INSUFFICIENT_ROBOT_CAPACITY")
    ).toBeInTheDocument();
    expect(screen.getByText("Not enough robot slots.")).toBeInTheDocument();
    expect(
      screen.getByText(/increase robot tables by 1/i)
    ).toBeInTheDocument();
  });
});
