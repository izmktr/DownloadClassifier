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
  const date = new Date(isoString); // ISO 8601形式の文字列からDateオブジェクトを作成
  const now = new Date();
  const seconds = Math.round((now - date) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  // ブラウザの国際化APIを使用して、ロケールに合わせた表示を生成
  const rtf = new Intl.RelativeTimeFormat(chrome.i18n.getUILanguage(), { numeric: 'auto' });

  if (seconds < 60) return rtf.format(-seconds, 'second');
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-days, 'day');
}

/**
 * 残り時間を人間が読みやすい形式に変換します。
 * @param {number} seconds - 残り秒数。
 * @returns {string} - フォーマットされた残り時間文字列。
 */
function formatTimeRemaining(seconds) {
  if (seconds < 0) return ''; // 負の値は表示しない
  if (seconds < 60) {
    return `${seconds}秒`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}分`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}時間`;
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
  if (['application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/gzip', 'application/x-bzip2'].includes(mime)) {
    return 'icons/archive.svg';
  }

  return 'icons/file-generic.svg'; // デフォルトアイコン
}

/**
 * chrome.downloads.searchをPromise化する
 * @param {chrome.downloads.DownloadQuery} query - 検索クエリ
 * @returns {Promise<chrome.downloads.DownloadItem[]>}
 */
function searchDownloads(query) {
  return new Promise(resolve => {
    chrome.downloads.search(query, resolve);
  });
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

  let progressBarContainer = null; // プログレスバーコンテナを初期化
  let progressBar = null; // プログレスバーを初期化

  // ダウンロードの状態に応じて表示を調整
  if (item.state === 'in_progress') {
    const received = item.bytesReceived;
    const total = item.totalBytes;
    const percentage = total > 0 ? Math.round((received / total) * 100) : 0;

    // プログレスバーのコンテナとバー本体を作成
    progressBarContainer = document.createElement('div');
    progressBarContainer.className = 'progress-bar-container';
    progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBarContainer.appendChild(progressBar);

    progressBar.style.width = `${percentage}%`;
    progressBar.classList.add('in-progress');

    let statusText = `${formatBytes(received)} / ${formatBytes(total)}`;
    if (item.bytesPerSecond > 0) {
      statusText += ` (${formatBytes(item.bytesPerSecond)}/s)`;
    }
    if (item.estimatedEndTime && item.bytesPerSecond > 0) { // 速度が0だと残り時間がおかしくなるため条件追加
      const remainingSeconds = Math.round((new Date(item.estimatedEndTime).getTime() - new Date().getTime()) / 1000);
      if (remainingSeconds > 0) {
        statusText += ` - 残り ${formatTimeRemaining(remainingSeconds)}`;
      }
    }
    statusSpan.textContent = statusText;
  } else if (item.state === 'complete') {
    // 完了したファイルにはプログレスバーを表示しないため、ここでは何もしない
    statusSpan.textContent = formatBytes(item.fileSize);
  } else if (item.state === 'interrupted') {
    statusSpan.textContent = item.error || chrome.i18n.getMessage('interruptedStatus') || '中断';
    // 中断されたファイルにはプログレスバーを表示しない
    // progressBarContainerとprogressBarはnullのままにする
  } else if (item.state === 'paused') {
    statusSpan.textContent = chrome.i18n.getMessage('pausedStatus') || '一時停止中';
    const percentage = item.totalBytes > 0 ? Math.round((item.bytesReceived / item.totalBytes) * 100) : 0;
    progressBarContainer = document.createElement('div');
    progressBarContainer.className = 'progress-bar-container';
    progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBarContainer.appendChild(progressBar);
    progressBar.style.width = `${percentage}%`;
    progressBar.classList.add('paused');
  }
  console.log('item.state:', item.state, 'progressBarContainer:', progressBarContainer, 'progressBar:', progressBar);

  const detailsRight = document.createElement('span'); // 時間とドメイン表示用
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
  if (progressBarContainer) { // progressBarContainerが作成された場合のみ追加
    fileInfo.appendChild(progressBarContainer);
  }
  li.appendChild(icon);
  li.appendChild(fileInfo);

  return li;
}

async function updateDownloadsView() {
  const downloadsList = document.getElementById('downloads-list');
  if (!downloadsList) return;
  console.log('updateDownloadView called:', downloadsList);

  // 以前の「ダウンロード中」セクションのコンテナが存在すれば削除
  let inProgressContainer = document.getElementById('in-progress-container');
  if (inProgressContainer) {
    inProgressContainer.remove();
  }

  const noDownloadsMessage = document.getElementById('no-downloads-message');

  // すべての最近のダウンロード（進行中を含む）を取得
  // limitは適宜調整してください。ここでは20件を取得します。
  const allRecentDownloads = await searchDownloads({ limit: 20, orderBy: ['-startTime'] });

  // リストをクリア
  downloadsList.replaceChildren(); 

  if (allRecentDownloads.length === 0) {
    noDownloadsMessage.style.display = 'block';
  } else {
    noDownloadsMessage.style.display = 'none';
    // すべてのダウンロードアイテムをdownloadsListに追加
    allRecentDownloads.forEach(item => {
      const li = createDownloadListItem(item);
      downloadsList.appendChild(li);
    });
  }
}

// ダウンロードの状態が変更されたときにリストを更新
chrome.downloads.onChanged.addListener(updateDownloadsView);

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
  updateDownloadsView();
});
