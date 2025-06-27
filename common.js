// common.js - 複数のスクリプトで共有されるヘルパー関数

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

  if (mime.startsWith('image/')) return 'icons/image.svg';
  if (mime.startsWith('audio/')) return 'icons/music.svg';
  if (mime.startsWith('video/')) return 'icons/video.svg';
  if (mime.startsWith('text/')) return 'icons/file-text.svg';
  if (mime === 'application/pdf') return 'icons/file-text.svg'; // PDFはテキストアイコンで代用
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