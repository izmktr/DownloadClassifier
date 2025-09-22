// d:/gitproject/DownloadClassifier/build.js
const fs = require('fs-extra');
const path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');
const archiver = require('archiver');

const srcDir = __dirname;
const distDir = path.join(__dirname, 'dist');
const zipPath = path.join(__dirname, 'extension.zip');

// distディレクトリにコピーするファイル/ディレクトリのリスト
// debug.js や debug.html など、開発用のファイルはここには含めません
// CSSとJSは個別に処理するため、ここには含めません。
const filesToCopy = [
  'html/popup.html',
  'html/options.html',
  'html/manual_ja.html',
  'html/manual_en.html',
  'html/icons',
  'icons',
  '_locales'
];

// Minify (圧縮) するJavaScriptファイルのリスト
const jsFilesToMinify = [
  'background.js',
  'js/downloadRule.js',
  'html/js/common.js',
  'html/js/options.js',
  'html/js/popup.js'
];

// Minify (圧縮) するCSSファイルのリスト
const cssFilesToMinify = [
  'html/css/options.css',
  'html/css/popup.css'
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

    // 2. package.jsonからバージョンなどを取得し、manifest.jsonを生成
    console.log('Creating manifest.json...');
    const packageJson = await fs.readJson(path.join(srcDir, 'package.json'));
    const manifestTemplate = await fs.readJson(path.join(srcDir, 'manifest.json'));
    
    manifestTemplate.version = packageJson.version;
    manifestTemplate.description = packageJson.description || manifestTemplate.description;

    await fs.writeJson(path.join(distDir, 'manifest.json'), manifestTemplate, { spaces: 2 });
    console.log(`  - Created manifest.json with version ${packageJson.version}`);

    // 3. 必要なアセットファイルをコピー
    console.log('Copying assets...');
    for (const file of filesToCopy) {
      const srcPath = path.join(srcDir, file);
      const destPath = path.join(distDir, file);
      if (await fs.pathExists(srcPath)) {
        await fs.copy(srcPath, destPath);
        console.log(`  - Copied asset: ${file}`);
      }
    }

    // 4. JavaScriptファイルをminifyし、console.logを削除
    console.log('Minifying JavaScript files...');
    for (const file of jsFilesToMinify) {
      const filePath = path.join(srcDir, file);
      const destPath = path.join(distDir, file);
      const code = await fs.readFile(filePath, 'utf8');
      const result = await minify(code, {
        compress: {
          drop_console: true, // このオプションがconsole.*の呼び出しを削除します
        },
        mangle: true, // 変数名を短縮します
      });
      if (result.error) throw result.error;
      
      // 出力先のディレクトリを確実に作成
      await fs.ensureDir(path.dirname(destPath));
      await fs.writeFile(destPath, result.code);
      console.log(`  - Minified: ${file}`);
    }

    // 5. CSSファイルをminify
    console.log('Minifying CSS files...');
    const cleanCss = new CleanCSS();
    for (const file of cssFilesToMinify) {
        const srcPath = path.join(srcDir, file);
        const destPath = path.join(distDir, file);
        if (await fs.pathExists(srcPath)) {
            const code = await fs.readFile(srcPath, 'utf8');
            const output = cleanCss.minify(code);
            // 出力先のディレクトリを確実に作成
            await fs.ensureDir(path.dirname(destPath));
            await fs.writeFile(destPath, output.styles);
            console.log(`  - Minified: ${file}`);
        }
    }

    // 6. HTMLファイルからデバッグ用の要素を削除
    console.log('Processing HTML files...');
    const optionsHtmlPath = path.join(distDir, 'html/options.html');
    if (await fs.pathExists(optionsHtmlPath)) {
        let content = await fs.readFile(optionsHtmlPath, 'utf8');
        // debug.htmlへのリンクを含むコンテナを丸ごと削除
        content = content.replace(/<div class="debug-link-container">[\s\S]*?<\/div>/, '');
        await fs.writeFile(optionsHtmlPath, content);
        console.log('  - Removed debug link from options.html');
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
