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
  constructor({ name, folder, urlPattern, filePattern, mimePattern }) {
    this.name = name;
    this.folder = folder;
    this.urlPattern = urlPattern;
    this.filePattern = filePattern;
    this.mimePattern = mimePattern;
  }

  match(downloadItem) {
    if (this.urlPattern && !wildcardToRegExp(this.urlPattern).test(downloadItem.url)){
      //console.log('URL不一致:', this.urlPattern, downloadItem.url);
      return false;
    } 
    if (this.mimePattern && !wildcardToRegExp(this.mimePattern).test(downloadItem.mime)) {
      //console.log('MIME不一致:', this.mimePattern, downloadItem.mime);
      return false;
    }
    if (this.filePattern && !wildcardToRegExp(this.filePattern).test(downloadItem.filename)) {
      //console.log('ファイル名不一致:', this.filePattern, downloadItem.filename);
      return false;
    }
    return true;
  }
}
