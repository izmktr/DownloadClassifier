// background.js
importScripts('html/js/downloadRule.js');

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

/**
 * Dateオブジェクトをstrftime形式の文字列でフォーマットする
 * @param {string} format - フォーマット文字列 (%Y, %m, %dなど)
 * @param {Date} [date=new Date()] - フォーマットするDateオブジェクト
 * @returns {string} フォーマットされた文字列
 */
function strftime(format, date = new Date()) {
  const zeroPad = (num) => String(num).padStart(2, '0');
  // %% を % に、%Yなどを日付の値に、それ以外の%?はそのまま出力する
  return format.replace(/%%|%./g, (match) => {
    switch (match) {
      case '%%': return '%';
      case '%Y': return date.getFullYear();
      case '%y': return String(date.getFullYear()).slice(-2);
      case '%m': return zeroPad(date.getMonth() + 1);
      case '%d': return zeroPad(date.getDate());
      case '%H': return zeroPad(date.getHours());
      case '%M': return zeroPad(date.getMinutes());
      case '%S': return zeroPad(date.getSeconds());
      default:
        // サポートされていないフォーマット指定子は、警告を出してそのまま返す
        debugLog(`Unsupported strftime format specifier: "${match}"`);
        return match;
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('DownloadClassifier 拡張機能がインストールされました');
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

// ダウンロード状態の変更を監視し、完了したらセッションストレージにIDを保存
chrome.downloads.onChanged.addListener((delta) => {
  // stateが 'complete' になった時だけ処理
  if (delta.state && delta.state.current === 'complete') {
    debugLog(`Download ${delta.id} completed. Storing ID to session storage.`);
    chrome.storage.session.set({ latestCompletedDownloadId: delta.id });
  }
});

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  // 非同期で suggest を呼び出すため、リスナーは true を返す必要がある。
  // 即時実行非同期関数 (async IIFE) を使って処理を行う。
  (async () => {
    try {
      // onDeterminingFilenameで得られたより正確な情報で履歴を更新
      const { history } = await chrome.storage.local.get({ history: [] });
      history.unshift(item); // 配列の先頭に新しいアイテムを追加
      if (history.length > 100) { // 履歴が100件を超えたら古いものから削除
        history.length = 100;
      }
      await chrome.storage.local.set({ history });
    } catch (e) {
      console.error('Error updating history in onDeterminingFilename:', e);
    }

    // ルールに基づいてファイルパスを決定
    const matched = cachedRules.find(rule => rule.match(item));
    if (matched && matched.folder) {
      // プレースホルダーを展開してフォルダパスを生成
      const downloadDate = new Date(item.startTime);
      const formattedFolder = strftime(matched.folder, downloadDate);

      const filename = item.filename.split(/[\\/]/).pop();
      const newfilepath = `${formattedFolder}/${filename}`;

      debugLog(`Rule matched for "${item.filename}". Suggesting new path: "${newfilepath}"`);
      suggest({ filename: newfilepath, conflictAction: 'uniquify' });
    } else {
      suggest(); // ルールにマッチしない場合はデフォルトの動作
    }
  })();

  return true; // suggest() を非同期で呼び出すことを示す
});
