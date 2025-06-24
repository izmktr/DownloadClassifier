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
      list.innerHTML = '';
      items.forEach(item => {
          const li = document.createElement('li');
          li.textContent = `${item.filename.split(/\\|\//).pop()} [${item.mime}]`;
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
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key && chrome.i18n) {
      el.textContent = chrome.i18n.getMessage(key) || el.textContent;
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

