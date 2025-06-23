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

let rules = [];
let selectedRuleIndex = -1;

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

function fillRuleDetail(idx) {
  if (idx > 0 && rules[idx - 1]) {
    // idx-1: 0番目は(新規)なので
    ruleNameInput.value = rules[idx - 1].name || '';
    sendFolderInput.value = rules[idx - 1].sendFolder || '';
    urlPatternInput.value = rules[idx - 1].urlPattern || '';
    filePatternInput.value = rules[idx - 1].filePattern || '';
    mimeInput.value = rules[idx - 1].mime || '';
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
}

function saveRulesToStorage() {
  chrome.storage.sync.set({ rules }, () => {
    renderRulesListBox();
    showRawData();
  })
  ;
}

rulesListBox.addEventListener('change', () => {
  const idx = rulesListBox.selectedIndex;
  fillRuleDetail(idx);
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
  const rule = {
    name: ruleNameInput.value.trim(),
    sendFolder: sendFolderInput.value.trim(),
    urlPattern: urlPatternInput.value.trim(),
    filePattern: filePatternInput.value.trim(),
    mime: mimeInput.value.trim()
  };
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
  showRawData();
  showDownloadHistory();
});

function showRawData() {
  chrome.storage.sync.get(null, data => {
    const rawDataElem = document.getElementById('rawData');
    if (rawDataElem) {
      rawDataElem.textContent = JSON.stringify(data, null, 2);
    }
  });
}

function showDownloadHistory() {
  if (!chrome.downloads) {
    const list = document.getElementById('downloadHistory');
    if (list) {
      list.innerHTML = '<li>chrome.downloads APIは利用できません。</li>';
    }
    return;
  }
  chrome.downloads.search({ limit: 10, orderBy: ['-startTime'] }, function(items) {
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
      });

      li.appendChild(addBtn);

      // 表示内容をitem.urlに変更
      let urlDisplay = '';
      if (item.url.startsWith('data:')) {
        urlDisplay = 'DATA URL';
      } else {
        urlDisplay = item.url;
      }
      li.appendChild(document.createTextNode(`${fileName} [${urlDisplay}]`));
      list.appendChild(li);
    });
  });
}
