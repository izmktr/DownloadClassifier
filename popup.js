// itemsはchrome.downloads.DownloadItem型の配列です。
// DownloadItemの主なプロパティ例:
// id: number - ダウンロードの一意なID
// url: string - ダウンロード元のURL
// filename: string - 保存先のファイルパス
// state: string - 'in_progress', 'complete', 'interrupted' など
// danger: string - 'safe', 'dangerous', 'accepted', 'uncommon', 'host', 'user_validated', 'user_validated'
// startTime: string - ISO 8601形式の開始時刻
// endTime: string - ISO 8601形式の終了時刻（完了時のみ）
// fileSize: number - バイト単位のファイルサイズ
// mime: string - MIMEタイプ
// paused: boolean - 一時停止中かどうか
// error: string - エラー内容（失敗時のみ）
// byExtensionId: string - 拡張機能ID（拡張機能経由の場合）
// byExtensionName: string - 拡張機能名（拡張機能経由の場合）

function getDownloadsList() {
  chrome.downloads.search({limit: 10, orderBy: ['-startTime']}, function(items) {
      const list = document.getElementById('downloads-list');
      list.innerHTML = '';    chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
        const lowerFilename = item.filename.toLowerCase();
        const isImage = imageExtensions.some(ext => lowerFilename.endsWith(ext));
        if (isImage) {
          const newFilename = 'images/' + item.filename.split(/[\\/]/).pop();
          suggest({filename: newFilename});
        } else {
          suggest();
        }
      });
      items.forEach(item => {
          const li = document.createElement('li');
          li.textContent = `${item.filename.split(/\\|\//).pop()} [${item.mime}]`;
          list.appendChild(li);
      });
  });
}

getDownloadsList();

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('openOptionsBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('options.html'));
      }
    });
  }
});

document.getElementById('show-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

