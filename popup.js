// ── 画面切り替え ──
var menuView   = document.getElementById('menu-view');
var injectView = document.getElementById('inject-view');

function showMenu() {
  menuView.style.display = 'flex';
  injectView.style.display = 'none';
}

function showInject() {
  menuView.style.display = 'none';
  injectView.style.display = 'block';
}

// ── メニューボタン ──
document.getElementById('btn-prepare').addEventListener('click', function () {
  chrome.tabs.create({ url: chrome.runtime.getURL('article-importer.html') });
  window.close();
});

document.getElementById('btn-go-inject').addEventListener('click', showInject);
document.getElementById('btn-back').addEventListener('click', showMenu);

// ── 流し込み画面の要素 ──
var btnInject = document.getElementById('btn-inject');
var statusBox = document.getElementById('status-box');
var resultDiv = document.getElementById('result');
var noteDiv   = document.getElementById('note');

function setStatus(msg, type) {
  statusBox.textContent = msg;
  statusBox.className = 'status-box ' + type;
}

function setResult(r, isExternal) {
  resultDiv.style.display = 'flex';
  var mark = function (v) { return v ? '<span class="ok-mark">OK</span>' : '<span class="ng-mark">NG</span>'; };
  var skip = '<span class="skip-mark">—</span>';
  document.getElementById('r-title').innerHTML   = mark(r.title);
  document.getElementById('r-summary').innerHTML = mark(r.summary);
  document.getElementById('r-body').innerHTML    = r.body
    ? '<span class="ok-mark">OK</span> <span style="font-size:10px;color:#8890a8">(' + (r.bodyMethod || '?') + ')</span>'
    : mark(false);
  document.getElementById('r-thumb').innerHTML   = r.thumbnail ? mark(true) : skip;
  document.getElementById('r-imgs').innerHTML    = r.images > 0
    ? '<span class="ok-mark">' + r.images + '枚</span>'
    : skip;

  if (r.category || r.tags) {
    var catRow = document.getElementById('r-category-row');
    var tagRow = document.getElementById('r-tags-row');
    if (catRow) {
      catRow.style.display = 'flex';
      document.getElementById('r-category').innerHTML = r.category ? mark(true) : skip;
    }
    if (tagRow) {
      tagRow.style.display = 'flex';
      document.getElementById('r-tags').innerHTML = r.tags ? mark(true) : skip;
    }
  }
}

// ── 流し込み処理 ──
btnInject.addEventListener('click', async function () {
  btnInject.disabled = true;
  setStatus('クリップボードを読み取り中…', 'guide');

  // クリップボード読み取り
  var text;
  try {
    text = await navigator.clipboard.readText();
  } catch (e) {
    setStatus('クリップボードの読み取りに失敗しました: ' + e.message, 'error');
    btnInject.disabled = false;
    return;
  }

  // JSONパース
  var data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    var preview = text ? text.substring(0, 120) : '（空）';
    setStatus('クリップボードのデータがJSON形式ではありません。\n「記事データを準備する」でデータをコピーしてから実行してください。\n\n読み取り内容: ' + preview, 'error');
    btnInject.disabled = false;
    return;
  }

  // sourceチェック
  var validSources = ['knowhow-interviewer', 'external-import'];
  if (validSources.indexOf(data.source) === -1) {
    setStatus('対応していないデータソースです。\n（source: ' + (data.source || '未設定') + '）', 'warn');
    btnInject.disabled = false;
    return;
  }

  // インタビュアーからの直接JSONは画像が含まれていないため、
  // 「記事データを準備する」で画像を追加してから流し込む必要がある
  if (data.source === 'knowhow-interviewer') {
    setStatus('インタビュアーのデータには画像が含まれていません。\n\nメニューに戻り「📝 記事データを準備する」から画像を追加してください。', 'warn');
    btnInject.disabled = false;
    return;
  }

  var isExternal = (data.source === 'external-import');
  setStatus('流し込み中…', 'guide');

  // アクティブタブのlibrary-bridge.jsにメッセージ送信
  var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  var tab = tabs[0];

  if (!tab || !tab.url || tab.url.indexOf('library.libecity.com') === -1) {
    setStatus('ノウハウ図書館の編集ページを開いてから実行してください。\n（現在のタブ: ' + (tab ? tab.url : '不明') + '）', 'error');
    btnInject.disabled = false;
    return;
  }

  try {
    var response = await chrome.tabs.sendMessage(tab.id, {
      type: 'INJECT',
      data: data
    });

    if (response && response.ok) {
      var r = response.result || response;
      setResult(r, isExternal);

      var requiredFields = ['title', 'summary', 'body'];
      var allOk = requiredFields.every(function (f) { return r[f]; });

      if (allOk) {
        setStatus('流し込み完了！ 確認画面で内容を確認してください。', 'ok');
      } else {
        var failedParts = [];
        if (!r.title) failedParts.push('タイトル');
        if (!r.summary) failedParts.push('要約');
        if (!r.body) failedParts.push('本文');
        setStatus('一部失敗: ' + failedParts.join('、') + ' が反映されませんでした。', 'warn');
      }

      var notes = [];
      var method = r.bodyMethod || '';
      if (method === 'lexical_api' || method === 'lexical_update') {
        notes.push('本文は Lexical API で見出し・段落構造付きで挿入されました。');
      } else if (method === 'paste') {
        notes.push('本文は HTML paste で挿入されました。見出し構造を確認してください。');
      } else if (method.indexOf('insertText') !== -1) {
        notes.push('本文はプレーンテキストで挿入されました（見出し・段落の構造なし）。');
      }

      if (r.category) notes.push('カテゴリが自動設定されました。');
      if (r.tags) notes.push('タグが自動追加されました。');

      if (r.errors && r.errors.length > 0) {
        notes.push('エラー: ' + r.errors.join(', '));
      }

      noteDiv.textContent = notes.map(function (n) { return '※' + n; }).join('\n');
    } else {
      setStatus('流し込みに失敗しました: ' + (response ? response.error : '不明'), 'error');
    }
  } catch (e) {
    setStatus('図書館ページとの通信に失敗しました。ページを再読み込みして試してください。\n' + e.message, 'error');
  }

  btnInject.disabled = false;
});
