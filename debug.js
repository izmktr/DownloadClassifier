// debug.js
// ルール一覧表示
function showRules() {
  chrome.storage.local.get(['rules'], (result) => {
    const rules = result.rules || [];
    const ul = document.getElementById('debug-rules');
    ul.innerHTML = '';
    rules.forEach(rule => {
      const li = document.createElement('li');
      li.textContent = `${rule.name} : フォルダ=${rule.folder} URL=${rule.urlPattern} MIME=${rule.mimePattern} ファイル=${rule.filePattern}`;
      ul.appendChild(li);
    });
  });
}

// 直近のダウンロード履歴表示
function showDownloads() {
  if (!chrome.downloads) return;
  chrome.downloads.search({limit: 10, orderBy: ['-startTime']}, (items) => {
    const ul = document.getElementById('debug-downloads');
    ul.innerHTML = '';
    items.forEach(item => {
      const li = document.createElement('li');
      li.textContent = `${item.filename.split(/[\\/]/).pop()} [${item.mime}] - ${item.url}`;
      ul.appendChild(li);
    });
  });
}

// Rawデータ表示
function showRawData() {
  chrome.storage.local.get(['rules'], (result) => {
    const pre = document.getElementById('rawData');
    pre.textContent = JSON.stringify(result.rules || [], null, 2);
  });
}

showRules();
showDownloads();
showRawData();
