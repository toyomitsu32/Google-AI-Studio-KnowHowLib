// Constants
const CATEGORIES = {
    "貯める": ["家計管理の準備","パソコン・スマホ","銀行・証券","キャッシュレス","通信費","食費","保険","税金","ローン","車","その他支出の見直し","引っ越し・賃貸","価値観マップ","ライフプラン","簿記・FP","公的制度の活用","その他貯める力"],
    "増やす": ["投資の基礎","インデックス投資","高配当株投資","その他株式投資","その他増やす力"],
    "稼ぐ": ["ITリテラシー","人に会う・オフ会","転職","ブログ・アフィリエイト","Webライティング","プログラミング","Web制作","デザイン","イラスト・漫画","動画編集","YouTube配信","ライバー","SNS","ハンドメイド","せどり・その他物販","コンテンツ販売","コンサルティング","不動産賃貸業","民泊","オンライン秘書","LINE構築","マーケティング","副業全般","その他稼ぐ力"],
    "使う": ["自己投資","時間を買う","健康への投資","豊かな浪費","寄付・プレゼント","その他使う力"],
    "守る": ["詐欺・ぼったくり","事故・病気","被災・盗難","インフレ","相続","セキュリティ","その他守る力"]
};

// State
let state = {
    currentStep: 1,
    inputMode: 'md', // 'md' or 'json'
    mdContent: null,
    title: '',
    summary: '',
    sections: [],
    mainCategory: '',
    subCategory: '',
    tags: [],
    images: [],
    imageSlots: [],
    thumbnail: null // base64 data for thumbnail image
};

// Initialize
function init() {
    try {
        setupCategoryDropdowns();
        setupEventListeners();
        // デフォルトでJSONクリップボードモードを表示
        switchInputMode('json');
        console.log('[article-importer] init完了: イベントリスナー登録済み');
    } catch (e) {
        console.error('[article-importer] init失敗:', e);
    }
}

// Category Setup
function setupCategoryDropdowns() {
    const mainSelect = document.getElementById('mainCategory');
    Object.keys(CATEGORIES).forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        mainSelect.appendChild(option);
    });
}

// Event Listeners
function setupEventListeners() {
    // Mode tabs
    document.getElementById('modeTabMd').addEventListener('click', () => switchInputMode('md'));
    document.getElementById('modeTabJson').addEventListener('click', () => switchInputMode('json'));

    // JSON clipboard read
    document.getElementById('btnReadClipboard').addEventListener('click', handleClipboardJson);

    // File input
    document.getElementById('mdFileInput').addEventListener('change', handleMdFileSelect);
    document.getElementById('dropZone').addEventListener('click', () => document.getElementById('mdFileInput').click());
    document.getElementById('dropZone').addEventListener('dragover', (e) => {
        e.preventDefault();
        document.getElementById('dropZone').classList.add('dragover');
    });
    document.getElementById('dropZone').addEventListener('dragleave', () => {
        document.getElementById('dropZone').classList.remove('dragover');
    });
    document.getElementById('dropZone').addEventListener('drop', (e) => {
        e.preventDefault();
        document.getElementById('dropZone').classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = Array.from(files).find(f => f.name.endsWith('.md'));
            if (file) {
                readMdFile(file);
            }
        }
    });

    // Step navigation
    document.getElementById('step1Next').addEventListener('click', () => goToStep(2));
    document.getElementById('step2Back').addEventListener('click', () => goToStep(1));
    document.getElementById('step2Next').addEventListener('click', () => goToStep(3));
    document.getElementById('step3Back').addEventListener('click', () => goToStep(2));
    document.getElementById('step3Skip').addEventListener('click', () => goToStep(4));
    document.getElementById('step3Next').addEventListener('click', () => goToStep(4));
    document.getElementById('step4Back').addEventListener('click', () => goToStep(3));
    document.getElementById('step4Submit').addEventListener('click', submitArticle);

    // Title input
    document.getElementById('titleInput').addEventListener('input', (e) => {
        state.title = e.target.value;
        updateCharCount('title');
    });

    // Summary input
    document.getElementById('summaryInput').addEventListener('input', (e) => {
        state.summary = e.target.value;
        updateCharCount('summary');
    });

    // Category dropdowns
    document.getElementById('mainCategory').addEventListener('change', (e) => {
        state.mainCategory = e.target.value;
        updateSubCategories();
    });

    document.getElementById('subCategory').addEventListener('change', (e) => {
        state.subCategory = e.target.value;
    });

    // Tags input
    document.getElementById('tagsInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag(e.target.value);
            e.target.value = '';
        }
    });

    // Image input
    document.getElementById('imageInput').addEventListener('change', handleImageSelect);
    document.getElementById('imageDrop').addEventListener('click', () => document.getElementById('imageInput').click());
    document.getElementById('imageDrop').addEventListener('dragover', (e) => {
        e.preventDefault();
        document.getElementById('imageDrop').classList.add('dragover');
    });
    document.getElementById('imageDrop').addEventListener('dragleave', () => {
        document.getElementById('imageDrop').classList.remove('dragover');
    });
    document.getElementById('imageDrop').addEventListener('drop', (e) => {
        e.preventDefault();
        document.getElementById('imageDrop').classList.remove('dragover');
        const files = e.dataTransfer.items;
        if (files && files.length > 0) {
            processImageFiles(Array.from(files).map(item => item.getAsFile()).filter(f => f));
        }
    });

}

