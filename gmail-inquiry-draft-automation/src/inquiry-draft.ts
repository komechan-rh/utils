type InquiryThread = GoogleAppsScript.Gmail.GmailThread;
type InquiryDraft = GoogleAppsScript.Gmail.GmailDraft;
type InquiryLabel = GoogleAppsScript.Gmail.GmailLabel;

export type InquiryDraftConfig = {
  organizationName: string;
  replySignature: string;
  lineFriendUrl: string;
};

export type ExecutionResult = {
  scanned: number;
  drafted: number;
  skipped: number;
  errors: number;
  durationMs: number;
};

export function createEmptyResult(): ExecutionResult {
  return {
    scanned: 0,
    drafted: 0,
    skipped: 0,
    errors: 0,
    durationMs: 0,
  };
}

export function buildSearchQuery(inquirySubjectKeyword: string, processedLabelName: string): string {
  return `subject:"${inquirySubjectKeyword}" -label:"${processedLabelName}"`;
}

export function extractSenderName(fromHeader: string): string {
  const match = fromHeader.match(/^"?([^"<]*)"?\s*<[^>]+>$/);
  if (!match) {
    return "";
  }
  return match[1].trim();
}

export function buildDraftBody(senderName: string, config: InquiryDraftConfig): string {
  const salutation = senderName ? `${senderName} 様\n\n` : "";
  const lineSection = config.lineFriendUrl
    ? `\n\nまた今後のやりとりをスムーズに行うためにも、公式ラインの友達追加をお勧めしております。\n` +
      `ぜひ公式ラインからやり取りさせていただけますと幸いです。\n${config.lineFriendUrl}`
    : "";
  const signature = config.replySignature ? `\n\n${config.replySignature}` : "";

  return (
    `${salutation}この度は${config.organizationName}にお問い合わせいただき、誠にありがとうございます。\n` +
    `内容を確認のうえ、担当者より改めてご連絡いたします。今しばらくお待ちくださいませ。${lineSection}${signature}`
  );
}

export function threadHasExistingDraft(thread: InquiryThread, drafts: InquiryDraft[]): boolean {
  const threadId = thread.getId();
  return drafts.some((draft) => draft.getMessage().getThread().getId() === threadId);
}

export function findUnprocessedInquiryThreads(
  inquirySubjectKeyword: string,
  processedLabelName: string,
): InquiryThread[] {
  return GmailApp.search(buildSearchQuery(inquirySubjectKeyword, processedLabelName), 0, 1);
}

export function getOrCreateLabel(name: string): InquiryLabel {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

export function createDraftForThread(thread: InquiryThread, config: InquiryDraftConfig): void {
  const messages = thread.getMessages();
  const latestMessage = messages[messages.length - 1];
  const senderName = extractSenderName(latestMessage.getFrom());

  thread.createDraftReply(buildDraftBody(senderName, config));
}

export function formatError(error: unknown): string {
  if (!error) {
    return "不明なエラー";
  }

  if (error instanceof Error) {
    return error.stack || error.message;
  }

  return String(error);
}

export function logResult(result: ExecutionResult): void {
  console.log(
    `処理結果: 確認したスレッド ${result.scanned}件、下書き作成 ${result.drafted}件、` +
      `スキップ ${result.skipped}件、エラー ${result.errors}件、処理時間 ${result.durationMs}ms。`,
  );
}
