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
 * 関連ファイル検索結果はセッションストレージにキャッシュされます。
 */
async function updateDownloadsView() {
  const downloadsList = document.getElementById('downloads-list');
  if (!downloadsList) return;
  const noDownloadsMessage = document.getElementById('no-downloads-message');

  // 1. 現在のタブ情報を取得
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab) { // タブが取得できない場合は何もしない
    noDownloadsMessage.style.display = 'block';
    return;
  }
  const tabTitle = activeTab.title || '';
  const tabId = activeTab.id;
  const cacheKey = `related_files_${tabId}`;

  let relatedFiles = [];
  let relatedFileIds = new Set();

  // 2. セッションキャッシュを確認
  const cachedData = await chrome.storage.session.get(cacheKey);
  // キャッシュが存在し、タブタイトルが変更されていない場合、キャッシュを使用
  if (cachedData[cacheKey] && cachedData[cacheKey].tabTitle === tabTitle) {
    relatedFiles = cachedData[cacheKey].files;
    relatedFileIds = new Set(relatedFiles.map(f => f.id));
  } else if (tabTitle) {
    // 3. キャッシュがない、またはタブタイトルが変更された場合、関連ファイルを検索
    const completedDownloads = await searchDownloads({
      limit: 1000, // 確実に1000件検索
      state: 'complete',
      orderBy: ['-startTime']
    });

    const matchedFiles = completedDownloads.filter(item => {
      const filenameWithoutExt = getFilenameWithoutExtension(item.filename);
      // 短すぎるファイル名や無関係なマッチを防ぐ
      if (!filenameWithoutExt || filenameWithoutExt.length < 3) {
        return false;
      }
      // 大文字・小文字を区別せずに比較
      return tabTitle.toLowerCase().includes(filenameWithoutExt.toLowerCase());
    });
 
    // ファイル名（拡張子なし）の長さで降順ソートし、関連性の高いものを優先
    matchedFiles.sort((a, b) => {
      const aName = getFilenameWithoutExtension(a.filename);
      const bName = getFilenameWithoutExtension(b.filename);
      return bName.length - aName.length;
    });
 
    // 上位3件を関連ファイルとする
    relatedFiles = matchedFiles.slice(0, 3);
    relatedFileIds = new Set(relatedFiles.map(f => f.id));

    // 検索結果をキャッシュに保存
    await chrome.storage.session.set({
      [cacheKey]: {
        tabTitle: tabTitle,
        files: relatedFiles
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
 
// ダウンロードの状態が変更されたときにリストを更新
// 方針に基づき、ポップアップを開いた時の静的な表示とするため、onChangedリスナーは無効化します。
// chrome.downloads.onChanged.addListener(updateDownloadsView);

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
