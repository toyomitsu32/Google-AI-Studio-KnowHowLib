// background.js — Service Worker

// 拡張アイコンクリック → article-importer.html を開く
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL('article-importer.html') });
});

// 図書館ページを開いて、読み込み完了後に自動で流し込む
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPEN_AND_INJECT') {
        openAndInject(message.data);
        sendResponse({ ok: true });
    }
    return true; // keep channel open for async
});

async function openAndInject(articleData) {
    try {
        // 1. 新タブで図書館の新規記事ページを開く
        const tab = await chrome.tabs.create({
            url: 'https://library.libecity.com/articles/new'
        });

        // 2. ページの読み込み完了を待つ
        await waitForTabLoad(tab.id);

        // 3. さらにReactアプリの描画を待つため少し待機
        await sleep(2000);

        // 4. library-bridge.js に注入データを送信
        const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'INJECT',
            data: articleData
        });

        if (response && response.ok) {
            console.log('[background] 自動流し込み成功:', response.result || response);
        } else {
            console.error('[background] 流し込み失敗:', response);
        }
    } catch (e) {
        console.error('[background] openAndInject エラー:', e);
    }
}

function waitForTabLoad(tabId, timeoutMs = 15000) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            console.warn('[background] waitForTabLoad timeout after', timeoutMs, 'ms');
            resolve(); // タイムアウトしても処理を続行
        }, timeoutMs);

        function listener(id, changeInfo) {
            if (id === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                clearTimeout(timer);
                resolve();
            }
        }
        chrome.tabs.onUpdated.addListener(listener);
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