// Mode Switch
function switchInputMode(mode) {
    state.inputMode = mode;
    document.getElementById('modeMdArea').style.display = mode === 'md' ? 'block' : 'none';
    document.getElementById('modeJsonArea').style.display = mode === 'json' ? 'block' : 'none';
    document.getElementById('modeTabMd').className = mode === 'md' ? 'btn btn-primary' : 'btn btn-secondary';
    document.getElementById('modeTabJson').className = mode === 'json' ? 'btn btn-primary' : 'btn btn-secondary';
}

// JSON Clipboard Handling (Mode A)
async function handleClipboardJson() {
    const errEl = document.getElementById('jsonReadError');
    errEl.style.display = 'none';

    try {
        const text = await navigator.clipboard.readText();
        const data = JSON.parse(text);

        if (!data.title || !data.sections || !Array.isArray(data.sections)) {
            throw new Error('JSON形式が正しくありません（title, sections が必要です）');
        }

        // Populate state from JSON
        state.title = data.title || '';
        state.summary = (data.summary || '').slice(0, 140);
        state.sections = data.sections.map(s => ({
            heading: s.heading || '',
            body: s.body || ''
        }));

        // Category
        if (data.category) {
            // Handle "稼ぐ > Webライティング" format
            const catName = data.category.includes('>')
                ? data.category.split('>').pop().trim()
                : data.category.trim();
            selectCategoryByName(catName);
        }

        // Tags
        state.tags = [];
        if (data.tags && Array.isArray(data.tags)) {
            data.tags.slice(0, 10).forEach(tag => addTag(tag));
        }

        // For Mode A (interviewer), create one image slot per section
        // (eyecatch at top of section, afterParagraph: 0)
        state.imageSlots = [];
        state.sections.forEach((sec, sIdx) => {
            state.imageSlots.push({
                sectionIdx: sIdx,
                afterParagraph: 0,
                label: sec.heading,
                data: null
            });
        });

        // Update UI
        document.getElementById('titleInput').value = state.title;
        document.getElementById('summaryInput').value = state.summary;
        updateCharCount('title');
        updateCharCount('summary');

        // Show preview
        const parsedTitle = document.getElementById('parsedTitle');
        const parsedSummary = document.getElementById('parsedSummary');
        const sectionCount = document.getElementById('sectionCount');
        const headingsDiv = document.getElementById('sectionHeadings');
        const step1Preview = document.getElementById('step1Preview');
        const step1Next = document.getElementById('step1Next');

        if (parsedTitle) parsedTitle.textContent = state.title;
        if (parsedSummary) parsedSummary.textContent = state.summary || '（未設定）';
        if (sectionCount) sectionCount.textContent = state.sections.length;
        if (headingsDiv) {
            headingsDiv.innerHTML = '';
            state.sections.forEach((sec, idx) => {
                const div = document.createElement('div');
                div.className = 'preview-item';
                div.style.fontSize = '12px';
                div.textContent = (idx + 1) + '. ' + sec.heading;
                headingsDiv.appendChild(div);
            });
        }
        if (step1Preview) step1Preview.style.display = 'block';
        if (step1Next) step1Next.style.display = 'block';

    } catch (e) {
        errEl.textContent = e.message === 'Unexpected token'
            ? 'クリップボードにJSON形式のデータがありません。インタビュアーで「Chrome拡張にコピー」を実行してください。'
            : e.message;
        errEl.style.display = 'block';
    }
}

