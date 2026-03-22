import React, { useState, useCallback, useMemo } from 'react';
import { ArticleOutline } from '../types';
import {
  CopyIcon,
  CheckIcon,
  ChevronLeftIcon,
  RefreshIcon,
  ImageIcon,
  FileTextIcon,
  DownloadIcon,
} from './icons';

const STYLE_CATEGORIES = [
  {
    label: 'リアル・写真系',
    styles: [
      { id: 'photo-flat', label: '実写風（フラット）' },
      { id: 'office-business', label: 'オフィス・ビジネス系' },
      { id: 'lifestyle', label: 'ライフスタイル系' },
    ],
  },
  {
    label: 'イラスト・ベクター系',
    styles: [
      { id: 'flat-illustration', label: 'フラットイラスト' },
      { id: 'yuru-pop', label: 'ゆるキャラ・ポップ' },
      { id: 'pilot-vector', label: 'パイロット（ベクター）' },
      { id: 'watercolor', label: '水彩・アナログ風' },
    ],
  },
  {
    label: 'テキスト強調系',
    styles: [
      { id: 'youtube-thumb', label: 'YouTubeサムネ風' },
      { id: 'chalkboard', label: '黒板チョーク風' },
      { id: 'magazine', label: '雑誌レイアウト風' },
      { id: 'manga-bubble', label: '吹き出し・マンガ風' },
    ],
  },
  {
    label: 'ミニマル・アイコン系',
    styles: [
      { id: 'minimal-icon', label: 'ミニマルアイコン' },
      { id: 'infographic', label: 'インフォグラフィック風' },
      { id: 'gradient-bg', label: 'グラデーション背景' },
    ],
  },
  {
    label: '参照系',
    styles: [
      { id: 'reference', label: '既存デザイン参照' },
    ],
  },
];

interface ImagePromptStepProps {
  outline: ArticleOutline | null;
  onBack: () => void;
  onNext: () => void;
  onRestart: () => void;
}

