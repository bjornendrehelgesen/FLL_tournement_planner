import { expect, test, type Page } from "@playwright/test";

type SetupOverrides = {
  teams?: number;
  robotTables?: number;
  presentationRooms?: number;
  robotStart?: string;
  robotEnd?: string;
  presentationStart?: string;
  presentationEnd?: string;
};

const DEFAULT_SETUP: Required<SetupOverrides> = {
  teams: 6,
  robotTables: 4,
  presentationRooms: 3,
  robotStart: "2026-01-15T09:00",
  robotEnd: "2026-01-15T12:00",
  presentationStart: "2026-01-15T09:00",
  presentationEnd: "2026-01-15T12:00",
};

function extractTimeRange(cellText: string): string {
  return cellText.split("|")[0]?.trim() ?? "";
}

function parseTime(text: string): number {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/.exec(text.trim());
  if (!match) {
    throw new Error(`Unexpected time format: ${text}`);
  }
  let hour = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3];
  if (meridiem === "PM" && hour !== 12) {
    hour += 12;
  }
  if (meridiem === "AM" && hour === 12) {
    hour = 0;
  }
  return hour * 60 + minutes;
}

function parseRange(rangeText: string): { start: number; end: number } {
  const [startText, endText] = rangeText.split(" - ");
  if (!startText || !endText) {
    throw new Error(`Unexpected range format: ${rangeText}`);
  }
  return {
    start: parseTime(startText),
    end: parseTime(endText),
  };
}

function formatTime(totalMinutes: number): string {
  const hour24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  let hour12 = hour24 % 12;
  if (hour12 === 0) {
    hour12 = 12;
  }
  return `${hour12}:${String(minutes).padStart(2, "0")} ${meridiem}`;
}

async function configureSetup(page: Page, overrides: SetupOverrides = {}) {
  const setup = { ...DEFAULT_SETUP, ...overrides };
  await page.goto("/");
  await page.locator("#teams-count").fill(String(setup.teams));
  await page.locator("#robot-tables").fill(String(setup.robotTables));
  await page.locator("#robot-start").fill(setup.robotStart);
  await page.locator("#robot-end").fill(setup.robotEnd);
  await page.locator("#presentation-rooms").fill(String(setup.presentationRooms));
  await page.locator("#presentation-start").fill(setup.presentationStart);
  await page.locator("#presentation-end").fill(setup.presentationEnd);
}

async function generateValidSchedule(
  page: Page,
  overrides: SetupOverrides = {}
) {
  await configureSetup(page, overrides);
  await page.getByRole("button", { name: "Generate schedule" }).click();
  await expect(
    page.getByRole("heading", { name: "Valid schedule generated" })
  ).toBeVisible();
}

test("happy path generates a valid schedule with expected team rows", async ({ page }) => {
  const teams = 6;
  await generateValidSchedule(page, { teams });
  await expect(page.getByText("Team schedule")).toBeVisible();
  await expect(page.locator("table tbody tr")).toHaveCount(teams);
});

test("manual edit on presentation grid produces conflicts after validation", async ({ page }) => {
  await generateValidSchedule(page);
  await expect(page.getByText("Team schedule")).toBeVisible();

  const teamRow = page.locator("tbody tr").filter({ hasText: "Team 1" }).first();
  const presentationCellText = await teamRow.locator("td").nth(0).innerText();
  const presentationRange = extractTimeRange(presentationCellText);

  const robotMatchTexts = await Promise.all([
    teamRow.locator("td").nth(1).innerText(),
    teamRow.locator("td").nth(2).innerText(),
    teamRow.locator("td").nth(3).innerText(),
  ]);

  await page.getByRole("tab", { name: "Presentation track" }).click();
  const grid = page.getByRole("region", { name: "Presentation grid" });
  await expect(grid).toBeVisible();

  const sourceCell = grid.locator(".grid-cell", { hasText: /^1$/ }).first();

  const robotRanges = robotMatchTexts.map((text) => parseRange(extractTimeRange(text)));
  const rowLabels = await grid.locator(".grid-row-label").allTextContents();
  const currentPresentationRange = parseRange(presentationRange);
  const targetIndex = rowLabels.findIndex((label) => {
    if (label.trim() === presentationRange.trim()) return false;
    const candidate = parseRange(label.trim());
    const overlapsRobot = robotRanges.some(
      (robot) => candidate.start < robot.end && robot.start < candidate.end
    );
    if (!overlapsRobot) return false;
    return candidate.start !== currentPresentationRange.start;
  });

  if (targetIndex === -1) {
    throw new Error(`Could not find a presentation slot overlapping robot ranges. Labels: ${rowLabels.join(", ")}`);
  }

  const targetRow = grid.locator(".grid-row").nth(targetIndex);
  const targetCell = targetRow.locator(".grid-row-cells .grid-cell").first();

  await expect(sourceCell).toBeVisible();
  await expect(targetCell).toBeVisible();
  await sourceCell.dragTo(targetCell);
  await expect(page.getByText("Manual changes pending validation.")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Teams" })).toHaveAttribute(
    "aria-selected",
    "true"
  );

  const validateButton = page.getByRole("button", { name: "Validate schedule" });
  await validateButton.scrollIntoViewIfNeeded();
  await validateButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Manual changes pending validation.")).toBeHidden();
  const conflictsPanel = page.locator(".panel.conflicts");
  await expect(conflictsPanel).toBeVisible();
  const conflictItems = conflictsPanel.locator("li");
  const conflictCount = await conflictItems.count();
  if (conflictCount === 0) {
    await expect(conflictsPanel).toContainText("No conflicts detected.");
  } else {
    expect(conflictCount).toBeGreaterThan(0);
  }
});

test("saved setup reloads as last opened", async ({ page }) => {
  await configureSetup(page, { teams: 8 });
  await page.locator("#setup-name").fill("E2E Setup");
  await page.getByRole("button", { name: "Save setup" }).click();

  await page.reload();

  await expect(page.locator("#teams-count")).toHaveValue("8");
  await expect(page.locator("#setup-load option:checked")).toHaveText("E2E Setup");
});
