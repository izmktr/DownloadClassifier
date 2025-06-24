// ルールの追加・削除・保存・読み込み

const rulesListBox = document.getElementById('rulesListBox');
const deleteRuleBtn = document.getElementById('deleteRuleBtn');
const addOrUpdateRuleBtn = document.getElementById('addOrUpdateRuleBtn');
const ruleNameInput = document.getElementById('ruleName');
const sendFolderInput = document.getElementById('sendFolder');
const urlPatternInput = document.getElementById('urlPattern');
const filePatternInput = document.getElementById('filePattern');
const mimeInput = document.getElementById('mime');
const moveUpRuleBtn = document.getElementById('moveUpRuleBtn');
const moveDownRuleBtn = document.getElementById('moveDownRuleBtn');
const testRuleBtn = document.getElementById('testRuleBtn');

let rules = [];
let selectedRuleIndex = -1;
let downloadHistoryCount = 20;

function renderRulesListBox() {
  const prevSelectedIndex = rulesListBox.selectedIndex;
  rulesListBox.innerHTML = '';
  // 一番上に「(新規)」を追加
  const newOption = document.createElement('option');
  newOption.value = '-1';
  newOption.textContent = '(新規)';
  rulesListBox.appendChild(newOption);

  rules.forEach((rule, idx) => {
    const option = document.createElement('option');
    option.value = idx;
    option.textContent = rule.name || '(名称未設定)';
    rulesListBox.appendChild(option);
  });

  // 選択状態を復元
  if (prevSelectedIndex >= 0 && prevSelectedIndex < rulesListBox.options.length) {
    rulesListBox.selectedIndex = prevSelectedIndex;
  } else {
    rulesListBox.selectedIndex = 0;
  }
}

function updateAddOrUpdateButtonLabel() {
  if (selectedRuleIndex === -1) {
    addOrUpdateRuleBtn.textContent = chrome.i18n ? (chrome.i18n.getMessage('add') || '追加') : '追加';
  } else {
    addOrUpdateRuleBtn.textContent = chrome.i18n ? (chrome.i18n.getMessage('update') || '更新') : '更新';
  }
}

function fillRuleDetail(idx) {
  if (idx > 0 && rules[idx - 1]) {
    // idx-1: 0番目は(新規)なので
    ruleNameInput.value = rules[idx - 1].name || '';
    sendFolderInput.value = rules[idx - 1].folder || '';
    urlPatternInput.value = rules[idx - 1].urlPattern || '';
    filePatternInput.value = rules[idx - 1].filePattern || '';
    mimeInput.value = rules[idx - 1].mimePattern || '';
    selectedRuleIndex = idx - 1;
  } else {
    // (新規)が選択された場合
    ruleNameInput.value = 'New Rule';
    sendFolderInput.value = '';
    urlPatternInput.value = '';
    filePatternInput.value = '';
    mimeInput.value = '';
    selectedRuleIndex = -1;
  }
  updateAddOrUpdateButtonLabel();
}

function saveRulesToStorage() {
  chrome.storage.sync.set({ rules }, () => {
    renderRulesListBox();
  })
  ;
}

rulesListBox.addEventListener('change', function() {
  fillRuleDetail(rulesListBox.selectedIndex);
  updateAddOrUpdateButtonLabel();
});

// 上へボタン
moveUpRuleBtn.addEventListener('click', () => {
  if (selectedRuleIndex > 0) {
    [rules[selectedRuleIndex - 1], rules[selectedRuleIndex]] = [rules[selectedRuleIndex], rules[selectedRuleIndex - 1]];
    selectedRuleIndex--;
    saveRulesToStorage();
    renderRulesListBox();
    rulesListBox.selectedIndex = selectedRuleIndex + 1;
    fillRuleDetail(rulesListBox.selectedIndex);
    rulesListBox.focus();
  }
});

// 下へボタン
moveDownRuleBtn.addEventListener('click', () => {
  if (selectedRuleIndex >= 0 && selectedRuleIndex < rules.length - 1) {
    [rules[selectedRuleIndex], rules[selectedRuleIndex + 1]] = [rules[selectedRuleIndex + 1], rules[selectedRuleIndex]];
    selectedRuleIndex++;
    saveRulesToStorage();
    renderRulesListBox();
    rulesListBox.selectedIndex = selectedRuleIndex + 1;
    fillRuleDetail(rulesListBox.selectedIndex);
    rulesListBox.focus();
  }
});

addOrUpdateRuleBtn.addEventListener('click', () => {
  const rule = new DownloadRule(
    ruleNameInput.value.trim(),
    sendFolderInput.value.trim(),
    urlPatternInput.value.trim(),
    filePatternInput.value.trim(),
    mimeInput.value.trim()
  );;
  if (!rule.name) return;
  if (selectedRuleIndex >= 0 && rules[selectedRuleIndex]) {
    // 更新
    rules[selectedRuleIndex] = rule;
  } else {
    // 追加
    rules.push(rule);
    selectedRuleIndex = rules.length - 1;
  }
  saveRulesToStorage();
  renderRulesListBox();
  rulesListBox.selectedIndex = selectedRuleIndex + 1;
  fillRuleDetail(rulesListBox.selectedIndex);
  rulesListBox.focus();
});

