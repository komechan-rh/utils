import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionCard } from "./SessionCard";
import { makeSession } from "../../test/fixtures";

describe("SessionCard", () => {
  it("shows subagents in a tree with status and duration", () => {
    render(
      <SessionCard
        session={makeSession({
          subagents: [
            {
              id: "sub-1",
              parentSessionId: "s1",
              type: "Explore",
              status: "running",
              startedAt: new Date(Date.now() - 84_000).toISOString(),
              source: "transcript",
            },
            {
              id: "sub-2",
              parentSessionId: "s1",
              type: "Test Runner",
              status: "completed",
              durationMs: 43_000,
              source: "transcript",
            },
          ],
        })}
      />,
    );
    const rows = screen.getAllByTestId("subagent-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Explore");
    expect(rows[0]).toHaveTextContent("Running");
    expect(rows[1]).toHaveTextContent("Test Runner");
    expect(rows[1]).toHaveTextContent("Completed");
    expect(rows[1]).toHaveTextContent("00:43");
  });

  it("shows 'No active subagents' when there are none", () => {
    render(<SessionCard session={makeSession({ subagents: [] })} />);
    expect(screen.getByText("No active subagents")).toBeInTheDocument();
  });

  it("shows a context progress bar when context data is present", () => {
    render(
      <SessionCard
        session={makeSession({
          context: {
            usedTokens: 137_500,
            maxTokens: 200_000,
            usedPercentage: 68.75,
            source: "transcript",
            confidence: "medium",
          },
        })}
      />,
    );
    const bar = screen.getByTestId("context-bar");
    expect(bar).toHaveTextContent("137,500");
    expect(bar).toHaveTextContent("200,000");
    expect(bar).toHaveTextContent("68.8%");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "69");
  });
});
