// background.js
importScripts('downloadRule.js');

chrome.runtime.onInstalled.addListener(() => {
  console.log('DownloadClassifier 拡張機能がインストールされました');
});

chrome.downloads.onCreated.addListener((downloadItem) => {
  console.log('新しいダウンロード:', downloadItem);
});

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  chrome.storage.local.get(['rules'], (result) => {
    const rules = result.rules || [];
    const ruleObjs = rules.map(r => new DownloadRule(r));
    const matched = ruleObjs.find(rule => rule.match(item));

    if (matched && matched.folder) {
      const filename = item.filename.split(/[\\/]/).pop();
      suggest({ filename: `${matched.folder}/${filename}` });
      console.log('rule match:', matched, item);
    } else {
      suggest();
      console.log('rule unmatch:', item);
    }
  });
});


