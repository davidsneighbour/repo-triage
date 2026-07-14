import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsDialog } from "./SettingsDialog.jsx";

const defaults = {
  defaultInactivityDays: 7,
  syncIntervalMinutes: 60,
  githubOwners: "",
};
const settings = {
  defaultInactivityDays: 14,
  syncIntervalMinutes: 30,
  githubOwners: "myorg",
};

describe("SettingsDialog", () => {
  it("renders with current settings pre-filled", () => {
    render(
      <SettingsDialog
        settings={settings}
        defaults={defaults}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Default review cycle (days)")).toHaveValue(
      14,
    );
    expect(screen.getByLabelText("Auto-sync interval (minutes)")).toHaveValue(
      30,
    );
    expect(
      screen.getByLabelText("GitHub owners (comma-separated)"),
    ).toHaveValue("myorg");
  });

  it("uses defaults when settings prop is null", () => {
    render(
      <SettingsDialog
        settings={null}
        defaults={defaults}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Default review cycle (days)")).toHaveValue(7);
    expect(screen.getByLabelText("Auto-sync interval (minutes)")).toHaveValue(
      60,
    );
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <SettingsDialog
        settings={settings}
        defaults={defaults}
        onSave={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(
      <SettingsDialog
        settings={settings}
        defaults={defaults}
        onSave={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onSave with parsed values on submit", async () => {
    const onSave = vi.fn().mockResolvedValue();
    render(
      <SettingsDialog
        settings={settings}
        defaults={defaults}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Default review cycle (days)"), {
      target: { value: "21" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        defaultInactivityDays: 21,
        syncIntervalMinutes: 30,
        githubOwners: "myorg",
        reportSchedule: null,
      }),
    );
  });

  it("shows a validation error for out-of-range review cycle", () => {
    render(
      <SettingsDialog
        settings={settings}
        defaults={defaults}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Default review cycle (days)"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("alert").textContent).toMatch(/Review cycle/);
  });

  it("shows a validation error for out-of-range sync interval", () => {
    render(
      <SettingsDialog
        settings={settings}
        defaults={defaults}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Auto-sync interval (minutes)"), {
      target: { value: "9999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("alert").textContent).toMatch(/Sync interval/);
  });
});

describe("SettingsDialog tag rules", () => {
  it("renders existing tag rules when tagRules prop is provided", () => {
    const tagRules = [
      { tag: "infra", days: 14 },
      { tag: "docs", days: 30 },
    ];
    render(
      <SettingsDialog
        settings={settings}
        defaults={defaults}
        tagRules={tagRules}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("infra")).toBeInTheDocument();
    expect(screen.getByText(/14d/)).toBeInTheDocument();
    expect(screen.getByText("docs")).toBeInTheDocument();
  });

  it("calls onTagRuleDelete when the delete button for a rule is clicked", () => {
    const onTagRuleDelete = vi.fn();
    const tagRules = [{ tag: "infra", days: 14 }];
    render(
      <SettingsDialog
        settings={settings}
        defaults={defaults}
        tagRules={tagRules}
        onSave={vi.fn()}
        onTagRuleDelete={onTagRuleDelete}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete tag rule for infra" }),
    );
    expect(onTagRuleDelete).toHaveBeenCalledWith("infra");
  });

  it("shows ruleError when Add is clicked with an empty tag", () => {
    render(
      <SettingsDialog
        settings={settings}
        defaults={defaults}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Tag rule days"), {
      target: { value: "14" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Tag is required");
  });

  it("shows ruleError when days is out of range", () => {
    render(
      <SettingsDialog
        settings={settings}
        defaults={defaults}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Tag rule tag"), {
      target: { value: "infra" },
    });
    fireEvent.change(screen.getByLabelText("Tag rule days"), {
      target: { value: "999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Days must be 1");
  });

  it("calls onTagRuleSave with valid tag and days and clears inputs after", async () => {
    const onTagRuleSave = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingsDialog
        settings={settings}
        defaults={defaults}
        onSave={vi.fn()}
        onTagRuleSave={onTagRuleSave}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Tag rule tag"), {
      target: { value: "infra" },
    });
    fireEvent.change(screen.getByLabelText("Tag rule days"), {
      target: { value: "14" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(onTagRuleSave).toHaveBeenCalledWith("infra", 14),
    );
    expect(screen.getByLabelText("Tag rule tag")).toHaveValue("");
  });
});

describe("SettingsDialog report schedule", () => {
  it("renders cron expression and output path fields", () => {
    render(
      <SettingsDialog
        settings={settings}
        defaults={defaults}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Cron expression")).toBeInTheDocument();
    expect(screen.getByLabelText("Output path")).toBeInTheDocument();
  });

  it("pre-fills cron and outputPath from settings.reportSchedule", () => {
    const s = {
      ...settings,
      reportSchedule: { cron: "0 9 * * *", outputPath: "/tmp/out" },
    };
    render(
      <SettingsDialog
        settings={s}
        defaults={defaults}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Cron expression")).toHaveValue("0 9 * * *");
    expect(screen.getByLabelText("Output path")).toHaveValue("/tmp/out");
  });

  it("passes reportSchedule to onSave when cron and outputPath are filled", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingsDialog
        settings={settings}
        defaults={defaults}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Cron expression"), {
      target: { value: "0 8 * * 1-5" },
    });
    fireEvent.change(screen.getByLabelText("Output path"), {
      target: { value: "/data/reports" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          reportSchedule: { cron: "0 8 * * 1-5", outputPath: "/data/reports" },
        }),
      ),
    );
  });

  it("shows lastExport info when lastExport prop is provided with ok status", () => {
    const lastExport = {
      status: "ok",
      timestamp: "2026-06-01T08:00:00.000Z",
      outputPath: "/data/reports",
    };
    render(
      <SettingsDialog
        settings={settings}
        defaults={defaults}
        lastExport={lastExport}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Last export/)).toBeInTheDocument();
    expect(screen.getByText(/Last export/).textContent).toMatch(
      /\/data\/reports/,
    );
  });

  it("shows warning glyph for a non-ok lastExport status", () => {
    const lastExport = {
      status: "error",
      timestamp: "2026-06-01T08:00:00.000Z",
    };
    render(
      <SettingsDialog
        settings={settings}
        defaults={defaults}
        lastExport={lastExport}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Last export/).textContent).toMatch(/⚠/);
  });
});