// MD File Handling
function handleMdFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        readMdFile(file);
    }
}

function readMdFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        parseMdContent(e.target.result);
    };
    reader.onerror = () => {
        console.error('[article-importer] FileReader error:', reader.error);
        alert('ファイルの読み込みに失敗しました');
    };
    reader.readAsText(file);
}

function parseMdContent(content) {
    const lines = content.split('\n');
    let titleLine = '';
    let categoryText = '';
    let summaryText = '';
    let tagsText = '';
    let sections = [];
    let currentSection = null;
    let inHeader = true;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('# ') && !line.startsWith('## ') && !titleLine) {
            titleLine = line.replace(/^#\s+/, '').trim();
            continue;
        }

        if (line.startsWith('## ')) {
            inHeader = false;
            if (currentSection) {
                currentSection.body = currentSection.body.trim();
                sections.push(currentSection);
            }
            currentSection = {
                heading: line.replace(/^##\s+/, '').trim(),
                body: ''
            };
            continue;
        }

        if (inHeader && titleLine) {
            const trimmed = line.trim();
            if (/^カテゴリ[:：]\s*/.test(trimmed)) {
                categoryText = trimmed.replace(/^カテゴリ[:：]\s*/, '').trim();
                continue;
            }
            if (/^要約[:：]\s*/.test(trimmed)) {
                summaryText = trimmed.replace(/^要約[:：]\s*/, '').trim();
                continue;
            }
            if (/^タグ[:：]\s*/.test(trimmed)) {
                tagsText = trimmed.replace(/^タグ[:：]\s*/, '').trim();
                continue;
            }
            continue;
        }

        if (currentSection) {
            const imageTrimmed = line.trim();
            if (/^\{\{image(?::([^}]*))?\}\}$/.test(imageTrimmed)) {
                if (!currentSection.imageMarkers) {
                    currentSection.imageMarkers = [];
                }
                const match = imageTrimmed.match(/^\{\{image(?::([^}]*))?\}\}$/);
                const label = match[1] ? match[1].trim() : '';
                currentSection.imageMarkers.push({ label });
                currentSection.body += '\n___IMAGE_MARKER___\n';
            } else {
                currentSection.body += line + '\n';
            }
        }
    }

    if (currentSection) {
        currentSection.body = currentSection.body.trim();
        sections.push(currentSection);
    }

    // Process image markers and convert to imageSlots
    state.imageSlots = [];
    sections.forEach((sec, sIdx) => {
        if (sec.imageMarkers && sec.imageMarkers.length > 0) {
            const paragraphs = sec.body.split(/\n\s*\n/).filter(p => p.trim());
            let slotIndex = 0;
            let newBody = '';
            let realParaIdx = -1;

            for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
                const para = paragraphs[pIdx];
                if (para.includes('___IMAGE_MARKER___')) {
                    if (sec.imageMarkers[slotIndex]) {
                        const label = sec.imageMarkers[slotIndex].label || '';
                        state.imageSlots.push({
                            sectionIdx: sIdx,
                            afterParagraph: Math.max(0, realParaIdx),
                            label: label,
                            data: null
                        });
                        slotIndex++;
                    }
                } else {
                    newBody += para + '\n\n';
                    realParaIdx++;
                }
            }
            sec.body = newBody.trim();
        }
        delete sec.imageMarkers;
    });

    let parsedTags = [];
    if (tagsText) {
        parsedTags = tagsText.split(/[,、]\s*/).map(t => t.trim()).filter(t => t);
    }

    state.title = titleLine;
    state.summary = summaryText.substring(0, 140);
    state.sections = sections;

    if (categoryText) {
        selectCategoryByName(categoryText);
    }

    if (parsedTags.length > 0) {
        parsedTags.slice(0, 10).forEach(tag => addTag(tag));
    }

    const titleInput = document.getElementById('titleInput');
    const summaryInput = document.getElementById('summaryInput');
    if (titleInput) titleInput.value = state.title;
    if (summaryInput) summaryInput.value = state.summary;
    updateCharCount('title');
    updateCharCount('summary');

    const parsedTitle2 = document.getElementById('parsedTitle');
    const parsedSummary2 = document.getElementById('parsedSummary');
    const sectionCount2 = document.getElementById('sectionCount');
    const headingsDiv2 = document.getElementById('sectionHeadings');
    const step1Preview2 = document.getElementById('step1Preview');
    const step1Next2 = document.getElementById('step1Next');

    if (parsedTitle2) parsedTitle2.textContent = state.title;
    if (parsedSummary2) parsedSummary2.textContent = state.summary || '（未設定）';
    if (sectionCount2) sectionCount2.textContent = sections.length;
    if (headingsDiv2) {
        headingsDiv2.innerHTML = '';
        sections.forEach((sec, idx) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.style.fontSize = '12px';
            div.textContent = (idx + 1) + '. ' + sec.heading;
            headingsDiv2.appendChild(div);
        });
    }
    if (step1Preview2) step1Preview2.style.display = 'block';
    if (step1Next2) step1Next2.style.display = 'block';

}

