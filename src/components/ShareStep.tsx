import React, { useState, useEffect, useCallback } from 'react';
import { CheckIcon, ChevronLeftIcon, RefreshIcon } from './icons';
import { ArticleOutline, ProfileAnalysis, UserProfile } from '../types';
import { generateTweetTemplates, TweetTemplate } from '../services/geminiService';

interface ShareStepProps {
  outline: ArticleOutline | null;
  analysis: ProfileAnalysis | null;
  profile: UserProfile;
  apiKey: string;
  onBack: () => void;
  onRestart: () => void;
}

const TOOL_URL = 'https://knowhow-publisher.libecity.com';

/** フォールバック用の固定テンプレート（API失敗時に使用） */
function buildFallbackTemplates(
  title: string,
  summary: string,
  articleUrl: string,
): TweetTemplate[] {
  const shortTitle = title.length > 18 ? title.slice(0, 17) + '…' : title;
  const firstSentence = summary.split(/[。！？\n]/)[0] || '';
  const shortProblem = firstSentence.length > 28 ? firstSentence.slice(0, 27) + '…' : firstSentence;
  const url = articleUrl.trim() || TOOL_URL;
  return [
    {
      label: '🤝 悩み共感型',
      text: `${shortProblem}\nそんな悩みに向き合った記事を書きました✍️\n${url}`,
    },
    {
      label: '📣 寄稿報告',
      text: `ノウハウ図書館に記事を寄稿しました！\nテーマは「${shortTitle}」\nよかったら読んでみてください\n${url}`,
    },
    {
      label: '💡 体験シェア',
      text: `「${shortTitle}」について記事にしてみた！\n質問に答えるだけで構成ができて自分の経験が整理された\n${url}`,
    },
  ];
}

