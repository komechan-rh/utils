import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionList } from "./SessionList";
import { makeSession } from "../../test/fixtures";

describe("SessionList", () => {
  it("shows the empty state when there are no sessions", () => {
    render(<SessionList sessions={[]} />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("renders multiple sessions", () => {
    render(
      <SessionList
        sessions={[
          makeSession({ id: "a", projectName: "frontend" }),
          makeSession({ id: "b", projectName: "backend" }),
        ]}
      />,
    );
    const cards = screen.getAllByTestId("session-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByText("frontend")).toBeInTheDocument();
    expect(screen.getByText("backend")).toBeInTheDocument();
  });

  it("sorts running sessions before stopped ones", () => {
    render(
      <SessionList
        sessions={[
          makeSession({ id: "a", projectName: "stopped-one", status: "stopped" }),
          makeSession({ id: "b", projectName: "running-one", status: "thinking" }),
        ]}
      />,
    );
    const cards = screen.getAllByTestId("session-card");
    expect(cards[0]).toHaveTextContent("running-one");
    expect(cards[1]).toHaveTextContent("stopped-one");
  });
});
