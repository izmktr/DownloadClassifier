// debug.js
// ルール一覧表示
function showRules() {
  chrome.storage.sync.get(['rules'], (result) => {
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

// ログ表示（background.jsから送信されたメッセージを受信）
function showLog(msg) {
  const pre = document.getElementById('debug-log');
  pre.textContent += msg + '\n';
  pre.scrollTop = pre.scrollHeight;
}

chrome.runtime.onMessage && chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'debug-log') {
    showLog(message.text);
  }
});

showRules();
showDownloads();
