/**
 * Google Apps Script のサンプル関数です。
 *
 * 必要に応じて名前を変更したり、関数を追加してください。
 */
function doGet(e?: GoogleAppsScript.Events.DoGet): GoogleAppsScript.Content.TextOutput {
  // テキスト出力を返す場合は型を Content.TextOutput に合わせる
  return ContentService.createTextOutput("Hello GAS template!");
}

// 必要に応じてテストや外部利用のために関数をエクスポートする
export {};
