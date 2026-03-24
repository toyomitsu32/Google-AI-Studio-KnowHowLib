import React, { useState, useRef } from 'react';
import { ProfileAnalysis, ArticleTheme, UserProfile, ExtractedSkill } from '../types';
import { SparklesIcon, CheckIcon, ChevronLeftIcon, ArrowRightIcon, RefreshIcon } from './icons';
import {
  analyzeProfile,
  regenerateCategoryThemes,
  generateSkillAngleThemes,
  generateDualAngleThemes,
  THEME_CATEGORIES,
  THEME_CATEGORY_KEYS,
  type ThemeCategoryKey,
} from '../services/geminiService';

interface AnalysisResultProps {
  analysis: ProfileAnalysis | null;
  setAnalysis: (a: ProfileAnalysis) => void;
  categorizedThemes: Record<string, ArticleTheme[]>;
  setCategorizedThemes: (themes: Record<string, ArticleTheme[]>) => void;
  selectedTheme: ArticleTheme | null;
  setSelectedTheme: (theme: ArticleTheme | null) => void;
  customTheme: string;
  setCustomTheme: (v: string) => void;
  selectedSkill: ExtractedSkill | null;
  setSelectedSkill: (skill: ExtractedSkill | null) => void;
  selectedAngle: string | null;
  setSelectedAngle: (angle: string | null) => void;
  apiKey: string;
  profile: UserProfile;
  startLoading: (msg: string, sub?: string) => void;
  stopLoading: () => void;
  onError: (msg: string) => void;
  onProceed: () => void;
  onBack: () => void;
}

const TAB_COLORS: Record<ThemeCategoryKey, { active: string; inactive: string; indicator: string }> = {
  howto:   { active: 'text-white bg-amber-600',  inactive: 'text-stone-500 hover:text-amber-600 hover:bg-amber-50/50', indicator: 'bg-amber-600' },
  mindset: { active: 'text-white bg-amber-600', inactive: 'text-stone-500 hover:text-amber-600 hover:bg-amber-50/50', indicator: 'bg-amber-600' },
  story:   { active: 'text-white bg-amber-600',    inactive: 'text-stone-500 hover:text-amber-600 hover:bg-amber-50/50', indicator: 'bg-amber-600' },
  failure: { active: 'text-white bg-amber-600',    inactive: 'text-stone-500 hover:text-amber-600 hover:bg-amber-50/50', indicator: 'bg-amber-600' },
  funny:   { active: 'text-white bg-amber-600',      inactive: 'text-stone-500 hover:text-amber-600 hover:bg-amber-50/50', indicator: 'bg-amber-600' },
  other:   { active: 'text-stone-700 bg-stone-100', inactive: 'text-stone-500 hover:text-stone-700 hover:bg-stone-50', indicator: 'bg-stone-500' },
};

