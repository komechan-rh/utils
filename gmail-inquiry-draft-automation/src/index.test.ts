import { describe, expect, it } from "vitest";

import {
  buildDraftBody,
  buildSearchQuery,
  createEmptyResult,
  extractSenderName,
  threadHasExistingDraft,
} from "./inquiry-draft";
import { main, setupTrigger } from "./index";

describe("GAS entrypoints", () => {
  it("GASから呼び出すmain関数を定義する", () => {
    expect(main).toBeTypeOf("function");
  });

  it("GASから呼び出すsetupTrigger関数を定義する", () => {
    expect(setupTrigger).toBeTypeOf("function");
  });
});

describe("createEmptyResult", () => {
  it("実行結果の初期値を返す", () => {
    expect(createEmptyResult()).toEqual({
      scanned: 0,
      drafted: 0,
      skipped: 0,
      errors: 0,
      durationMs: 0,
    });
  });
});

describe("buildSearchQuery", () => {
  it("件名キーワードを含み処理済みラベルを除外する検索クエリを組み立てる", () => {
    expect(buildSearchQuery("問い合わせ", "下書き作成済み")).toBe(
      'subject:"問い合わせ" -label:"下書き作成済み"',
    );
  });
});

describe("extractSenderName", () => {
  it("表示名とメールアドレスの形式から表示名を取り出す", () => {
    expect(extractSenderName("山田太郎 <taro@example.com>")).toBe("山田太郎");
  });

  it("ダブルクォートで囲まれた表示名からクォートを除いて取り出す", () => {
    expect(extractSenderName('"山田 太郎" <taro@example.com>')).toBe("山田 太郎");
  });

  it("表示名がない場合は空文字を返す", () => {
    expect(extractSenderName("taro@example.com")).toBe("");
  });
});

describe("buildDraftBody", () => {
  const config = { organizationName: "example organization", replySignature: "", lineFriendUrl: "" };

  it("送信者名がある場合は宛名から始まる本文を作る", () => {
    const body = buildDraftBody("山田太郎", config);

    expect(body.startsWith("山田太郎 様\n\n")).toBe(true);
    expect(body).toContain("この度はexample organizationにお問い合わせいただき");
  });

  it("送信者名がない場合は宛名なしの本文を作る", () => {
    const body = buildDraftBody("", config);

    expect(body.startsWith("この度は")).toBe(true);
  });

  it("公式ラインURLが設定されている場合は友達追加の案内を挿入する", () => {
    const body = buildDraftBody("山田太郎", {
      organizationName: "example organization",
      replySignature: "",
      lineFriendUrl: "https://page.line.me/example",
    });

    expect(body).toContain("公式ラインの友達追加をお勧めしております");
    expect(body).toContain("https://page.line.me/example");
  });

  it("公式ラインURLが未設定の場合は案内を挿入しない", () => {
    const body = buildDraftBody("山田太郎", config);

    expect(body).not.toContain("公式ライン");
  });

  it("署名が設定されている場合は本文末尾に追加する", () => {
    const body = buildDraftBody("山田太郎", {
      organizationName: "example organization",
      replySignature: "example signature",
      lineFriendUrl: "",
    });

    expect(body.endsWith("\n\nexample signature")).toBe(true);
  });

  it("公式ラインURLと署名が両方設定されている場合は案内の後に署名を続ける", () => {
    const body = buildDraftBody("山田太郎", {
      organizationName: "example organization",
      replySignature: "example signature",
      lineFriendUrl: "https://page.line.me/example",
    });

    expect(body.endsWith("https://page.line.me/example\n\nexample signature")).toBe(true);
  });
});

describe("threadHasExistingDraft", () => {
  it("スレッドIDが一致する下書きがあればtrueを返す", () => {
    const thread = { getId: () => "thread-1" } as GoogleAppsScript.Gmail.GmailThread;
    const drafts = [
      {
        getMessage: () => ({
          getThread: () => ({ getId: () => "thread-1" }),
        }),
      },
    ] as unknown as GoogleAppsScript.Gmail.GmailDraft[];

    expect(threadHasExistingDraft(thread, drafts)).toBe(true);
  });

  it("スレッドIDが一致する下書きがなければfalseを返す", () => {
    const thread = { getId: () => "thread-1" } as GoogleAppsScript.Gmail.GmailThread;
    const drafts = [
      {
        getMessage: () => ({
          getThread: () => ({ getId: () => "thread-2" }),
        }),
      },
    ] as unknown as GoogleAppsScript.Gmail.GmailDraft[];

    expect(threadHasExistingDraft(thread, drafts)).toBe(false);
  });
});
