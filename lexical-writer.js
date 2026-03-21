// lexical-writer.js — ページコンテキストで実行される Lexical Editor 操作スクリプト
// library-bridge.js から <script src="lexical-writer.js"> として注入される
// ページの window コンテキストで動作するため、Lexical の内部APIにアクセス可能

(function () {
  'use strict';

  var DATA_ID = '__knowhow_inject_data__';
  var RESULT_EVENT = '__knowhow_inject_result__';

  // ── データ読み取り ──────────────────────────────────────────
  var dataEl = document.getElementById(DATA_ID);
  if (!dataEl) return;

  var sections;
  try {
    sections = JSON.parse(dataEl.textContent);
    dataEl.remove();
  } catch (e) {
    console.error('[KnowHow inject] データパース失敗:', e);
    report(false, 'parse_error', e.message);
    return;
  }

  // ── エディター要素を検索 ──────────────────────────────────
  var editorEl =
    document.querySelector('[data-lexical-editor="true"]') ||
    document.querySelector('.ContentEditable__root');
  if (!editorEl) {
    report(false, 'no_editor', 'エディター要素が見つかりません');
    return;
  }

  // ── Lexical editor インスタンスを取得 ─────────────────────
  var editor = null;
  try {
    var keys = Object.keys(editorEl);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].startsWith('__lexicalEditor')) {
        editor = editorEl[keys[i]];
        break;
      }
    }
  } catch (e) {
    console.warn('[KnowHow inject] editorインスタンス取得失敗:', e);
  }

  var success = false;

  // ── APPROACH A: Lexical API (parseEditorState + setEditorState) ─
  if (editor && typeof editor.parseEditorState === 'function') {
    var registeredTypes = [];
    try {
      editor._nodes.forEach(function (val, key) { registeredTypes.push(key); });
    } catch (e) {}
    console.log('[KnowHow inject] Lexical editor取得成功。登録ノード:', registeredTypes);
    success = tryLexicalAPI(editor, sections, registeredTypes);
  }

  // ── APPROACH B: Paste event（ページコンテキストなので動作するはず）─
  if (!success) {
    console.log('[KnowHow inject] Approach B: paste event を試行...');
    success = tryPaste(editorEl, sections);
  }

  // ── APPROACH C: insertText（プレーンテキスト・最終手段）─
  if (!success) {
    console.log('[KnowHow inject] Approach C: insertText（構造なし）...');
    success = tryInsertText(editorEl, sections);
  }

  if (!success) {
    report(false, 'all_failed', '全アプローチ失敗');
  }

  // =====================================================================
  // 実装関数
  // =====================================================================

  function tryLexicalAPI(editor, sections, registeredTypes) {
    var hasHeading = registeredTypes.indexOf('heading') !== -1;
    var hasParagraph = registeredTypes.indexOf('paragraph') !== -1;
    var hasImage = registeredTypes.indexOf('image') !== -1;

    if (!hasParagraph) {
      console.warn('[KnowHow inject] paragraph ノード未登録。API不可。');
      return false;
    }

    // Lexical内部JSON形式を組み立て
    var children = [];
    sections.forEach(function (s) {
      // 見出し
      if (s.heading && s.heading.trim() && hasHeading) {
        children.push({
          type: 'heading',
          tag: 'h2',
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          children: [makeTextNode(s.heading.trim())]
        });
      } else if (s.heading && s.heading.trim()) {
        // heading未登録ならparagraphで太字
        children.push({
          type: 'paragraph',
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          children: [makeTextNode(s.heading.trim(), 1)] // format:1 = bold
        });
      }

      // セクション画像（見出し直後に配置）
      if (s.image && hasImage) {
        children.push(makeImageNode(s.image, s.heading || ''));
      }

      // 本文（Markdown構文をパースして構造化 + inlineImages対応）
      var parsed = parseBodyLines(s.body);
      var inlineImgs = s.inlineImages || [];
      var paraIdx = 0; // inlineImages用の段落カウンタ
      parsed.forEach(function (node) {
        if (node.type === 'h3' && hasHeading) {
          children.push({
            type: 'heading',
            tag: 'h3',
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
            children: parseInlineFormatting(node.text)
          });
        } else if (node.type === 'quote' && registeredTypes.indexOf('quote') !== -1) {
          children.push({
            type: 'quote',
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
            children: [makeTextNode(node.text)]
          });
        } else {
          // paragraph（通常・リスト変換・h3フォールバック含む）
          children.push({
            type: 'paragraph',
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
            children: parseInlineFormatting(node.text)
          });
        }
        // h3はafterParagraphカウントに含めない
        if (node.type !== 'h3') {
          // この段落の直後に挿入すべき追加画像があるかチェック
          if (hasImage) {
            inlineImgs.forEach(function (img) {
              if (img.afterParagraph === paraIdx && img.data) {
                // section.imageと重複しない場合のみ追加
                if (img.data !== s.image) {
                  children.push(makeImageNode(img.data, img.label || s.heading || ''));
                }
              }
            });
          }
          paraIdx++;
        }
      });
    });

    if (children.length === 0) return false;

    var stateJSON = JSON.stringify({
      root: {
        type: 'root',
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        children: children
      }
    });

    try {
      var newState = editor.parseEditorState(stateJSON);
      editor.setEditorState(newState);
      // DOMへの反映を強制（空のupdateで reconciliation をトリガー）
      editor.update(function () {});
      console.log('[KnowHow inject] Approach A 成功: Lexical API');
      report(true, 'lexical_api', '見出し・段落構造あり' + (hasImage ? ' + 画像' : ''));
      return true;
    } catch (e) {
      console.warn('[KnowHow inject] parseEditorState 失敗:', e.message);

      // フォーマットが合わない場合: update() 内で直接操作を試みる
      return tryLexicalUpdate(editor, sections, registeredTypes);
    }
  }

  // editor.update() 内でノードツリーを直接操作
  function tryLexicalUpdate(editor, sections, registeredTypes) {
    try {
      var nodeClasses = {};
      editor._nodes.forEach(function (entry, key) {
        // entry は { klass, transforms } または klass そのもの
        nodeClasses[key] = entry.klass || entry;
      });

      if (!nodeClasses.paragraph || !nodeClasses.text) {
        console.warn('[KnowHow inject] 必要なノードクラスが取得不可');
        return false;
      }

      editor.update(function () {
        try {
          // Lexical の $getRoot 相当: pendingEditorState から root を取得
          var state = editor._pendingEditorState || editor._editorState;
          var root = state._nodeMap.get('root');
          if (!root) return;

          // Writable版を取得
          var writableRoot = root.getWritable ? root.getWritable() : root;

          // 子ノードをクリア
          if (typeof writableRoot.clear === 'function') {
            writableRoot.clear();
          }

          sections.forEach(function (s) {
            // 見出し
            if (s.heading && s.heading.trim() && nodeClasses.heading) {
              var heading = new nodeClasses.heading('h2');
              var hText = new nodeClasses.text(s.heading.trim());
              heading.append(hText);
              writableRoot.append(heading);
            }

            // セクション画像（見出し直後に配置）
            if (s.image && nodeClasses.image) {
              try {
                var sectionImg = new nodeClasses.image({ src: s.image, altText: s.heading || '' });
                writableRoot.append(sectionImg);
              } catch (imgErr) {
                console.warn('[KnowHow inject] セクション画像ノード作成失敗:', imgErr);
              }
            }

            // 本文（Markdown構文をパースして構造化 + inlineImages対応）
            var parsed = parseBodyLines(s.body);
            var inlineImgs = s.inlineImages || [];
            var paraIdx = 0;
            parsed.forEach(function (node) {
              if (node.type === 'h3' && nodeClasses.heading) {
                var h3 = new nodeClasses.heading('h3');
                var h3Text = new nodeClasses.text(node.text.replace(/\*\*/g, ''));
                h3.append(h3Text);
                writableRoot.append(h3);
              } else {
                var para = new nodeClasses.paragraph();
                var pText = new nodeClasses.text(node.text.replace(/\*\*/g, ''));
                para.append(pText);
                writableRoot.append(para);
              }
              if (node.type !== 'h3') {
                if (nodeClasses.image) {
                  inlineImgs.forEach(function (imgInfo) {
                    if (imgInfo.afterParagraph === paraIdx && imgInfo.data) {
                      if (imgInfo.data !== s.image) {
                        try {
                          var img = new nodeClasses.image({ src: imgInfo.data, altText: imgInfo.label || s.heading || '' });
                          writableRoot.append(img);
                        } catch (imgErr) {
                          console.warn('[KnowHow inject] inline画像ノード作成失敗:', imgErr);
                        }
                      }
                    }
                  });
                }
                paraIdx++;
              }
            });
          });
        } catch (updateErr) {
          console.error('[KnowHow inject] update内エラー:', updateErr);
        }
      });

      console.log('[KnowHow inject] Approach A2 成功: editor.update()');
      report(true, 'lexical_update', '見出し・段落構造あり');
      return true;
    } catch (e) {
      console.warn('[KnowHow inject] editor.update() 失敗:', e.message);
      return false;
    }
  }

  function tryPaste(editorEl, sections) {
    try {
      // HTMLを組み立て
      var html = sections.map(function (s) {
        var h = '';
        if (s.heading && s.heading.trim()) {
          h += '<h2>' + esc(s.heading.trim()) + '</h2>';
        }
        // セクション画像（見出し直後に配置）
        if (s.image) {
          h += '<img src="' + s.image + '" alt="' + esc(s.heading || '') + '" />';
        }
        var parsed = parseBodyLines(s.body);
        var inlineImgs = s.inlineImages || [];
        var paraIdx = 0;
        parsed.forEach(function (node) {
          if (node.type === 'h3') {
            h += '<h3>' + inlineToHtml(node.text) + '</h3>';
          } else if (node.type === 'quote') {
            h += '<blockquote>' + inlineToHtml(node.text) + '</blockquote>';
          } else {
            h += '<p>' + inlineToHtml(node.text) + '</p>';
          }
          if (node.type !== 'h3') {
            inlineImgs.forEach(function (img) {
              if (img.afterParagraph === paraIdx && img.data) {
                if (img.data !== s.image) {
                  h += '<img src="' + img.data + '" alt="' + esc(img.label || s.heading || '') + '" />';
                }
              }
            });
            paraIdx++;
          }
        });
        return h;
      }).join('');

      var plain = sections.map(function (s) {
        return s.heading + '\n' + s.body;
      }).join('\n\n');

      // フォーカスして全選択
      editorEl.focus();
      var sel = window.getSelection();
      if (sel) {
        var range = document.createRange();
        range.selectNodeContents(editorEl);
        sel.removeAllRanges();
        sel.addRange(range);
      }

      // ClipboardEvent を生成（ページコンテキストなので DataTransfer が使える）
      var dt = new DataTransfer();
      dt.setData('text/html', html);
      dt.setData('text/plain', plain);

      var evt = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt
      });

      var dispatched = editorEl.dispatchEvent(evt);
      console.log('[KnowHow inject] Approach B: paste dispatched (defaultPrevented:', !dispatched, ')');
      report(true, 'paste', 'HTML paste経由');
      return true;
    } catch (e) {
      console.error('[KnowHow inject] paste失敗:', e);
      return false;
    }
  }

  function tryInsertText(editorEl, sections) {
    try {
      var plain = sections.map(function (s) {
        return s.heading + '\n' + s.body;
      }).join('\n\n');

      editorEl.focus();
      document.execCommand('selectAll');
      document.execCommand('insertText', false, plain);

      console.log('[KnowHow inject] Approach C: insertText（プレーンテキスト）');
      report(true, 'insertText', 'プレーンテキストのみ（構造なし）');
      return true;
    } catch (e) {
      console.error('[KnowHow inject] insertText失敗:', e);
      return false;
    }
  }

  // ── ユーティリティ ────────────────────────────────────────

  // ── 本文行をパースして構造化ノード配列に変換 ───────────────
  // 戻り値: [{ type: 'h3'|'paragraph', text: '...', bold: bool }]
  function parseBodyLines(body) {
    var lines = body.split('\n').filter(function (p) { return p.trim(); });
    var result = [];
    lines.forEach(function (line) {
      var trimmed = line.trim();
      // ### 小見出し → h3
      if (/^###\s+/.test(trimmed)) {
        result.push({ type: 'h3', text: trimmed.replace(/^###\s+/, '').trim() });
      }
      // - リスト項目 → ・付き段落
      else if (/^[-\*]\s+/.test(trimmed)) {
        result.push({ type: 'paragraph', text: '・' + trimmed.replace(/^[-\*]\s+/, '').trim() });
      }
      // > 引用
      else if (/^>\s+/.test(trimmed)) {
        result.push({ type: 'quote', text: trimmed.replace(/^>\s+/, '').trim() });
      }
      // 通常段落
      else {
        result.push({ type: 'paragraph', text: trimmed });
      }
    });
    return result;
  }

  // テキスト内の **太字** と [リンク](URL) をパースして子ノード配列に変換
  // Lexical JSON用
  function parseInlineFormatting(text) {
    var nodes = [];
    // **太字** と [リンク](URL) をパース
    var regex = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
    var lastIdx = 0;
    var match;
    while ((match = regex.exec(text)) !== null) {
      // マッチ前のテキスト
      if (match.index > lastIdx) {
        nodes.push(makeTextNode(text.substring(lastIdx, match.index)));
      }
      if (match[1]) {
        // **太字**
        nodes.push(makeTextNode(match[1], 1)); // format:1 = bold
      } else if (match[2] && match[3]) {
        // [テキスト](URL) → リンクノード
        nodes.push({
          type: 'link',
          url: match[3],
          target: '_blank',
          rel: 'noopener',
          version: 1,
          children: [makeTextNode(match[2])]
        });
      }
      lastIdx = match.index + match[0].length;
    }
    // 残りのテキスト
    if (lastIdx < text.length) {
      nodes.push(makeTextNode(text.substring(lastIdx)));
    }
    return nodes.length > 0 ? nodes : [makeTextNode(text)];
  }

  // テキスト内の **太字** と [リンク](URL) をHTMLに変換
  function inlineToHtml(text) {
    return esc(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  }

  function makeTextNode(text, format) {
    return {
      type: 'text',
      text: text,
      format: format || 0,
      style: '',
      mode: 'normal',
      detail: 0,
      version: 1
    };
  }

  function makeImageNode(src, alt) {
    // Lexical の ImageNode はプラグインによりスキーマが異なる
    // よく使われるプロパティを網羅的に設定
    return {
      type: 'image',
      version: 1,
      src: src,
      altText: alt || '',
      width: 0,
      height: 0,
      maxWidth: 800,
      showCaption: false,
      caption: {
        editorState: {
          root: {
            type: 'root', direction: null, format: '', indent: 0, version: 1,
            children: []
          }
        }
      }
    };
  }

  function esc(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
  }

  function report(success, method, detail) {
    window.dispatchEvent(new CustomEvent(RESULT_EVENT, {
      detail: { success: success, method: method, detail: detail }
    }));
  }
})();
