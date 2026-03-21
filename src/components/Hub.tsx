import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpenIcon,
  UserIcon,
  SparklesIcon,
  FileTextIcon,
  ImageIcon,
  SendIcon,
  ArrowRightIcon,
  MicIcon,
} from './icons';

/* ─── Scroll-triggered reveal ─── */

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

/* ─── Step data ─── */

const STEPS = [
  { num: '01', title: '著者紹介',     desc: 'まずはあなたのことを聞かせてください' },
  { num: '02', title: '企画',         desc: '編集部がテーマと方向性を一緒に考えます' },
  { num: '03', title: 'インタビュー', desc: '編集者との対話で、記事の素材を引き出します。これが私たちのサービスの核となる時間です。', highlight: true },
  { num: '04', title: '原稿',         desc: 'インタビューをもとに記事を構成します' },
  { num: '05', title: '挿絵',         desc: '記事に添えるスライドと画像を準備します' },
  { num: '06', title: '入稿',         desc: '完成した記事をノウハウ図書館へ寄稿します' },
  { num: '07', title: '拡散',         desc: 'リベッターでフォロワーに記事を届けます', full: true },
];

const VALUES = [
  { icon: 'psychology',    title: '引き出す、教えない', body: 'AIが書くのではなく、あなたの言葉を引き出す。対話が核。' },
  { icon: 'verified_user', title: '経験が主役',         body: 'テクニックより実体験。あなたにしか書けない記事を。' },
  { icon: 'handshake',     title: '完成まで伴走',       body: '企画から入稿まで、全工程を一貫してサポート。' },
];

/* ─── Hub ─── */

interface HubProps {
  onStart: () => void;
  isAdmin?: boolean;
  onCrawlUpdate?: () => Promise<{ success: boolean; output?: string; error?: string }>;
}