// カテゴリ名からセレクトUIを自動選択
function selectCategoryByName(name) {
    for (const [mainCat, subCats] of Object.entries(CATEGORIES)) {
        const idx = subCats.indexOf(name);
        if (idx !== -1) {
            const mainSelect = document.getElementById('mainCategory');
            const subSelect = document.getElementById('subCategory');
            mainSelect.value = mainCat;
            mainSelect.dispatchEvent(new Event('change'));
            setTimeout(() => {
                subSelect.value = name;
                subSelect.dispatchEvent(new Event('change'));
            }, 50);
            return true;
        }
    }
    return false;
}

// Character Count
function updateCharCount(field) {
    const input = document.getElementById(field + 'Input');
    const count = document.getElementById(field + 'Count');
    count.textContent = input.value.length;
    if (field === 'summary' && input.value.length > 120) {
        count.parentElement.classList.add('warning');
    } else {
        count.parentElement.classList.remove('warning');
    }
}

// Sub Categories
function updateSubCategories() {
    const mainCat = state.mainCategory;
    const subSelect = document.getElementById('subCategory');
    subSelect.innerHTML = '<option value="">小カテゴリを選択</option>';

    if (mainCat && CATEGORIES[mainCat]) {
        CATEGORIES[mainCat].forEach(sub => {
            const option = document.createElement('option');
            option.value = sub;
            option.textContent = sub;
            subSelect.appendChild(option);
        });
    }

    if (state.subCategory && CATEGORIES[mainCat] && CATEGORIES[mainCat].includes(state.subCategory)) {
        subSelect.value = state.subCategory;
    }
}

// Tags
function addTag(tag) {
    tag = tag.trim();
    if (tag && state.tags.length < 10 && !state.tags.includes(tag)) {
        state.tags.push(tag);
        renderTags();
    }
}

function removeTag(tag) {
    state.tags = state.tags.filter(t => t !== tag);
    renderTags();
}

function renderTags() {
    const container = document.getElementById('tagsList');
    container.innerHTML = '';
    state.tags.forEach(tag => {
        const chip = document.createElement('div');
        chip.className = 'tag-chip';
        chip.innerHTML = tag + ' <button type="button">\u00d7</button>';
        chip.querySelector('button').addEventListener('click', () => removeTag(tag));
        container.appendChild(chip);
    });
    document.getElementById('tagCount').textContent = state.tags.length;
}

// Image Handling
function handleImageSelect(e) {
    const files = Array.from(e.target.files);
    processImageFiles(files);
}

function processImageFiles(files) {
    const imageFiles = files.filter(f =>
        /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name)
    ).sort((a, b) => {
        const aNum = extractLastNumber(a.name);
        const bNum = extractLastNumber(b.name);
        return aNum - bNum;
    });

    state.images = [];

    Promise.all(imageFiles.map((file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve({
                    name: file.name,
                    data: e.target.result
                });
            };
            reader.onerror = () => {
                console.error('[article-importer] FileReader error for', file.name, reader.error);
                resolve({
                    name: file.name,
                    data: null
                });
            };
            reader.readAsDataURL(file);
        });
    })).then((results) => {
        // Sort by filename number to ensure correct order
        // (FileReader.onload is async so push order is not guaranteed)
        state.images = results.sort((a, b) => {
            return extractLastNumber(a.name) - extractLastNumber(b.name);
        });
        autoAssignImages();
        renderImageLayout();
    });
}

