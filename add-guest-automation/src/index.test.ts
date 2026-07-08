import { describe, expect, it, vi } from "vitest";

import { createEmptyResult, shouldProcessCreatedEvent } from "./calendar-automation";
import { main } from "./index";

describe("GAS entrypoints", () => {
  it("GASから呼び出すmain関数を定義する", () => {
    expect(main).toBeTypeOf("function");
  });
});

describe("createEmptyResult", () => {
  it("実行結果の初期値を返す", () => {
    expect(createEmptyResult()).toEqual({
      scanned: 0,
      updated: 0,
      addedGuests: 0,
      alreadyComplete: 0,
      skipped: 0,
      failedGuests: 0,
      errors: 0,
      durationMs: 0,
      skipReasons: {},
    });
  });
});

describe("shouldProcessCreatedEvent", () => {
  const defaultOptions = {
    includeAllDayEvents: false,
    skipTitleKeywords: ["招待不要"],
    onlyIfCreatorIsMe: false,
  };
  const createdWatermark = "2026-04-19T00:00:00.000Z";

  it("作成日時が確認範囲より前の場合、not_newly_createdで対象外にする", () => {
    const result = shouldProcessCreatedEvent(
      createEvent({
        created: "2026-04-18T23:59:59.000Z",
      }),
      defaultOptions,
      createdWatermark,
    );

    expect(result).toEqual({
      shouldProcess: false,
      reason: "not_newly_created",
    });
  });

  it("終日イベントを含めない設定の場合、all_day_eventで対象外にする", () => {
    const result = shouldProcessCreatedEvent(
      createEvent({
        created: "2026-04-19T00:01:00.000Z",
        start: { date: "2026-04-19" },
      }),
      defaultOptions,
      createdWatermark,
    );

    expect(result).toEqual({
      shouldProcess: false,
      reason: "all_day_event",
    });
  });

  it("タイトルに除外キーワードが含まれる場合、skip_title_keywordで対象外にする", () => {
    const result = shouldProcessCreatedEvent(
      createEvent({
        created: "2026-04-19T00:01:00.000Z",
        summary: "定例 招待不要",
      }),
      defaultOptions,
      createdWatermark,
    );

    expect(result).toEqual({
      shouldProcess: false,
      reason: "skip_title_keyword",
    });
  });

  it("作成者が実行ユーザーではない場合、creator_mismatchで対象外にする", () => {
    vi.stubGlobal("Session", {
      getEffectiveUser: () => ({ getEmail: () => "me@example.com" }),
      getActiveUser: () => ({ getEmail: () => "me@example.com" }),
    });

    const result = shouldProcessCreatedEvent(
      createEvent({
        created: "2026-04-19T00:01:00.000Z",
        creator: { email: "other@example.com" },
      }),
      {
        ...defaultOptions,
        onlyIfCreatorIsMe: true,
      },
      createdWatermark,
    );

    expect(result).toEqual({
      shouldProcess: false,
      reason: "creator_mismatch",
    });
  });
});

function createEvent(
  overrides: GoogleAppsScript.Calendar.Schema.Event,
): GoogleAppsScript.Calendar.Schema.Event {
  return {
    id: "event-id",
    created: "2026-04-19T00:01:00.000Z",
    start: { dateTime: "2026-04-19T01:00:00.000Z" },
    creator: { self: true },
    ...overrides,
  };
}