export default function Hub({ onStart, isAdmin, onCrawlUpdate }: HubProps) {
  const [crawlLoading, setCrawlLoading] = useState(false);
  const [crawlMessage, setCrawlMessage] = useState<string | null>(null);

  const processReveal = useReveal();
  const mvvReveal = useReveal();
  const ctaReveal = useReveal();

  const handleCrawlUpdate = async () => {
    if (!onCrawlUpdate || crawlLoading) return;
    setCrawlLoading(true);
    setCrawlMessage(null);
    try {
      const result = await onCrawlUpdate();
      if (result.success) {
        const output = result.output || '';
        const m = output.match(/(\d+)\s*件の新着記事を追加/);
        setCrawlMessage(
          m ? `✅ ${m[1]} 件の新着記事を追加しました`
            : output.includes('カタログは最新です') ? '✅ カタログは最新です'
            : '✅ カタログ更新完了'
        );
      } else {
        setCrawlMessage(`❌ 更新に失敗しました: ${result.error || '不明なエラー'}`);
      }
    } catch {
      setCrawlMessage('❌ 開発サーバーに接続できません');
    } finally {
      setCrawlLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#fbf9f8' }}>

      {/* ══════════════════════════════════════
          HERO
          ══════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col justify-center items-center px-6 pt-20 bg-editorial-gradient overflow-hidden">
        {/* Decorative blurred orbs */}
        <div className="hub-hero-orb-1" />
        <div className="hub-hero-orb-2" />

        <div className="relative z-10 max-w-4xl text-center space-y-10">
          <h1 className="font-serif text-4xl md:text-6xl leading-tight tracking-tight" style={{ color: '#1b1c1c' }}>
            あなたにしか書けないことを、
            <br />
            <span className="font-serif italic" style={{ color: '#944a00' }}>対話で記事</span>にする。
          </h1>

          <p className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: '#564337' }}>
            経験もノウハウもあるのに、書き方がわからない——
            <br />
            そんな人のための出版社です。
            <br />
            編集者との対話だけで、あなたの言葉が記事になります。
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center pt-4" role="region" aria-label="ヒーローセクション操作">
            <button
              onClick={onStart}
              className="group flex items-center gap-3 px-10 py-5 rounded-full text-xl font-medium transition-all duration-300 transform hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500 focus-visible:outline-none"
              style={{ background: '#e67e22', color: '#502600', boxShadow: '0 20px 40px -12px rgba(148,74,0,0.15)' }}
              aria-label="インタビューを開始する"
            >
              インタビューを受ける
              <ArrowRightIcon size={20} className="group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </button>

            <button
              onClick={() => processReveal.ref.current?.scrollIntoView({ behavior: 'smooth' })}
              className="group flex items-center gap-2 py-4 transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none rounded-md px-2"
              style={{ color: '#564337' }}
              aria-label="ページをスクロールして詳細情報を表示"
            >
              スクロールして詳しく
              <span className="material-symbols-outlined animate-bounce text-base" aria-hidden="true">expand_more</span>
            </button>
          </div>
        </div>

        {/* Bottom decorative text */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 opacity-30">
          <span className="font-serif italic text-sm tracking-widest uppercase">The Curated Manuscript</span>
        </div>
      </section>

      {/* ══════════════════════════════════════
          PROCESS — Bento Grid
          ══════════════════════════════════════ */}
      <section ref={processReveal.ref} className="py-32 px-6" style={{ background: '#fbf9f8' }}>
        <div className={`max-w-6xl mx-auto transition-all duration-700 ${processReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          <div className="mb-20 space-y-4">
            <span className="font-bold tracking-widest text-sm uppercase" style={{ color: '#944a00' }}>Process</span>
            <h2 className="font-serif text-3xl md:text-5xl leading-tight max-w-3xl" style={{ color: '#1b1c1c' }}>
              企画から拡散まで、<br className="hidden md:block" />7つのステップで記事を届けます。
            </h2>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-5" role="presentation">
            {/* Step 01 */}
            <div
              className="md:col-span-2 p-8 rounded-xl hub-surface-container-low group hover:bg-stone-200/40 transition-all duration-500 focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2 rounded-xl"
              style={{ transitionDelay: processReveal.visible ? '100ms' : '0ms' }}
            >
              <div className="font-serif text-4xl mb-6 group-hover:transition-colors" style={{ color: '#dcc1b1' }} aria-hidden="true">01</div>
              <h3 className="text-xl font-bold mb-3" style={{ color: '#1b1c1c' }}>著者紹介</h3>
              <p style={{ color: '#564337' }} className="leading-relaxed">まずはあなたのことを聞かせてください</p>
            </div>

            {/* Step 02 */}
            <div
              className="md:col-span-2 p-8 rounded-xl hub-surface-container-low group hover:bg-stone-200/40 transition-all duration-500 focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2 rounded-xl"
              style={{ transitionDelay: processReveal.visible ? '200ms' : '0ms' }}
            >
              <div className="font-serif text-4xl mb-6 group-hover:transition-colors" style={{ color: '#dcc1b1' }} aria-hidden="true">02</div>
              <h3 className="text-xl font-bold mb-3" style={{ color: '#1b1c1c' }}>企画</h3>
              <p style={{ color: '#564337' }} className="leading-relaxed">編集部がテーマと方向性を一緒に考えます</p>
            </div>

            {/* Step 03 — Core: spans 2 rows */}
            <div
              className="md:col-span-2 md:row-span-2 p-10 rounded-xl hub-secondary-container flex flex-col justify-center relative overflow-hidden shadow-lg focus-within:ring-2 focus-within:ring-orange-500"
              style={{ transitionDelay: processReveal.visible ? '300ms' : '0ms' }}
            >
              <div className="absolute top-0 right-0 p-4">
                <span className="text-white text-xs px-3 py-1 rounded-full uppercase tracking-wider" style={{ background: '#944a00' }}>
                  Core
                </span>
              </div>
              <div className="font-serif text-5xl mb-8" style={{ color: 'rgba(87,104,101,0.3)' }} aria-hidden="true">03</div>
              <h3 className="text-2xl font-bold mb-4" style={{ color: '#1b1c1c' }}>インタビュー</h3>
              <p className="text-lg leading-relaxed mb-8" style={{ color: '#576865' }}>
                編集者との対話で、記事の素材を引き出します。これが私たちのサービスの核となる時間です。
              </p>
              <div className="mt-auto">
                <span className="material-symbols-outlined text-4xl" style={{ color: '#576865' }} aria-hidden="true">chat_bubble</span>
              </div>
            </div>

            {/* Step 04 */}
            <div
              className="md:col-span-2 p-8 rounded-xl hub-surface-container-low group hover:bg-stone-200/40 transition-all duration-500 focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2 rounded-xl"
              style={{ transitionDelay: processReveal.visible ? '400ms' : '0ms' }}
            >
              <div className="font-serif text-4xl mb-6 group-hover:transition-colors" style={{ color: '#dcc1b1' }} aria-hidden="true">04</div>
              <h3 className="text-xl font-bold mb-3" style={{ color: '#1b1c1c' }}>原稿</h3>
              <p style={{ color: '#564337' }} className="leading-relaxed">インタビューをもとに記事を構成します</p>
            </div>

            {/* Step 05 */}
            <div
              className="md:col-span-2 p-8 rounded-xl hub-surface-container-low group hover:bg-stone-200/40 transition-all duration-500 focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2 rounded-xl"
              style={{ transitionDelay: processReveal.visible ? '500ms' : '0ms' }}
            >
              <div className="font-serif text-4xl mb-6 group-hover:transition-colors" style={{ color: '#dcc1b1' }} aria-hidden="true">05</div>
              <h3 className="text-xl font-bold mb-3" style={{ color: '#1b1c1c' }}>挿絵</h3>
              <p style={{ color: '#564337' }} className="leading-relaxed">記事に添えるスライドと画像を準備します</p>
            </div>

            {/* Step 06 */}
            <div
              className="md:col-span-3 p-8 rounded-xl hub-surface-container-low group hover:bg-stone-200/40 transition-all duration-500 focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2 rounded-xl"
              style={{ transitionDelay: processReveal.visible ? '600ms' : '0ms' }}
            >
              <div className="font-serif text-4xl mb-6 group-hover:transition-colors" style={{ color: '#dcc1b1' }} aria-hidden="true">06</div>
              <h3 className="text-xl font-bold mb-3" style={{ color: '#1b1c1c' }}>入稿</h3>
              <p style={{ color: '#564337' }} className="leading-relaxed">完成した記事をノウハウ図書館へ寄稿します</p>
            </div>

            {/* Step 07 — Full width finish */}
            <div
              className="md:col-span-3 p-10 rounded-xl hub-tertiary-fixed flex flex-col items-center justify-center gap-4 focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2"
              style={{ transitionDelay: processReveal.visible ? '700ms' : '0ms' }}
            >
              <div className="bg-white p-5 rounded-full aspect-square flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-3xl" style={{ color: '#944a00' }} aria-hidden="true">share</span>
              </div>
              <div className="text-center space-y-1">
                <div className="font-serif text-2xl" style={{ color: 'rgba(87,104,101,0.4)' }} aria-hidden="true">07</div>
                <h3 className="text-xl font-bold" style={{ color: '#1b1c1c' }}>拡散</h3>
                <p style={{ color: '#3f4947' }}>リベッターでフォロワーに記事を届けます</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          PHILOSOPHY — MVV
          ══════════════════════════════════════ */}
      <section ref={mvvReveal.ref} className="py-32 px-6 hub-surface-container-low relative overflow-hidden">
        <div className={`max-w-6xl mx-auto relative z-10 transition-all duration-700 ${mvvReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            {/* Left — mission text */}
            <div className="space-y-8">
              <span className="font-bold tracking-widest text-sm uppercase" style={{ color: '#944a00' }}>Philosophy</span>
              <h2 className="font-serif text-4xl md:text-5xl leading-tight" style={{ color: '#1b1c1c' }}>
                すべての経験者を、<br />著者にする。
              </h2>
              <p className="text-xl leading-relaxed" style={{ color: '#564337' }}>
                誰もが誰かの役に立つノウハウを持っている。
                「知っているけど書けない」を「読める記事」に変える。
                それが私たちのミッションです。
              </p>
            </div>

            {/* Right — values */}
            <div className="space-y-10">
              {VALUES.map((v, i) => (
                <div
                  key={i}
                  className={`flex gap-6 items-start transition-all duration-500 focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2 rounded-lg p-2 ${mvvReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                  style={{ transitionDelay: mvvReveal.visible ? `${300 + i * 120}ms` : '0ms' }}
                >
                  <div className="p-4 rounded-xl bg-white shadow-sm shrink-0">
                    <span className="material-symbols-outlined" style={{ color: '#944a00' }} aria-hidden="true">{v.icon}</span>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-bold" style={{ color: '#1b1c1c' }}>{v.title}</h4>
                    <p style={{ color: '#564337' }}>{v.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FINAL CTA
          ══════════════════════════════════════ */}
      <section ref={ctaReveal.ref} className="py-32 px-6 bg-editorial-gradient">
        <div className={`max-w-4xl mx-auto text-center space-y-12 transition-all duration-700 ${ctaReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="font-serif text-4xl md:text-6xl leading-tight" style={{ color: '#1b1c1c' }}>
            あなたのノウハウを、<br />図書館の一冊に。
          </h2>

          <div className="flex flex-col items-center gap-6">
            <button
              onClick={onStart}
              className="px-16 py-6 rounded-full text-2xl font-medium transition-all duration-300 hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500 focus-visible:outline-none"
              style={{ background: '#e67e22', color: '#502600', boxShadow: '0 25px 50px -12px rgba(148,74,0,0.2)' }}
              aria-label="インタビューを開始する"
            >
              インタビューを受ける
            </button>
            <p className="font-serif italic text-sm" style={{ color: 'rgba(86,67,55,0.6)' }}>
              Start your manuscript journey today.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          Footer
          ══════════════════════════════════════ */}
      <footer className="py-12 px-8 mt-20 border-t" style={{ background: '#fafaf9', borderColor: 'rgba(220,193,177,0.3)' }}>
        <div className="max-w-6xl mx-auto">

          {/* リンク集（目立つ位置） */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <a
              href="https://library.libecity.com/articles/ARTICLE_ID"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl bg-white border transition-all hover:shadow-md hover:border-stone-300 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
              style={{ borderColor: '#dcc1b1' }}
            >
              <span className="material-symbols-outlined text-2xl" style={{ color: '#e67e22' }} aria-hidden="true">auto_stories</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#1b1c1c' }}>紹介記事を読む</p>
                <p className="text-xs" style={{ color: '#a8a29e' }}>ノウハウ図書館</p>
              </div>
            </a>
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSfCx6cnMCj00Ew7uyhd2iM30Rb9wMotxXO6xMtXpntIgXTlrQ/viewform"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl bg-white border transition-all hover:shadow-md hover:border-stone-300 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
              style={{ borderColor: '#dcc1b1' }}
            >
              <span className="material-symbols-outlined text-2xl" style={{ color: '#e67e22' }} aria-hidden="true">rate_review</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#1b1c1c' }}>フィードバックを送る</p>
                <p className="text-xs" style={{ color: '#a8a29e' }}>ご意見をお聞かせください</p>
              </div>
            </a>
            <a
              href="https://libecity.com/user_profile/QWQY9sPYMFbXRP6Ipti0I6ROb472"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl bg-white border transition-all hover:shadow-md hover:border-stone-300 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
              style={{ borderColor: '#dcc1b1' }}
            >
              <span className="material-symbols-outlined text-2xl" style={{ color: '#e67e22' }} aria-hidden="true">person</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#1b1c1c' }}>開発者に連絡する</p>
                <p className="text-xs" style={{ color: '#a8a29e' }}>さにー☀️</p>
              </div>
            </a>
          </div>

          {/* 著作権 + 管理ボタン */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-6" style={{ borderTop: '1px solid rgba(220,193,177,0.2)' }}>
            <div className="text-center md:text-left">
              <p className="text-sm" style={{ color: '#564337' }}>
                <span className="font-serif font-semibold" style={{ color: '#1b1c1c' }}>ノウハウ出版社</span>
                {' '}Created by{' '}
                <a
                  href="https://libecity.com/user_profile/QWQY9sPYMFbXRP6Ipti0I6ROb472"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#944a00' }}
                  className="hover:underline"
                >
                  さにー☀️事業を照らすITコンサル
                </a>
              </p>
            </div>

            {isAdmin && onCrawlUpdate && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCrawlUpdate}
                  disabled={crawlLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-stone-500 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 hover:text-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
                  aria-label={crawlLoading ? 'カタログ更新中' : 'ノウハウ図書館のカタログを更新する'}
                  aria-busy={crawlLoading}
                >
                  {crawlLoading ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      更新中...
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                      </svg>
                      カタログ更新
                    </>
                  )}
                </button>
                {crawlMessage && (
                  <p className={`text-xs ${crawlMessage.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
                    {crawlMessage}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
