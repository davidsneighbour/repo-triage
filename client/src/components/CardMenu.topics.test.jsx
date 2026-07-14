import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CardMenu } from "./CardMenu.jsx";

const noop = () => {
  /* no-op */
};
const makeHandlers = (overrides = {}) => ({
  onSetChecked: noop,
  onClearCheck: noop,
  onSetPriority: noop,
  onSetInactivity: noop,
  onSetIgnored: noop,
  onAddNotice: noop,
  onViewNotices: noop,
  onAddTag: vi.fn(),
  onRemoveTag: noop,
  onClose: noop,
  defaultInactivity: 7,
  ...overrides,
});

const anchor = { current: document.createElement("button") };

describe("CardMenu topic suggestions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows unapplied topics as suggestion chips", () => {
    const repo = {
      id: 1,
      name: "widget",
      tags: ["infra"],
      topics: ["react", "typescript"],
      priority: null,
      notice_count: 0,
    };
    render(<CardMenu repo={repo} anchorRef={anchor} {...makeHandlers()} />);
    expect(
      screen.getByRole("button", { name: "Add topic react as tag" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add topic typescript as tag" }),
    ).toBeInTheDocument();
  });

  it("does not show a chip for a topic already applied as a tag", () => {
    const repo = {
      id: 1,
      name: "widget",
      tags: ["react"],
      topics: ["react", "typescript"],
      priority: null,
      notice_count: 0,
    };
    render(<CardMenu repo={repo} anchorRef={anchor} {...makeHandlers()} />);
    expect(
      screen.queryByRole("button", { name: "Add topic react as tag" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add topic typescript as tag" }),
    ).toBeInTheDocument();
  });

  it("calls onAddTag with the normalised topic on click", () => {
    const onAddTag = vi.fn();
    const repo = {
      id: 1,
      name: "widget",
      tags: [],
      topics: ["React"],
      priority: null,
      notice_count: 0,
    };
    render(
      <CardMenu
        repo={repo}
        anchorRef={anchor}
        {...makeHandlers({ onAddTag })}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Add topic react as tag" }),
    );
    expect(onAddTag).toHaveBeenCalledWith(1, "react");
  });

  it("normalises topics: trims whitespace and lowercases", () => {
    const onAddTag = vi.fn();
    const repo = {
      id: 1,
      name: "widget",
      tags: [],
      topics: ["  TypeScript  "],
      priority: null,
      notice_count: 0,
    };
    render(
      <CardMenu
        repo={repo}
        anchorRef={anchor}
        {...makeHandlers({ onAddTag })}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Add topic typescript as tag" }),
    );
    expect(onAddTag).toHaveBeenCalledWith(1, "typescript");
  });

  it("renders nothing when topics is empty", () => {
    const repo = {
      id: 1,
      name: "widget",
      tags: [],
      topics: [],
      priority: null,
      notice_count: 0,
    };
    render(<CardMenu repo={repo} anchorRef={anchor} {...makeHandlers()} />);
    expect(screen.queryByText("topics:")).not.toBeInTheDocument();
  });

  it("renders nothing when all topics are already applied", () => {
    const repo = {
      id: 1,
      name: "widget",
      tags: ["react", "typescript"],
      topics: ["react", "typescript"],
      priority: null,
      notice_count: 0,
    };
    render(<CardMenu repo={repo} anchorRef={anchor} {...makeHandlers()} />);
    expect(screen.queryByText("topics:")).not.toBeInTheDocument();
  });

  it("renders nothing when topics is absent", () => {
    const repo = {
      id: 1,
      name: "widget",
      tags: [],
      priority: null,
      notice_count: 0,
    };
    render(<CardMenu repo={repo} anchorRef={anchor} {...makeHandlers()} />);
    expect(screen.queryByText("topics:")).not.toBeInTheDocument();
  });
});
