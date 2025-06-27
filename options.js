// options.js - Refactored

// --- Modules -----------------------------------------------------------------

// --- Helper Functions (copied from popup.js) ---
/**
 * UIに関する操作を担当するモジュール
 */
const UIManager = {
  // DOM要素のキャッシュ
  elements: {
    rulesListBox: document.getElementById('rulesListBox'),
    deleteRuleBtn: document.getElementById('deleteRuleBtn'),
    addOrUpdateRuleBtn: document.getElementById('addOrUpdateRuleBtn'),
    ruleNameInput: document.getElementById('ruleName'),
    sendFolderInput: document.getElementById('sendFolder'),
    urlPatternInput: document.getElementById('urlPattern'),
    filePatternInput: document.getElementById('filePattern'),
    mimeInput: document.getElementById('mime'),
    moveUpRuleBtn: document.getElementById('moveUpRuleBtn'),
    moveDownRuleBtn: document.getElementById('moveDownRuleBtn'),
    testRuleBtn: document.getElementById('testRuleBtn'),
    downloadHistory: document.getElementById('downloadHistory'),
    historyCountInput: document.getElementById('historyCountInput'),
    changeHistoryCountBtn: document.getElementById('changeHistoryCountBtn'),
  },

  /**
   * ルールリストを描画する
   * @param {Array} rules - 描画するルールの配列
   * @param {number} selectedIndex - 選択状態にするインデックス
   */
  renderRulesList(rules, selectedIndex) {
    const { rulesListBox } = this.elements;
    const prevSelectedIndex = rulesListBox.selectedIndex;
    rulesListBox.innerHTML = '';

    const newOption = document.createElement('option');
    newOption.value = '-1';
    newOption.textContent = chrome.i18n.getMessage('newRule') || '(新規)';
    rulesListBox.appendChild(newOption);

    rules.forEach((rule, idx) => {
      const option = document.createElement('option');
      option.value = idx;
      option.textContent = rule.name || chrome.i18n.getMessage('unnamedRule') || '(名称未設定)';
      rulesListBox.appendChild(option);
    });

    rulesListBox.selectedIndex = selectedIndex !== -1 ? selectedIndex + 1 : 0;
  },

  /**
   * ルール詳細フォームを埋める
   * @param {object | null} rule - 表示するルールオブジェクト
   */
  fillRuleDetail(rule) {
    if (rule) {
      this.elements.ruleNameInput.value = rule.name || '';
      this.elements.sendFolderInput.value = rule.folder || '';
      this.elements.urlPatternInput.value = rule.urlPattern || '';
      this.elements.filePatternInput.value = rule.filePattern || '';
      this.elements.mimeInput.value = rule.mimePattern || '';
    } else {
      this.elements.ruleNameInput.value = 'New Rule';
      this.elements.sendFolderInput.value = '';
      this.elements.urlPatternInput.value = '';
      this.elements.filePatternInput.value = '';
      this.elements.mimeInput.value = '';
    }
  },

  /**
   * 追加/更新ボタンのラベルを更新する
   * @param {boolean} isNew - 新規ルールの場合はtrue
   */
  updateAddOrUpdateButtonLabel(isNew) {
    const key = isNew ? 'add' : 'update';
    this.elements.addOrUpdateRuleBtn.textContent = chrome.i18n.getMessage(key) || (isNew ? '追加' : '更新');
  },

  /**
   * ダウンロード履歴を描画する
   * @param {Array} historyItems - 履歴アイテムの配列
   * @param {function} onAddToRuleClick - 「このファイルでルール追加」ボタンのクリックハンドラ
   * @param {function} hightlightRule - ハイライト対象のルールかどうかを判定する関数
   */
  renderDownloadHistory(historyItems, onAddToRuleClick, hightlightRule) {
    const { downloadHistory } = this.elements;
    downloadHistory.replaceChildren(); // 安全なクリア

    if (!historyItems || historyItems.length === 0) {
      const li = document.createElement('li');
      li.textContent = chrome.i18n.getMessage('noDownloadHistory') || 'ダウンロード履歴がありません。';
      li.style.padding = '1em';
      li.style.textAlign = 'center';
      li.style.color = '#666';
      downloadHistory.appendChild(li);
      return;
    }

    historyItems.forEach(item => {
      const li = document.createElement('li');
      if (hightlightRule(item)) {
        li.style.background = 'yellow';
      }

      const icon = document.createElement('img');
      icon.className = 'file-icon';
      icon.src = getFileIcon(item);

      const fileInfo = document.createElement('div');
      fileInfo.className = 'file-info';

      // Wrapper for filename and button
      const fileNameWrapper = document.createElement('div');
      fileNameWrapper.className = 'file-name-wrapper';

      const fileNameDiv = document.createElement('div');
      fileNameDiv.className = 'file-name';
      const fileName = item.filename ? item.filename.split(/\\|\//).pop() : '(unknown)';
      fileNameDiv.textContent = fileName;
      fileNameDiv.title = item.filename;

      const addBtn = document.createElement('button');
      addBtn.className = 'add-rule-btn';
      addBtn.textContent = chrome.i18n.getMessage('addRuleWithThisFile') || 'このファイルでルール追加';
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent li click event if any
        onAddToRuleClick(item);
      });

      fileNameWrapper.appendChild(fileNameDiv);
      fileNameWrapper.appendChild(addBtn);

      // Details section
      const fileDetails = document.createElement('div');
      fileDetails.className = 'file-details';

      const statusSpan = document.createElement('span');
      statusSpan.className = `file-status ${item.state}`;
      statusSpan.textContent = item.state === 'complete' ? formatBytes(item.fileSize) : (item.error || item.state);

      const detailsRight = document.createElement('span');
      detailsRight.className = 'details-right';

      const domainSpan = document.createElement('span');
      domainSpan.className = 'file-domain';
      domainSpan.textContent = getDomain(item.url);

      const timeSpan = document.createElement('span');
      timeSpan.className = 'file-time';
      timeSpan.textContent = item.startTime ? formatTimeAgo(item.startTime) : '';

      detailsRight.appendChild(domainSpan);
      detailsRight.appendChild(timeSpan);
      fileDetails.appendChild(statusSpan);
      fileDetails.appendChild(detailsRight);

      fileInfo.appendChild(fileNameWrapper);
      fileInfo.appendChild(fileDetails);

      li.appendChild(icon);
      li.appendChild(fileInfo);
      downloadHistory.appendChild(li);
    });
  },

  /**
   * フォームから現在のルールデータを取得する
   * @returns {object} ルールデータ
   */
  getRuleDataFromForm() {
    let sendFolderValue = this.elements.sendFolderInput.value.trim();
    if (sendFolderValue.endsWith('/') || sendFolderValue.endsWith('\\')) {
        sendFolderValue = sendFolderValue.slice(0, -1);
    }
    return {
      name: this.elements.ruleNameInput.value.trim(),
      folder: sendFolderValue,
      urlPattern: this.elements.urlPatternInput.value.trim(),
      filePattern: this.elements.filePatternInput.value.trim(),
      mimePattern: this.elements.mimeInput.value.trim(),
    };
  },

  /**
   * 履歴からルールを作成するための情報をフォームに設定する
   * @param {object} item - 履歴アイテム
   */
  fillRuleFormFromHistory(item) {
    const fileName = item.filename ? item.filename.split(/[\\/]/).pop() : '';
    const extMatch = fileName.match(/\.[^.]+$/);
    const filePattern = extMatch ? `*${extMatch[0]}` : fileName;
    
    let urlPattern = '*';
    let ruleName = fileName;
    
    try {
      const urlStr = item.url.startsWith('blob:') ? item.url.substring(5) : item.url;
      const urlObj = new URL(urlStr);
      if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
        urlPattern = `*://${urlObj.hostname}/*`;
        ruleName = urlObj.hostname;
      }
    } catch (e) {
      // URLの解析に失敗した場合はデフォルト値を使用
    }

    this.elements.ruleNameInput.value = ruleName;
    this.elements.sendFolderInput.value = '';
    this.elements.urlPatternInput.value = urlPattern;
    this.elements.filePatternInput.value = filePattern;
    this.elements.mimeInput.value = item.mime || '';
  },

  /**
   * UIのテキストを多言語化する
   */
  localize() {
    document.title = chrome.i18n.getMessage('extOptionsTitle') || document.title;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = chrome.i18n.getMessage(key) || el.textContent;
      }
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.getAttribute('data-i18n-ph');
      if (key) {
        el.setAttribute('placeholder', chrome.i18n.getMessage(key) || el.getAttribute('placeholder'));
      }
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        el.title = chrome.i18n.getMessage(key) || '';
      }
    });
  },

  /**
   * ルール操作ボタン（上へ、下へ、削除）の有効/無効状態を更新する
   */
  updateRuleButtonsState() {
    const { moveUpRuleBtn, moveDownRuleBtn, deleteRuleBtn } = this.elements;
    const selectedIndex = RuleManager.selectedIndex;
    const rulesCount = RuleManager.rules.length;

    // 「新規ルール」が選択されている場合、またはルールがない場合は全て無効
    deleteRuleBtn.disabled = (selectedIndex === -1);
    // 選択されているルールが最初の場合、または「新規ルール」の場合は上へ移動を無効
    moveUpRuleBtn.disabled = (selectedIndex === -1 || selectedIndex === 0);
    // 選択されているルールが最後の場合、または「新規ルール」の場合は下へ移動を無効
    moveDownRuleBtn.disabled = (selectedIndex === -1 || selectedIndex === rulesCount - 1);
  },
};