function getStyleLabel(styleId: string): string {
  for (const cat of STYLE_CATEGORIES) {
    const found = cat.styles.find((s) => s.id === styleId);
    if (found) return found.label;
  }
  return styleId;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

export default function ImagePromptStep({
  outline,
  onBack,
  onNext,
  onRestart,
}: ImagePromptStepProps) {
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [sourceText, setSourceText] = useState<string>('');
  const [slidePrompt, setSlidePrompt] = useState<string>('');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [hasIconCharacter, setHasIconCharacter] = useState<boolean>(false);

  /** 見出し + その下の本文をセクション単位で抽出 */
  const sections = useMemo(() => {
    if (!outline) return [];
    const lines = outline.bodyMarkdown.split('\n');
    const result: { heading: string; content: string }[] = [];
    let currentHeading = '';
    let currentLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (currentHeading) {
          result.push({ heading: currentHeading, content: currentLines.join('\n').trim() });
        }
        currentHeading = line.slice(3).trim();
        currentLines = [];
      } else if (currentHeading) {
        currentLines.push(line);
      }
    }
    if (currentHeading) {
      result.push({ heading: currentHeading, content: currentLines.join('\n').trim() });
    }
    return result;
  }, [outline]);

  const buildPrompt = useCallback(() => {
    if (!outline || !selectedStyle) return;

    const isReference = selectedStyle === 'reference';
    const styleLabel = getStyleLabel(selectedStyle);

    // --- ソース用: 記事本文 ---
    const source = `${outline.title}

${outline.summary}

${outline.bodyMarkdown}`;

    // --- カスタマイズ用: スライド指示 ---
    const styleInstruction = isReference
      ? `アップロード済みの参照画像のトーン・配色・レイアウトの雰囲気を踏襲し、スライド全体で統一感を持たせてください。`
      : `「${styleLabel}」テイストで統一してください。`;

    const slideSections = sections
      .map((sec, i) => {
        // 本文からH3を除去し、テキストだけを抽出
        const plainContent = sec.content
          .replace(/^### .+$/gm, '')
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/^\s*[-*] /gm, '')
          .replace(/\n{2,}/g, '\n')
          .trim();
        // 要点だけ短く切り出し（アイキャッチなので詰め込まない）
        const summary = plainContent.length > 80
          ? plainContent.slice(0, 80) + '…'
          : plainContent;
        return `${i + 2}枚目：「${sec.heading}」
  テーマ: ${summary}
  → 見出しテキストを大きく配置し、内容を象徴するビジュアルを添える程度にすること`;
      })
      .join('\n\n');

    const iconInstruction = hasIconCharacter
      ? `\n■ アイコンキャラクター指定
ソースに添付されたアイコンキャラクター画像を確認し、
そのキャラクターをスライド内で一貫して使用してください。
- サムネイル（1枚目）には必ずキャラクターを登場させること
- 各スライドにも適宜キャラクターを配置し、記事の案内役として活用すること
- キャラクターのデザイン・色合い・タッチを忠実に再現すること
`
      : '';

    const prompt = `以下の指示に従ってスライド資料を作成してください。
各スライドはブログ記事の「アイキャッチ画像」として使用します。
本文の要約や箇条書きは入れず、見出しとビジュアルだけで印象を伝える
シンプルなデザインにしてください。

■ デザイン指定
${styleInstruction}
- 画像サイズは 横1600px × 縦900px（アスペクト比 16:9）とすること
- 配色・フォント・装飾はスライド全体で統一すること
- テキストは大きめに、余白を十分に取ること
- 背景はシンプルにし、テキストの可読性を優先すること
${iconInstruction}

■ スライド構成（全${sections.length + 2}枚）

1枚目（サムネイル）：
  記事タイトル「${outline.title}」を大きく配置
  読者の目を引くキャッチーなデザインにすること

${slideSections}

${sections.length + 2}枚目（締めくくり）：
  「この記事が参考になったら、いいね・レビューで応援お願いします」
  温かみのある締めくくりデザインにすること`;

    setSourceText(source);
    setSlidePrompt(prompt);
  }, [outline, selectedStyle, sections, hasIconCharacter]);

  const handleCopy = useCallback(async (text: string, sectionId: string) => {
    await copyText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  }, []);

  if (!outline) return null;

  const isGenerated = !!sourceText;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <span className="font-bold tracking-widest text-xs uppercase" style={{ color: '#944a00' }}>Step 05</span>
        <h2 className="font-serif text-3xl md:text-4xl leading-tight mt-2 mb-3" style={{ color: '#1b1c1c' }}>挿絵</h2>
        <p style={{ color: '#564337' }} className="text-sm">NotebookLMでスライド資料を生成し、記事の挿絵を作成します。</p>
      </div>

      {/* How to use guide */}
      <div className="mb-6 bg-white rounded-xl p-4" style={{ border: '1px solid #e7e5e4' }}>
        <p className="text-xs font-semibold text-stone-500 mb-2">使い方</p>
        <ol className="text-sm text-stone-600 space-y-1.5 list-decimal list-inside">
          <li>下のスタイルを選択し、アイコン画像を使う場合はチェックを入れる</li>
          <li>「プロンプトを生成する」をクリック</li>
          <li><span className="font-semibold text-stone-700">記事本文</span>をコピー → NotebookLMの<span className="font-semibold text-stone-700">ソース</span>に貼り付け</li>
          <li>アイコン画像がある場合、<span className="font-semibold text-stone-700">同じソースにアイコン画像もアップロード</span></li>
          <li><span className="font-semibold text-stone-700">スライド指示</span>をコピー → <span className="font-semibold text-stone-700">Studio → スライド資料 → カスタマイズ</span>欄に貼り付け</li>
          <li>スライド資料を生成し、<span className="font-semibold text-stone-700">PDFでダウンロード</span></li>
          <li>iLovePDFでPDFを<span className="font-semibold text-stone-700">1枚ずつ画像に変換</span>して記事に挿入</li>
        </ol>
      </div>

      {/* Style Selection */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon size={20} className="text-amber-600" />
          <h3 className="text-lg font-bold" style={{ color: '#1b1c1c' }}>スライドのデザインスタイルを選択</h3>
        </div>

        <div className="space-y-4">
          {STYLE_CATEGORIES.map((cat) => (
            <div key={cat.label} className="bg-white rounded-xl border border-stone-200 p-4">
              <p className="text-xs font-semibold text-stone-500 mb-2.5">{cat.label}</p>
              <div className="flex flex-wrap gap-2">
                {cat.styles.map((style) => {
                  const isSelected = selectedStyle === style.id;
                  return (
                    <button
                      key={style.id}
                      onClick={() => {
                        setSelectedStyle(isSelected ? '' : style.id);
                        setSourceText('');
                        setSlidePrompt('');
                      }}
                      className={`text-sm px-3.5 py-2 rounded-full border-2 transition-all font-medium ${isSelected
                          ? 'font-semibold'
                          : 'border-stone-200 text-stone-600 hover:border-amber-200 hover:bg-stone-50'
                        }`}
                      style={isSelected ? { borderColor: '#e67e22', background: '#fff8f0', color: '#944a00' } : {}}
                    >
                      {style.label}
                    </button>
                  );
                })}
              </div>
              {/* Reference annotation */}
              {cat.label === '参照系' && selectedStyle === 'reference' && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-700">
                    参照画像はNotebookLMのソースに直接アップロードしてください。アップした画像のトーン・配色・デザインが踏襲されます。
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Icon Character Option */}
      <div className="mb-6">
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hasIconCharacter}
              onChange={(e) => {
                setHasIconCharacter(e.target.checked);
                setSourceText('');
                setSlidePrompt('');
              }}
              className="mt-0.5 w-4 h-4 accent-amber-500 rounded"
            />
            <div>
              <p className="text-sm font-semibold text-stone-700">アイコンキャラクター画像を使用する</p>
              <p className="text-xs text-stone-500 mt-1">
                NotebookLMのソースにアイコン画像をアップロードすると、そのキャラクターがスライド全体で案内役として登場します。
              </p>
            </div>
          </label>
          {hasIconCharacter && (
            <div className="mt-3 ml-7 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700">
                記事本文と一緒に、アイコンキャラクター画像をNotebookLMのソースにアップロードしてください。プロンプトにキャラクター採用の指示が自動で含まれます。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Generate Button */}
      <div className="mb-6 text-center">
        <button
          onClick={buildPrompt}
          disabled={!selectedStyle}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          style={{ background: '#e67e22', color: '#502600', boxShadow: '0 10px 30px -8px rgba(148,74,0,0.15)' }}
        >
          <ImageIcon size={18} />
          プロンプトを生成する
        </button>
      </div>

      {/* Generated Outputs */}
      {isGenerated && (
        <div className="space-y-8 mb-8">
          {/* 1. Source: Article body */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileTextIcon size={18} className="text-teal-600" />
                <h3 className="text-lg font-bold" style={{ color: '#1b1c1c' }}>1. 記事本文（ソース用）</h3>
              </div>
              <button
                onClick={() => handleCopy(sourceText, 'source')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors"
              >
                {copiedSection === 'source' ? (
                  <><CheckIcon className="text-teal-500" size={14} />コピー済み</>
                ) : (
                  <><CopyIcon size={14} />コピー</>
                )}
              </button>
            </div>
            <div className="bg-white rounded-xl border border-stone-200">
              <pre className="p-5 text-sm text-stone-700 leading-relaxed whitespace-pre-wrap font-mono overflow-auto max-h-[400px] scrollbar-thin">
                {sourceText}
              </pre>
            </div>
            <p className="text-xs text-stone-400 mt-2">
              コピーして NotebookLM のソースに貼り付けてください。
            </p>
            {hasIconCharacter && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <span className="text-amber-500 text-base leading-none mt-0.5">🎨</span>
                <p className="text-xs text-amber-700">
                  記事本文に加えて、<span className="font-semibold">アイコンキャラクター画像</span>もNotebookLMのソースにアップロードしてください。スライド指示にキャラクター採用の指示が含まれています。
                </p>
              </div>
            )}
          </div>

          {/* 2. Slide customization prompt */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ImageIcon size={18} className="text-amber-600" />
                <h3 className="text-lg font-bold" style={{ color: '#1b1c1c' }}>2. スライド指示（カスタマイズ用）</h3>
              </div>
              <button
                onClick={() => handleCopy(slidePrompt, 'slide')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors"
              >
                {copiedSection === 'slide' ? (
                  <><CheckIcon className="text-teal-500" size={14} />コピー済み</>
                ) : (
                  <><CopyIcon size={14} />コピー</>
                )}
              </button>
            </div>
            <div className="bg-white rounded-xl border border-stone-200">
              <pre className="p-5 text-sm text-stone-700 leading-relaxed whitespace-pre-wrap font-mono overflow-auto max-h-[400px] scrollbar-thin">
                {slidePrompt}
              </pre>
            </div>
            <p className="text-xs text-stone-400 mt-2">
              コピーして NotebookLM → Studio → スライド資料 → カスタマイズ欄 に貼り付けてください。
            </p>
          </div>

          {/* 3. PDF to image conversion */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <DownloadIcon size={18} className="text-violet-600" />
              <h3 className="text-lg font-bold" style={{ color: '#1b1c1c' }}>3. PDFを画像に変換</h3>
            </div>
            <ol className="text-sm text-stone-600 space-y-2 list-decimal list-inside mb-4">
              <li>NotebookLMでスライド資料を生成し、<span className="font-semibold text-stone-700">PDFでダウンロード</span></li>
              <li>下のボタンからiLovePDFを開き、PDFをアップロードして<span className="font-semibold text-stone-700">1ページずつ画像に変換</span></li>
              <li>変換後、<span className="font-semibold text-stone-700">ZIPファイル</span>がダウンロードされるので<span className="font-semibold text-stone-700">解凍</span>しておく</li>
            </ol>
            <p className="text-xs text-stone-400 mb-4">
              ※ 解凍したフォルダを次のステップ（入稿）で画像フォルダとして選択します。
            </p>
            <a
              href="https://www.ilovepdf.com/ja/pdf_to_jpg"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm bg-violet-500 text-white font-semibold rounded-lg hover:bg-violet-600 transition-colors"
            >
              <ImageIcon size={16} />
              iLovePDF でPDFを画像に変換
            </a>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-stone-200">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm hover:text-stone-800 transition-colors"
          style={{ color: '#564337' }}
        >
          <ChevronLeftIcon size={16} />
          記事構成に戻る
        </button>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold rounded-full transition-colors"
          style={{ background: '#e67e22', color: '#502600' }}
        >
          入稿へ →
        </button>
      </div>
    </div>
  );
}
