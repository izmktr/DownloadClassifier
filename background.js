// background.js
importScripts('downloadRule.js');

chrome.runtime.onInstalled.addListener(() => {
  console.log('DownloadClassifier 拡張機能がインストールされました');
});

chrome.downloads.onCreated.addListener((downloadItem) => {
  console.log('新しいダウンロード:', downloadItem);
});

let cachedRules = [];

function updateRulesCache() {
  chrome.storage.sync.get(['rules'], (result) => {
    cachedRules = (result.rules || []).map(ruleObj => new DownloadRule(ruleObj));
  });
}

// 初回ロード時にキャッシュ
updateRulesCache();

// ルールが変更されたらキャッシュを更新
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.rules) {
    updateRulesCache();
  }
});

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  const matched = cachedRules.find(rule => rule.match(item));
  if (matched && matched.folder) {
    const filename = item.filename.split(/[\\/]/).pop();
    suggest({ filename: `${matched.folder}/${filename}` });
    console.log('rule match:', matched, item);
  } else {
    suggest();
    console.log('rule unmatch:', item);
  }
});