function extractLastNumber(filename) {
    const match = filename.match(/(\d+)(?!.*\d)/);
    return match ? parseInt(match[0]) : 0;
}

function autoAssignImages() {
    if (state.inputMode === 'json') {
        // Mode A: 1枚目=サムネイル、2〜N+1枚目=各セクション、残り=最終セクション末尾に追加
        let imgIdx = 0;

        // 1枚目 → サムネイル
        if (imgIdx < state.images.length) {
            state.thumbnail = state.images[imgIdx].data;
            imgIdx++;
        }

        // 2〜N+1枚目 → 各セクションのアイキャッチ
        state.imageSlots.forEach((slot) => {
            if (imgIdx < state.images.length) {
                slot.data = state.images[imgIdx].data;
                imgIdx++;
            }
        });

        // 残りの画像（締めスライド等）→ 最終セクション末尾にスロットを追加して配置
        while (imgIdx < state.images.length && state.sections.length > 0) {
            const lastSIdx = state.sections.length - 1;
            const lastSec = state.sections[lastSIdx];
            const paraCount = lastSec.body.split(/\n\s*\n/).filter(p => p.trim()).length;
            state.imageSlots.push({
                sectionIdx: lastSIdx,
                afterParagraph: Math.max(0, paraCount - 1),
                label: '締め画像',
                data: state.images[imgIdx].data
            });
            imgIdx++;
        }
    } else {
        // Mode B: {{image}} マーカー順に割り当て
        let imgIdx = 0;
        state.imageSlots.forEach((slot) => {
            if (imgIdx < state.images.length) {
                slot.data = state.images[imgIdx].data;
                imgIdx++;
            }
        });
    }
}

function renderImageLayout() {
    const container = document.getElementById('imageLayoutContainer');
    container.style.display = 'block';
    renderArticleStructure();
    renderImagePool();
    document.getElementById('step3Next').style.display = 'block';
}

