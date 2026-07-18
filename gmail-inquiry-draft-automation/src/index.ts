import {
  createDraftForThread,
  createEmptyResult,
  findUnprocessedInquiryThreads,
  formatError,
  getOrCreateLabel,
  type InquiryDraftConfig,
  logResult,
  threadHasExistingDraft,
} from "./inquiry-draft";

const INQUIRY_SUBJECT_KEYWORD_DEFAULT = "問い合わせ";
const PROCESSED_LABEL_NAME_DEFAULT = "下書き作成済み";
const TRIGGER_INTERVAL_MINUTES = 5;

function getTrimmedProperty(props: GoogleAppsScript.Properties.Properties, key: string): string {
  return (props.getProperty(key) || "").trim();
}

function getConfig(): InquiryDraftConfig & {
  inquirySubjectKeyword: string;
  processedLabelName: string;
} {
  const props = PropertiesService.getScriptProperties();
  const organizationName = getTrimmedProperty(props, "ORGANIZATION_NAME");

  if (!organizationName) {
    throw new Error("ORGANIZATION_NAME がスクリプトプロパティに設定されていません。");
  }

  return {
    organizationName,
    replySignature: getTrimmedProperty(props, "REPLY_SIGNATURE"),
    lineFriendUrl: getTrimmedProperty(props, "LINE_FRIEND_URL"),
    inquirySubjectKeyword:
      getTrimmedProperty(props, "INQUIRY_SUBJECT_KEYWORD") || INQUIRY_SUBJECT_KEYWORD_DEFAULT,
    processedLabelName:
      getTrimmedProperty(props, "PROCESSED_LABEL_NAME") || PROCESSED_LABEL_NAME_DEFAULT,
  };
}

function main(): void {
  const startedAt = new Date();
  const result = createEmptyResult();

  try {
    const config = getConfig();
    const processedLabel = getOrCreateLabel(config.processedLabelName);
    const threads = findUnprocessedInquiryThreads(config.inquirySubjectKeyword, config.processedLabelName);
    const drafts = GmailApp.getDrafts();

    result.scanned = threads.length;

    threads.forEach((thread) => {
      try {
        if (threadHasExistingDraft(thread, drafts)) {
          result.skipped += 1;
          processedLabel.addToThread(thread);
          console.log(`既に下書きが存在するためスキップしました。件名「${thread.getFirstMessageSubject()}」`);
          return;
        }

        createDraftForThread(thread, config);
        processedLabel.addToThread(thread);
        result.drafted += 1;
        console.log(`返信の下書きを作成しました。件名「${thread.getFirstMessageSubject()}」`);
      } catch (threadError) {
        result.errors += 1;
        console.error(
          `下書き作成中にエラーが発生しました。件名「${thread.getFirstMessageSubject()}」詳細: ${formatError(threadError)}`,
        );
      }
    });
  } catch (error) {
    result.errors += 1;
    console.error(`問い合わせ下書き自動作成を中断しました。詳細: ${formatError(error)}`);
  } finally {
    result.durationMs = Date.now() - startedAt.getTime();
    logResult(result);
  }
}

function setupTrigger(): void {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === "main") {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  ScriptApp.newTrigger("main").timeBased().everyMinutes(TRIGGER_INTERVAL_MINUTES).create();

  console.log(`トリガーを登録しました。${TRIGGER_INTERVAL_MINUTES}分ごとに main が実行されます。`);
}

export { main, setupTrigger };
