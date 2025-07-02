// d:/gitproject/DownloadClassifier/build.js
const fs = require('fs-extra');
const path = require('path');
const { minify } = require('terser');
const archiver = require('archiver');

const srcDir = __dirname;
const distDir = path.join(__dirname, 'dist');
const zipPath = path.join(__dirname, 'extension.zip');

// distディレクトリにコピーするファイル/ディレクトリのリスト
// debug.js や debug.html など、開発用のファイルはここには含めません
const filesToCopy = [
  'manifest.json',
  'popup.html',
  'options.html',
  'manual_ja.html',
  'manual_en.html',
  // 'popup.css', // CSSファイルがあればコメントを外してください
  // 'options.css',
  'icons',
  '_locales'
];

// Minify (圧縮) するJavaScriptファイルのリスト
const jsFilesToMinify = [
  'background.js',
  'common.js',
  'downloadRule.js',
  'options.js',
  'popup.js'
];

/**
 * ビルド処理のメイン関数
 */
async function build() {
  try {
    // 1. 既存のdistディレクトリとzipファイルを削除
    console.log('Cleaning up old build files...');
    await fs.remove(distDir);
    await fs.remove(zipPath);
    await fs.ensureDir(distDir);

    // 2. 必要なアセットファイルをコピー
    console.log('Copying assets...');
    for (const file of filesToCopy) {
      const srcPath = path.join(srcDir, file);
      const destPath = path.join(distDir, file);
      if (await fs.pathExists(srcPath)) {
        await fs.copy(srcPath, destPath);
        console.log(`  - Copied: ${file}`);
      }
    }

    // 3. JavaScriptファイルをminifyし、console.logを削除
    console.log('Minifying JavaScript files...');
    for (const file of jsFilesToMinify) {
      const filePath = path.join(srcDir, file);
      const code = await fs.readFile(filePath, 'utf8');
      const result = await minify(code, {
        compress: {
          drop_console: true, // このオプションがconsole.*の呼び出しを削除します
        },
        mangle: true, // 変数名を短縮します
      });
      if (result.error) throw result.error;
      
      await fs.writeFile(path.join(distDir, file), result.code);
      console.log(`  - Minified: ${file}`);
    }

    console.log('\n✅ Build completed successfully!');

  } catch (err) {
    console.error('\n❌ Build failed:', err);
    process.exit(1);
  }
}

/**
 * distディレクトリをZIPファイルに圧縮する関数
 */
async function createZip() {
  console.log(`\nCreating ZIP file at ${zipPath}...`);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  const promise = new Promise((resolve, reject) => {
    output.on('close', () => {
      console.log(`  - Total size: ${(archive.pointer() / 1024).toFixed(2)} KB`);
      console.log('✅ ZIP file created successfully.');
      resolve();
    });
    archive.on('error', err => reject(err));
  });

  archive.pipe(output);
  archive.directory(distDir, false);
  await archive.finalize();

  return promise;
}

// --- スクリプト実行 ---
(async () => {
  await build();

  // コマンドライン引数に 'zip' があればZIP化も実行
  if (process.argv.includes('zip')) {
    await createZip();
  }
})();
