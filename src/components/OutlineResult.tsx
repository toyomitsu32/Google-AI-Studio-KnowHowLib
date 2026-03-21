import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  ArticleOutline,
  UserProfile,
  ProfileAnalysis,
  ArticleTheme,
  ArticleDirection,
  KeyPoint,
} from '../types';
import {
  CopyIcon,
  DownloadIcon,
  CheckIcon,
  ChevronLeftIcon,
  ArrowRightIcon,
  ImageIcon,
} from './icons';
import { validateArticleStructure } from '../utils/articleValidation';

interface OutlineResultProps {
  outline: ArticleOutline | null;
  profile: UserProfile;
  analysis: ProfileAnalysis | null;
  selectedTheme: ArticleTheme | null;
  direction: ArticleDirection;
  keyPoints: KeyPoint[];
  onBack: () => void;
  onNext: () => void;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineFormat(s: string, styled: boolean): string {
  let out = escHtml(s);
  if (styled) {
    out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
      '<img src="$2" alt="$1" class="rounded-lg my-2 max-w-full" />');
  } else {
    // Strip images for clipboard (keep alt text only)
    out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1');
  }
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    styled ? '<a href="$2" style="color:#944a00" class="underline" target="_blank" rel="noopener">$1</a>' : '<a href="$2">$1</a>');
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return out;
}

/** Markdown → HTML (styled=true for preview with Tailwind, false for clean clipboard HTML) */
function renderMarkdown(md: string, styled = true): string {
  return md
    .split('\n')
    .map((line) => {
      if (line.startsWith('### ')) return styled
        ? `<h3 class="text-base font-bold mt-6 mb-2" style="color:#1b1c1c">${escHtml(line.slice(4))}</h3>`
        : `<h3>${escHtml(line.slice(4))}</h3>`;
      if (line.startsWith('## ')) return styled
        ? `<h2 class="font-serif text-lg font-bold mt-8 mb-3" style="color:#1b1c1c">${escHtml(line.slice(3))}</h2>`
        : `<h2>${escHtml(line.slice(3))}</h2>`;
      if (line.trim() === '') return styled ? '<div class="h-2"></div>' : '<br>';
      return styled
        ? `<p class="text-sm text-stone-700 leading-relaxed my-1">${inlineFormat(line, styled)}</p>`
        : `<p>${inlineFormat(line, styled)}</p>`;
    })
    .join('\n');
}

/** Copy both rich text (HTML) and plain text to clipboard */
async function copyRichText(html: string, plainText: string): Promise<void> {
  try {
    const htmlBlob = new Blob([html], { type: 'text/html' });
    const textBlob = new Blob([plainText], { type: 'text/plain' });
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob,
      }),
    ]);
  } catch {
    // Fallback: plain text only
    await navigator.clipboard.writeText(plainText);
  }
}