export default function AnalysisResult({
  analysis,
  setAnalysis,
  categorizedThemes,
  setCategorizedThemes,
  selectedTheme,
  setSelectedTheme,
  customTheme,
  setCustomTheme,
  selectedSkill,
  setSelectedSkill,
  selectedAngle,
  setSelectedAngle,
  apiKey,
  profile,
  startLoading,
  stopLoading,
  onError,
  onProceed,
  onBack,
}: AnalysisResultProps) {
  const [activeTab, setActiveTab] = useState<ThemeCategoryKey>('howto');
  const [freeTexts, setFreeTexts] = useState<Record<string, string>>({});
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSelected, setShareSelected] = useState<string[]>([]);
  const skillSectionRef = useRef<HTMLDivElement>(null);
  // テーマ生成のインライン進捗管理
  const [generatingAngles, setGeneratingAngles] = useState(false);
  const [angleProgress, setAngleProgress] = useState<{ current: number; total: number; currentLabel: string; completedKeys: string[] }>({
    current: 0, total: THEME_CATEGORY_KEYS.length, currentLabel: '', completedKeys: [],
  });

  // ── リベッターシェア ──
  const TOOL_URL = 'https://libecity.com/room_list?room_id=SEG96Zoun75WxITHlKEi';
  // 😲, ❤️, 👏 の順番に変更
  const REACTION_EMOJIS = ['😲', '❤️', '👏'];

  const toggleShareItem = (title: string) => {
    setShareSelected((prev) => {
      if (prev.includes(title)) return prev.filter((t) => t !== title);
      if (prev.length >= 2) return prev;
      return [...prev, title];
    });
  };

  const buildLibetterUrl = (titles: string[]) => {
    if (titles.length === 0) return '';
    
    // 140文字制限への精密な最適化
    // 固定部: 導入文(36) + 絵文字等(8) + URL(10) = 54文字
    // 残り 140 - 54 = 86文字。テーマ2つの場合、1つあたり最大43文字。
    const maxTitleLen = 43;
    
    const header = 'どのノウハウ図書館の記事が読みたい？\nリアクションで教えてください！\n';
    const body = titles.map((title, i) => {
      const display = title.length > maxTitleLen ? title.slice(0, maxTitleLen - 1) + '…' : title;
      return `${REACTION_EMOJIS[i]} ${display}\n`;
    }).join('');
    
    const text = header + body + TOOL_URL;
    return `https://libecity.com/tweet/all?create=${encodeURIComponent(text)}`;
  };

  if (!analysis) return null;

  const skills = analysis.skills || [];
  const hasSkills = skills.length > 0;
  const isNewFlow = hasSkills && selectedSkill !== null;

  // For new flow: build skill-based theme key helper
  const skillKey = (angleKey: ThemeCategoryKey) =>
    selectedSkill ? `skill-${selectedSkill.id}-${angleKey}` : '';

  // 全テーマ候補をフラットに集める（シェア選択パネル用）
  const getAllThemeTitles = (): string[] => {
    const titles: string[] = [];
    for (const key of THEME_CATEGORY_KEYS) {
      const sk = isNewFlow ? skillKey(key) : key;
      for (const t of (categorizedThemes[sk] || [])) {
        if (!titles.includes(t.title)) titles.push(t.title);
      }
    }
    return titles;
  };

  // Check if skill themes have been generated (at least one angle has themes)
  const hasSkillThemes = isNewFlow && THEME_CATEGORY_KEYS.some(
    (key) => (categorizedThemes[skillKey(key)]?.length || 0) > 0
  );

  // Count themes
  const totalCount = isNewFlow
    ? THEME_CATEGORY_KEYS.reduce((sum, key) => sum + (categorizedThemes[skillKey(key)]?.length || 0), 0)
    : THEME_CATEGORY_KEYS.reduce((sum, key) => sum + (categorizedThemes[key]?.length || 0), 0);

  const canProceed = selectedTheme || customTheme.trim();

  // Legacy flow: regenerate by category
  const handleRegenerate = async (categoryKey: ThemeCategoryKey, freeText?: string) => {
    const storageKey = isNewFlow ? skillKey(categoryKey) : categoryKey;
    const currentThemes = categorizedThemes[storageKey] || [];
    const previousTitles = currentThemes.map((t) => t.title);
    const catLabel = THEME_CATEGORIES[categoryKey].label;

    startLoading(`${catLabel}テーマを再生成中...`, '前回と違うテーマを提案します');
    try {
      let newThemes: ArticleTheme[];
      if (isNewFlow && selectedSkill) {
        newThemes = await generateSkillAngleThemes(
          apiKey, profile, analysis, selectedSkill, categoryKey, previousTitles, freeText,
        );
      } else {
        newThemes = await regenerateCategoryThemes(
          apiKey, profile, analysis, categoryKey, previousTitles, freeText,
        );
      }
      setCategorizedThemes({ ...categorizedThemes, [storageKey]: newThemes });
      if (selectedTheme) {
        const prefix = isNewFlow ? `skill-${selectedSkill!.id}-${categoryKey}` : categoryKey;
        if (selectedTheme.id.startsWith(prefix)) setSelectedTheme(null);
      }
      stopLoading();
    } catch (error: any) {
      stopLoading();
      const errorMsg = error?.message || 'テーマ再生成中にエラーが発生しました';
      onError(errorMsg);
      console.error('Theme regeneration error:', error);
    }
  };

  // Re-analyze to regenerate skills
  const handleRegenerateSkills = async () => {
    startLoading('スキルを再分析中...', 'プロフィールから強みを抽出しています');
    try {
      const result = await analyzeProfile(apiKey, profile);
      setAnalysis(result);
      setSelectedSkill(null);
      setSelectedAngle(null);
      setSelectedTheme(null);
      stopLoading();
    } catch (error: any) {
      stopLoading();
      const errorMsg = error?.message || 'スキル再分析中にエラーが発生しました';
      onError(errorMsg);
      console.error('Skill regeneration error:', error);
    }
  };

  // New flow: generate 6 angles in 3 paired requests (API回数半減)
  const ANGLE_PAIRS: [ThemeCategoryKey, ThemeCategoryKey][] = [
    ['howto', 'mindset'],
    ['story', 'failure'],
    ['funny', 'other'],
  ];

  const handleGenerateAllAngles = async () => {
    if (!selectedSkill) return;
    setGeneratingAngles(true);
    setAngleProgress({ current: 0, total: THEME_CATEGORY_KEYS.length, currentLabel: '', completedKeys: [] });
    try {
      const updated = { ...categorizedThemes };
      const completedKeys: string[] = [];
      for (let i = 0; i < ANGLE_PAIRS.length; i++) {
        const [keyA, keyB] = ANGLE_PAIRS[i];
        const pairLabel = `${THEME_CATEGORIES[keyA].label} + ${THEME_CATEGORIES[keyB].label}`;
        setAngleProgress({ current: i * 2, total: THEME_CATEGORY_KEYS.length, currentLabel: pairLabel, completedKeys: [...completedKeys] });
        const result = await generateDualAngleThemes(apiKey, profile, analysis, selectedSkill, keyA, keyB);
        updated[skillKey(keyA)] = result.a;
        updated[skillKey(keyB)] = result.b;
        completedKeys.push(keyA, keyB);
        setCategorizedThemes({ ...updated });
        setAngleProgress({ current: (i + 1) * 2, total: THEME_CATEGORY_KEYS.length, currentLabel: pairLabel, completedKeys: [...completedKeys] });
        // レート制限回避: リクエスト間に2秒の間隔を入れる
        if (i < ANGLE_PAIRS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      setSelectedTheme(null);
      setGeneratingAngles(false);
    } catch (error: any) {
      setGeneratingAngles(false);
      const errorMsg = error?.message || 'テーマ生成中にエラーが発生しました';
      onError(errorMsg);
      console.error('Angle generation error:', error);
    }
  };

  const setFreeText = (key: string, value: string) => {
    setFreeTexts((prev) => ({ ...prev, [key]: value }));
  };

  // Resolve active tab themes depending on flow
  const activeStorageKey = isNewFlow ? skillKey(activeTab) : activeTab;
  const activeThemes = categorizedThemes[activeStorageKey] || [];
  const activeFreeText = freeTexts[activeStorageKey] || '';

  // Check if selected theme belongs to a specific category
  const selectedCategory = selectedTheme
    ? THEME_CATEGORY_KEYS.find((k) => {
        const prefix = isNewFlow ? skillKey(k) : k;
        return selectedTheme.id.startsWith(prefix.replace(/^skill-/, 'skill-'));
      })
    : null;

  // Show theme tabs only after themes have been generated (skill selected + generated)
  const showThemeTabs = hasSkillThemes;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <span className="font-bold tracking-widest text-xs uppercase" style={{ color: '#944a00' }}>Step 02</span>
        <h2 className="font-serif text-3xl md:text-4xl leading-tight mt-2 mb-3" style={{ color: '#1b1c1c' }}>分析結果</h2>
        <p style={{ color: '#564337' }} className="text-sm">AIがあなたの人物像と文体を分析しました。テーマを選んでインタビューに進みましょう。</p>
      </div>

      {/* Analysis Cards */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f6f3f2' }}>
              <span style={{ color: '#e67e22' }}><SparklesIcon size={16} /></span>
            </div>
            <h3 className="text-sm font-semibold text-stone-700">人物特徴</h3>
          </div>
          <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{analysis.personality}</p>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f6f3f2' }}>
              <span style={{ color: '#e67e22' }}><SparklesIcon size={16} /></span>
            </div>
            <h3 className="text-sm font-semibold text-stone-700">文体プロファイル</h3>
          </div>
          <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap mb-3">{analysis.writingStyle}</p>
          <div className="grid grid-cols-2 gap-2">
            <StyleTag label="丁寧さ" value={analysis.styleProfile.politeness} />
            <StyleTag label="温度感" value={analysis.styleProfile.warmth} />
            <StyleTag label="距離感" value={analysis.styleProfile.distance} />
            <StyleTag label="感情表現" value={analysis.styleProfile.emotionExpression} />
            <StyleTag label="文の長さ" value={analysis.styleProfile.sentenceLength} />
          </div>
          {analysis.styleProfile.frequentExpressions.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-stone-400 mb-1">よく使う表現</p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.styleProfile.frequentExpressions.map((exp, i) => (
                  <span key={i} className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                    {exp}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Free Theme Input — always visible */}
      <div className="bg-white rounded-xl border-2 p-5 mb-8" style={{ borderColor: '#e7e5e4' }}>
        <label className="block text-sm font-semibold text-stone-700 mb-1">
          書きたいテーマが決まっている方はこちら
        </label>
        <p className="text-xs text-stone-400 mb-3">テーマを入力するだけでインタビューに進めます</p>
        <input
          type="text"
          value={customTheme}
          onChange={(e) => {
            setCustomTheme(e.target.value);
            if (e.target.value.trim()) setSelectedTheme(null);
          }}
          placeholder="例: フリーランスが最初に学ぶべきお金の管理"
          className="w-full px-4 py-3 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent bg-stone-50"
          style={{ '--tw-ring-color': '#e67e22' } as React.CSSProperties}
        />
      </div>

      {/* Skill Selection */}
      {hasSkills && (
        <div className="mb-6" ref={skillSectionRef}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-bold text-stone-800">強みからテーマを探す</h3>
            <button
              onClick={handleRegenerateSkills}
              className="text-xs text-stone-500 hover:text-stone-700 transition-colors flex items-center gap-1"
            >
              <RefreshIcon size={12} />
              再分析
            </button>
          </div>
          <p className="text-xs text-stone-400 mb-3">記事の起点になるスキルを1つ選んでください</p>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => {
              const isSelected = selectedSkill?.id === skill.id;
              return (
                <button
                  key={skill.id}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedSkill(null);
                      setSelectedAngle(null);
                    } else {
                      setSelectedSkill(skill);
                      setSelectedAngle(null);
                      setSelectedTheme(null);
                      setCustomTheme('');
                      // スムーズスクロールでスキルセクションを画面に表示
                      setTimeout(() => {
                        skillSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 50);
                    }
                  }}
                  className={`px-4 py-2 text-sm rounded-full border-2 transition-all ${
                    isSelected
                      ? 'font-semibold shadow-sm text-white'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                  }`}
                  style={isSelected ? { background: '#e67e22', borderColor: '#e67e22' } : {}}
                  title={skill.description}
                >
                  {skill.label}
                </button>
              );
            })}
          </div>
          {selectedSkill && (
            <p className="text-xs text-stone-500 mt-2 bg-stone-50 rounded-lg p-2">
              {selectedSkill.description}
            </p>
          )}
        </div>
      )}

      {/* Generate All Angles button / progress (new flow) */}
      {isNewFlow && !hasSkillThemes && !generatingAngles && (
        <div className="text-center py-8 mb-8 bg-white rounded-xl border border-stone-200">
          <p className="text-stone-500 mb-4">
            <span className="font-semibold" style={{ color: '#e67e22' }}>{selectedSkill!.label}</span> を起点に、6つの切り口でテーマを提案します
          </p>
          <button
            onClick={handleGenerateAllAngles}
            disabled={!apiKey}
            className="inline-flex items-center gap-2 px-5 py-2.5 font-semibold rounded-full transition-colors disabled:opacity-50"
            style={{ background: '#e67e22', color: '#502600', boxShadow: '0 10px 30px -8px rgba(148,74,0,0.15)' }}
          >
            <SparklesIcon size={16} />
            テーマを生成する
          </button>
        </div>
      )}

      {/* Inline progress bar during sequential generation */}
      {generatingAngles && (
        <div className="mb-8 bg-white rounded-xl border border-stone-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#fff0e0' }}>
              <span className="material-symbols-outlined animate-spin-slow text-lg" style={{ color: '#e67e22' }}>autorenew</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800">
                テーマを生成中… {angleProgress.current}/{angleProgress.total}
              </p>
              {angleProgress.currentLabel && angleProgress.current < angleProgress.total && (
                <p className="text-xs text-stone-500">
                  「{angleProgress.currentLabel}」を生成しています
                </p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden mb-4">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${(angleProgress.current / angleProgress.total) * 100}%`,
                background: 'linear-gradient(90deg, #e67e22, #f59e0b)',
              }}
            />
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap gap-2">
            {THEME_CATEGORY_KEYS.map((key, i) => {
              const isCompleted = angleProgress.completedKeys.includes(key);
              const isCurrent = !isCompleted && i === angleProgress.current;
              return (
                <div
                  key={key}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300"
                  style={
                    isCompleted
                      ? { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }
                      : isCurrent
                      ? { background: '#fff7ed', color: '#e67e22', border: '1px solid #fed7aa', animation: 'pulse 2s ease-in-out infinite' }
                      : { background: '#f5f5f4', color: '#a8a29e', border: '1px solid #e7e5e4' }
                  }
                >
                  {isCompleted && <span style={{ color: '#16a34a' }}>✓</span>}
                  {isCurrent && (
                    <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  )}
                  {THEME_CATEGORIES[key].label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Theme Selection with Tabs */}
      {showThemeTabs && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-bold text-stone-800">テーマを選択</h3>
            {selectedTheme && selectedCategory && (
              <span className="text-xs font-medium" style={{ color: '#e67e22' }}>
                選択中: {THEME_CATEGORIES[selectedCategory].label}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-stone-400">
              6つの切り口から{totalCount}件のテーマ候補
            </p>
            <button
              onClick={() => { setShareOpen(!shareOpen); if (!shareOpen) setShareSelected([]); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all hover:shadow-sm"
              style={{
                color: shareOpen ? '#502600' : '#944a00',
                borderColor: shareOpen ? '#e67e22' : '#dcc1b1',
                background: shareOpen ? '#e67e22' : '#fff8f0',
              }}
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                {shareOpen ? 'close' : 'share'}
              </span>
              {shareOpen ? '閉じる' : 'リベッターで聞いてみる'}
            </button>
          </div>

          {/* リベッター シェア選択パネル */}
          {shareOpen && (
            <div className="mb-4 rounded-xl border-2 p-4 animate-fade-in" style={{ borderColor: '#e67e22', background: '#fffcf8' }}>
              <div className="mb-3">
                <p className="text-sm font-semibold" style={{ color: '#502600' }}>
                  フォロワーに聞きたいテーマを2つ選んでください
                </p>
                <p className="text-xs mt-1" style={{ color: '#564337' }}>
                  リアクションで投票してもらえるつぶやきが作れます（{REACTION_EMOJIS[0]} {REACTION_EMOJIS[1]}）
                </p>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {getAllThemeTitles().map((title) => {
                  const idx = shareSelected.indexOf(title);
                  const isChosen = idx >= 0;
                  const isFull = shareSelected.length >= 2 && !isChosen;
                  return (
                    <button
                      key={title}
                      onClick={() => toggleShareItem(title)}
                      disabled={isFull}
                      className={`text-left px-3 py-2 text-xs rounded-lg border-2 transition-all ${
                        isChosen
                          ? 'font-semibold shadow-sm'
                          : isFull
                            ? 'opacity-40 cursor-not-allowed border-stone-200 bg-white'
                            : 'border-stone-200 bg-white hover:border-stone-300'
                      }`}
                      style={isChosen ? { borderColor: '#e67e22', background: '#fff0e0', color: '#502600' } : {}}
                    >
                      {isChosen && <span className="mr-1">{REACTION_EMOJIS[idx]}</span>}
                      {title.length > 30 ? title.slice(0, 29) + '…' : title}
                    </button>
                  );
                })}
              </div>

              {/* プレビュー & 投稿ボタン */}
              {shareSelected.length > 0 && (
                <div className="rounded-lg p-3 mb-3 text-xs leading-relaxed whitespace-pre-wrap" style={{ background: '#f6f3f2', color: '#564337' }}>
                  <span style={{ color: '#944a00', fontWeight: 600 }}>プレビュー：</span>{'\n'}
                  {'どのノウハウ図書館の記事が読みたい？\nリアクションで教えてください！\n'}
                  {shareSelected.map((title, i) => {
                    const maxTitleLen = 43;
                    const display = title.length > maxTitleLen ? title.slice(0, maxTitleLen - 1) + '…' : title;
                    return `${REACTION_EMOJIS[i]} ${display}\n`;
                  }).join('')}
                  {TOOL_URL}
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#564337' }}>
                  {shareSelected.length}/2 選択中
                </span>
                {(() => {
                  const url = buildLibetterUrl(shareSelected);
                  if (!url || shareSelected.length === 0) return (
                    <span className="text-xs" style={{ color: '#a8a29e' }}>テーマを選ぶとリベッターに投稿できます</span>
                  );
                  return (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-full transition-all hover:scale-105 active:scale-95"
                      style={{ background: '#e67e22', color: '#502600' }}
                    >
                      <span className="material-symbols-outlined text-base" aria-hidden="true">send</span>
                      リベッターに投稿
                    </a>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
            {THEME_CATEGORY_KEYS.map((key) => {
              const isActive = activeTab === key;
              const colors = TAB_COLORS[key];
              const tabStorageKey = isNewFlow ? skillKey(key) : key;
              const hasSelection = selectedTheme?.id.startsWith(
                isNewFlow ? `skill-${selectedSkill!.id}-${key}` : key
              );
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`relative px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    isActive ? colors.active : colors.inactive
                  }`}
                >
                  {THEME_CATEGORIES[key].label}
                  {hasSelection && (
                    <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${colors.indicator}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Active tab content */}
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="grid md:grid-cols-2 gap-3 mb-3">
              {activeThemes.map((theme, idx) => {
                const isSelected = selectedTheme?.id === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => {
                      setSelectedTheme(isSelected ? null : theme);
                      if (!isSelected) setCustomTheme('');
                    }}
                    className={`text-left p-4 rounded-xl border-2 transition-all card-hover ${
                      isSelected
                        ? 'shadow-md'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                    style={isSelected ? { background: '#fffcf8', borderColor: '#e67e22', borderLeftWidth: '4px' } : {}}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`text-xs font-bold mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'text-white' : 'bg-stone-100 text-stone-400'
                      }`}
                      style={isSelected ? { background: '#e67e22' } : {}}>
                        {isSelected ? <CheckIcon size={12} /> : idx + 1}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold leading-snug" style={{ color: isSelected ? '#502600' : '#292524' }}>{theme.title}</h4>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs">
                          <span style={{ color: isSelected ? '#564337' : '#78716c' }}><span style={{ color: isSelected ? '#944a00' : '#a8a29e' }}>読者:</span> {theme.audience}</span>
                          <span style={{ color: isSelected ? '#564337' : '#78716c' }}><span style={{ color: isSelected ? '#944a00' : '#a8a29e' }}>悩み:</span> {theme.problem}</span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: '#944a00' }}>{theme.reason}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Regeneration controls (only when skill is selected) */}
            {isNewFlow && <div className="flex gap-2 pt-2 border-t border-stone-100">
              <input
                type="text"
                value={activeFreeText}
                onChange={(e) => setFreeText(activeStorageKey, e.target.value)}
                placeholder="リクエストを入力して再生成..."
                className="flex-1 px-3 py-2 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent bg-stone-50"
                style={{ '--tw-ring-color': '#e67e22' } as React.CSSProperties}
              />
              <button
                onClick={() => {
                  handleRegenerate(activeTab, activeFreeText.trim() || undefined);
                  setFreeText(activeStorageKey, '');
                }}
                className="px-3 py-2 text-xs text-stone-500 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 hover:text-stone-700 transition-colors flex items-center gap-1"
              >
                <RefreshIcon size={12} />
                再生成
              </button>
            </div>}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors"
          style={{ color: '#564337' }}
        >
          <ChevronLeftIcon size={16} />
          戻る
        </button>
        <button
          onClick={onProceed}
          disabled={!canProceed}
          className="inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          style={{ background: '#e67e22', color: '#502600', boxShadow: '0 10px 30px -8px rgba(148,74,0,0.15)' }}
        >
          このテーマでインタビューへ
          <ArrowRightIcon size={18} />
        </button>
      </div>
    </div>
  );
}

function StyleTag({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-stone-50 rounded-lg px-2.5 py-1.5">
      <p className="text-[10px] text-stone-400">{label}</p>
      <p className="text-xs font-medium text-stone-700">{value}</p>
    </div>
  );
}
