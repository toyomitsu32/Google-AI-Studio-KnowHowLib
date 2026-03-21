import React, { useState, useEffect, useRef } from 'react';
import {
  UserProfile,
  ProfileAnalysis,
  ArticleTheme,
  ArticleDirection,
  KeyPoint,
  OutlinePattern,
  ArticleOutline,
  HeadingCandidate,
  HeadingOrder,
  HeadingExperience,
} from '../types';
import { LightbulbIcon, SparklesIcon, ChevronLeftIcon, ArrowRightIcon, PlusIcon, CheckIcon } from './icons';
import {
  generateOutlinePatterns,
  generateOutline,
  generateHeadingCandidates,
  generateHeadingOrders,
  generateWritingHints,
} from '../services/geminiService';

interface ArticleDesignProps {
  apiKey: string;
  profile: UserProfile;
  analysis: ProfileAnalysis | null;
  themeTitle: string;
  setThemeTitle: (v: string) => void;
  direction: ArticleDirection;
  setDirection: React.Dispatch<React.SetStateAction<ArticleDirection>>;
  keyPoints: KeyPoint[];
  setKeyPoints: React.Dispatch<React.SetStateAction<KeyPoint[]>>;
  outlinePatterns: OutlinePattern[];
  setOutlinePatterns: React.Dispatch<React.SetStateAction<OutlinePattern[]>>;
  selectedPatternId: string | null;
  setSelectedPatternId: React.Dispatch<React.SetStateAction<string | null>>;
  headingCandidates: HeadingCandidate[];
  setHeadingCandidates: React.Dispatch<React.SetStateAction<HeadingCandidate[]>>;
  headingOrders: HeadingOrder[];
  setHeadingOrders: React.Dispatch<React.SetStateAction<HeadingOrder[]>>;
  selectedOrderId: string | null;
  setSelectedOrderId: React.Dispatch<React.SetStateAction<string | null>>;
  orderedHeadings: string[];
  setOrderedHeadings: React.Dispatch<React.SetStateAction<string[]>>;
  headingExperiences: HeadingExperience[];
  setHeadingExperiences: React.Dispatch<React.SetStateAction<HeadingExperience[]>>;
  writingHints: Record<string, string[]>;
  setWritingHints: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  onGenerate: (outline: ArticleOutline) => void;
  startLoading: (msg: string, sub?: string) => void;
  stopLoading: () => void;
  onError: (msg: string) => void;
  onBack: () => void;
}

type DesignSection = 'direction' | 'headings' | 'experience' | 'points';