function renderArticleStructure() {
    const panel = document.getElementById('articleStructure');
    panel.innerHTML = '';

    // Thumbnail slot (always shown at top)
    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'article-section';
    const thumbHeading = document.createElement('div');
    thumbHeading.className = 'section-heading';
    thumbHeading.textContent = '\ud83d\uddbc サムネイル（アイキャッチ）';
    thumbDiv.appendChild(thumbHeading);

    const thumbSlot = document.createElement('div');
    thumbSlot.className = 'image-slot' + (state.thumbnail ? ' filled' : '');
    thumbSlot.dataset.slotType = 'thumbnail';

    if (state.thumbnail) {
        const img = document.createElement('img');
        img.src = state.thumbnail;
        img.className = 'image-slot-thumbnail';
        thumbSlot.appendChild(img);
        const removeBtn = document.createElement('button');
        removeBtn.className = 'image-slot-remove';
        removeBtn.innerHTML = '\u00d7';
        removeBtn.addEventListener('click', (e) => { e.stopPropagation(); state.thumbnail = null; renderImageLayout(); });
        thumbSlot.appendChild(removeBtn);
    } else {
        const text = document.createElement('div');
        text.className = 'image-slot-text';
        text.innerHTML = '[\ud83d\uddbc サムネイル画像]<br>ドラッグして割り当て';
        thumbSlot.appendChild(text);
    }

    thumbSlot.addEventListener('dragover', (e) => { e.preventDefault(); thumbSlot.classList.add('dragover'); });
    thumbSlot.addEventListener('dragleave', () => { thumbSlot.classList.remove('dragover'); });
    thumbSlot.addEventListener('drop', (e) => {
        e.preventDefault();
        thumbSlot.classList.remove('dragover');
        const imageIdx = parseInt(e.dataTransfer.getData('text/plain'));
        if (!isNaN(imageIdx) && imageIdx < state.images.length) {
            state.thumbnail = state.images[imageIdx].data;
            renderImageLayout();
        }
    });
    thumbDiv.appendChild(thumbSlot);
    panel.appendChild(thumbDiv);

    state.sections.forEach((sec, sIdx) => {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'article-section';

        const headingDiv = document.createElement('div');
        headingDiv.className = 'section-heading';
        headingDiv.textContent = '\ud83d\udcdd ' + sec.heading;
        sectionDiv.appendChild(headingDiv);

        const paragraphs = sec.body.split(/\n\s*\n/).filter(p => p.trim());

        paragraphs.forEach((para, pIdx) => {
            const paraDiv = document.createElement('div');
            paraDiv.className = 'section-paragraph';
            const preview = para.substring(0, 80) + (para.length > 80 ? '...' : '');
            paraDiv.textContent = preview;
            sectionDiv.appendChild(paraDiv);

            const slotsHere = state.imageSlots.filter(s => s.sectionIdx === sIdx && s.afterParagraph === pIdx);
            slotsHere.forEach((slot) => {
                const slotDiv = document.createElement('div');
                slotDiv.className = 'image-slot' + (slot.data ? ' filled' : '');
                slotDiv.dataset.slotId = state.imageSlots.indexOf(slot);
                slotDiv.draggable = true;

                if (slot.data) {
                    const img = document.createElement('img');
                    img.src = slot.data;
                    img.className = 'image-slot-thumbnail';
                    slotDiv.appendChild(img);

                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'image-slot-remove';
                    removeBtn.innerHTML = '\u00d7';
                    removeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        removeImageFromSlot(parseInt(slotDiv.dataset.slotId));
                    });
                    slotDiv.appendChild(removeBtn);
                } else {
                    const text = document.createElement('div');
                    text.className = 'image-slot-text';
                    text.innerHTML = slot.label ? '[\ud83d\uddbc ' + slot.label + ']<br>ドラッグして割り当て' : '[\ud83d\uddbc 画像スロット]<br>ドラッグして割り当て';
                    slotDiv.appendChild(text);
                }

                slotDiv.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    slotDiv.classList.add('dragover');
                });
                slotDiv.addEventListener('dragleave', () => {
                    slotDiv.classList.remove('dragover');
                });
                slotDiv.addEventListener('drop', (e) => {
                    e.preventDefault();
                    slotDiv.classList.remove('dragover');
                    const imageIdx = parseInt(e.dataTransfer.getData('text/plain'));
                    if (!isNaN(imageIdx) && imageIdx < state.images.length) {
                        assignImageToSlot(imageIdx, parseInt(slotDiv.dataset.slotId));
                    }
                });

                sectionDiv.appendChild(slotDiv);
            });

            // Add button between paragraphs
            if (pIdx < paragraphs.length - 1) {
                const addBtn = document.createElement('button');
                addBtn.className = 'add-image-button';
                addBtn.textContent = '＋';
                addBtn.type = 'button';
                addBtn.addEventListener('click', () => {
                    addImageSlot(sIdx, pIdx);
                });
                sectionDiv.appendChild(addBtn);
            }
        });

        // Add button at end of section
        const addBtn = document.createElement('button');
        addBtn.className = 'add-image-button';
        addBtn.textContent = '＋';
        addBtn.type = 'button';
        addBtn.addEventListener('click', () => {
            addImageSlot(sIdx, paragraphs.length - 1);
        });
        sectionDiv.appendChild(addBtn);

        panel.appendChild(sectionDiv);
    });
}

function renderImagePool() {
    const pool = document.getElementById('imagePool');
    pool.innerHTML = '';

    state.images.forEach((img, idx) => {
        const div = document.createElement('div');
        div.className = 'pool-image';

        const isUsed = state.imageSlots.some(s => s.data === img.data) || state.thumbnail === img.data;
        if (isUsed) {
            div.classList.add('used');
        }

        const imgTag = document.createElement('img');
        imgTag.src = img.data;
        div.appendChild(imgTag);

        const label = document.createElement('div');
        label.className = 'pool-image-label';
        label.title = img.name;
        label.textContent = img.name.substring(0, 20);
        div.appendChild(label);

        const checkmark = document.createElement('div');
        checkmark.className = 'pool-image-checkmark';
        checkmark.textContent = '\u2713';
        div.appendChild(checkmark);

        div.draggable = true;
        div.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/plain', idx.toString());
        });

        pool.appendChild(div);
    });

    if (state.images.length === 0) {
        const empty = document.createElement('div');
        empty.style.gridColumn = '1 / -1';
        empty.style.textAlign = 'center';
        empty.style.color = '#8b8f99';
        empty.style.padding = '20px';
        empty.textContent = '画像がロードされていません';
        pool.appendChild(empty);
    }
}

