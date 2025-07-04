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
 * 1つのダウンロードアイテムに対応するリスト要素（<li>）を作成します。
 * @param {chrome.downloads.DownloadItem} item - ダウンロードアイテム。
 * @returns {HTMLLIElement} - 生成されたリストアイテム要素。
 */
function createDownloadListItem(item, isRelated = false) {
  const li = document.createElement('li');
  li.dataset.downloadId = item.id;
  li.addEventListener('click', () => {
    chrome.downloads.show(item.id);
  });

  // 関連ファイルの場合、背景色を変更し、ツールチップを設定する
  if (isRelated) {
    li.style.backgroundColor = '#ffebee'; // 薄い赤色
    li.title = chrome.i18n.getMessage('relatedFileTooltip') || 'このページのタイトルに関連するファイルです';
  }

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

/**
 * ポップアップのダウンロード履歴ビューを更新します。
 * 現在のタブに関連するファイルを優先的に表示します。
 * 関連ファイル検索結果は、ダウンロード状況に応じて更新されるキャッシュを利用します。
 */
async function updateDownloadsView() {
  const downloadsList = document.getElementById('downloads-list');
  if (!downloadsList) return;
  const noDownloadsMessage = document.getElementById('no-downloads-message');

  // 1. 現在のタブ情報と、バックグラウンドで保存された最新の完了ダウンロードIDを取得
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab) {
    noDownloadsMessage.style.display = 'block';
    return;
  }
  const tabTitle = activeTab.title || '';
  const tabId = activeTab.id;
  const cacheKey = `related_files_${tabId}`;

  // コンテンツスクリプトを実行してページ内のリンクを取得
  let pageLinks = new Set();
  try {
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => {
        // ページ上のすべての<a>タグからhref属性を収集し、絶対URLのセットを返す
        const links = Array.from(document.querySelectorAll('a[href]'))
                           .map(a => a.href) // a.hrefは自動的に絶対URLを返す
                           .filter(href => href.startsWith('http:') || href.startsWith('https:') || href.startsWith('ftp:'));
        return Array.from(new Set(links));
      }
    });
    // executeScriptは結果の配列を返す
    if (injectionResults && injectionResults[0] && injectionResults[0].result) {
      pageLinks = new Set(injectionResults[0].result);
    }
  } catch (e) {
    console.warn(`Could not execute content script on tab ${activeTab.id}: ${e.message}`);
    // 権限がないページ(chrome://など)では失敗するが、処理は続行する
  }

  const storageSessionData = await chrome.storage.session.get([cacheKey, 'latestCompletedDownloadId']);
  const latestCompletedDownloadId = storageSessionData.latestCompletedDownloadId;
  const cachedData = storageSessionData[cacheKey];

  let relatedFiles = [];
  let relatedFileIds = new Set();

  // 2. キャッシュの有効性を確認
  // キャッシュが存在し、タブタイトルが同じで、かつ最新のダウンロードIDも同じ場合、キャッシュを使用
  if (cachedData &&
      cachedData.tabTitle === tabTitle &&
      cachedData.latestDownloadId === latestCompletedDownloadId) {
    relatedFiles = cachedData.files;
    relatedFileIds = new Set(relatedFiles.map(f => f.id));
  } else if (tabTitle) {
    // 3. キャッシュが無効な場合、関連ファイルを再検索
    const completedDownloads = await searchDownloads({
      limit: 1000,
      state: 'complete',
      orderBy: ['-startTime']
    });

    let tabOrigin = '';
    try {
      // blob: URLの場合、元のオリジンを抽出する
      const urlForOrigin = activeTab.url.startsWith('blob:') ? activeTab.url.substring(5) : activeTab.url;
      tabOrigin = new URL(urlForOrigin).origin;
    } catch (e) {
      // about:blank, chrome:// などのURLでは失敗するが、無視して問題ない
    }

    /**
     * 文字列を正規化し、意味のあるトークン（単語）に分割します。
     * @param {string} text - 入力文字列
     * @returns {Set<string>} - 3文字以上のトークンのセット
     */
    const getTokens = (text) => {
      if (!text) return new Set();
      // 小文字化し、一般的な区切り文字で分割。3文字未満のトークンはノイズになりやすいため除外。
      return new Set(
        text.toLowerCase()
            .split(/[\s\-_\[\]().,]+/) // スペース、ハイフン、アンダースコア、括弧、ドット、カンマなどで分割
            .filter(token => token.length >= 3)
      );
    };

    const titleTokens = getTokens(tabTitle);

    if (titleTokens.size > 0 || tabOrigin) {
      const scoredFiles = completedDownloads.map(item => {
        let score = 0;

        // --- スコアリング基準1: ファイル名とタブタイトルのトークン一致 ---
        const filenameWithoutExt = getFilenameWithoutExtension(item.filename);
        const fileTokens = getTokens(filenameWithoutExt);
        if (titleTokens.size > 0 && fileTokens.size > 0) {
          const commonTokens = new Set([...titleTokens].filter(token => fileTokens.has(token)));
          if (commonTokens.size > 0) {
            const matchCountScore = commonTokens.size;
            const matchLengthScore = [...commonTokens].reduce((acc, token) => acc + token.length, 0);
            score += matchCountScore * 10 + matchLengthScore;
          }
        }

        // --- スコアリング基準2: ページ内リンクとダウンロード元URLの一致 ---
        if (pageLinks.size > 0 && item.url && pageLinks.has(item.url)) {
          score += 100; // ページ内に直接リンクがあれば非常に高いスコア
        }

        // --- スコアリング基準3: ダウンロード元URL(href)のオリジン一致 ---
        if (tabOrigin && item.url) {
          try {
            const itemOrigin = new URL(item.url).origin;
            if (tabOrigin === itemOrigin) {
              score += 10; // オリジンが一致したらボーナススコア
            }
          } catch (e) {
            // item.urlが不正な形式の場合（例: data: URL）は無視
          }
        }

        return { item, score };
      }).filter(scored => scored.score > 0);

      // スコアの高い順にソートし、上位3件を関連ファイルとする
      scoredFiles.sort((a, b) => b.score - a.score);
      relatedFiles = scoredFiles.slice(0, 3).map(scored => scored.item);
    }

    relatedFileIds = new Set(relatedFiles.map(f => f.id));

    // 検索結果を新しいキャッシュとして保存
    // このキャッシュが作られた時点での最新完了IDも一緒に保存
    await chrome.storage.session.set({
      [cacheKey]: {
        tabTitle: tabTitle,
        files: relatedFiles,
        latestDownloadId: latestCompletedDownloadId
      }
    });
  }
 
  // 4. 通常表示用の履歴を取得
  const storageData = await chrome.storage.local.get({ historyCount: 20 });
  const displayLimit = storageData.historyCount;
  const recentDownloads = await searchDownloads({ limit: displayLimit, orderBy: ['-startTime'] });
 
  // 5. 通常履歴から関連ファイルを除外して重複をなくす
  const uniqueRecentDownloads = recentDownloads.filter(item => !relatedFileIds.has(item.id));
 
  downloadsList.replaceChildren();
 
  // 6. 関連ファイルをリストの先頭に追加
  relatedFiles.forEach(item => downloadsList.appendChild(createDownloadListItem(item, true)));
  // 7. 残りの履歴を追加
  uniqueRecentDownloads.forEach(item => downloadsList.appendChild(createDownloadListItem(item, false)));
 
  if (downloadsList.children.length === 0) {
    noDownloadsMessage.style.display = 'block';
  } else {
    noDownloadsMessage.style.display = 'none';
  }
}
 
/**
 * ダウンロードの開始時（ファイル名決定時）と状態変化時（完了、中断など）にリストを更新します。
 * これにより、ダウンロード中の進捗更新による頻繁な再描画を避けます。
 */
chrome.downloads.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.filename || downloadDelta.state) {
    updateDownloadsView();
  }
});
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