export default function ShareStep({ outline, analysis, profile, apiKey, onBack, onRestart }: ShareStepProps) {
  const [articleUrl, setArticleUrl] = useState('');
  const [selectedTweet, setSelectedTweet] = useState<number | null>(null);
  const [templates, setTemplates] = useState<TweetTemplate[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  // 初期表示時はフォールバックテンプレートを表示
  useEffect(() => {
    if (outline && !generated) {
      setTemplates(buildFallbackTemplates(outline.title, outline.summary, articleUrl));
    }
  }, [outline, articleUrl, generated]);

  const handleGenerate = useCallback(async () => {
    if (!outline || !analysis?.styleProfile || !apiKey) return;
    setGenerating(true);
    setSelectedTweet(null);
    try {
      const result = await generateTweetTemplates(
        apiKey,
        outline.title,
        outline.summary,
        analysis.styleProfile,
        profile.profileText,
        articleUrl,
      );
      if (result && result.length > 0) {
        setTemplates(result);
        setGenerated(true);
      }
    } catch (e: any) {
      console.error('[ShareStep] つぶやき生成失敗:', e);
      // フォールバックを維持
    }
    setGenerating(false);
  }, [outline, analysis, profile, apiKey, articleUrl]);

  // styleProfileがあれば自動的にAI生成を試行
  useEffect(() => {
    if (outline && analysis?.styleProfile && apiKey && !generated) {
      handleGenerate();
    }
  }, [outline, analysis, apiKey]); // articleUrl変更時は手動再生成に任せる

  if (!outline) return null;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <span className="font-bold tracking-widest text-xs uppercase" style={{ color: '#944a00' }}>Step 07</span>
        <h2 className="font-serif text-3xl md:text-4xl leading-tight mt-2 mb-3" style={{ color: '#1b1c1c' }}>拡散</h2>
        <p className="text-base leading-relaxed" style={{ color: '#564337' }}>
          寄稿した記事をリベッターでフォロワーに届けましょう。あなたの記事が誰かの役に立つかもしれません。
        </p>
      </div>

      {/* 記事URL入力 */}
      <div className="mb-6 bg-white rounded-xl p-5" style={{ border: '1px solid #e7e5e4' }}>
        <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#944a00' }}>記事URLを入力</p>
        <p className="text-sm text-stone-500 mb-3">
          ノウハウ図書館に投稿した記事のURLを貼り付けると、つぶやきにリンクが含まれます。
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            value={articleUrl}
            onChange={(e) => { setArticleUrl(e.target.value); setSelectedTweet(null); }}
            placeholder="https://library.libecity.com/articles/..."
            className="flex-1 px-3 py-2.5 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent bg-stone-50"
            style={{ '--tw-ring-color': '#e67e22' } as React.CSSProperties}
          />
          {articleUrl && (
            <span className="flex items-center text-xs font-medium px-2" style={{ color: '#16a34a' }}>
              <CheckIcon size={14} />
            </span>
          )}
        </div>
        <p className="text-xs text-stone-400 mt-1.5">
          {articleUrl ? '✓ つぶやきに記事リンクが含まれます' : 'URLがなくてもツールのリンク付きでつぶやけます'}
        </p>
      </div>

      {/* つぶやきテンプレート選択 */}
      <div className="mb-6 bg-white rounded-xl p-5" style={{ border: '1px solid #e7e5e4' }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#944a00' }}>つぶやきを選ぶ</p>
          {generated && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#fff0e0', color: '#944a00' }}>
              ✨ あなたの文体で生成
            </span>
          )}
        </div>
        <p className="text-sm text-stone-500 mb-4">
          {generated
            ? 'あなたの文体プロファイルに合わせてAIが生成しました。'
            : 'フォロワーに響くスタイルを選んでください。記事タイトルと要約から自動生成されています。'}
        </p>

        {generating ? (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-2 border-stone-300 border-t-amber-500 rounded-full animate-spin mb-3" />
            <p className="text-sm text-stone-500">あなたの文体でつぶやきを生成中…</p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 mb-4">
              {templates.map((tmpl, i) => {
                const isChosen = selectedTweet === i;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedTweet(isChosen ? null : i)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      isChosen ? 'shadow-sm' : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                    style={isChosen ? { borderColor: '#e67e22', background: '#fffcf8', borderLeftWidth: '4px' } : {}}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold">{tmpl.label}</span>
                      {isChosen && <span style={{ color: '#e67e22' }}><CheckIcon size={14} /></span>}
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#564337' }}>
                      {tmpl.text}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* 再生成ボタン */}
            {analysis?.styleProfile && apiKey && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="text-xs px-3 py-1.5 rounded-full border transition-colors mb-4"
                style={{ borderColor: '#dcc1b1', color: '#564337' }}
              >
                ↻ 文体を反映して再生成
              </button>
            )}
          </>
        )}

        {selectedTweet !== null && (() => {
          const tmpl = templates[selectedTweet];
          const libetterUrl = `https://libecity.com/tweet/all?create=${encodeURIComponent(tmpl.text)}`;
          return (
            <a
              href={libetterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-full transition-all hover:scale-105 active:scale-95"
              style={{ background: '#e67e22', color: '#502600', boxShadow: '0 10px 30px -8px rgba(148,74,0,0.15)' }}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">send</span>
              リベッターに投稿する
            </a>
          );
        })()}
      </div>

      {/* 応援メッセージ */}
      <div className="mb-8 text-center py-6 rounded-xl" style={{ background: '#f6f3f2' }}>
        <p className="font-serif text-lg" style={{ color: '#1b1c1c' }}>おつかれさまでした！</p>
        <p className="text-sm mt-2" style={{ color: '#564337' }}>
          あなたの経験が、誰かの一歩を後押しする記事になりました。
        </p>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid #e7e5e4' }}>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm hover:transition-colors"
          style={{ color: '#564337' }}
        >
          <ChevronLeftIcon size={16} />
          入稿に戻る
        </button>
        <button
          onClick={onRestart}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium rounded-full transition-colors"
          style={{ background: '#e67e22', color: '#502600', boxShadow: '0 10px 30px -8px rgba(148,74,0,0.15)' }}
        >
          <RefreshIcon size={16} />
          新しいインタビューをはじめる
        </button>
      </div>
    </div>
  );
}
