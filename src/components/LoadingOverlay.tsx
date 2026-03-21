import React, { useEffect, useMemo, useState } from 'react';
import { SparklesIcon } from './icons';

interface LoadingOverlayProps {
  message?: string;
  subMessage?: string;
  /** ソーステキスト — 断片に分解して背景に浮遊させる */
  sourceText?: string;
}

// ── フェーズ別演出定義 ──
interface PhaseStyle {
  icon: string;            // Material Symbols Outlined
  iconAnimation: string;   // CSS animation class
  accentColor: string;     // ring / glow color
  flavorTexts: string[];   // ランダムで切り替わるサブメッセージ
  particleWords: string[]; // 浮遊パーティクル用キーワード
  particleColors: string[]; // フェーズ固有のカラーパレット
}

const PHASE_STYLES: { keywords: string[]; style: PhaseStyle }[] = [
  {
    // プロフィール分析 — ユーザーの文章断片を浮かせる（sourceTextを優先）
    keywords: ['プロフィール', '分析中', 'スキルを再分析'],
    style: {
      icon: 'psychology',
      iconAnimation: 'animate-pulse-soft',
      accentColor: '#944a00',
      flavorTexts: [
        'あなたの文章を丁寧に読んでいます',
        '言葉の選び方から人柄を感じ取っています',
        '強みと個性を見つけています',
        '文体のクセを分析しています',
      ],
      particleWords: [
        '人物像', '文体', '強み', '個性', '経験', '丁寧さ', '温度感',
        '距離感', '表現', 'ノウハウ', '専門性', '実績', '信頼', '想い',
        '言葉づかい', 'スキル', '価値観', '情熱', '知識', '挑戦',
      ],
      particleColors: ['#fbbf24', '#fb923c', '#fde68a', '#fdba74', '#fcd34d', '#fed7aa'],
    },
  },
  {
    // テーマ生成 — ひらめきワード
    keywords: ['テーマ', '切り口', '再生成'],
    style: {
      icon: 'emoji_objects',
      iconAnimation: 'animate-bounce-slow',
      accentColor: '#f59e0b',
      flavorTexts: [
        'あなたにしか書けないテーマを探しています',
        '読者が知りたいことを考えています',
        '新しい切り口を試しています',
        'いくつかのアイデアを比較しています',
      ],
      particleWords: [
        '💡', 'ひらめき', '切り口', '着想', '視点', '読者', 'ニーズ',
        '独自性', '共感', '発見', '深掘り', '意外性', '?', '新発想',
        'What if', '仮説', 'アイデア', '候補', 'ブレスト', '比較',
      ],
      particleColors: ['#fde68a', '#fef08a', '#fbbf24', '#a3e635', '#86efac', '#67e8f9'],
    },
  },
  {
    // 構成・見出し — 構造キーワード
    keywords: ['構成', '見出し', '並び順', 'パターン'],
    style: {
      icon: 'architecture',
      iconAnimation: 'animate-spin-slow',
      accentColor: '#e67e22',
      flavorTexts: [
        '記事の骨格を設計しています',
        '読者を引き込む流れを組み立てています',
        '見出しのインパクトを吟味しています',
        '情報の順番を最適化しています',
      ],
      particleWords: [
        'H2', '導入', '本論', 'まとめ', '構成', '流れ', '骨格',
        '起承転結', '見出し', '段落', 'フック', '結論', '根拠', '展開',
        '→', '序盤', '中盤', '終盤', '伏線', '着地',
      ],
      particleColors: ['#fdba74', '#fb923c', '#67e8f9', '#a5b4fc', '#fde68a', '#c4b5fd'],
    },
  },
  {
    // 記事生成 — 原稿イメージワード
    keywords: ['記事', '方向性', '本文', 'メタ情報'],
    style: {
      icon: 'edit_note',
      iconAnimation: 'animate-writing',
      accentColor: '#944a00',
      flavorTexts: [
        'あなたの言葉で原稿を起こしています',
        '伝わる文章に仕上げています',
        '読者に響く表現を選んでいます',
        '最後の推敲をしています',
      ],
      particleWords: [
        '✏️', '推敲', '校正', '原稿', '表現', '一文', '語彙',
        '接続詞', 'リズム', '余白', '句読点', '漢字', 'ひらがな',
        '読点', '改行', '段落', '文末', '口語', '説得力', '共感',
      ],
      particleColors: ['#fbbf24', '#fde68a', '#86efac', '#67e8f9', '#c4b5fd', '#fca5a5'],
    },
  },
];

/** メッセージからフェーズスタイルを推定 */
function detectPhase(message: string): PhaseStyle {
  for (const { keywords, style } of PHASE_STYLES) {
    if (keywords.some((kw) => message.includes(kw))) return style;
  }
  return {
    icon: 'auto_awesome',
    iconAnimation: 'animate-pulse-soft',
    accentColor: '#e67e22',
    flavorTexts: ['編集部が考えています', 'もう少しだけお待ちください'],
    particleWords: ['✨', '...', '考え中', '処理中'],
    particleColors: ['#e67e22', '#f59e0b', '#944a00'],
  };
}

