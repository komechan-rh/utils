import type { MonthlyPayrollResult } from "./types";

const PAYROLL_NOT_FOUND_MESSAGE = "今月の支払い予定は見つかりませんでした。";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatDateLabel(date: Date): string {
  return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
}

function formatMonthlyPayrollMessage(result: MonthlyPayrollResult | undefined): string {
  if (!result) return PAYROLL_NOT_FOUND_MESSAGE;

  const lines: string[] = [
    `💰 給与支払い通知（${result.workMonth}分 / 支払い予定日 ${formatDateLabel(result.paymentDueDate)}）`,
    `支払い状況: ${result.paymentStatus}`,
    "",
  ];

  if (result.payments.length === 0) {
    lines.push("対象者なし");
  } else {
    for (const { personName, amount } of result.payments) {
      lines.push(`・${personName}: ${amount.toLocaleString()}円`);
    }
    const total = result.payments.reduce((sum, payment) => sum + payment.amount, 0);
    lines.push("");
    lines.push(`合計: ${total.toLocaleString()}円`);
  }

  return lines.join("\n");
}

export { formatMonthlyPayrollMessage };
