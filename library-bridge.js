// library-bridge.js — ノウハウ図書館インポーター
// 拡張 ↔ library.libecity.com 間のブリッジ（コンテンツスクリプト）
// v0.3.0: external-import対応（カテゴリ・タグ注入）

(function () {
  'use strict';

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.type !== 'INJECT') return;

    // 非同期処理を開始して完了後にsendResponse
    handleInject(msg.data).then(function (result) {
      sendResponse({ ok: true, result: result });
    }).catch(function (e) {
      sendResponse({ ok: false, error: e.message });
    });

    return true; // 非同期sendResponseのためポートを保持
  });

  // ================================================================
  // メイン処理
  // ================================================================

  function handleInject(d) {
    var isExternal = (d.source === 'external-import');

    var result = {
      title: false,
      summary: false,
      body: false,
      thumbnail: false,
      images: 0,
      bodyMethod: '',
      category: false,
      tags: false,
      errors: []
    };

    // ① タイトル（同期）
    try {
      var ti = document.querySelector('#title');
      if (ti) {
        setNativeValue(ti, d.title.slice(0, 50));
        ti.dispatchEvent(new Event('input', { bubbles: true }));
        ti.dispatchEvent(new Event('change', { bubbles: true }));
        result.title = true;
      }
    } catch (e) {
      result.errors.push('title: ' + e.message);
    }

    // ② 要約（同期）
    try {
      var su = document.querySelector('#summary');
      if (su) {
        setNativeValue(su, d.summary.slice(0, 140));
        su.dispatchEvent(new Event('input', { bubbles: true }));
        su.dispatchEvent(new Event('change', { bubbles: true }));
        result.summary = true;
      }
    } catch (e) {
      result.errors.push('summary: ' + e.message);
    }

    // ③ 本文（lexical-writer.jsの完了を待つ Promise）
    var bodyPromise = injectBody(d.sections, result);

    // ④ サムネイル（非同期）— thumbnail専用フィールド優先、なければsections[0].image
    var thumbPromise = injectThumbnail(d.thumbnail, d.sections).then(function (ok) {
      result.thumbnail = ok;
    }).catch(function (e) {
      result.errors.push('thumbnail: ' + e.message);
    });

    // ⑤ カテゴリ（データがあれば source 問わず注入）
    var catPromise = Promise.resolve();
    if (d.category) {
      catPromise = injectCategory(d.category, result);
    }

    // ⑥ タグ（データがあれば source 問わず注入）
    var tagPromise = Promise.resolve();
    if (d.tags && d.tags.length > 0) {
      tagPromise = injectTags(d.tags, result);
    }

    // 全部完了してからresultを返す
    return Promise.allSettled([bodyPromise, thumbPromise, catPromise, tagPromise]).then(function () {
      console.log('[KnowHow bridge] 最終結果:', JSON.stringify(result));
      return result;
    });
  }

  // ================================================================
  // 本文注入（lexical-writer.js経由）
  // ================================================================

  function injectBody(sections, result) {
    result.images = sections.filter(function (s) { return s.image; }).length;

    return new Promise(function (resolve) {
      // lexical-writer.jsからの結果イベントを待つ
      var handler = function handler(e) {
        window.removeEventListener('__knowhow_inject_result__', handler);
        clearTimeout(timeout);
        if (e.detail) {
          result.body = e.detail.success;
          result.bodyMethod = e.detail.method || '';
          console.log('[KnowHow bridge] 本文結果:', e.detail.method, e.detail.detail);
        }
        resolve();
      };
      window.addEventListener('__knowhow_inject_result__', handler);

      // タイムアウト（5秒で諦める）
      var timeout = setTimeout(function () {
        console.warn('[KnowHow bridge] lexical-writer.js タイムアウト');
        window.removeEventListener('__knowhow_inject_result__', handler);
        if (!result.body) {
          result.errors.push('body: lexical-writer.js timeout');
        }
        resolve();
      }, 5000);

      // データを隠しDOM要素に格納
      var dataEl = document.createElement('script');
      dataEl.type = 'application/json';
      dataEl.id = '__knowhow_inject_data__';
      dataEl.textContent = JSON.stringify(sections);
      document.body.appendChild(dataEl);

      // lexical-writer.jsをページコンテキストに注入
      var script = document.createElement('script');
      script.src = chrome.runtime.getURL('lexical-writer.js');
      script.onload = function () {
        script.remove();
        // onloadの時点でlexical-writer.jsは実行完了しているはず
        // ただしCustomEventがまだ届いていない場合は短いdelayで待つ
        setTimeout(function () {
          if (!result.body && !result.bodyMethod) {
            // イベントがまだ来ていない場合、もう少し待つ（既にhandlerが設定済み）
            console.log('[KnowHow bridge] lexical-writer.js loaded, waiting for result event...');
          }
        }, 100);
      };
      script.onerror = function () {
        clearTimeout(timeout);
        console.warn('[KnowHow bridge] lexical-writer.js読み込み失敗。フォールバック実行。');
        tryInsertTextFallback(sections, result);
        script.remove();
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  // ================================================================
  // ヘルパー
  // ================================================================

  function setNativeValue(el, value) {
    var proto = (el.tagName === 'TEXTAREA')
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    var descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }
  }

  function tryInsertTextFallback(sections, result) {
    try {
      var editor = document.querySelector('.ContentEditable__root, [data-lexical-editor]');
      if (editor) {
        var plain = sections.map(function (s) {
          return s.heading + '\n' + s.body;
        }).join('\n\n');
        editor.focus();
        document.execCommand('selectAll');
        document.execCommand('insertText', false, plain);
        result.body = true;
        result.bodyMethod = 'insertText_fallback';
      }
    } catch (e) {
      result.errors.push('body_fallback: ' + e.message);
    }
  }

  // ================================================================
  // カテゴリ注入（モーダルを開いてテキストマッチでクリック）
  // ================================================================

  function injectCategory(categoryName, result) {
    return new Promise(function (resolve) {
      try {
        // モーダルを開く
        var catBtn = document.querySelector('.btn_selectCategory');
        if (!catBtn) {
          result.errors.push('category: .btn_selectCategory が見つかりません');
          resolve();
          return;
        }
        catBtn.click();

        // モーダルが開くまで少し待つ
        setTimeout(function () {
          // サブカテゴリボタンからテキストマッチで探す
          var subCatBtns = document.querySelectorAll('.sub_cat_inner');
          var matched = false;
          for (var i = 0; i < subCatBtns.length; i++) {
            var nameEl = subCatBtns[i].querySelector('.sub_cat_name');
            if (nameEl && nameEl.textContent.trim() === categoryName) {
              subCatBtns[i].click();
              result.category = true;
              matched = true;
              console.log('[KnowHow bridge] カテゴリ選択:', categoryName);
              break;
            }
          }
          if (!matched) {
            // モーダルを閉じる
            var closeBtn = Array.from(document.querySelectorAll('button, a')).find(function (el) {
              return el.textContent.trim() === '閉じる';
            });
            if (closeBtn) closeBtn.click();
            result.errors.push('category: "' + categoryName + '" が見つかりません');
          }
          resolve();
        }, 500);
      } catch (e) {
        result.errors.push('category: ' + e.message);
        resolve();
      }
    });
  }

  // ================================================================
  // タグ注入（input に値セット → Enter keydown で追加）
  // ================================================================

  function injectTags(tags, result) {
    return new Promise(function (resolve) {
      try {
        var tagsToAdd = tags.slice(0, 10);
        var index = 0;

        function addNext() {
          if (index >= tagsToAdd.length) {
            result.tags = true;
            console.log('[KnowHow bridge] タグ追加完了:', tagsToAdd.length + '個');
            resolve();
            return;
          }

          // 毎回入力欄を再取得（React再描画で参照が変わるため）
          var tagInput = document.querySelector('.article_tag_inputArea input[placeholder="タグを追加してください"]');
          if (!tagInput) {
            result.errors.push('tags: タグ入力欄が見つかりません（' + index + '個目で停止）');
            resolve();
            return;
          }

          tagInput.focus();
          setNativeValue(tagInput, tagsToAdd[index]);
          tagInput.dispatchEvent(new Event('input', { bubbles: true }));

          // input反映を待ってからEnterを送る
          setTimeout(function () {
            tagInput.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
            }));
            index++;
            // React再描画を待つため少し長めに間隔を空ける
            setTimeout(addNext, 300);
          }, 50);
        }

        addNext();
      } catch (e) {
        result.errors.push('tags: ' + e.message);
        resolve();
      }
    });
  }

  // ================================================================
  // サムネイル
  // ================================================================

  function injectThumbnail(thumbnailData, sections) {
    // thumbnail専用フィールドを優先、なければsections[0].imageにフォールバック
    var imgData = thumbnailData || null;
    if (!imgData) {
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].image) { imgData = sections[i].image; break; }
      }
    }
    if (!imgData) return Promise.resolve(false);

    return fetch(imgData)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP error status: ' + res.status);
        return res.blob();
      })
      .then(function (blob) {
        var file = new File([blob], 'thumbnail.jpg', {
          type: blob.type || 'image/jpeg',
          lastModified: Date.now()
        });

        if (tryFileInput(file)) return true;
        if (tryDropZone(file)) return true;
        if (tryBase64Input(imgData)) return true;

        console.warn('[KnowHow bridge] サムネイル: 全方法失敗');
        return false;
      })
      .catch(function (e) {
        console.warn('[KnowHow bridge] サムネイル変換失敗:', e);
        return false;
      });
  }

  function tryFileInput(file) {
    var selectors = [
      '#fileInput',
      'input[type="file"]',
      '.js_dragDropFileInput input[type="file"]',
      '[name="thumbnail"] input[type="file"]',
      '[class*="thumbnail"] input[type="file"]'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var input = document.querySelector(selectors[i]);
      if (input && input.type === 'file') {
        try {
          var dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('input', { bubbles: true }));
          console.log('[KnowHow bridge] サムネイル: file input OK (' + selectors[i] + ')');
          return true;
        } catch (e) {
          console.warn('[KnowHow bridge] file input失敗:', e);
        }
      }
    }
    return false;
  }

  function tryDropZone(file) {
    var selectors = [
      '.js_dragDropFileInput',
      '[class*="dropzone"]',
      '[class*="drop-zone"]',
      '[class*="upload-area"]'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var zone = document.querySelector(selectors[i]);
      if (zone) {
        try {
          var dt = new DataTransfer();
          dt.items.add(file);
          zone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: dt }));
          zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
          zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
          console.log('[KnowHow bridge] サムネイル: drop event OK (' + selectors[i] + ')');
          return true;
        } catch (e) {
          console.warn('[KnowHow bridge] drop失敗:', e);
        }
      }
    }
    return false;
  }

  function tryBase64Input(dataUrl) {
    var input = document.querySelector('input[name="base64_thumbnail"]');
    if (input) {
      try {
        setNativeValue(input, dataUrl);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('[KnowHow bridge] サムネイル: base64 input OK');
        return true;
      } catch (e) {
        console.warn('[KnowHow bridge] base64失敗:', e);
      }
    }
    return false;
  }
})();
