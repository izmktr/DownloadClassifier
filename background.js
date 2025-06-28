// background.js
importScripts('downloadRule.js');
importScripts('common.js');

let isDebugLoggingEnabled = false;

function updateDebugSettings() {
  // デフォルト値は false
  chrome.storage.local.get({ debugLoggingEnabled: false }, (result) => {
    isDebugLoggingEnabled = result.debugLoggingEnabled;
  });
}

function debugLog(...args) {
  if (isDebugLoggingEnabled) {
    console.log('[Debug]', ...args);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('DownloadClassifier 拡張機能がインストールされました');
});

chrome.downloads.onCreated.addListener((downloadItem) => {
  debugLog('Download created:', downloadItem);
  // 履歴に追加する処理をこちらに移動
  chrome.storage.local.get({ history: [] }, (result) => {
    const history = result.history;
    // downloadItemには完全な情報が含まれている
    history.unshift(downloadItem);
    if (history.length > 100) history.length = 100;
    chrome.storage.local.set({ history });
  });
});

let cachedRules = [];

function updateRulesCache() {
  chrome.storage.local.get(['rules'], (result) => {
    cachedRules = (result.rules || []).map(r => new DownloadRule(r));
  });
}

// 初回ロード時にキャッシュ
updateRulesCache();
updateDebugSettings();

// ルールが変更されたらキャッシュを更新
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.rules) {
      debugLog('Rules changed, updating cache.');
      updateRulesCache();
    }
    if (changes.debugLoggingEnabled) {
      updateDebugSettings();
      console.log('Debug logging setting changed to:', changes.debugLoggingEnabled.newValue);
    }
  }
});

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  // 非同期で suggest を呼び出すため、リスナーは true を返す必要がある。
  // 即時実行非同期関数 (async IIFE) を使って処理を行う。
  (async () => {
    try {
      // onDeterminingFilenameで得られたより正確な情報で履歴を更新
      const result = await new Promise(resolve => chrome.storage.local.get({ history: [] }, resolve));
      const history = result.history;
      const historyItemIndex = history.findIndex(h => h.id === item.id);
      if (historyItemIndex !== -1) {
        const storedItem = history[historyItemIndex];
        let needsUpdate = false;

        if (storedItem.mime !== item.mime) {
          storedItem.mime = item.mime;
          needsUpdate = true;
        }
        if (storedItem.filename !== item.filename) {
          storedItem.filename = item.filename;
          needsUpdate = true;
        }
        if (needsUpdate) await new Promise(resolve => chrome.storage.local.set({ history }, resolve));
      }
    } catch (e) {
      console.error('Error updating history in onDeterminingFilename:', e);
    }

    // ルールに基づいてファイルパスを決定
    const matched = cachedRules.find(rule => rule.match(item));
    if (matched && matched.folder) {
      const filename = item.filename.split(/[\\/]/).pop();
      const newfilepath = `${matched.folder}/${filename}`;
      suggest({ filename: newfilepath });
    } else {
      suggest(); // ルールにマッチしない場合はデフォルトの動作
    }
  })();

  return true; // suggest() を非同期で呼び出すことを示す
});

// タブが更新されたときに呼び出されるリスナー
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // タイトルが変更され、確定した瞬間にのみ処理を実行
  if (changeInfo.title) {
    debugLog('Tab title changed:', { tabId: tabId, newTitle: changeInfo.title });

    // タイトルが汎用的なものであればスキップ
    if (changeInfo.title === 'New Tab' || changeInfo.title === '新しいタブ' || changeInfo.title.trim() === '') {
      debugLog('Tab title is generic or empty, skipping.');
      return;
    }

    try {
      // 1. 過去1000件の完了したダウンロード履歴を取得します
      const downloadedItems = await searchDownloads({
        limit: 1000,
        state: 'complete',
        orderBy: ['-startTime']
      });

      if (!downloadedItems) return;

      // 2. タブのタイトルにファイル名（拡張子なし）が含まれるファイルを探します
      const matchedFiles = downloadedItems.filter(item => {
        const filenameWithoutExt = getFilenameWithoutExtension(item.filename);
        // 拡張子なしのファイル名が存在し、かつタブのタイトルに含まれているかチェック
        return filenameWithoutExt && changeInfo.title.includes(filenameWithoutExt);
      });

      if (matchedFiles.length > 0) {
        debugLog('Found matched files in tab title:', { title: changeInfo.title, matches: matchedFiles });
      }
    } catch (e) {
      console.error('Error processing tab update:', e);
    }
  }
});
