import { describe, expect, it } from "vitest";
import { dataSourceTier } from "./domain";

describe("dataSourceTier", () => {
  it("classifies hook/statusline as official", () => {
    expect(dataSourceTier("official_hook")).toBe("official");
    expect(dataSourceTier("status_line")).toBe("official");
  });
  it("classifies transcript/filesystem/process as observed", () => {
    expect(dataSourceTier("transcript")).toBe("observed");
    expect(dataSourceTier("filesystem")).toBe("observed");
    expect(dataSourceTier("process")).toBe("observed");
  });
  it("classifies estimated as estimated", () => {
    expect(dataSourceTier("estimated")).toBe("estimated");
  });
});
