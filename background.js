// background.js
importScripts('downloadRule.js');

chrome.runtime.onInstalled.addListener(() => {
  console.log('DownloadClassifier 拡張機能がインストールされました');
});

chrome.downloads.onCreated.addListener((downloadItem) => {
  console.log('新しいダウンロード:', downloadItem);
});

function getRules(callback) {
  chrome.storage.sync.get(['rules'], (result) => {
    const rules = (result.rules || []).map(ruleObj => new DownloadRule(ruleObj));
    callback(rules);
  });
}

function sendDebugLog(msg) {
  chrome.runtime.sendMessage({ type: 'debug-log', text: msg });
}

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  getRules((rules) => {
    const matched = rules.find(rule => rule.match(item));
    if (matched && matched.folder) {
      const filename = item.filename.split(/[\\/]/).pop();
      suggest({ filename: `${matched.folder}/${filename}` });
      const logMsg = `rule match: ${item.filename} → ${matched.folder} [${matched.name}]`;
      console.log(logMsg);
      sendDebugLog(logMsg);
      return;
    } else {
      suggest();
      const logMsg = `rule unmatch: ${item.filename}`;
      console.log(logMsg);
      sendDebugLog(logMsg);
      return;
    }
  });
});


