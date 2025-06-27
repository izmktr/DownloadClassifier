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

/**
 * ファイルサイズを人間が読みやすい形式に変換します。
 * @param {number} bytes - バイト単位のファイルサイズ。
 * @param {number} [decimals=2] - 小数点以下の桁数。
 * @returns {string} - フォーマットされたファイルサイズ文字列。
 */
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes <= 0) return '';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * URLからホスト名を取得します。
 * @param {string} url - URL文字列。
 * @returns {string} - ホスト名。
 */
function getDomain(url) {
  if (!url) return '';
  try {
    // data: URLなどを考慮
    if (url.startsWith('data:')) {
      return 'Data URL';
    }
    return new URL(url).hostname;
  } catch (e) {
    // ローカルファイルパスなどの場合
    return 'Local';
  }
}

/**
 * ダウンロード項目に基づいて表示するアイコンのパスを返します。
 * @param {chrome.downloads.DownloadItem} item - ダウンロードアイテム。
 * @returns {string} - アイコンファイルのパス。
 */
function getFileIcon(item) {
  const mime = item.mime;
  if (!mime) return 'icons/file-generic.svg';

  if (mime.startsWith('image/')) {
    return 'icons/image.svg';
  }
  if (mime.startsWith('audio/')) {
    return 'icons/music.svg';
  }
  if (mime.startsWith('video/')) {
    return 'icons/video.svg';
  }
  if (mime.startsWith('text/')) {
    return 'icons/file-text.svg';
  }
  if (mime === 'application/pdf') {
    return 'icons/file-text.svg'; // PDFはテキストアイコンで代用
  }
  if (['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/gzip', 'application/x-bzip2'].includes(mime)) {
    return 'icons/archive.svg';
  }

  return 'icons/file-generic.svg'; // デフォルトアイコン
}

function getDownloadsList() {
  chrome.downloads.search({limit: 20, orderBy: ['-startTime']}, function(items) {
      const list = document.getElementById('downloads-list');
      if (!list) return;
      list.replaceChildren(); // より安全な方法でリストをクリア

      items.forEach(item => {
          const li = document.createElement('li');

           const icon = document.createElement('img');
           icon.className = 'file-icon';
           icon.src = getFileIcon(item);

           const fileInfo = document.createElement('div');
           fileInfo.className = 'file-info';

           const fileNameDiv = document.createElement('div');
           fileNameDiv.className = 'file-name';
          const fileName = item.filename.split(/\\|\//).pop();
           fileNameDiv.textContent = fileName;
           fileNameDiv.title = item.filename; // フルパスをツールチップで表示

           const fileDetails = document.createElement('div');
           fileDetails.className = 'file-details';

           const statusSpan = document.createElement('span');
           statusSpan.className = `file-status ${item.state}`;
           statusSpan.textContent = item.state === 'complete' ? formatBytes(item.fileSize) : (item.error || item.state);

           const domainSpan = document.createElement('span');
           domainSpan.className = 'file-domain';
           domainSpan.textContent = getDomain(item.url);

           fileDetails.appendChild(statusSpan);
           fileDetails.appendChild(domainSpan);
           fileInfo.appendChild(fileNameDiv);
           fileInfo.appendChild(fileDetails);
           li.appendChild(icon);
           li.appendChild(fileInfo);
          list.appendChild(li);
      });
  });
}

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

function localizeTitle() {
  const titleMsg = chrome.i18n.getMessage('popupTitle');
  if (titleMsg) {
    document.title = titleMsg;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  localizeHtml();
  localizeTitle();
  getDownloadsList();
});
