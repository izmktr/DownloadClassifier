// background.js
importScripts('downloadRule.js');

chrome.runtime.onInstalled.addListener(() => {
  console.log('DownloadClassifier 拡張機能がインストールされました');
});

chrome.downloads.onCreated.addListener((downloadItem) => {
  console.log('新しいダウンロード:', downloadItem);
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
    console.log('loaded', cachedRules);
  });
}

// 初回ロード時にキャッシュ
updateRulesCache();

// ルールが変更されたらキャッシュを更新
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.rules) {
    updateRulesCache();
  }
});

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  // onDeterminingFilenameで得られたより正確なMIMEタイプで履歴を更新
  const matched = cachedRules.find(rule => rule.match(item));
  if (matched && matched.folder) {
    const filename = item.filename.split(/[\\/]/).pop();
    const newfilepath = `${matched.folder}/${filename}`;
    suggest({ filename: newfilepath });
    console.log('rule match:', matched, item, newfilepath);
  } else {
    suggest();
    console.log('rule unmatch:', item);
  }
  chrome.storage.local.get({ history: [] }, (result) => {
    const history = result.history;
    const historyItemIndex = history.findIndex(h => h.id === item.id);
    if (historyItemIndex !== -1) {
      const storedItem = history[historyItemIndex];
      let needsUpdate = false;

      // MIMEタイプが異なる、または元々空だった場合に更新
      if (storedItem.mime !== item.mime) {
        storedItem.mime = item.mime;
        needsUpdate = true;
      }
      // ファイル名が異なる場合に更新
      if (storedItem.filename !== item.filename) {
        storedItem.filename = item.filename;
        needsUpdate = true;
      }
      if (needsUpdate) chrome.storage.local.set({ history });
    }
  });
});
