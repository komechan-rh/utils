import type { MonthlyPayrollResult, PersonPayment } from "./types";

// 空き部屋数・支払い状況は氏名行にも値を持つが、支払い対象者ではないため除外する。
const NON_PERSON_LABELS = ["空き部屋数", "支払い状況"];

type ColumnMap = {
  workMonthCol: number;
  paymentDueDateCol: number;
  paymentStatusCol: number;
  totalColumns: { personName: string; col: number }[];
};

function findHeaderRows(values: unknown[][]): {
  nameRow: unknown[];
  labelRow: unknown[];
  dataStartIndex: number;
} {
  const labelRowIndex = values.findIndex((row) => row.includes("稼働月"));
  if (labelRowIndex < 1) {
    throw new Error("スプレッドシートのヘッダー行（稼働月）が見つかりません。");
  }

  return {
    nameRow: values[labelRowIndex - 1],
    labelRow: values[labelRowIndex],
    dataStartIndex: labelRowIndex + 1,
  };
}

function buildColumnMap(nameRow: unknown[], labelRow: unknown[]): ColumnMap {
  const workMonthCol = labelRow.indexOf("稼働月");
  const paymentDueDateCol = labelRow.indexOf("支払い予定日");
  const paymentStatusCol = nameRow.indexOf("支払い状況");

  const totalColumns: { personName: string; col: number }[] = [];
  nameRow.forEach((name, col) => {
    if (typeof name === "string" && name !== "" && !NON_PERSON_LABELS.includes(name)) {
      totalColumns.push({ personName: name, col });
    }
  });

  return { workMonthCol, paymentDueDateCol, paymentStatusCol, totalColumns };
}

function findTargetRow(
  dataRows: unknown[][],
  columnMap: ColumnMap,
  targetDate: Date,
): unknown[] | undefined {
  return dataRows.find((row) => {
    const dueDate = row[columnMap.paymentDueDateCol];
    return (
      dueDate instanceof Date &&
      dueDate.getFullYear() === targetDate.getFullYear() &&
      dueDate.getMonth() === targetDate.getMonth()
    );
  });
}

function formatWorkMonth(value: unknown): string {
  if (value instanceof Date) {
    return `${value.getFullYear()}/${String(value.getMonth() + 1).padStart(2, "0")}`;
  }
  return String(value ?? "");
}

function extractPayments(row: unknown[], columnMap: ColumnMap): PersonPayment[] {
  return columnMap.totalColumns
    .map(({ personName, col }) => ({ personName, amount: Number(row[col]) || 0 }))
    .filter(({ amount }) => amount > 0);
}

function buildMonthlyPayrollResult(
  values: unknown[][],
  targetDate: Date,
): MonthlyPayrollResult | undefined {
  const { nameRow, labelRow, dataStartIndex } = findHeaderRows(values);
  const columnMap = buildColumnMap(nameRow, labelRow);
  const dataRows = values.slice(dataStartIndex);

  const targetRow = findTargetRow(dataRows, columnMap, targetDate);
  if (!targetRow) return undefined;

  return {
    workMonth: formatWorkMonth(targetRow[columnMap.workMonthCol]),
    paymentDueDate: targetRow[columnMap.paymentDueDateCol] as Date,
    paymentStatus: String(targetRow[columnMap.paymentStatusCol] ?? ""),
    payments: extractPayments(targetRow, columnMap),
  };
}

function getMonthlyPayroll(targetDate: Date = new Date()): MonthlyPayrollResult | undefined {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(
    "PAYROLL_SPREADSHEET_ID",
  );
  if (!spreadsheetId) {
    throw new Error("PAYROLL_SPREADSHEET_ID がスクリプトプロパティに設定されていません。");
  }

  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheets()[0];
  const values = sheet.getDataRange().getValues();

  return buildMonthlyPayrollResult(values, targetDate);
}

export { getMonthlyPayroll, buildMonthlyPayrollResult };
