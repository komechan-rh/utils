import { describe, expect, it } from "vitest";

import { buildInquiryReplyPrompt, parseGenAiResponseText } from "./genai-client";

describe("buildInquiryReplyPrompt", () => {
  it("問い合わせ本文を含み、宛名・署名を含めない指示のプロンプトを組み立てる", () => {
    const prompt = buildInquiryReplyPrompt("見学希望日: 7月8日の午前");

    expect(prompt).toContain("見学希望日: 7月8日の午前");
    expect(prompt).toContain("宛名、挨拶、署名は含めない");
  });
});

describe("parseGenAiResponseText", () => {
  it("レスポンスからテキストを取り出す", () => {
    const responseBody = JSON.stringify({
      candidates: [{ content: { parts: [{ text: "  ご希望の7月8日午前で確定いたします。  " }] } }],
    });

    expect(parseGenAiResponseText(responseBody)).toBe("ご希望の7月8日午前で確定いたします。");
  });

  it("candidatesが存在しない場合はエラーを投げる", () => {
    const responseBody = JSON.stringify({});

    expect(() => parseGenAiResponseText(responseBody)).toThrow(
      "GenAI APIのレスポンスからメッセージを取得できませんでした。",
    );
  });
});
