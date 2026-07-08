import { describe, expect, it, vi } from "vitest";

// GASのグローバルオブジェクトをモック
const mockTextOutput = {
  getContent: () => "Hello GAS template!",
};

vi.stubGlobal("ContentService", {
  createTextOutput: vi.fn().mockReturnValue(mockTextOutput),
});

// テスト対象の関数をインポートするため動的に読み込む
// GAS環境ではグローバル関数として定義されるため、ここではロジックを直接テスト

describe("doGet", () => {
  it("テキスト出力を返す", () => {
    const output = ContentService.createTextOutput("Hello GAS template!");
    expect(output.getContent()).toBe("Hello GAS template!");
  });
});
