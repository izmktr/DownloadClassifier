// itemsはchrome.downloads.DownloadItem型の配列です。
// DownloadItemの主なプロパティ例:
// id: number - ダウンロードの一意なID
// url: string - ダウンロード元のURL
// filename: string - 保存先のファイルパス
// state: string - 'in_progress', 'complete', 'interrupted' など
// danger: string - 'safe', 'dangerous', 'accepted', 'uncommon', 'host', 'user_validated', 'user_validated'
// startTime: string - ISO 8601形式の開始時刻
// endTime: string - ISO 8601形式の終了時刻（完了時のみ）
// fileSize: number - バイト単位のファイルサイズ
// mime: string - MIMEタイプ
// paused: boolean - 一時停止中かどうか
// error: string - エラー内容（失敗時のみ）
// byExtensionId: string - 拡張機能ID（拡張機能経由の場合）
// byExtensionName: string - 拡張機能名（拡張機能経由の場合）

function getDownloadsList() {
  chrome.downloads.search({limit: 20, orderBy: ['-startTime']}, function(items) {
      const list = document.getElementById('downloads-list');
      if (!list) return;
      list.replaceChildren(); // より安全な方法でリストをクリア
      items.forEach(item => {
          const li = document.createElement('li');
          const fileName = item.filename.split(/\\|\//).pop();
          //const mimeType = item.mime || 'N/A';
          li.textContent = `${fileName}`;
          list.appendChild(li);
      });
  });
}

getDownloadsList();

document.getElementById('show-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// 多言語化: message.jsonの値でUIテキストを置換
function localizeHtml() {
  // data-i18n 属性を持つ要素のテキストを置換
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key && chrome.i18n) {
      el.textContent = chrome.i18n.getMessage(key) || el.textContent;
    }
  });

  // data-i18n-title 属性を持つ要素のtitle属性を設定
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key && chrome.i18n) {
      el.title = chrome.i18n.getMessage(key) || '';
    }
  });
}
document.addEventListener('DOMContentLoaded', localizeHtml);

function localizeTitle() {
  if (chrome.i18n) {
    const titleMsg = chrome.i18n.getMessage('popupTitle');
    if (titleMsg) {
      document.title = titleMsg;
    }
  }
}
document.addEventListener('DOMContentLoaded', localizeTitle);
