const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const extensionDir = path.join(__dirname, '..');
const backgroundCode = fs.readFileSync(path.join(extensionDir, 'background.js'), 'utf8');

function createBackground({ rules = [], history = [], getHistory, setHistory } = {}) {
  let filenameListener;
  let changeListener;
  let storageChangeListener;
  const errors = [];
  const writes = [];
  const sessionWrites = [];
  const context = vm.createContext({
    console: {
      log() {},
      error(...args) { errors.push(args); },
    },
    chrome: {
      runtime: {
        id: 'download-classifier',
        onInstalled: { addListener() {} },
      },
      storage: {
        local: {
          get(query, callback) {
            if (callback) {
              callback(Array.isArray(query) ? { rules } : { debugLoggingEnabled: false });
              return;
            }
            return getHistory ? getHistory() : Promise.resolve({ history });
          },
          set(value) {
            writes.push(value);
            return setHistory ? setHistory(value) : Promise.resolve();
          },
        },
        session: { set(value) { sessionWrites.push(value); } },
        onChanged: { addListener(listener) { storageChangeListener = listener; } },
      },
      downloads: {
        onDeterminingFilename: { addListener(listener) { filenameListener = listener; } },
        onChanged: { addListener(listener) { changeListener = listener; } },
      },
    },
    importScripts(filename) {
      vm.runInContext(fs.readFileSync(path.join(extensionDir, filename), 'utf8'), context);
    },
  });
  vm.runInContext(backgroundCode, context);
  return {
    filenameListener, changeListener, errors, writes, sessionWrites,
    updateRules(newRules) {
      rules = newRules;
      storageChangeListener({ rules: { newValue: newRules } }, 'local');
    },
  };
}

function download(overrides = {}) {
  return {
    id: 1,
    filename: 'report.pdf',
    url: 'https://example.com/report.pdf',
    mime: 'application/pdf',
    startTime: '2026-10-20T09:00:00',
    ...overrides,
  };
}

function determine(background, item = download()) {
  const calls = [];
  const result = background.filenameListener(item, (...args) => calls.push(args));
  assert.equal(result, undefined, 'the listener must not request asynchronous filename handling');
  assert.equal(calls.length, 1, 'suggest must be called exactly once before the listener returns');
  return calls[0][0];
}

async function flushHistory() {
  await new Promise(resolve => setImmediate(resolve));
}

test('matching rules preserve the basename, date folders, and uniquify behavior', () => {
  const background = createBackground({
    rules: [
      { filePattern: '*.png', folder: 'images' },
      { filePattern: '*.pdf', folder: 'documents/%Y-%m-%d' },
      { folder: 'fallback' },
    ],
  });
  const suggestion = determine(background, download({ filename: 'C:\\Downloads\\report.pdf' }));
  assert.equal(suggestion.filename, 'documents/2026-10-20/report.pdf');
  assert.equal(suggestion.conflictAction, 'uniquify');
});

test('unmatched rules and empty destination folders keep the original filename', () => {
  for (const rules of [[], [{ filePattern: '*.png', folder: 'images' }], [{ folder: '' }]]) {
    assert.equal(determine(createBackground({ rules })), undefined);
  }
});

test('downloads started by another extension keep its filename and still enter history', async () => {
  const background = createBackground({ rules: [{ folder: 'documents' }] });
  const item = download({ byExtensionId: 'other-extension' });
  assert.equal(determine(background, item), undefined);
  await flushHistory();
  assert.equal(background.writes[0].history[0], item);
  assert.equal(background.errors.length, 0);
  assert.equal(determine(background, download({ id: 2 })).filename, 'documents/report.pdf');
});

test('downloads started by this extension can still be classified', () => {
  const background = createBackground({ rules: [{ folder: 'documents' }] });
  assert.equal(
    determine(background, download({ byExtensionId: 'download-classifier' })).filename,
    'documents/report.pdf',
  );
});

test('filename decisions do not wait for a pending history read', () => {
  const background = createBackground({
    rules: [{ folder: 'documents' }],
    getHistory: () => new Promise(() => {}),
  });
  assert.equal(determine(background).filename, 'documents/report.pdf');
  assert.equal(determine(background, download({ id: 2 })).filename, 'documents/report.pdf');
});

test('filename decisions do not wait for a pending history write', async () => {
  const background = createBackground({
    rules: [{ folder: 'documents' }],
    setHistory: () => new Promise(() => {}),
  });
  assert.equal(determine(background).filename, 'documents/report.pdf');
  await flushHistory();
  assert.equal(background.writes.length, 1);
  assert.equal(determine(background, download({ id: 2 })).filename, 'documents/report.pdf');
});

test('history read and write failures are logged without blocking filename decisions', async () => {
  for (const failingOperation of ['getHistory', 'setHistory']) {
    const error = new Error('Storage unavailable');
    const background = createBackground({
      rules: [{ folder: 'documents' }],
      [failingOperation]: () => Promise.reject(error),
    });
    assert.equal(determine(background).filename, 'documents/report.pdf');
    await flushHistory();
    assert.equal(background.errors.length, 1);
    assert.equal(background.errors[0][1], error);
    assert.equal(determine(background, download({ id: 2 })).filename, 'documents/report.pdf');
    await flushHistory();
  }
});

test('rule evaluation and folder formatting errors fall back for that download only', async () => {
  for (const rule of [
    { filePattern: 42, folder: 'documents' },
    { folder: 42 },
  ]) {
    const background = createBackground({ rules: [rule] });
    assert.equal(determine(background), undefined);
    assert.equal(background.errors.length, 1);
    assert.equal(determine(background, download({ id: 2 })), undefined);
    background.updateRules([{ filePattern: '*.pdf', folder: 'documents' }]);
    assert.equal(determine(background, download({ id: 3 })).filename, 'documents/report.pdf');
  }
  await flushHistory();
});

test('a filename error does not prevent the next download from being classified', () => {
  const background = createBackground({ rules: [{ folder: 'documents' }] });
  assert.equal(determine(background, download({ filename: undefined })), undefined);
  assert.equal(background.errors.length, 1);
  assert.equal(determine(background, download({ id: 2 })).filename, 'documents/report.pdf');
});

test('a failed suggestion is logged and never retried, including foreign downloads', () => {
  for (const byExtensionId of [undefined, 'other-extension']) {
    const background = createBackground({ rules: [{ folder: 'documents' }] });
    const error = new Error('Filename suggestion rejected');
    let calls = 0;
    assert.doesNotThrow(() => background.filenameListener(download({ byExtensionId }), () => {
      calls++;
      throw error;
    }));
    assert.equal(calls, 1);
    assert.equal(background.errors.length, 1);
    assert.equal(background.errors[0][1], error);
    assert.equal(determine(background, download({ id: 2 })).filename, 'documents/report.pdf');
  }
});

test('history retains only the latest 100 downloads', async () => {
  const background = createBackground({
    history: Array.from({ length: 100 }, (_, id) => download({ id: id + 2 })),
  });
  const item = download();
  determine(background, item);
  await flushHistory();
  assert.equal(background.writes[0].history.length, 100);
  assert.equal(background.writes[0].history[0], item);
  assert.equal(background.writes[0].history[99].id, 100);
});

test('completed downloads still update session storage', () => {
  const background = createBackground();
  background.changeListener({ id: 5, state: { current: 'in_progress' } });
  assert.equal(background.sessionWrites.length, 0);
  background.changeListener({ id: 5, state: { current: 'complete' } });
  assert.equal(background.sessionWrites[0].latestCompletedDownloadId, 5);
});