export default function ArticleDesign({
  apiKey,
  profile,
  analysis,
  themeTitle,
  setThemeTitle,
  direction,
  setDirection,
  keyPoints,
  setKeyPoints,
  outlinePatterns,
  setOutlinePatterns,
  selectedPatternId,
  setSelectedPatternId,
  headingCandidates,
  setHeadingCandidates,
  headingOrders,
  setHeadingOrders,
  selectedOrderId,
  setSelectedOrderId,
  orderedHeadings,
  setOrderedHeadings,
  headingExperiences,
  setHeadingExperiences,
  writingHints,
  setWritingHints,
  onGenerate,
  startLoading,
  stopLoading,
  onError,
  onBack,
}: ArticleDesignProps) {
  const [activeSection, setActiveSection] = useState<DesignSection>('direction');
  const [regenerateInput, setRegenerateInput] = useState('');
  const [customHeadingInput, setCustomHeadingInput] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Auto-save indicator
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  // Show "saved" indicator when persisted data changes (debounced)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setShowSaved(true);
    savedTimerRef.current = setTimeout(() => setShowSaved(false), 2000);
  }, [direction, headingCandidates, orderedHeadings, headingExperiences, themeTitle]);

  // themeTitle is now a prop from App.tsx (editable, persisted)

  // Determine which flow to use: new heading flow or legacy pattern flow
  const useNewFlow = true; // Always use new flow

  // Direction is now pre-filled by App.tsx onProceed before entering this step

  // ---- Legacy pattern flow ----
  const handleGeneratePatterns = async (userRequest?: string) => {
    if (!apiKey || !themeTitle) return;
    startLoading('構成パターンを生成中...', '3つの異なるアプローチを検討しています');
    try {
      const result = await generateOutlinePatterns(apiKey, themeTitle, direction, profile.profileText, userRequest || undefined);
      setOutlinePatterns(result);
      setSelectedPatternId(null);
      setKeyPoints([]);
      stopLoading();
    } catch (error: any) {
      stopLoading();
      const errorMsg = error?.message || '構成パターン生成中にエラーが発生しました';
      onError(errorMsg);
      console.error('Pattern generation error:', error);
    }
  };

  const handleSelectPattern = (patternId: string) => {
    setSelectedPatternId(patternId);
    const pattern = outlinePatterns.find((p) => p.id === patternId);
    if (pattern) {
      setKeyPoints(pattern.points.map((p) => ({ ...p, selected: true })));
    }
  };

  // ---- New heading flow ----
  const selectedCount = headingCandidates.filter((h) => h.selected).length;

  const handleGenerateHeadings = async () => {
    if (!apiKey || !themeTitle) return;
    startLoading('大見出し候補を生成中...', 'テーマに合った見出しを考えています');
    try {
      const result = await generateHeadingCandidates(apiKey, themeTitle, direction, profile.profileText);
      setHeadingCandidates(result);
      setHeadingOrders([]);
      setSelectedOrderId(null);
      setOrderedHeadings([]);
      setHeadingExperiences([]);
      stopLoading();
      setActiveSection('headings');
    } catch (error: any) {
      stopLoading();
      const errorMsg = error?.message || '見出し生成中にエラーが発生しました';
      onError(errorMsg);
      console.error('Heading generation error:', error);
    }
  };

  const handleAddMoreHeadings = async () => {
    if (!apiKey || !themeTitle) return;
    // 選択済みの見出しをキープし、それらを除外して新候補を生成
    const selectedLabels = headingCandidates.filter((h) => h.selected).map((h) => h.label);
    const allLabels = headingCandidates.map((h) => h.label);
    startLoading('追加の見出し候補を生成中...', '既存候補と異なる切り口を探しています');
    try {
      const result = await generateHeadingCandidates(apiKey, themeTitle, direction, profile.profileText, allLabels);
      // 選択済みの候補はそのままキープ、未選択候補を新候補に入れ替え
      const kept = headingCandidates.filter((h) => h.selected);
      // IDの重複を避けるためにタイムスタンプで採番
      const newCandidates = result.map((c, i) => ({
        ...c,
        id: `heading-more-${Date.now()}-${i}`,
      }));
      setHeadingCandidates([...kept, ...newCandidates]);
      // 並び順は選び直しが必要
      setHeadingOrders([]);
      setSelectedOrderId(null);
      setOrderedHeadings([]);
      setHeadingExperiences([]);
      stopLoading();
    } catch (error: any) {
      stopLoading();
      const errorMsg = error?.message || '見出し追加生成中にエラーが発生しました';
      onError(errorMsg);
      console.error('Additional heading generation error:', error);
    }
  };

  const toggleHeading = (id: string) => {
    setHeadingCandidates((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const newSelected = !h.selected;
        const currentCount = prev.filter((x) => x.selected).length;
        // Enforce 3-10 limit (candidates are max 10)
        if (newSelected && currentCount >= 10) return h;
        return { ...h, selected: newSelected };
      })
    );
  };

  const updateHeadingLabel = (id: string, newLabel: string) => {
    setHeadingCandidates((prev) =>
      prev.map((h) => (h.id === id ? { ...h, label: newLabel } : h))
    );
  };

  const addCustomHeading = () => {
    const text = customHeadingInput.trim();
    if (!text) return;
    const id = `heading-custom-${Date.now()}`;
    setHeadingCandidates((prev) => [...prev, { id, label: text, selected: true }]);
    setCustomHeadingInput('');
  };

  const handleGenerateOrders = async () => {
    if (!apiKey || !themeTitle) return;
    const selected = headingCandidates.filter((h) => h.selected).map((h) => h.label);
    if (selected.length < 3) return;

    startLoading('並び順パターンを生成中...', '効果的な構成を検討しています');
    try {
      const result = await generateHeadingOrders(apiKey, themeTitle, direction, selected);
      setHeadingOrders(result);
      setSelectedOrderId(null);
      setOrderedHeadings([]);
      setHeadingExperiences([]);
      stopLoading();
      // Scroll to order selection after render
      setTimeout(() => {
        orderSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (error: any) {
      stopLoading();
      const errorMsg = error?.message || '並び順生成中にエラーが発生しました';
      onError(errorMsg);
      console.error('Order generation error:', error);
    }
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    const order = headingOrders.find((o) => o.id === orderId);
    if (order) {
      setOrderedHeadings([...order.headings]);
      // Initialize experiences for each heading
      setHeadingExperiences(
        order.headings.map((_, i) => ({
          headingId: `heading-ordered-${i}`,
          text: '',
          tags: [],
        }))
      );
      // Clear hints when order changes
      setWritingHints({});
      setInsertedHints({});
      hintsGeneratedRef.current = false;
    }
  };

  // ---- DnD handlers ----
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    // Reorder
    const newOrder = [...orderedHeadings];
    const [moved] = newOrder.splice(dragIndex, 1);
    newOrder.splice(index, 0, moved);
    setOrderedHeadings(newOrder);
    // Also reorder experiences
    const newExp = [...headingExperiences];
    const [movedExp] = newExp.splice(dragIndex, 1);
    newExp.splice(index, 0, movedExp);
    // Re-assign headingIds
    const reindexed = newExp.map((exp, i) => ({ ...exp, headingId: `heading-ordered-${i}` }));
    setHeadingExperiences(reindexed);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const moveHeading = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= orderedHeadings.length) return;
    const newOrder = [...orderedHeadings];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    setOrderedHeadings(newOrder);
    const newExp = [...headingExperiences];
    const [movedExp] = newExp.splice(fromIndex, 1);
    newExp.splice(toIndex, 0, movedExp);
    const reindexed = newExp.map((exp, i) => ({ ...exp, headingId: `heading-ordered-${i}` }));
    setHeadingExperiences(reindexed);
  };

  // ---- Experience handlers ----
  const updateExperienceText = (index: number, text: string) => {
    setHeadingExperiences((prev) =>
      prev.map((exp, i) => (i === index ? { ...exp, text } : exp))
    );
  };

  // ---- Writing hints (AI-generated) ----
  const [hintsLoading, setHintsLoading] = useState<Record<string, boolean>>({});
  const [insertedHints, setInsertedHints] = useState<Record<string, Set<string>>>({});
  const hintsGeneratedRef = useRef(false);
  const orderSectionRef = useRef<HTMLDivElement>(null);

  // 全見出し一括生成（初回自動実行用）
  const handleGenerateHints = async () => {
    if (!apiKey || !themeTitle || orderedHeadings.length === 0) return;
    const allKeys = orderedHeadings.map((_, i) => `heading-ordered-${i}`);
    setHintsLoading((prev) => {
      const next = { ...prev };
      allKeys.forEach((k) => { next[k] = true; });
      return next;
    });
    try {
      const result = await generateWritingHints(apiKey, themeTitle, direction, profile.profileText, orderedHeadings);
      setWritingHints(result);
      setInsertedHints({});
    } catch (error: any) {
      // Silently fail — hints are optional, but log for debugging
      console.warn('Writing hints generation failed:', error?.message || error);
    } finally {
      setHintsLoading((prev) => {
        const next = { ...prev };
        allKeys.forEach((k) => { next[k] = false; });
        return next;
      });
    }
  };

  // 見出し単位で再生成
  const handleRegenerateHintsForHeading = async (index: number) => {
    if (!apiKey || !themeTitle) return;
    const headingKey = `heading-ordered-${index}`;
    setHintsLoading((prev) => ({ ...prev, [headingKey]: true }));
    try {
      // 1見出しだけ送って再生成
      const result = await generateWritingHints(apiKey, themeTitle, direction, profile.profileText, [orderedHeadings[index]]);
      const newHints = result['heading-ordered-0'] || [];
      setWritingHints((prev) => ({ ...prev, [headingKey]: newHints }));
      setInsertedHints((prev) => {
        const next = { ...prev };
        delete next[headingKey];
        return next;
      });
    } catch (error: any) {
      // Silently fail — optional feature, but log for debugging
      console.warn('Single heading hints generation failed:', error?.message || error);
    } finally {
      setHintsLoading((prev) => ({ ...prev, [headingKey]: false }));
    }
  };

  // Auto-generate hints when experience tab is opened (once)
  useEffect(() => {
    if (activeSection === 'experience' && orderedHeadings.length > 0 && Object.keys(writingHints).length === 0 && !hintsGeneratedRef.current) {
      hintsGeneratedRef.current = true;
      handleGenerateHints();
    }
  }, [activeSection, orderedHeadings.length]);

  const insertHint = (index: number, hintText: string) => {
    const headingKey = `heading-ordered-${index}`;
    const qaBlock = `Q. ${hintText}\nA. `;
    setHeadingExperiences((prev) =>
      prev.map((exp, i) => {
        if (i !== index) return exp;
        const newText = exp.text.trim()
          ? `${exp.text}\n\n${qaBlock}`
          : qaBlock;
        return { ...exp, text: newText };
      })
    );
    // Mark as inserted
    setInsertedHints((prev) => {
      const set = new Set(prev[headingKey] || []);
      set.add(hintText);
      return { ...prev, [headingKey]: set };
    });
  };

  // ---- Generate outline ----
  const canGenerateNew =
    apiKey &&
    themeTitle &&
    direction.reader.trim() &&
    direction.problem.trim() &&
    orderedHeadings.length >= 3 &&
    headingExperiences.every((exp) => exp.text.trim());

  const canGenerateLegacy =
    apiKey &&
    themeTitle &&
    direction.reader.trim() &&
    direction.problem.trim() &&
    selectedPatternId !== null;

  const canGenerate = useNewFlow ? canGenerateNew : canGenerateLegacy;

  const handleGenerate = async () => {
    if (!analysis) return;

    if (useNewFlow && canGenerateNew) {
      startLoading('記事構成を生成中...', 'タイトル・本文・メタ情報を作成しています');
      try {
        const outlineResult = await generateOutline(
          apiKey,
          profile,
          analysis.styleProfile,
          themeTitle,
          direction,
          [], // no legacy points
          orderedHeadings,
          headingExperiences,
        );
        stopLoading();
        onGenerate(outlineResult);
      } catch (error: any) {
        stopLoading();
        const errorMsg = error?.message || '構成生成中にエラーが発生しました';
        onError(errorMsg);
        console.error('Outline generation error:', error);
      }
    } else if (canGenerateLegacy) {
      startLoading('記事構成を生成中...', 'タイトル・本文・メタ情報を作成しています');
      try {
        const selectedPoints = keyPoints.filter((p) => p.selected);
        const outlineResult = await generateOutline(
          apiKey,
          profile,
          analysis.styleProfile,
          themeTitle,
          direction,
          selectedPoints,
        );
        stopLoading();
        onGenerate(outlineResult);
      } catch (error: any) {
        stopLoading();
        const errorMsg = error?.message || '構成生成中にエラーが発生しました';
        onError(errorMsg);
        console.error('Legacy outline generation error:', error);
      }
    }
  };

  // Substep indicators for heading flow
  const headingSubStep = orderedHeadings.length > 0 ? 3 : headingOrders.length > 0 ? 2 : headingCandidates.length > 0 ? 1 : 0;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-bold tracking-widest text-xs uppercase" style={{ color: '#944a00' }}>Step 03</span>
            <h2 className="font-serif text-3xl md:text-4xl leading-tight mt-2 mb-3" style={{ color: '#1b1c1c' }}>インタビュー</h2>
          </div>
          <div className={`flex items-center gap-1 text-xs transition-opacity duration-300 ${showSaved ? 'opacity-100' : 'opacity-0'}`}>
            <span style={{ color: '#944a00' }}><CheckIcon size={12} /></span>
            <span style={{ color: '#944a00' }}>自動保存済み</span>
          </div>
        </div>
        <p style={{ color: '#564337' }} className="text-sm">
          テーマ: <span className="font-semibold" style={{ color: '#e67e22' }}>{themeTitle}</span>
        </p>
      </div>

      {/* Section tabs (step-by-step unlock) */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { key: 'direction' as const, label: '方向性', icon: LightbulbIcon, enabled: true },
          ...(useNewFlow
            ? [
                { key: 'headings' as const, label: '見出し設計', icon: SparklesIcon, enabled: headingCandidates.length > 0 },
                { key: 'experience' as const, label: 'インタビュー', icon: LightbulbIcon, enabled: orderedHeadings.length > 0 },
              ]
            : [
                { key: 'points' as const, label: '構成パターン', icon: SparklesIcon, enabled: true },
              ]),
        ].map(({ key, label, icon: Icon, enabled }) => (
          <button
            key={key}
            onClick={() => { if (enabled) { setActiveSection(key); window.scrollTo({ top: 0, behavior: 'smooth' }); } }}
            disabled={!enabled}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeSection === key
                ? 'text-stone-500 hover:bg-stone-100'
                : enabled
                ? 'text-stone-500 hover:bg-stone-100'
                : 'text-stone-300 cursor-not-allowed'
            }`}
            style={activeSection === key ? { background: '#fff0e0', color: '#944a00' } : undefined}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Direction Section */}
      {activeSection === 'direction' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <label className="block text-sm font-semibold text-stone-700 mb-1">テーマ</label>
            <p className="text-xs text-stone-400 mb-2">テーマ名を自由に編集できます。変更は以降のすべての処理に反映されます。</p>
            <input
              type="text"
              value={themeTitle}
              onChange={(e) => setThemeTitle(e.target.value)}
              placeholder="例: フリーランスが最初に学ぶべきお金の管理"
              className="w-full px-4 py-3 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 bg-stone-50"
              style={{ '--tw-ring-color': '#e67e22' } as React.CSSProperties}
            />
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <label className="block text-sm font-semibold text-stone-700 mb-1">記事スタイル</label>
            <p className="text-xs text-stone-400 mb-3">記事の語り口を選んでください</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'empathy' as const, label: '寄り添い型', desc: '読者の気持ちに共感しながら提案' },
                { value: 'senior' as const, label: '先輩型', desc: '経験者として具体的にアドバイス' },
                { value: 'howto_guide' as const, label: '手順紹介型', desc: 'ステップごとに実践方法を解説' },
              ]).map((opt) => {
                const isActive = direction.stance === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setDirection((prev) => ({ ...prev, stance: opt.value }))}
                    className={`text-left p-3 rounded-lg border-2 transition-all ${
                      isActive ? '' : 'border-stone-200 hover:border-stone-300'
                    }`}
                    style={isActive ? { borderColor: '#e67e22', background: '#fff8f0' } : {}}
                  >
                    <span className="block text-sm font-semibold" style={isActive ? { color: '#944a00' } : { color: '#1b1c1c' }}>
                      {opt.label}
                    </span>
                    <span className="block text-xs mt-0.5" style={{ color: '#564337' }}>{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <label className="block text-sm font-semibold text-stone-700 mb-1">想定読者</label>
            <p className="text-xs text-stone-400 mb-2">どんな人に届けたいですか？</p>
            <textarea
              value={direction.reader}
              onChange={(e) => setDirection((prev) => ({ ...prev, reader: e.target.value }))}
              placeholder="例: Web制作を始めたばかりのフリーランス"
              rows={2}
              className="w-full px-4 py-3 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-stone-50 resize-none"
            />
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <label className="block text-sm font-semibold text-stone-700 mb-1">読者の悩み</label>
            <p className="text-xs text-stone-400 mb-2">その読者が抱えている課題や悩みは何ですか？</p>
            <textarea
              value={direction.problem}
              onChange={(e) => setDirection((prev) => ({ ...prev, problem: e.target.value }))}
              placeholder="例: 案件の取り方がわからない、単価の設定に自信がない"
              rows={3}
              className="w-full px-4 py-3 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-stone-50 resize-none"
            />
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <label className="block text-sm font-semibold text-stone-700 mb-1">記事の結論<span className="text-xs font-normal text-stone-400 ml-1">（任意）</span></label>
            <p className="text-xs text-stone-400 mb-2">この記事で最終的に伝えたいメッセージがあれば教えてください。空欄でもOKです。</p>
            <textarea
              value={direction.conclusion}
              onChange={(e) => setDirection((prev) => ({ ...prev, conclusion: e.target.value }))}
              placeholder="例: まずは小さな実績を積むことが最短ルート"
              rows={2}
              className="w-full px-4 py-3 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-stone-50 resize-none"
            />
          </div>

          <div className="text-right">
            {useNewFlow ? (
              <button
                onClick={handleGenerateHeadings}
                disabled={!apiKey || !direction.reader.trim() || !direction.problem.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                style={{ background: '#e67e22' }}
              >
                <SparklesIcon size={16} />
                大見出し候補を生成する
              </button>
            ) : (
              <button
                onClick={() => {
                  handleGeneratePatterns();
                  setActiveSection('points');
                }}
                disabled={!apiKey || !direction.reader.trim() || !direction.problem.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                style={{ background: '#e67e22' }}
              >
                <SparklesIcon size={16} />
                構成パターンを生成する
              </button>
            )}
          </div>
        </div>
      )}

      {/* ===================== NEW FLOW: Heading Design ===================== */}
      {useNewFlow && activeSection === 'headings' && (
        <div className="space-y-6">
          {headingCandidates.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-stone-200">
              <LightbulbIcon className="mx-auto text-stone-300 mb-4" size={40} />
              <p className="text-stone-500 mb-4">方向性を入力して大見出し候補を生成してください</p>
              <button
                onClick={() => setActiveSection('direction')}
                className="text-sm font-medium"
                style={{ color: '#e67e22' }}
              >
                方向性タブへ移動
              </button>
            </div>
          ) : (
            <>
              {/* Sub-step 1: Select headings */}
              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold font-serif" style={{ color: '#1b1c1c' }}>1. 大見出しを選択</h3>
                    <p className="text-xs text-stone-400 mt-0.5">3個以上の見出しを選んでください（{selectedCount}個選択中）</p>
                  </div>
                  {selectedCount >= 3 && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full text-white" style={{ background: '#944a00' }}>OK</span>
                  )}
                </div>

                <div className="space-y-2 mb-3">
                  {headingCandidates.map((heading) => (
                    <div
                      key={heading.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                        heading.selected
                          ? ''
                          : 'border-stone-200 hover:border-stone-300'
                      }`}
                      style={heading.selected ? { borderColor: '#e67e22', background: 'rgba(230,126,34,0.05)' } : {}}
                    >
                      <input
                        type="checkbox"
                        checked={heading.selected}
                        onChange={() => toggleHeading(heading.id)}
                        className="w-4 h-4 rounded border-stone-300 cursor-pointer flex-shrink-0"
                        style={{ accentColor: '#e67e22' }}
                      />
                      <input
                        type="text"
                        value={heading.label}
                        onChange={(e) => updateHeadingLabel(heading.id, e.target.value)}
                        className="flex-1 text-sm text-stone-700 bg-transparent border-none outline-none focus:ring-0 p-0"
                      />
                    </div>
                  ))}
                </div>

                {/* Custom heading add */}
                <div className="flex gap-2 pt-2 border-t border-stone-100">
                  <input
                    type="text"
                    value={customHeadingInput}
                    onChange={(e) => setCustomHeadingInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && addCustomHeading()}
                    placeholder="オリジナルの見出しを追加..."
                    className="flex-1 px-3 py-2 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-2 bg-stone-50"
                    style={{ '--tw-ring-color': '#e67e22' } as React.CSSProperties}
                  />
                  <button
                    onClick={addCustomHeading}
                    disabled={!customHeadingInput.trim()}
                    className="px-3 py-2 text-xs text-stone-500 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 hover:text-stone-700 transition-colors flex items-center gap-1 disabled:opacity-40"
                  >
                    <PlusIcon size={12} />
                    追加
                  </button>
                </div>

                {/* Re-generate with keeping selected */}
                <div className="mt-3 pt-3 border-t border-stone-100 text-center">
                  <button
                    onClick={handleAddMoreHeadings}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs border rounded-lg transition-colors font-medium"
                    style={{ color: '#e67e22', borderColor: '#e67e22' }}
                  >
                    <SparklesIcon size={12} />
                    もっと候補を出す
                  </button>
                  <p className="text-xs text-stone-400 mt-1">選択済みの見出しはキープされます</p>
                </div>
              </div>

              {/* Generate order button */}
              {selectedCount >= 3 && headingOrders.length === 0 && (
                <div className="text-center">
                  <button
                    onClick={handleGenerateOrders}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-lg transition-colors"
                    style={{ background: '#e67e22' }}
                  >
                    <SparklesIcon size={16} />
                    並び順パターンを生成する
                  </button>
                </div>
              )}

              {/* Sub-step 2: Select order pattern */}
              {headingOrders.length > 0 && (
                <div ref={orderSectionRef} className="bg-white rounded-xl border border-stone-200 p-5">
                  <h3 className="text-sm font-bold font-serif mb-1" style={{ color: '#1b1c1c' }}>2. 並び順パターンを選択</h3>
                  <p className="text-xs text-stone-400 mb-3">3つの並び順から1つ選んでください</p>

                  <div className="space-y-3">
                    {headingOrders.map((order) => {
                      const isSelected = selectedOrderId === order.id;
                      return (
                        <button
                          key={order.id}
                          onClick={() => handleSelectOrder(order.id)}
                          className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                            isSelected
                              ? ''
                              : 'border-stone-200 hover:border-stone-300'
                          }`}
                          style={isSelected ? { borderColor: '#e67e22', background: 'rgba(230,126,34,0.05)' } : {}}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 mt-0.5 ${
                                isSelected ? '' : 'border-stone-300'
                              }`}
                              style={isSelected ? { background: '#e67e22', borderColor: '#e67e22' } : {}}
                            >
                              {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex flex-wrap gap-1 mb-2">
                                {order.headings.map((h, i) => (
                                  <React.Fragment key={i}>
                                    {i > 0 && <span className="text-sm" style={{ color: '#e67e22' }}>→</span>}
                                    <span className="text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded">{h}</span>
                                  </React.Fragment>
                                ))}
                              </div>
                              <p className="text-xs text-stone-500">{order.rationale}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Regenerate orders */}
                  <div className="mt-3 text-right">
                    <button
                      onClick={handleGenerateOrders}
                      className="text-xs text-stone-500 hover:text-stone-700 transition-colors"
                    >
                      並び順を再生成
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-step 3: Manual reorder with DnD */}
              {orderedHeadings.length > 0 && (
                <div className="bg-white rounded-xl border border-stone-200 p-5">
                  <h3 className="text-sm font-bold font-serif mb-1" style={{ color: '#1b1c1c' }}>3. 並び順を調整</h3>
                  <p className="text-xs text-stone-400 mb-3">ドラッグまたは矢印ボタンで並べ替えできます</p>

                  <div className="space-y-2">
                    {orderedHeadings.map((heading, index) => (
                      <div
                        key={`order-${index}`}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-grab active:cursor-grabbing ${
                          dragIndex === index ? 'opacity-70 border-stone-200 bg-white' : 'border-stone-200 bg-white'
                        }`}
                        style={dragIndex === index ? { borderColor: '#e67e22', background: 'rgba(230,126,34,0.05)' } : {}}
                      >
                        <span className="text-xs font-bold text-stone-400 w-5 text-center">{index + 1}</span>
                        <span className="flex-1 text-sm text-stone-700">{heading}</span>
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => moveHeading(index, index - 1)}
                            disabled={index === 0}
                            className="text-stone-400 hover:text-stone-600 disabled:opacity-20 text-xs leading-none p-0.5"
                            aria-label="上に移動"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveHeading(index, index + 1)}
                            disabled={index === orderedHeadings.length - 1}
                            className="text-stone-400 hover:text-stone-600 disabled:opacity-20 text-xs leading-none p-0.5"
                            aria-label="下に移動"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-right">
                    <button
                      onClick={() => { setActiveSection('experience'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-colors"
                      style={{ color: '#e67e22' }}
                    >
                      インタビューへ進む
                      <ArrowRightIcon size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ===================== NEW FLOW: Experience Input ===================== */}
      {useNewFlow && activeSection === 'experience' && (
        <div className="space-y-4">
          {orderedHeadings.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-stone-200">
              <LightbulbIcon className="mx-auto text-stone-300 mb-4" size={40} />
              <p className="text-stone-500 mb-4">先に見出しの選択と並べ替えを完了してください</p>
              <button
                onClick={() => setActiveSection('headings')}
                className="text-sm font-medium"
                style={{ color: '#e67e22' }}
              >
                見出し設計タブへ移動
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-stone-500">
                各見出しについて、<span className="font-semibold" style={{ color: '#e67e22' }}>あなたの体験や感情</span>を教えてください。
                これがAI記事生成の素材になります。
              </p>

              {orderedHeadings.map((heading, index) => {
                const exp = headingExperiences[index];
                if (!exp) return null;

                return (
                  <div key={`exp-${index}`} className="bg-white rounded-xl border border-stone-200 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold text-white w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#e67e22' }}>
                        {index + 1}
                      </span>
                      <h4 className="text-sm font-bold font-serif" style={{ color: '#1b1c1c' }}>{heading}</h4>
                    </div>

                    <textarea
                      value={exp.text}
                      onChange={(e) => updateExperienceText(index, e.target.value)}
                      placeholder={"下のインタビュー項目をクリックすると Q&A 形式で挿入されます。\nA. の後にあなたの体験やエピソードを教えてください。"}
                      rows={Math.max(5, (exp.text.match(/\n/g) || []).length + 2)}
                      className="w-full px-4 py-3 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 bg-stone-50 resize-y mb-3 font-mono leading-relaxed"
                      style={{ '--tw-ring-color': '#e67e22' } as React.CSSProperties}
                    />

                    {/* AI-generated writing hints */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-stone-400">
                          インタビュー
                          {hintsLoading[`heading-ordered-${index}`] && (
                            <span className="inline-flex items-center gap-1 ml-2" style={{ color: '#e67e22' }}>
                              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              生成中...
                            </span>
                          )}
                        </p>
                        <button
                          onClick={() => handleRegenerateHintsForHeading(index)}
                          disabled={!!hintsLoading[`heading-ordered-${index}`]}
                          className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors disabled:opacity-40"
                        >
                          <SparklesIcon size={10} />
                          再生成
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(writingHints[`heading-ordered-${index}`] || []).map((hint, hintIdx) => {
                          const isInserted = insertedHints[`heading-ordered-${index}`]?.has(hint);
                          return (
                            <button
                              key={hintIdx}
                              onClick={() => insertHint(index, hint)}
                              className={`text-xs px-3 py-1.5 rounded-full border transition-all inline-flex items-center gap-1 font-medium ${
                                isInserted
                                  ? 'opacity-60'
                                  : 'border-stone-200 hover:border-stone-300'
                              }`}
                              style={isInserted ? { background: '#f6f3f2', borderColor: '#dcc1b1', color: '#564337' } : {}}
                            >
                              {isInserted && <span style={{ color: '#944a00' }}><CheckIcon size={12} /></span>}
                              {hint}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

            </>
          )}
        </div>
      )}

      {/* ===================== LEGACY FLOW: Pattern Selection ===================== */}
      {!useNewFlow && activeSection === 'points' && (
        <div className="space-y-4">
          {outlinePatterns.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-stone-200">
              <LightbulbIcon className="mx-auto text-stone-300 mb-4" size={40} />
              <p className="text-stone-500 mb-4">方向性を入力して構成パターンを生成してください</p>
              <button
                onClick={() => setActiveSection('direction')}
                className="text-sm font-medium"
                style={{ color: '#e67e22' }}
              >
                方向性タブへ移動
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-stone-500">
                3つの構成パターンから<span className="font-semibold" style={{ color: '#e67e22' }}>1つ</span>を選択してください。
              </p>
              <div className="space-y-4">
                {outlinePatterns.map((pattern) => {
                  const isSelected = selectedPatternId === pattern.id;
                  return (
                    <button
                      key={pattern.id}
                      onClick={() => handleSelectPattern(pattern.id)}
                      className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
                        isSelected
                          ? ''
                          : 'border-stone-200 bg-white hover:border-stone-300'
                      }`}
                      style={isSelected ? { borderColor: '#e67e22', background: 'rgba(230,126,34,0.05)' } : {}}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 mt-0.5 ${
                            isSelected
                              ? ''
                              : 'border-stone-300'
                          }`}
                          style={isSelected ? { background: '#e67e22', borderColor: '#e67e22' } : {}}
                        >
                          {isSelected && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-bold font-serif" style={{ color: '#1b1c1c' }}>{pattern.concept}</p>
                          <p className="text-sm text-stone-600 mt-1">{pattern.storyArc}</p>

                          {/* Points with arrows */}
                          <div className="mt-3 space-y-1">
                            {pattern.points.map((point, idx) => (
                              <React.Fragment key={point.id}>
                                {idx > 0 && (
                                  <div className="flex items-center pl-2">
                                    <span className="text-lg leading-none" style={{ color: '#e67e22' }}>↓</span>
                                  </div>
                                )}
                                <div className="bg-stone-50 rounded-lg p-3">
                                  <p className="text-sm font-semibold text-stone-700">{point.label}</p>
                                  <p className="text-xs text-stone-500 mt-0.5">{point.description}</p>
                                </div>
                              </React.Fragment>
                            ))}
                          </div>

                          <p className="text-xs text-stone-400 mt-3 italic">{pattern.flowRationale}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Regeneration area */}
              <div className="bg-white rounded-xl border border-stone-200 p-4">
                <label className="block text-sm font-semibold text-stone-700 mb-2">パターンを再生成する</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={regenerateInput}
                    onChange={(e) => setRegenerateInput(e.target.value)}
                    placeholder="例: 〇〇の話を入れたい、もっと実践的に"
                    className="flex-1 px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-stone-50"
                  />
                  <button
                    onClick={() => {
                      handleGeneratePatterns(regenerateInput.trim() || undefined);
                      setRegenerateInput('');
                    }}
                    className="px-4 py-2 text-sm rounded-full font-medium transition-colors"
                    style={{ background: '#e67e22', color: '#502600', boxShadow: '0 10px 30px -8px rgba(148,74,0,0.15)' }}
                  >
                    再生成する
                  </button>
                </div>
                <p className="text-xs text-stone-400 mt-1">リクエストを入力して再生成できます。空欄でもOKです。</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm hover:text-stone-800 transition-colors"
          style={{ color: '#564337' }}
        >
          <ChevronLeftIcon size={16} />
          戻る
        </button>
        {((useNewFlow && activeSection === 'experience') || (!useNewFlow && activeSection === 'points')) && (
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            style={{ background: '#e67e22', color: '#502600', boxShadow: '0 10px 30px -8px rgba(148,74,0,0.15)' }}
          >
            <SparklesIcon size={18} />
            記事構成をつくる
          </button>
        )}
      </div>
    </div>
  );
}