deleteRuleBtn.addEventListener('click', () => {
  if (selectedRuleIndex >= 0 && rules[selectedRuleIndex]) {
    rules.splice(selectedRuleIndex, 1);
    saveRulesToStorage();
    renderRulesListBox();
    fillRuleDetail(0); // (新規)を選択状態に
    rulesListBox.selectedIndex = 0;
    rulesListBox.focus();
  }
});

function loadRulesFromStorage() {
  chrome.storage.sync.get({ rules: [] }, data => {
    rules = data.rules;
    renderRulesListBox();
    fillRuleDetail(-1);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadRulesFromStorage();
  showDownloadHistory();
  updateAddOrUpdateButtonLabel();
});

function loadHistoryCount() {
  chrome.storage.local.get({ downloadHistoryCount: 20 }, (data) => {
    downloadHistoryCount = data.downloadHistoryCount;
    const historyCountInput = document.getElementById('historyCountInput');
    if (historyCountInput) historyCountInput.value = downloadHistoryCount;
    showDownloadHistory();
  });
}

function saveHistoryCount(val) {
  chrome.storage.local.set({ downloadHistoryCount: val });
}

const changeHistoryCountBtn = document.getElementById('changeHistoryCountBtn');
const historyCountInput = document.getElementById('historyCountInput');
if (changeHistoryCountBtn && historyCountInput) {
  changeHistoryCountBtn.addEventListener('click', () => {
    const val = parseInt(historyCountInput.value, 10);
    if (!isNaN(val) && val > 0 && val <= 100) {
      downloadHistoryCount = val;
      saveHistoryCount(val);
      showDownloadHistory();
    }
  });
}

function showDownloadHistory(hightlightRule = (rule) => false) {
  if (!chrome.downloads) {
    const list = document.getElementById('downloadHistory');
    if (list) {
      list.innerHTML = '<li>chrome.downloads APIは利用できません。</li>';
    }
    return;
  }
  chrome.downloads.search({ limit: downloadHistoryCount, orderBy: ['-startTime'] }, function(items) {
    const list = document.getElementById('downloadHistory');
    if (!list) return;
    list.innerHTML = '';
    if (items.length === 0) {
      list.innerHTML = '<li>ダウンロード履歴がありません。</li>';
      return;
    }
    items.forEach(item => {
      const li = document.createElement('li');
      const fileName = item.filename.split(/[\\/]/).pop();

      // ルール追加ボタン（左側に配置）
      const addBtn = document.createElement('button');
      addBtn.textContent = 'このファイルでルール追加';
      addBtn.style.marginRight = '8px';
      addBtn.addEventListener('click', () => {
        const extMatch = fileName.match(/\.[^.]+$/);
        const filePattern = extMatch ? `*${extMatch[0]}` : fileName;
        let urlPattern = '';
        if (item.url && (item.url.startsWith('http://') || item.url.startsWith('https://'))) {
          try {
            const urlObj = new URL(item.url);
            urlPattern = `*://${urlObj.hostname}/*`;
          } catch (e) {
            urlPattern = '';
          }
        }else if (item.url && (item.url.startsWith('blob:https://') || item.url.startsWith('blob:http://'))) {
          try {
            const urlObj = new URL(item.url.substring(5)); // blob:を除去
            urlPattern = `*://${urlObj.hostname}/*`;
          } catch (e) {
            urlPattern = '';
          }
        } else {
          urlPattern = '*';
        }
        ruleNameInput.value = fileName;
        sendFolderInput.value = '';
        urlPatternInput.value = urlPattern;
        filePatternInput.value = filePattern;
        mimeInput.value = item.mime || '';
        rulesListBox.selectedIndex = 0;
        selectedRuleIndex = -1;
        updateAddOrUpdateButtonLabel();
      });

      li.appendChild(addBtn);

      // 表示内容をitem.urlに変更
      let urlDisplay = '';
      if (item.url.startsWith('data:')) {
        urlDisplay = 'DATA URL';
      } else {
        urlDisplay = item.url;
      }
      if (hightlightRule(item)) {
        li.style.background = 'yellow';
      }
      li.appendChild(document.createTextNode(`${fileName} [${urlDisplay}]`));
      list.appendChild(li);
    });
  });
}

// テストボタン押下時の処理
if (testRuleBtn) {
  testRuleBtn.addEventListener('click', () => {
    // 入力中のルール情報をDownloadRule形式に変換
    const testRule = new DownloadRule({
      name: ruleNameInput.value,
      folder: sendFolderInput.value,
      urlPattern: urlPatternInput.value,
      filePattern: filePatternInput.value,
      mimePattern: mimeInput.value
    });
    showDownloadHistory((item) => {
      // ルールにマッチするかチェック
      return testRule.match(item);
    });
  });
}

// 多言語化: message.jsonの値でUIテキストを置換
function localizeHtml() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key && chrome.i18n) {
      el.textContent = chrome.i18n.getMessage(key) || el.textContent;
    }
  });
  // placeholder属性も置換
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    if (key && chrome.i18n) {
      el.setAttribute('placeholder', chrome.i18n.getMessage(key) || el.getAttribute('placeholder'));
    }
  });
}

document.addEventListener('DOMContentLoaded', localizeHtml);
