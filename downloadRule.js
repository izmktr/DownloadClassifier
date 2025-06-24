// ワイルドカード（*と?）をRegExpに変換する関数
function wildcardToRegExp(pattern) {
  if (!pattern) return /.*/;
  // エスケープしてから * → .*, ? → . に置換
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexStr = '^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
  return new RegExp(regexStr);
}

// ダウンロード分類ルールクラス
class DownloadRule {
  constructor({ name, folder, urlPattern, mimePattern, filePattern }) {
    this.name = name;
    this.folder = folder;
    this.urlPattern = urlPattern;
    this.mimePattern = mimePattern;
    this.filePattern = filePattern;
  }

  match(downloadItem) {
    console.log('match', downloadItem, this);
    if (this.urlPattern && !wildcardToRegExp(this.urlPattern).test(downloadItem.url)) return false;
    if (this.mimePattern && !wildcardToRegExp(this.mimePattern).test(downloadItem.mime)) return false;
    if (this.filePattern && !wildcardToRegExp(this.filePattern).test(downloadItem.filename)) return false;
    return true;
  }
}
