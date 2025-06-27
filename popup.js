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
 * ISO形式の日時文字列を相対的な時間（例: 「5分前」）に変換します。
 * @param {string} isoString - ISO 8601形式の日時文字列。
 * @returns {string} - フォーマットされた相対時間文字列。
 */
function formatTimeAgo(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const seconds = Math.round((now - date) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  // ブラウザの国際化APIを使用して、ロケールに合わせた表示を生成
  const rtf = new Intl.RelativeTimeFormat('ja', { numeric: 'auto' });

  if (seconds < 60) return rtf.format(-seconds, 'second');
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-days, 'day');
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
    // blob: URLを考慮
    if (url.startsWith('blob:')) {
      // 'blob:' を取り除いた部分でURLを再解析
      const originUrl = url.substring(5);
      return `blob:(${new URL(originUrl).hostname})`;
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

/**
 * 1つのダウンロードアイテムに対応するリスト要素（<li>）を作成します。
 * @param {chrome.downloads.DownloadItem} item - ダウンロードアイテム。
 * @returns {HTMLLIElement} - 生成されたリストアイテム要素。
 */
function createDownloadListItem(item) {
  const li = document.createElement('li');
  li.dataset.downloadId = item.id;
  li.addEventListener('click', () => {
    chrome.downloads.show(item.id);
  });

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

  const detailsRight = document.createElement('span');
  detailsRight.className = 'details-right';

  const domainSpan = document.createElement('span');
  domainSpan.className = 'file-domain';
  domainSpan.textContent = getDomain(item.url);

  const timeSpan = document.createElement('span');
  timeSpan.className = 'file-time';
  timeSpan.textContent = formatTimeAgo(item.startTime);

  detailsRight.appendChild(domainSpan);
  detailsRight.appendChild(timeSpan);
  fileDetails.appendChild(statusSpan);
  fileDetails.appendChild(detailsRight);
  fileInfo.appendChild(fileNameDiv);
  fileInfo.appendChild(fileDetails);
  li.appendChild(icon);
  li.appendChild(fileInfo);

  return li;
}

function getDownloadsList() {
  chrome.downloads.search({limit: 20, orderBy: ['-startTime']}, function(items) {
      const list = document.getElementById('downloads-list');
      if (!list) return;
      list.replaceChildren(); // より安全な方法でリストをクリア

      items.forEach(item => {
          const li = createDownloadListItem(item);
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
