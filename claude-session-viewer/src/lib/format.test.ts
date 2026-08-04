import { describe, expect, it } from "vitest";
import { formatDuration, formatPercentage, formatResetTime, formatTokens } from "./format";

describe("formatPercentage", () => {
  it("formats to one decimal place", () => {
    expect(formatPercentage(68.75)).toBe("68.8%");
  });
  it("shows an em dash when unavailable", () => {
    expect(formatPercentage(undefined)).toBe("—");
  });
});

describe("formatTokens", () => {
  it("adds thousands separators", () => {
    expect(formatTokens(137_500)).toBe("137,500");
  });
});

describe("formatResetTime", () => {
  it("shows a time for today's resets", () => {
    const today = new Date();
    today.setHours(21, 30, 0, 0);
    expect(formatResetTime(today.toISOString())).toBe("21:30");
  });

  it("shows month/day for a different day", () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const result = formatResetTime(future.toISOString());
    expect(result).not.toBe("—");
    expect(result).not.toMatch(/^\d{2}:\d{2}$/);
  });

  it("shows an em dash for missing input", () => {
    expect(formatResetTime(undefined)).toBe("—");
  });
});

describe("formatDuration", () => {
  it("formats sub-hour durations as mm:ss", () => {
    expect(formatDuration(84_000)).toBe("01:24");
  });
  it("formats hour-plus durations as h:mm:ss", () => {
    expect(formatDuration(3_723_000)).toBe("1:02:03");
  });
});
