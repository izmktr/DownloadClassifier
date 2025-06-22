// options.js
document.addEventListener('DOMContentLoaded', () => {
  const defaultCategory = document.getElementById('defaultCategory');
  const status = document.getElementById('status');

  // 保存済み値の読み込み
  chrome.storage.sync.get(['defaultCategory'], (result) => {
    if (result.defaultCategory) {
      defaultCategory.value = result.defaultCategory;
    }
  });

  document.getElementById('optionsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    chrome.storage.sync.set({
      defaultCategory: defaultCategory.value
    }, () => {
      status.textContent = '保存しました';
      setTimeout(() => status.textContent = '', 1500);
    });
  });

  // ルール管理用コード追加
  const ruleList = document.getElementById('ruleList');
  const ruleForm = document.getElementById('ruleForm');
  const ruleName = document.getElementById('ruleName');
  const ruleFolder = document.getElementById('ruleFolder');
  const ruleUrlPattern = document.getElementById('ruleUrlPattern');
  const ruleMimePattern = document.getElementById('ruleMimePattern');
  const ruleFilePattern = document.getElementById('ruleFilePattern');
  const ruleStatus = document.getElementById('ruleStatus');
  const addRuleBtn = document.getElementById('addRuleBtn');
  const deleteRuleBtn = document.getElementById('deleteRuleBtn');

  let rules = [];
  let selectedRuleIndex = null;

  function renderRuleList() {
    ruleList.innerHTML = '';
    const newOption = document.createElement('option');
    newOption.value = 'new';
    newOption.textContent = '(新規)';
    ruleList.appendChild(newOption);
    rules.forEach((rule, idx) => {
      const option = document.createElement('option');
      option.value = idx;
      option.textContent = rule.name;
      ruleList.appendChild(option);
    });
  }

  function loadRules() {
    chrome.storage.sync.get(['rules'], (result) => {
      rules = result.rules || [];
      renderRuleList();
      if (rules.length > 0) {
        ruleList.selectedIndex = 0;
        showRule(0);
      } else {
        clearRuleForm();
      }
    });
  }

  function saveRules() {
    chrome.storage.sync.set({ rules }, () => {
      ruleStatus.textContent = 'ルールを保存しました';
      setTimeout(() => ruleStatus.textContent = '', 1500);
      renderRuleList();
    });
  }

  function showRule(idx) {
    if (rules[idx]) {
      ruleName.value = rules[idx].name;
      ruleFolder.value = rules[idx].folder;
      ruleUrlPattern.value = rules[idx].urlPattern;
      ruleMimePattern.value = rules[idx].mimePattern || '';
      ruleFilePattern.value = rules[idx].filePattern || '';
      selectedRuleIndex = idx;
    }
  }

  function clearRuleForm() {
    ruleName.value = '';
    ruleFolder.value = '';
    ruleUrlPattern.value = '';
    ruleMimePattern.value = '';
    ruleFilePattern.value = '';
    selectedRuleIndex = null;
  }

  ruleList.addEventListener('change', (e) => {
    const idx = ruleList.selectedIndex;
    if (idx === 0) {
      // (新規)が選択された場合
      clearRuleForm();
      ruleList.selectedIndex = 0;
      selectedRuleIndex = null;
    } else if (idx > 0) {
      showRule(idx - 1);
    }
  });

  addRuleBtn.addEventListener('click', () => {
    clearRuleForm();
    ruleList.selectedIndex = 0;
    selectedRuleIndex = null;
  });

  deleteRuleBtn.addEventListener('click', () => {
    const idx = ruleList.selectedIndex;
    if (idx >= 0 && rules[idx]) {
      rules.splice(idx, 1);
      saveRules();
      clearRuleForm();
      loadRules();
    }
  });

  ruleForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const rule = {
      name: ruleName.value,
      folder: ruleFolder.value,
      urlPattern: ruleUrlPattern.value,
      mimePattern: ruleMimePattern.value,
      filePattern: ruleFilePattern.value
    };
    if (selectedRuleIndex !== null && rules[selectedRuleIndex]) {
      rules[selectedRuleIndex] = rule;
    } else {
      rules.push(rule);
      ruleList.selectedIndex = rules.length - 1;
      selectedRuleIndex = rules.length - 1;
    }
    saveRules();
    renderRuleList();
  });

  // ダウンロード履歴表示
  const historySection = document.createElement('div');
  historySection.className = 'history-section';
  const historyTitle = document.createElement('h2');
  historyTitle.textContent = 'ダウンロード履歴';
  historySection.appendChild(historyTitle);
  const historyTable = document.createElement('table');
  historyTable.id = 'downloadHistoryTable';
  historyTable.innerHTML = '<thead><tr><th>ファイル名</th><th>URL</th></tr></thead><tbody></tbody>';
  historySection.appendChild(historyTable);
  document.body.appendChild(historySection);

  function renderDownloadHistory(items) {
    const tbody = historyTable.querySelector('tbody');
    tbody.innerHTML = '';
    items.forEach(item => {
      const tr = document.createElement('tr');
      const tdName = document.createElement('td');
      tdName.textContent = item.filename || '';
      const tdUrl = document.createElement('td');
      tdUrl.textContent = item.url || '';
      tr.appendChild(tdName);
      tr.appendChild(tdUrl);
      tbody.appendChild(tr);
    });
  }

  // 履歴取得
  if (chrome.downloads && chrome.downloads.search) {
    chrome.downloads.search({limit: 20, orderBy: ['-startTime']}, (results) => {
      const items = results.map(r => ({ filename: r.filename ? r.filename.split(/[/\\]/).pop() : '', url: r.url }));
      renderDownloadHistory(items);
    });
  }

  // 初期化
  loadRules();
});