/** テキストを意味のある断片に分解 */
function extractFragments(text: string, maxCount: number = 28): string[] {
  if (!text || text.trim().length === 0) return [];

  const raw = text
    .replace(/\n+/g, '。')
    .split(/[。、！？!?,.\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 20);

  const unique = Array.from(new Set(raw));
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  return unique.slice(0, maxCount);
}


type ParticleDirection = 'up' | 'down' | 'diag-r' | 'diag-l';
const DIRECTIONS: ParticleDirection[] = ['up', 'down', 'diag-r', 'diag-l'];
const DIR_CSS: Record<ParticleDirection, string> = {
  'up': 'particle-up',
  'down': 'particle-down',
  'diag-r': 'particle-diag-r',
  'diag-l': 'particle-diag-l',
};

interface Particle {
  text: string;
  x: number;        // CSS left %
  y: number;        // CSS top %
  size: number;
  delay: number;
  duration: number;
  opacity: number;
  color: string;
  direction: ParticleDirection;
  swayA: number;
  swayB: number;
  swayC: number;
  rotA: number;
  rotB: number;
  rotC: number;
  rotD: number;
}

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function generateParticles(fragments: string[], colors: string[]): Particle[] {
  return fragments.map((text, i) => {
    const dir = DIRECTIONS[i % DIRECTIONS.length];
    // 方向に応じて開始位置を変える
    let x: number, y: number;
    switch (dir) {
      case 'up':     x = 5 + Math.random() * 90; y = 85 + Math.random() * 15; break;
      case 'down':   x = 5 + Math.random() * 90; y = -5 - Math.random() * 10; break;
      case 'diag-r': x = -5 - Math.random() * 10; y = 50 + Math.random() * 40; break;
      case 'diag-l': x = 95 + Math.random() * 10; y = 50 + Math.random() * 40; break;
    }
    return {
      text,
      x,
      y,
      size: 14 + Math.random() * 8,
      delay: i * 0.3 + Math.random() * 1.2,
      duration: 5 + Math.random() * 4,
      opacity: 0.7 + Math.random() * 0.3,
      color: colors[i % colors.length],
      direction: dir,
      swayA: randRange(-30, 30),
      swayB: randRange(-40, 40),
      swayC: randRange(-25, 25),
      rotA: randRange(-15, 15),
      rotB: randRange(-20, 20),
      rotC: randRange(-12, 12),
      rotD: randRange(-10, 10),
    };
  });
}

export default function LoadingOverlay({
  message = '編集部が考えています...',
  subMessage = 'しばらくお待ちください',
  sourceText,
}: LoadingOverlayProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [flavorIndex, setFlavorIndex] = useState(0);

  const phase = useMemo(() => detectPhase(message), [message]);

  // sourceTextの文章断片を全フェーズで使う（色だけフェーズ固有）
  // sourceTextがない場合のみフォールバックでphase固有ワードを使う
  useEffect(() => {
    const extracted = extractFragments(sourceText || '', 24);
    const words = extracted.length > 0 ? extracted : phase.particleWords;
    setParticles(generateParticles(words, phase.particleColors));
  }, [message, sourceText, phase]);

  // フレーバーテキストを4秒ごとにローテーション
  useEffect(() => {
    const timer = setInterval(() => {
      setFlavorIndex((prev) => (prev + 1) % phase.flavorTexts.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [phase.flavorTexts.length]);

  const displaySubMessage = subMessage !== 'しばらくお待ちください'
    ? subMessage
    : phase.flavorTexts[flavorIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm overflow-hidden"
      role="progressbar"
      aria-label="コンテンツ生成中"
      aria-valuenow={50}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-busy="true"
      aria-live="polite"
    >

      {/* Floating text particles — multi-direction */}
      {particles.map((p, i) => (
        <span
          key={i}
          className={`${DIR_CSS[p.direction]} absolute pointer-events-none select-none whitespace-nowrap font-semibold`}
          aria-hidden="true"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            fontSize: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            opacity: 0,
            color: p.color,
            textShadow: `0 0 12px ${p.color}80, 0 0 24px ${p.color}40`,
            ['--particle-opacity' as any]: p.opacity,
            ['--sway-a' as any]: `${p.swayA}px`,
            ['--sway-b' as any]: `${p.swayB}px`,
            ['--sway-c' as any]: `${p.swayC}px`,
            ['--rot-a' as any]: `${p.rotA}deg`,
            ['--rot-b' as any]: `${p.rotB}deg`,
            ['--rot-c' as any]: `${p.rotC}deg`,
            ['--rot-d' as any]: `${p.rotD}deg`,
          }}
        >
          {p.text}
        </span>
      ))}

      {/* Center card */}
      <div
        className="animate-fade-in bg-white rounded-2xl shadow-2xl p-10 max-w-sm w-full mx-4 text-center relative z-10"
        role="status"
        aria-label="ローディング表示"
      >
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${phase.accentColor}25, ${phase.accentColor}0d)` }}
              aria-hidden="true"
            >
              <span
                className={`material-symbols-outlined ${phase.iconAnimation}`}
                style={{ color: phase.accentColor, fontSize: '32px' }}
              >
                {phase.icon}
              </span>
            </div>
            <div
              className="absolute inset-0 w-16 h-16 rounded-full border-2 border-t-transparent animate-spin-slow"
              style={{ borderColor: `${phase.accentColor}4d`, borderTopColor: 'transparent' }}
              aria-hidden="true"
            />
          </div>
        </div>
        <p className="text-lg font-semibold text-stone-800 mb-2">{message}</p>
        <p
          className="text-sm text-stone-500 transition-opacity duration-500"
          key={flavorIndex}
          style={{ animation: 'fade-in 0.5s ease-in-out' }}
        >
          {displaySubMessage}
        </p>
        <div className="mt-6 flex justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                background: phase.accentColor,
                animation: 'pulse-soft 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