/**
 * ルールデータの管理を担当するモジュール
 */
const RuleManager = {
  rules: [],
  selectedIndex: -1,
  historyCount: 20,

  async load() {
    const data = await chrome.storage.local.get({ rules: [], historyCount: 20 });
    this.rules = data.rules;
    this.historyCount = data.historyCount;
    this.selectedIndex = -1;
  },

  async save() {
    await chrome.storage.local.set({ rules: this.rules });
  },

  get(index) {
    return this.rules[index] || null;
  },

  add(rule) {
    this.rules.push(rule);
    this.selectedIndex = this.rules.length - 1;
  },

  update(rule) {
    if (this.selectedIndex !== -1) {
      this.rules[this.selectedIndex] = rule;
    }
  },

  delete() {
    if (this.selectedIndex !== -1) {
      this.rules.splice(this.selectedIndex, 1);
      this.selectedIndex = -1;
    }
  },

  moveUp() {
    if (this.selectedIndex > 0) {
      [this.rules[this.selectedIndex - 1], this.rules[this.selectedIndex]] = 
      [this.rules[this.selectedIndex], this.rules[this.selectedIndex - 1]];
      this.selectedIndex--;
    }
  },

  moveDown() {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.rules.length - 1) {
      [this.rules[this.selectedIndex], this.rules[this.selectedIndex + 1]] = 
      [this.rules[this.selectedIndex + 1], this.rules[this.selectedIndex]];
      this.selectedIndex++;
    }
  },

  isValidWildcard(pattern) {
    try {
      const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
      const regexStr = '^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
      new RegExp(regexStr);
    } catch (e) {
      return false;
    }
    return true;
  },
};