function assignImageToSlot(imageIdx, slotId) {
    if (imageIdx >= state.images.length || slotId >= state.imageSlots.length) {
        return;
    }
    state.imageSlots[slotId].data = state.images[imageIdx].data;
    renderImageLayout();
}

function removeImageFromSlot(slotId) {
    if (slotId < state.imageSlots.length) {
        state.imageSlots[slotId].data = null;
        renderImageLayout();
    }
}

function addImageSlot(sectionIdx, afterParagraph) {
    state.imageSlots.push({
        sectionIdx: sectionIdx,
        afterParagraph: afterParagraph,
        label: '',
        data: null,
        userAdded: true
    });
    renderImageLayout();
}

// Step Navigation
function goToStep(step) {
    document.querySelectorAll('.card').forEach(card => card.classList.remove('active'));
    document.querySelector('.card[data-step="' + step + '"]').classList.add('active');

    document.querySelectorAll('.progress-step').forEach(s => {
        const stepNum = parseInt(s.dataset.step);
        s.classList.remove('active', 'completed');
        if (stepNum < step) {
            s.classList.add('completed');
        } else if (stepNum === step) {
            s.classList.add('active');
        }
    });

    state.currentStep = step;

    if (step === 4) {
        document.getElementById('previewTitle').textContent = state.title;
        document.getElementById('previewSummary').textContent = state.summary;
        document.getElementById('previewCategory').textContent = state.subCategory;
        document.getElementById('previewTags').textContent = state.tags.join('、') || 'なし';
        document.getElementById('previewSections').textContent = state.sections.length;
        // ステップ4に来るたびにボタンとメッセージをリセット
        var submitBtn = document.getElementById('step4Submit');
        submitBtn.disabled = false;
        submitBtn.textContent = 'ノウハウ図書館に寄稿する';
        document.getElementById('successMessage').classList.add('hidden');
    }
}

// Submit
async function submitArticle() {
    const json = {
        source: 'external-import',
        version: '1.0',
        title: state.title,
        summary: state.summary,
        category: state.subCategory,
        tags: state.tags,
        thumbnail: state.thumbnail || null,
        sections: state.sections.map((sec, sIdx) => {
            const sectionSlots = state.imageSlots
                .filter(s => s.sectionIdx === sIdx && s.data)
                .map(s => ({afterParagraph: s.afterParagraph, data: s.data}));

            return {
                heading: sec.heading,
                body: sec.body.trim(),
                image: sectionSlots.length > 0 ? sectionSlots[0].data : null,
                inlineImages: sectionSlots
            };
        })
    };

    // ボタンを無効化して処理中表示
    var submitBtn = document.getElementById('step4Submit');
    submitBtn.disabled = true;
    submitBtn.textContent = '図書館を開いて流し込み中…';

    try {
        // バックグラウンドに送信 → 新タブを開いて自動注入
        chrome.runtime.sendMessage({
            type: 'OPEN_AND_INJECT',
            data: json
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('sendMessage error:', chrome.runtime.lastError);
                // フォールバック: クリップボード経由
                fallbackClipboard(json, submitBtn);
                return;
            }
            var msgEl = document.getElementById('successMessage');
            msgEl.textContent = '\u2713 図書館ページを開いて自動流し込みを実行しました！タブを確認してください。';
            msgEl.classList.remove('hidden');
            resetSubmitButton(submitBtn);
        });
    } catch (error) {
        fallbackClipboard(json, submitBtn);
    }
}

// 送信完了後にボタンを再利用可能な状態にリセット
function resetSubmitButton(submitBtn) {
    submitBtn.textContent = '✓ 寄稿完了 — もう一度寄稿する';
    submitBtn.disabled = false;
}

// Fallback: クリップボード経由（Service Worker非稼働時）
async function fallbackClipboard(json, submitBtn) {
    try {
        await navigator.clipboard.writeText(JSON.stringify(json));
        var msgEl = document.getElementById('successMessage');
        msgEl.textContent = '\u2713 クリップボードにコピーしました！新タブで拡張アイコン → 「流し込む」を実行してください。';
        msgEl.classList.remove('hidden');
        resetSubmitButton(submitBtn);
        setTimeout(function() {
            window.open('https://library.libecity.com/articles/new', '_blank');
        }, 500);
    } catch (e) {
        alert('コピーに失敗しました: ' + e.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'ノウハウ図書館に寄稿する';
    }
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
