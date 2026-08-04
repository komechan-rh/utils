import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RateLimitHeader } from "./RateLimitHeader";

describe("RateLimitHeader", () => {
  it("shows an explicit Unavailable message when there is no local source", () => {
    render(
      <RateLimitHeader
        rateLimits={{
          availability: "unavailable",
          unavailableReason: "no local source",
          source: "estimated",
        }}
      />,
    );
    expect(screen.getByTestId("rate-limit-unavailable")).toHaveTextContent("Unavailable");
  });

  it("shows both windows with percentage and reset time when available", () => {
    const today = new Date();
    today.setHours(21, 30, 0, 0);
    render(
      <RateLimitHeader
        rateLimits={{
          availability: "available",
          fiveHour: { usedPercentage: 68, resetsAt: today.toISOString() },
          sevenDay: { usedPercentage: 39, resetsAt: today.toISOString() },
          source: "official_hook",
        }}
      />,
    );
    const bar = screen.getByTestId("rate-limit-bar");
    expect(bar).toHaveTextContent("5 hours");
    expect(bar).toHaveTextContent("68.0%");
    expect(bar).toHaveTextContent("7 days");
    expect(bar).toHaveTextContent("39.0%");
  });
});