export default function OutlineResult({
  outline,
  profile,
  analysis,
  selectedTheme,
  direction,
  keyPoints,
  onBack,
  onNext,
}: OutlineResultProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'markdown'>('preview');

  const copyPlain = useCallback(async (text: string, sectionId: string) => {
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
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  }, []);

  const copyAsRich = useCallback(async (markdown: string, sectionId: string) => {
    const html = renderMarkdown(markdown, false);
    // Strip markdown markers for the plain text fallback
    const plain = markdown
      .replace(/^###\s+/gm, '')
      .replace(/^##\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    await copyRichText(html, plain);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  }, []);

  const fullMarkdown = useMemo(() => {
    if (!outline) return '';
    let md = `# ${outline.title}\n\n`;
    md += `**カテゴリ:** ${outline.category}\n\n`;
    md += `**要約:** ${outline.summary}\n\n`;
    md += `**タグ:** ${outline.tags.join(' / ')}\n\n---\n\n`;
    md += outline.bodyMarkdown;
    return md;
  }, [outline]);

  // Memoize expensive markdown rendering
  const bodyHtml = useMemo(() => {
    if (!outline) return '';
    return renderMarkdown(outline.bodyMarkdown);
  }, [outline?.bodyMarkdown]);

  const handleDownloadJSON = useCallback(() => {
    if (!outline) return;
    const selectedKeyPoints = keyPoints.filter((p) => p.selected);
    const data = {
      outline,
      metadata: {
        profile,
        analysis,
        theme: selectedTheme,
        direction,
        keyPoints: selectedKeyPoints,
        exportedAt: new Date().toISOString(),
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knowhow-interview-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [outline, profile, analysis, selectedTheme, direction, keyPoints]);

  if (!outline) return null;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <span className="font-bold tracking-widest text-xs uppercase" style={{ color: '#944a00' }}>Step 04</span>
        <h2 className="font-serif text-3xl md:text-4xl leading-tight mt-2 mb-3" style={{ color: '#1b1c1c' }}>原稿</h2>
        <p className="text-base leading-relaxed" style={{ color: '#564337' }}>インタビューをもとに記事構成が完成しました。</p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-6" role="toolbar" aria-label="原稿操作ツール">
        <button
          onClick={() => copyAsRich(fullMarkdown, 'all-md')}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
          style={{ background: '#fff', border: '1px solid #e7e5e4', color: '#564337' }}
          aria-label={copiedSection === 'all-md' ? 'すべてコピー済み' : 'すべてをクリップボードにコピーする'}
          aria-pressed={copiedSection === 'all-md'}
        >
          {copiedSection === 'all-md' ? <CheckIcon className="text-teal-500" size={14} /> : <CopyIcon size={14} />}
          {copiedSection === 'all-md' ? 'コピー済み' : '全体コピー'}
        </button>
        <button
          onClick={handleDownloadJSON}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
          style={{ background: '#fff', border: '1px solid #e7e5e4', color: '#564337' }}
          aria-label="原稿データをJSONファイルとしてダウンロードする"
        >
          <DownloadIcon size={14} />
          JSONダウンロード
        </button>
      </div>

      {/* Meta info */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <CopyableCard label="タイトル" sectionId="title" copiedSection={copiedSection} onCopy={() => copyPlain(outline.title, 'title')}>
          <h3 className="font-serif text-lg font-bold" style={{ color: '#1b1c1c' }}>{outline.title}</h3>
          <p className="text-xs text-stone-400 mt-1">{outline.title.length}文字</p>
        </CopyableCard>

        <CopyableCard label="カテゴリ / タグ" sectionId="meta" copiedSection={copiedSection} onCopy={() => copyPlain(`${outline.category}\n${outline.tags.join(', ')}`, 'meta')}>
          {(() => {
            const parts = outline.category.split('>').map((s) => s.trim());
            const main = parts[0] || outline.category;
            const sub = parts[1] || '';
            return (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold" style={{ color: '#944a00' }}>{main}</span>
                {sub && (
                  <>
                    <span className="text-stone-300">&gt;</span>
                    <span className="text-sm font-semibold text-stone-700">{sub}</span>
                  </>
                )}
              </div>
            );
          })()}
          <div className="flex flex-wrap gap-1.5">
            {outline.tags.map((tag, i) => (
              <span key={i} className="text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full">#{tag}</span>
            ))}
          </div>
        </CopyableCard>
      </div>

      <CopyableCard label="要約" sectionId="summary" copiedSection={copiedSection} onCopy={() => copyPlain(outline.summary, 'summary')} className="mb-6">
        <p className="text-sm text-stone-600 leading-relaxed">{outline.summary}</p>
        <p className="text-xs text-stone-400 mt-1">{outline.summary.length}文字</p>
      </CopyableCard>

      {/* Body */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-lg font-bold" style={{ color: '#1b1c1c' }}>記事本文</h3>
          <div className="flex gap-1" role="tablist" aria-label="表示モード選択">
            <button
              onClick={() => setViewMode('preview')}
              role="tab"
              aria-selected={viewMode === 'preview'}
              aria-controls="article-preview"
              id="tab-preview"
              className={`px-3 py-1 text-xs rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none ${viewMode === 'preview' ? 'font-semibold' : 'hover:bg-stone-100'}`}
              style={viewMode === 'preview' ? { background: '#fff0e0', color: '#944a00' } : { color: '#564337' }}
            >
              プレビュー
            </button>
            <button
              onClick={() => setViewMode('markdown')}
              role="tab"
              aria-selected={viewMode === 'markdown'}
              aria-controls="article-markdown"
              id="tab-markdown"
              className={`px-3 py-1 text-xs rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none ${viewMode === 'markdown' ? 'font-semibold' : 'hover:bg-stone-100'}`}
              style={viewMode === 'markdown' ? { background: '#fff0e0', color: '#944a00' } : { color: '#564337' }}
            >
              Markdown
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl relative group" style={{ border: '1px solid #e7e5e4' }}>
          <button
            onClick={() => copyAsRich(outline.bodyMarkdown, 'body')}
            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-stone-200 z-10 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none focus-visible:opacity-100"
            aria-label={copiedSection === 'body' ? '本文がコピーされました' : '本文をコピーする'}
          >
            {copiedSection === 'body' ? <><CheckIcon className="text-teal-500" size={12} />コピー済み</> : <><CopyIcon size={12} />本文コピー</>}
          </button>

          {viewMode === 'preview' ? (
            <div
              id="article-preview"
              className="p-6 overflow-auto max-h-[600px] scrollbar-thin"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
              role="tabpanel"
              aria-labelledby="tab-preview"
            />
          ) : (
            <pre
              id="article-markdown"
              className="p-6 text-xs text-stone-700 bg-stone-50 rounded-xl overflow-auto max-h-[600px] scrollbar-thin whitespace-pre-wrap font-mono"
              role="tabpanel"
              aria-labelledby="tab-markdown"
            >
              {outline.bodyMarkdown}
            </pre>
          )}
        </div>
      </div>

      {/* Structure Analysis */}
      <StructurePanel bodyMarkdown={outline.bodyMarkdown} />

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid #e7e5e4' }} role="navigation" aria-label="ステップナビゲーション">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
          style={{ color: '#564337' }}
          aria-label="前のステップ（インタビュー）に戻る"
        >
          <ChevronLeftIcon size={16} />
          インタビューに戻る
        </button>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm rounded-full font-medium transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500 focus-visible:outline-none"
          style={{ background: '#e67e22', color: '#502600', boxShadow: '0 10px 30px -8px rgba(148,74,0,0.15)' }}
          aria-label="次のステップ（画像プロンプト生成）に進む"
        >
          <ImageIcon size={16} />
          画像プロンプトへ
          <ArrowRightIcon size={14} />
        </button>
      </div>
    </div>
  );
}

const StructurePanel = memo(function StructurePanel({ bodyMarkdown }: { bodyMarkdown: string }) {
  const [open, setOpen] = useState(false);
  const result = useMemo(() => validateArticleStructure(bodyMarkdown), [bodyMarkdown]);
  const hasWarnings = result.warnings.length > 0;

  return (
    <div className="mb-8">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none rounded-md px-2 py-1"
        aria-expanded={open}
        aria-controls="structure-details"
        aria-label="記事構成の詳細分析を表示"
      >
        <svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        構成分析
        <span className="text-xs text-stone-400">({result.totalChars}字)</span>
        {hasWarnings && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full" role="status">
            {result.warnings.length}件の注意
          </span>
        )}
      </button>

      {open && (
        <div
          id="structure-details"
          className="mt-3 bg-white rounded-xl p-5 animate-fade-in"
          style={{ border: '1px solid #e7e5e4' }}
          role="region"
          aria-label="記事構成分析"
        >
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">セクション構成</h4>
            <div className="space-y-1.5">
              {result.sections.map((sec, i) => {
                const isH2 = sec.level === 2;
                const isShort = isH2 && sec.charCount < 200;
                const isLong = isH2 && sec.charCount > 800;
                return (
                  <div key={i} className={`flex items-center gap-2 text-sm ${sec.level === 3 ? 'ml-4' : ''}`}>
                    <span className="text-xs text-stone-400 w-6">{sec.level === 2 ? 'H2' : sec.level === 3 ? 'H3' : '導入'}</span>
                    <span className="flex-1 text-stone-700 truncate">{sec.heading}</span>
                    <span className={`text-xs font-mono tabular-nums ${isShort ? 'text-amber-600' : isLong ? 'text-red-500' : 'text-stone-400'}`}>
                      {sec.charCount}字
                    </span>
                    {isShort && <span className="text-xs text-amber-600">短い</span>}
                    {isLong && <span className="text-xs text-red-500">長い</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {hasWarnings && (
            <div>
              <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">注意点</h4>
              <div className="space-y-1">
                {result.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${w.type === 'long_section' || w.type === 'total_long' ? 'bg-red-400' : 'bg-amber-400'}`} />
                    <span className="text-stone-600">{w.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const CopyableCard = memo(function CopyableCard({
  label,
  children,
  copiedSection,
  sectionId,
  onCopy,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  copiedSection: string | null;
  sectionId: string;
  onCopy: () => void;
  className?: string;
}) {
  const isCopied = copiedSection === sectionId;
  return (
    <div
      className={`bg-white rounded-xl p-5 relative group ${className}`}
      style={{ border: '1px solid #e7e5e4' }}
      role="region"
      aria-label={label}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{label}</span>
        <button
          onClick={onCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none focus-visible:opacity-100 px-1 py-0.5 rounded"
          aria-label={isCopied ? `${label}がコピーされました` : `${label}をコピーする`}
          aria-pressed={isCopied}
        >
          {isCopied ? <><CheckIcon className="text-teal-500" size={12} />コピー済み</> : <><CopyIcon size={12} />コピー</>}
        </button>
      </div>
      {children}
    </div>
  );
});