/**
 * アプリケーション全体を管理するモジュール
 */
const App = {
  async init() {
    UIManager.localize();
    await RuleManager.load();
    
    UIManager.elements.historyCountInput.value = RuleManager.historyCount;
    this.updateRulesUI();
    await this.updateHistoryUI();
    UIManager.updateRuleButtonsState(); // 初期状態のボタンを更新
    this.addEventListeners();
  },

  addEventListeners() {
    const { elements } = UIManager;
    elements.rulesListBox.addEventListener('change', this.handleRuleSelect.bind(this));
    elements.addOrUpdateRuleBtn.addEventListener('click', this.handleSaveRule.bind(this));
    elements.deleteRuleBtn.addEventListener('click', this.handleDeleteRule.bind(this));
    elements.moveUpRuleBtn.addEventListener('click', this.handleMoveRuleUp.bind(this));
    elements.moveDownRuleBtn.addEventListener('click', this.handleMoveRuleDown.bind(this));
    elements.testRuleBtn.addEventListener('click', this.handleTestRule.bind(this));
    elements.changeHistoryCountBtn.addEventListener('click', this.handleChangeHistoryCount.bind(this));
  },

  updateRulesUI() {
    UIManager.renderRulesList(RuleManager.rules, RuleManager.selectedIndex);
    const selectedRule = RuleManager.get(RuleManager.selectedIndex);
    UIManager.fillRuleDetail(selectedRule);
    UIManager.updateAddOrUpdateButtonLabel(RuleManager.selectedIndex === -1);
    UIManager.updateRuleButtonsState(); // ルール選択・更新後にボタン状態を更新
  },

  async updateHistoryUI(hightlightRule = () => false) {
    const items = await searchDownloads({
      limit: RuleManager.historyCount,
      orderBy: ['-startTime']
    });
    UIManager.renderDownloadHistory(items, this.handleAddToRuleFromHistory.bind(this), hightlightRule);
    // updateRuleButtonsStateはupdateRulesUIで呼ばれるため、ここでは不要
  },

  handleRuleSelect(e) {
    RuleManager.selectedIndex = parseInt(e.target.value, 10);
    this.updateRulesUI();
  },

  async handleSaveRule() {
    const ruleData = UIManager.getRuleDataFromForm();

    if (!ruleData.name) {
      alert(chrome.i18n.getMessage('ruleNameRequired') || 'ルール名を入力してください。');
      UIManager.elements.ruleNameInput.focus();
      return;
    }
    if (ruleData.urlPattern && !RuleManager.isValidWildcard(ruleData.urlPattern)) {
        alert('URLパターンの形式が正しくありません。');
        UIManager.elements.urlPatternInput.focus();
        return;
    }
    // 他のパターンのバリデーションも同様に追加...

    if (RuleManager.selectedIndex === -1) {
      RuleManager.add(ruleData);
    } else {
      RuleManager.update(ruleData);
    }
    await RuleManager.save();
    this.updateRulesUI();
    UIManager.elements.rulesListBox.focus();
    // updateRuleButtonsStateはupdateRulesUIで呼ばれるため、ここでは不要
  },

  async handleDeleteRule() {
    if (RuleManager.selectedIndex !== -1) {
      RuleManager.delete();
      await RuleManager.save();
      this.updateRulesUI();
      UIManager.updateRuleButtonsState(); // 削除後にボタン状態を更新
      UIManager.elements.rulesListBox.focus();
    }
  },

  async handleMoveRuleUp() {
    RuleManager.moveUp();
    await RuleManager.save();
    this.updateRulesUI();
    UIManager.updateRuleButtonsState(); // 移動後にボタン状態を更新
    UIManager.elements.rulesListBox.focus();
  },

  async handleMoveRuleDown() {
    RuleManager.moveDown();
    await RuleManager.save();
    this.updateRulesUI();
    UIManager.updateRuleButtonsState(); // 移動後にボタン状態を更新
    UIManager.elements.rulesListBox.focus();
  },
  
  async handleTestRule() {
    const testRuleData = UIManager.getRuleDataFromForm();
    const testRule = new DownloadRule(testRuleData);

    // ストレージからonCreated時の履歴データを事前に取得
    const { history } = await chrome.storage.local.get({ history: [] });

    // ハイライト判定用の関数を定義
    const hightlightRule = (latestItem) => {
      // 表示用のlatestItemのIDを使って、ストレージから保存された元の情報を探す
      const originalItem = history.find(item => item.id === latestItem.id);

      // ルール判定には、originalItem（ダウンロード開始直後の情報）を優先して使用する
      const itemToTest = originalItem || latestItem;
      return testRule.match(itemToTest);
    };
    await this.updateHistoryUI(hightlightRule);
  },

  async handleAddToRuleFromHistory(latestItem) {
    // 表示に使ったのは最新のItemだが、ルール作成にはonCreated時の情報を使いたい
    // ストレージからIDで元の情報を検索する
    const { history } = await chrome.storage.local.get({ history: [] });
    const originalItem = history.find(item => item.id === latestItem.id);

    // onCreated時の情報があればそれを使い、なければ最新情報でフォールバック
    const itemForRule = originalItem || latestItem;

    RuleManager.selectedIndex = -1;
    // ルールリストの選択を視覚的に「(新規)」に更新
    UIManager.elements.rulesListBox.selectedIndex = 0;

    UIManager.fillRuleFormFromHistory(itemForRule);
    UIManager.updateAddOrUpdateButtonLabel(true);
    UIManager.updateRuleButtonsState(); // ルール操作ボタンを無効化
    UIManager.elements.ruleNameInput.focus();
  },

  async handleChangeHistoryCount() {
    const value = parseInt(UIManager.elements.historyCountInput.value, 10);
    if (!isNaN(value) && value > 0 && value <= 100) {
      RuleManager.historyCount = value;
      await chrome.storage.local.set({ historyCount: value });
      await this.updateHistoryUI();
    }
  },
};

// --- Initialization ----------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});