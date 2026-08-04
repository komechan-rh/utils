import { describe, expect, it } from "vitest";
import {
  buildMonthlyPayrollResult,
  findPaymentStatusCell,
  getPreviousMonthDate,
  resolveMarkTargetCell,
} from "./sheet";

// 実際のスプレッドシートの氏名は含めず、ダミーの氏名で構成を再現する。
// スタッフCは「氏名行に名前はあるが合計列のラベルが空欄」という
// 実データで起きている入力漏れを再現し、それでも合計を検出できることを確認する。
function buildSheetValues(dueDate: Date): unknown[][] {
  const nameRow = [
    "",
    "",
    "",
    "スタッフA",
    "",
    "",
    "",
    "",
    "スタッフB",
    "",
    "",
    "",
    "",
    "スタッフC",
    "",
    "",
    "",
    "",
    "空き部屋数",
    "支払い状況",
  ];
  const labelRow = [
    "稼働月",
    "稼働月末日",
    "支払い予定日",
    "合計",
    "基本",
    "稼働率",
    "内見報酬",
    "積み残し分",
    "合計",
    "基本",
    "稼働率",
    "内見報酬",
    "積み残し分",
    "",
    "基本",
    "稼働率",
    "内見報酬",
    "積み残し分",
    "",
    "",
  ];
  const dataRow = [
    "2026/06",
    new Date(2026, 5, 30),
    dueDate,
    40000,
    30000,
    10000,
    0,
    0,
    40000,
    30000,
    0,
    0,
    10000,
    20000,
    15000,
    5000,
    0,
    0,
    4,
    "未済",
  ];

  return [nameRow, labelRow, dataRow];
}

describe("buildMonthlyPayrollResult", () => {
  it("支払い予定日が対象月の行から給与情報を抽出する", () => {
    const dueDate = new Date(2026, 6, 30);
    const values = buildSheetValues(dueDate);

    const result = buildMonthlyPayrollResult(values, new Date(2026, 6, 9));

    expect(result).toEqual({
      workMonth: "2026/06",
      paymentDueDate: dueDate,
      paymentStatus: "未済",
      payments: [
        { personName: "スタッフA", amount: 40000 },
        { personName: "スタッフB", amount: 40000 },
        { personName: "スタッフC", amount: 20000 },
      ],
    });
  });

  it("対象月に一致する支払い予定日がなければundefinedを返す", () => {
    const dueDate = new Date(2026, 6, 30);
    const values = buildSheetValues(dueDate);

    const result = buildMonthlyPayrollResult(values, new Date(2026, 7, 1));

    expect(result).toBeUndefined();
  });

  it("金額が0または空欄の人は対象から除外する", () => {
    const dueDate = new Date(2026, 6, 30);
    const values = buildSheetValues(dueDate);
    values[2][8] = 0;
    values[2][13] = "";

    const result = buildMonthlyPayrollResult(values, new Date(2026, 6, 9));

    expect(result?.payments).toEqual([{ personName: "スタッフA", amount: 40000 }]);
  });
});

describe("findPaymentStatusCell", () => {
  it("対象月の行にある支払い状況セルの位置（1始まりの行・列）を返す", () => {
    const dueDate = new Date(2026, 6, 30);
    const values = buildSheetValues(dueDate);

    const cell = findPaymentStatusCell(values, new Date(2026, 6, 9));

    expect(cell).toEqual({ row: 3, col: 20 });
  });

  it("対象月に一致する支払い予定日がなければundefinedを返す", () => {
    const dueDate = new Date(2026, 6, 30);
    const values = buildSheetValues(dueDate);

    const cell = findPaymentStatusCell(values, new Date(2026, 7, 1));

    expect(cell).toBeUndefined();
  });
});

describe("getPreviousMonthDate", () => {
  it("基準日の前月の1日を返す", () => {
    expect(getPreviousMonthDate(new Date(2026, 7, 15))).toEqual(new Date(2026, 6, 1));
  });

  it("1月が基準日の場合は前年12月になる", () => {
    expect(getPreviousMonthDate(new Date(2026, 0, 15))).toEqual(new Date(2025, 11, 1));
  });
});

describe("resolveMarkTargetCell", () => {
  // 支払いが遅れて翌月にずれ込んだケース: 前月分（7月30日締め）が未済のまま残っている状態で
  // 8月に「給与支払い済」と発言した場合、当月分ではなく未済の前月分を更新対象にする。
  function buildTwoMonthSheetValues(previousMonthStatus: string): unknown[][] {
    const nameRow = ["", "", "", "スタッフA", "支払い状況"];
    const labelRow = ["稼働月", "稼働月末日", "支払い予定日", "合計", ""];
    const previousMonthRow = [
      "2026/06",
      new Date(2026, 5, 30),
      new Date(2026, 6, 30),
      40000,
      previousMonthStatus,
    ];
    const currentMonthRow = [
      "2026/07",
      new Date(2026, 6, 31),
      new Date(2026, 7, 30),
      40000,
      "未済",
    ];

    return [nameRow, labelRow, previousMonthRow, currentMonthRow];
  }

  it("前月分が未済であれば、当月分ではなく前月分のセル位置を返す", () => {
    const values = buildTwoMonthSheetValues("未済");

    const cell = resolveMarkTargetCell(values, new Date(2026, 7, 5));

    expect(cell).toEqual({ row: 3, col: 5 });
  });

  it("前月分が済であれば、当月分のセル位置を返す", () => {
    const values = buildTwoMonthSheetValues("済");

    const cell = resolveMarkTargetCell(values, new Date(2026, 7, 5));

    expect(cell).toEqual({ row: 4, col: 5 });
  });
});
