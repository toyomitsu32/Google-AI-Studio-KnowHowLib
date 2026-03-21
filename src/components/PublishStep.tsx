import React, { useState, useCallback } from 'react';
import {
  ChevronLeftIcon,
  CopyIcon,
  CheckIcon,
} from './icons';
import { ArticleOutline } from '../types';
import { downloadExtensionZip } from '../utils/extensionZipData';

interface PublishStepProps {
  outline: ArticleOutline | null;
  onBack: () => void;
  onRestart: () => void;
  onProceed: () => void;
}

export default function PublishStep({ outline, onBack, onRestart, onProceed }: PublishStepProps) {
  const [copied, setCopied] = useState(false);

  /** bodyMarkdown を ## で分割して sections 配列に変換 */
  const parseBodyToSections = useCallback((bodyMarkdown: string) => {
    const lines = bodyMarkdown.split('\n');
    const sections: { heading: string; body: string; image: null; inlineImages: never[] }[] = [];
    let currentHeading = '';
    let currentBody: string[] = [];
    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (currentHeading) {
          sections.push({ heading: currentHeading, body: currentBody.join('\n').trim(), image: null, inlineImages: [] });
        }
        currentHeading = line.slice(3).trim();
        currentBody = [];
      } else if (currentHeading) {
        currentBody.push(line);
      }
    }
    if (currentHeading) {
      sections.push({ heading: currentHeading, body: currentBody.join('\n').trim(), image: null, inlineImages: [] });
    }
    return sections;
  }, []);

  /** "稼ぐ > Webライティング" → "Webライティング" */
  const extractSubCategory = useCallback((category: string) => {
    const parts = category.split('>').map((s) => s.trim());
    return parts.length > 1 ? parts[parts.length - 1] : parts[0];
  }, []);

  /** Chrome拡張用JSONをクリップボードにコピー */
  const handleCopyForExtension = useCallback(async () => {
    if (!outline) return;
    const json = {
      source: 'knowhow-interviewer',
      version: '1.0',
      title: outline.title,
      summary: outline.summary.slice(0, 140),
      category: extractSubCategory(outline.category),
      tags: outline.tags,
      thumbnail: null,
      sections: parseBodyToSections(outline.bodyMarkdown),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(json));
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = JSON.stringify(json);
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [outline, parseBodyToSections, extractSubCategory]);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <span className="font-bold tracking-widest text-xs uppercase" style={{ color: '#944a00' }}>Step 06</span>
        <h2 className="font-serif text-3xl md:text-4xl leading-tight mt-2 mb-3" style={{ color: '#1b1c1c' }}>入稿</h2>
        <p className="text-base leading-relaxed" style={{ color: '#564337' }}>Chrome拡張機能を使って、ノウハウ図書館に記事を入稿します。</p>
      </div>

      {/* Chrome拡張にコピー */}
      {outline && (
        <div className="mb-6 bg-white rounded-xl p-5" style={{ border: '1px solid #e7e5e4' }}>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#944a00' }}>原稿データをコピー</p>
          <p className="text-sm text-stone-500 mb-4">拡張機能に読み込ませるため、まず原稿データをクリップボードにコピーしてください。</p>
          <button
            onClick={handleCopyForExtension}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
            style={{ background: '#e67e22', color: '#502600' }}
          >
            {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
            {copied ? 'コピーしました！' : 'Chrome拡張にコピー'}
          </button>
        </div>
      )}

      {/* 前提確認 */}
      <div className="mb-6 bg-white rounded-xl p-4" style={{ border: '1px solid #e7e5e4' }}>
        <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#944a00' }}>事前準備チェック</p>
        <ul className="text-sm text-stone-600 space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="mt-0.5" style={{ color: '#944a00' }}>✓</span>
            <span>上の<span className="font-semibold text-stone-700">「Chrome拡張にコピー」</span>を実行済み</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5" style={{ color: '#944a00' }}>✓</span>
            <span>Step 5（挿絵）でスライド資料を生成し、<span className="font-semibold text-stone-700">PDFを1枚ずつ画像に変換・ZIP解凍</span>済み</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5" style={{ color: '#944a00' }}>✓</span>
            <span><span className="font-semibold text-stone-700">ノウハウ図書館インポーター</span>（Chrome拡張機能）がインストール済み</span>
          </li>
        </ul>
      </div>

      {/* 拡張機能ダウンロード・インストール手順 */}
      <div className="mb-6 bg-white rounded-xl p-5" style={{ border: '1px solid #e7e5e4' }}>
        <div className="flex items-center justify-between gap-4 mb-4">
          <p className="text-sm font-bold text-stone-700">ノウハウ図書館インポーター（Chrome拡張機能）</p>
          <button
            onClick={downloadExtensionZip}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-full transition-colors shrink-0"
            style={{ background: '#e67e22', color: '#502600' }}
          >
            ↓ ダウンロード
          </button>
        </div>
        <ol className="text-xs text-stone-500 space-y-1.5 list-decimal list-inside">
          <li>上のボタンから <span className="font-semibold text-stone-600">knowhow-extension.zip</span> をダウンロード</li>
          <li>ZIPファイルを<span className="font-semibold text-stone-600">解凍</span>してフォルダにする（ダブルクリックまたは右クリック→展開）</li>
          <li>Chromeのアドレスバーに <code className="bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded text-xs">chrome://extensions</code> と入力して開く</li>
          <li>右上の<span className="font-semibold text-stone-600">「デベロッパーモード」</span>をオンにする</li>
          <li>左上の<span className="font-semibold text-stone-600">「パッケージ化されていない拡張機能を読み込む」</span>をクリック</li>
          <li>解凍したフォルダを選択 → インストール完了</li>
        </ol>
      </div>

      {/* 手順タイムライン（1枚のカード） */}
      <div className="mb-8 bg-white rounded-xl p-6" style={{ border: '1px solid #e7e5e4' }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: '#944a00' }}>拡張機能の操作手順</p>

        <div className="relative ml-3.5">
          {/* 縦のライン */}
          <div className="absolute left-0 top-3.5 bottom-3.5 w-px bg-stone-200" />

          {/* 手順1 */}
          <div className="relative pl-8 pb-7">
            <span className="absolute left-0 top-0 -translate-x-1/2 flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold" style={{ background: '#e67e22' }}>1</span>
            <p className="text-sm font-bold mb-2" style={{ color: '#1b1c1c' }}>拡張機能にデータを取り込む</p>
            <ol className="text-sm text-stone-600 space-y-1 list-decimal list-inside">
              <li>ブラウザのツールバーにある<span className="font-semibold text-stone-700">拡張機能ボタン</span>（パズルのアイコン）をクリック</li>
              <li><span className="font-semibold text-stone-700">「ノウハウ図書館インポーター」</span>を選択</li>
              <li>ステップ1 で<span className="font-semibold text-stone-700">「📋 クリップボードから読み込み」</span>をクリック</li>
              <li>記事のタイトル・セクション構成がプレビュー表示されたら取り込み成功</li>
            </ol>
          </div>

          {/* 手順2 */}
          <div className="relative pl-8 pb-7">
            <span className="absolute left-0 top-0 -translate-x-1/2 flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold" style={{ background: '#e67e22' }}>2</span>
            <p className="text-sm font-bold mb-2" style={{ color: '#1b1c1c' }}>メタ情報を確認</p>
            <p className="text-sm text-stone-600">
              ステップ2 でタイトル・サマリー・カテゴリ・タグが自動入力されています。必要に応じて修正してください。
            </p>
          </div>

          {/* 手順3 */}
          <div className="relative pl-8 pb-7">
            <span className="absolute left-0 top-0 -translate-x-1/2 flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold" style={{ background: '#e67e22' }}>3</span>
            <p className="text-sm font-bold mb-2" style={{ color: '#1b1c1c' }}>画像を割り当てる</p>
            <ol className="text-sm text-stone-600 space-y-1 list-decimal list-inside">
              <li>ステップ3 で<span className="font-semibold text-stone-700">画像フォルダ</span>（解凍した画像フォルダ）を選択</li>
              <li>1枚目 → サムネイル、2枚目以降 → 各セクションのアイキャッチに自動配置されます</li>
              <li>配置を調整したい場合はドラッグ&ドロップで入れ替えできます</li>
            </ol>
          </div>

          {/* 手順4 */}
          <div className="relative pl-8">
            <span className="absolute left-0 top-0 -translate-x-1/2 flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold" style={{ background: '#e67e22' }}>4</span>
            <p className="text-sm font-bold mb-2" style={{ color: '#1b1c1c' }}>図書館に寄稿する</p>
            <ol className="text-sm text-stone-600 space-y-1 list-decimal list-inside">
              <li>ステップ4 で<span className="font-semibold text-stone-700">「ノウハウ図書館に寄稿する」</span>をクリック</li>
              <li>ノウハウ図書館の新規投稿ページが開き、記事データが自動で流し込まれます</li>
              <li>流し込み後、内容を確認して投稿してください</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid #e7e5e4' }}>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm hover:transition-colors"
          style={{ color: '#564337' }}
        >
          <ChevronLeftIcon size={16} />
          画像プロンプトに戻る
        </button>
        <button
          onClick={onProceed}
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-full transition-colors"
          style={{ background: '#e67e22', color: '#502600', boxShadow: '0 10px 30px -8px rgba(148,74,0,0.15)' }}
        >
          拡散へ進む
          <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
