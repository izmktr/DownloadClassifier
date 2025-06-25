# DownloadClassifier

このChrome拡張機能は、ダウンロードファイルをルールに基づいて自動分類します。

## 構成ファイル
- manifest.json
- background.js
- popup.html / popup.js / popup.css
- options.html / options.js / options.css
- debug.html / debug.js（開発用デバッグページ）
- _locales/ja/messages.json, _locales/en/messages.json（多言語対応）
- icon/

## インストール方法
1. Chromeの拡張機能管理画面（chrome://extensions/）を開く
2. 「パッケージ化されていない拡張機能を読み込む」からこのフォルダを選択

## 使い方
- ポップアップで最新のダウンロード履歴を確認できます。
- オプション画面で「ルール」を追加・編集し、ダウンロードファイルの分類条件を設定できます。
- ルールは端末ごと（storage.local）に保存されます。
- デバッグ用ページ（debug.html）でルールや履歴の中身を確認できます。
- 多言語（日本語・英語）に対応しています。

## 注意
- ルールの競合や他拡張との競合時は、Chromeの仕様上、先にsuggest()した拡張の値が優先されます。
