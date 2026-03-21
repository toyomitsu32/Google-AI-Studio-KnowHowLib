import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  AppStep,
  UserProfile,
  ProfileAnalysis,
  ExtractedSkill,
  ArticleTheme,
  ArticleDirection,
  KeyPoint,
  OutlinePattern,
  ArticleOutline,
  HeadingCandidate,
  HeadingOrder,
  HeadingExperience,
} from './types';
import { createDebouncedStorage } from './utils/storage';
import { saveToStorage, loadFromStorage, clearAllStorage } from './utils/storage';
import { inferDirectionFromTheme } from './services/geminiService';
import Hub from './components/Hub';
import ProfileInput from './components/ProfileInput';
import AnalysisResult from './components/AnalysisResult';
import ArticleDesign from './components/ArticleDesign';
import OutlineResult from './components/OutlineResult';
import ImagePromptStep from './components/ImagePromptStep';
import PublishStep from './components/PublishStep';
import ShareStep from './components/ShareStep';
import LoadingOverlay from './components/LoadingOverlay';
import ErrorBoundary from './components/ErrorBoundary';
import { KeyIcon, BookOpenIcon } from './components/icons';

const INITIAL_PROFILE: UserProfile = { profileText: '' };

function migrateProfile(stored: any): UserProfile {
  if (!stored) return INITIAL_PROFILE;
  if (typeof stored.profileText === 'string') return stored;
  // Migrate from old multi-field format
  const parts = [stored.introduction, stored.experiences, stored.values, stored.writingSample]
    .filter(Boolean)
    .join('\n\n');
  return { profileText: parts || '' };
}

const INITIAL_DIRECTION: ArticleDirection = {
  reader: '',
  problem: '',
  conclusion: '',
  stance: 'empathy',
};

function getApiKey(): string {
  if (typeof window !== 'undefined' && (window as any).aistudio?.apiKey) {
    return (window as any).aistudio.apiKey;
  }
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  if (process.env.API_KEY) {
    return process.env.API_KEY;
  }
  return '';
}

function AppContent() {
  const [step, setStep] = useState<AppStep>(
    () => loadFromStorage<AppStep>('step') || AppStep.HUB
  );
  const [apiKey, setApiKey] = useState<string>(() => {
    return getApiKey() || loadFromStorage<string>('apiKey') || '';
  });
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingSubMessage, setLoadingSubMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile>(
    () => migrateProfile(loadFromStorage('profile'))
  );
  const [analysis, setAnalysis] = useState<ProfileAnalysis | null>(
    () => loadFromStorage<ProfileAnalysis>('analysis')
  );
  const [categorizedThemes, setCategorizedThemes] = useState<Record<string, ArticleTheme[]>>(
    () => loadFromStorage<Record<string, ArticleTheme[]>>('categorizedThemes') || {}
  );
  const [selectedTheme, setSelectedTheme] = useState<ArticleTheme | null>(
    () => loadFromStorage<ArticleTheme>('selectedTheme')
  );
  const [customTheme, setCustomTheme] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<ExtractedSkill | null>(
    () => loadFromStorage<ExtractedSkill>('selectedSkill')
  );
  const [selectedAngle, setSelectedAngle] = useState<string | null>(
    () => loadFromStorage<string>('selectedAngle')
  );
  // Step 3 redesign: heading-centric states
  const [headingCandidates, setHeadingCandidates] = useState<HeadingCandidate[]>(
    () => loadFromStorage<HeadingCandidate[]>('headingCandidates') || []
  );
  const [headingOrders, setHeadingOrders] = useState<HeadingOrder[]>(
    () => loadFromStorage<HeadingOrder[]>('headingOrders') || []
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    () => loadFromStorage<string | null>('selectedOrderId') || null
  );
  const [orderedHeadings, setOrderedHeadings] = useState<string[]>(
    () => loadFromStorage<string[]>('orderedHeadings') || []
  );
  const [headingExperiences, setHeadingExperiences] = useState<HeadingExperience[]>(
    () => loadFromStorage<HeadingExperience[]>('headingExperiences') || []
  );
  const [direction, setDirection] = useState<ArticleDirection>(
    () => loadFromStorage<ArticleDirection>('direction') || INITIAL_DIRECTION
  );
  const [keyPoints, setKeyPoints] = useState<KeyPoint[]>(
    () => loadFromStorage<KeyPoint[]>('keyPoints') || []
  );
  const [outlinePatterns, setOutlinePatterns] = useState<OutlinePattern[]>(
    () => loadFromStorage<OutlinePattern[]>('outlinePatterns') || []
  );
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(
    () => loadFromStorage<string | null>('selectedPatternId') || null
  );
  const [outline, setOutline] = useState<ArticleOutline | null>(
    () => loadFromStorage<ArticleOutline>('outline')
  );
  // Step 3 で編集可能なテーマタイトル
  const [themeTitle, setThemeTitle] = useState<string>(
    () => loadFromStorage<string>('themeTitle') || ''
  );
  // AI生成の書き方ヒント
  const [writingHints, setWritingHints] = useState<Record<string, string[]>>(
    () => loadFromStorage<Record<string, string[]>>('writingHints') || {}
  );
  // テーマ変更検知用: Step 3 のデータがどのテーマに基づくかを追跡
  const [designThemeKey, setDesignThemeKey] = useState<string | null>(
    () => loadFromStorage<string | null>('designThemeKey') || null
  );

  // Scroll to top on step change
  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

  // Debounced storage writers for frequently-modified states
  const debouncedProfileRef = useRef<ReturnType<typeof import('./utils/storage').createDebouncedStorage> | null>(null);
  const debouncedThemeTitleRef = useRef<ReturnType<typeof import('./utils/storage').createDebouncedStorage> | null>(null);
  const debouncedDirectionRef = useRef<ReturnType<typeof import('./utils/storage').createDebouncedStorage> | null>(null);

  useEffect(() => {
    if (!debouncedProfileRef.current) {
      debouncedProfileRef.current = createDebouncedStorage('profile', 800);
      debouncedThemeTitleRef.current = createDebouncedStorage('themeTitle', 800);
      debouncedDirectionRef.current = createDebouncedStorage('direction', 800);
    }
    debouncedProfileRef.current?.save(profile);
  }, [profile]);

  useEffect(() => {
    debouncedThemeTitleRef.current?.save(themeTitle);
  }, [themeTitle]);

  useEffect(() => {
    debouncedDirectionRef.current?.save(direction);
  }, [direction]);

  // Persist (immediate for less-frequently-modified states)
  useEffect(() => { saveToStorage('step', step); }, [step]);
  useEffect(() => { saveToStorage('analysis', analysis); }, [analysis]);
  useEffect(() => { saveToStorage('categorizedThemes', categorizedThemes); }, [categorizedThemes]);
  useEffect(() => { saveToStorage('selectedTheme', selectedTheme); }, [selectedTheme]);
  useEffect(() => { saveToStorage('selectedSkill', selectedSkill); }, [selectedSkill]);
  useEffect(() => { saveToStorage('selectedAngle', selectedAngle); }, [selectedAngle]);
  useEffect(() => { saveToStorage('headingCandidates', headingCandidates); }, [headingCandidates]);
  useEffect(() => { saveToStorage('headingOrders', headingOrders); }, [headingOrders]);
  useEffect(() => { saveToStorage('selectedOrderId', selectedOrderId); }, [selectedOrderId]);
  useEffect(() => { saveToStorage('orderedHeadings', orderedHeadings); }, [orderedHeadings]);
  useEffect(() => { saveToStorage('headingExperiences', headingExperiences); }, [headingExperiences]);
  useEffect(() => { saveToStorage('keyPoints', keyPoints); }, [keyPoints]);
  useEffect(() => { saveToStorage('outlinePatterns', outlinePatterns); }, [outlinePatterns]);
  useEffect(() => { saveToStorage('selectedPatternId', selectedPatternId); }, [selectedPatternId]);
  useEffect(() => { saveToStorage('outline', outline); }, [outline]);
  useEffect(() => { saveToStorage('writingHints', writingHints); }, [writingHints]);
  useEffect(() => { saveToStorage('designThemeKey', designThemeKey); }, [designThemeKey]);

  const handleSaveApiKey = useCallback(() => {
    if (apiKeyDraft.trim()) {
      setApiKey(apiKeyDraft.trim());
      saveToStorage('apiKey', apiKeyDraft.trim());
      setShowApiKeyInput(false);
      setApiKeyDraft('');
    }
  }, [apiKeyDraft]);

  const hasApiKey = !!apiKey;
  const isAdmin = !!(apiKey && import.meta.env.VITE_ADMIN_API_KEY && apiKey === import.meta.env.VITE_ADMIN_API_KEY);

  const startLoading = useCallback((msg: string, sub: string = 'しばらくお待ちください') => {
    setLoading(true);
    setLoadingMessage(msg);
    setLoadingSubMessage(sub);
    setError(null);
  }, []);

  const stopLoading = useCallback(() => {
    setLoading(false);
  }, []);

  const handleError = useCallback((msg: string) => {
    setError(msg);
    setLoading(false);
  }, []);

  // Step 3 以降の状態をリセット
  const clearDesignState = useCallback(() => {
    setThemeTitle('');
    setDirection(INITIAL_DIRECTION);
    setKeyPoints([]);
    setOutlinePatterns([]);
    setSelectedPatternId(null);
    setOutline(null);
    setHeadingCandidates([]);
    setHeadingOrders([]);
    setSelectedOrderId(null);
    setOrderedHeadings([]);
    setHeadingExperiences([]);
    setWritingHints({});
  }, []);

  const handleRestart = useCallback(() => {
    if (!window.confirm('新しいインタビューを始めますか？\n（プロフィールは保持されます。それ以外のデータはリセットされます）')) {
      return;
    }
    // Preserve API key and profile, clear everything else
    const currentProfile = profile;
    clearAllStorage();
    saveToStorage('apiKey', apiKey);
    saveToStorage('profile', currentProfile);
    // Reset all state EXCEPT profile
    setAnalysis(null);
    setCategorizedThemes({});
    setSelectedTheme(null);
    setCustomTheme('');
    setThemeTitle('');
    setSelectedSkill(null);
    setSelectedAngle(null);
    setDirection(INITIAL_DIRECTION);
    setKeyPoints([]);
    setOutlinePatterns([]);
    setSelectedPatternId(null);
    setOutline(null);
    setHeadingCandidates([]);
    setHeadingOrders([]);
    setSelectedOrderId(null);
    setOrderedHeadings([]);
    setHeadingExperiences([]);
    setWritingHints({});
    setDesignThemeKey(null);
    setError(null);
    setStep(AppStep.PROFILE_INPUT);
  }, [apiKey, profile]);

  const stepLabels: { step: AppStep; label: string }[] = [
    { step: AppStep.PROFILE_INPUT, label: '著者紹介' },
    { step: AppStep.ANALYSIS, label: '企画' },
    { step: AppStep.DESIGN, label: 'インタビュー' },
    { step: AppStep.OUTPUT, label: '原稿' },
    { step: AppStep.IMAGE_PROMPTS, label: '挿絵' },
    { step: AppStep.PUBLISH, label: '入稿' },
    { step: AppStep.SHARE, label: '拡散' },
  ];

  const stepIndex = stepLabels.findIndex((s) => s.step === step);

  // 各ステップにデータが存在するかで到達可能性を判定
  const canNavigateTo = useCallback((targetStep: AppStep): boolean => {
    switch (targetStep) {
      case AppStep.PROFILE_INPUT:
        return true;
      case AppStep.ANALYSIS:
        return !!analysis;
      case AppStep.DESIGN:
        return !!analysis && !!themeTitle;
      case AppStep.OUTPUT:
        return !!outline;
      case AppStep.IMAGE_PROMPTS:
        return !!outline;
      case AppStep.PUBLISH:
        return !!outline;
      case AppStep.SHARE:
        return !!outline;
      default:
        return false;
    }
  }, [analysis, themeTitle, outline]);

  const handleCrawlUpdate = useCallback(async () => {
    const res = await fetch('/api/crawl-update', { method: 'POST' });
    return res.json();
  }, []);

  if (step === AppStep.HUB) {
    return <Hub onStart={() => setStep(AppStep.PROFILE_INPUT)} isAdmin={isAdmin} onCrawlUpdate={handleCrawlUpdate} />;
  }

  return (
    <div className="min-h-screen" style={{ background: '#fbf9f8' }}>
      {loading && <LoadingOverlay message={loadingMessage} subMessage={loadingSubMessage} sourceText={profile.profileText || themeTitle || ''} />}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep(AppStep.HUB)} className="font-serif italic text-xl" style={{ color: '#1b1c1c' }}>
              ノウハウ出版社
            </button>
          </div>

          {/* Step navigation */}
          <div className="flex items-center gap-1 sm:gap-2">
            {stepLabels.map((s, i) => {
              const isCurrent = s.step === step;
              const isReachable = canNavigateTo(s.step);
              return (
                <React.Fragment key={s.step}>
                  {i > 0 && (
                    <div className={`w-4 sm:w-8 h-0.5 ${isReachable ? '' : 'bg-stone-200'}`} style={isReachable ? { background: '#944a00' } : {}} />
                  )}
                  <button
                    onClick={() => isReachable && !isCurrent && setStep(s.step)}
                    disabled={!isReachable && !isCurrent}
                    className={`font-serif text-sm px-3 py-1.5 rounded-full transition-colors ${
                      isCurrent
                        ? 'font-semibold'
                        : isReachable
                        ? 'cursor-pointer hover:bg-stone-100'
                        : ''
                    }`}
                    style={
                      isCurrent
                        ? { background: '#e67e22', color: '#502600' }
                        : isReachable
                        ? { color: '#944a00' }
                        : { color: '#a8a29e' }
                    }
                  >
                    <span className="hidden sm:inline">{s.label}</span>
                    <span className="sm:hidden">{i + 1}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* API Key */}
          <div className="relative">
            <button
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
              className={`p-2 rounded-lg transition-colors bg-stone-100 hover:bg-stone-200`}
              style={{ color: '#944a00' }}
              title={hasApiKey ? 'APIキー設定済み' : 'APIキーを設定'}
            >
              <KeyIcon size={18} />
            </button>
            {showApiKeyInput && (
              <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-stone-200 p-4 w-80 z-50">
                <p className="text-xs text-stone-500 mb-2">Gemini APIキー</p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKeyDraft}
                    onChange={(e) => setApiKeyDraft(e.target.value)}
                    placeholder="AIzaSy..."
                    className="flex-1 px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
                  />
                  <button
                    onClick={handleSaveApiKey}
                    className="px-3 py-2 text-sm rounded-full"
                    style={{ background: '#e67e22', color: '#502600' }}
                  >
                    保存
                  </button>
                </div>
                {hasApiKey && (
                  <p className="text-xs text-teal-600 mt-2">APIキー設定済み</p>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="max-w-5xl mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {!hasApiKey && (
          <div className="mb-6 border rounded-xl text-sm px-4 py-3" style={{ background: '#fffbeb', borderColor: '#e67e22', color: '#944a00' }}>
            APIキーが設定されていません。右上の鍵アイコンからGemini APIキーを設定してください。
          </div>
        )}

        {step === AppStep.PROFILE_INPUT && (
          <ProfileInput
            profile={profile}
            setProfile={setProfile}
            apiKey={apiKey}
            onAnalyzed={(result) => {
              setAnalysis(result);
              setCategorizedThemes({});
              // 再分析時: Step 2 以降の選択・入力をすべてクリア
              setSelectedTheme(null);
              setCustomTheme('');
              setSelectedSkill(null);
              setSelectedAngle(null);
              clearDesignState();
              setDesignThemeKey(null);
              setStep(AppStep.ANALYSIS);
            }}
            startLoading={startLoading}
            stopLoading={stopLoading}
            onError={handleError}
          />
        )}

        {step === AppStep.ANALYSIS && (
          <AnalysisResult
            analysis={analysis}
            setAnalysis={setAnalysis}
            categorizedThemes={categorizedThemes}
            setCategorizedThemes={setCategorizedThemes}
            selectedTheme={selectedTheme}
            setSelectedTheme={setSelectedTheme}
            customTheme={customTheme}
            setCustomTheme={setCustomTheme}
            selectedSkill={selectedSkill}
            setSelectedSkill={setSelectedSkill}
            selectedAngle={selectedAngle}
            setSelectedAngle={setSelectedAngle}
            apiKey={apiKey}
            profile={profile}
            startLoading={startLoading}
            stopLoading={stopLoading}
            onError={handleError}
            onProceed={async () => {
              const currentKey = selectedTheme?.id || customTheme.trim() || null;
              const isNewTheme = currentKey !== designThemeKey;
              if (isNewTheme) {
                clearDesignState();
                setDesignThemeKey(currentKey);
              }
              // Initialize editable theme title (only when theme changed, preserve user edits otherwise)
              const initialTitle = selectedTheme?.title || customTheme.trim();
              if (isNewTheme) {
                setThemeTitle(initialTitle);
              }
              // Infer direction from theme (only for new themes)
              const titleForInference = isNewTheme ? initialTitle : themeTitle;
              if (isNewTheme && titleForInference && apiKey) {
                // Pre-fill from selectedTheme card data if available
                const preReader = selectedTheme?.audience || '';
                const preProblem = selectedTheme?.problem || '';
                if (preReader || preProblem) {
                  setDirection((prev) => ({
                    ...prev,
                    reader: preReader,
                    problem: preProblem,
                  }));
                }
                // Always call LLM to fill remaining fields (conclusion, or reader/problem for custom themes)
                startLoading('テーマの方向性を分析中...', 'テーマから想定読者・悩み・結論を推定しています');
                try {
                  const inferred = await inferDirectionFromTheme(apiKey, titleForInference, profile.profileText);
                  setDirection((prev) => ({
                    ...prev,
                    reader: prev.reader || inferred.reader,
                    problem: prev.problem || inferred.problem,
                    conclusion: prev.conclusion || inferred.conclusion,
                  }));
                  stopLoading();
                } catch {
                  stopLoading();
                  // silently continue — user can fill manually
                }
              }
              setStep(AppStep.DESIGN);
            }}
            onBack={() => setStep(AppStep.PROFILE_INPUT)}
          />
        )}

        {step === AppStep.DESIGN && (
          <ArticleDesign
            apiKey={apiKey}
            profile={profile}
            analysis={analysis}
            themeTitle={themeTitle}
            setThemeTitle={setThemeTitle}
            direction={direction}
            setDirection={setDirection}
            keyPoints={keyPoints}
            setKeyPoints={setKeyPoints}
            outlinePatterns={outlinePatterns}
            setOutlinePatterns={setOutlinePatterns}
            selectedPatternId={selectedPatternId}
            setSelectedPatternId={setSelectedPatternId}
            headingCandidates={headingCandidates}
            setHeadingCandidates={setHeadingCandidates}
            headingOrders={headingOrders}
            setHeadingOrders={setHeadingOrders}
            selectedOrderId={selectedOrderId}
            setSelectedOrderId={setSelectedOrderId}
            orderedHeadings={orderedHeadings}
            setOrderedHeadings={setOrderedHeadings}
            headingExperiences={headingExperiences}
            setHeadingExperiences={setHeadingExperiences}
            writingHints={writingHints}
            setWritingHints={setWritingHints}
            onGenerate={(outlineData) => {
              setOutline(outlineData);
              setStep(AppStep.OUTPUT);
            }}
            startLoading={startLoading}
            stopLoading={stopLoading}
            onError={handleError}
            onBack={() => setStep(AppStep.ANALYSIS)}
          />
        )}

        {step === AppStep.OUTPUT && (
          <OutlineResult
            outline={outline}
            profile={profile}
            analysis={analysis}
            selectedTheme={selectedTheme}
            direction={direction}
            keyPoints={keyPoints}
            onBack={() => setStep(AppStep.DESIGN)}
            onNext={() => setStep(AppStep.IMAGE_PROMPTS)}
          />
        )}

        {step === AppStep.IMAGE_PROMPTS && (
          <ImagePromptStep
            outline={outline}
            onBack={() => setStep(AppStep.OUTPUT)}
            onNext={() => setStep(AppStep.PUBLISH)}
            onRestart={handleRestart}
          />
        )}

        {step === AppStep.PUBLISH && (
          <PublishStep
            outline={outline}
            onBack={() => setStep(AppStep.IMAGE_PROMPTS)}
            onRestart={handleRestart}
            onProceed={() => setStep(AppStep.SHARE)}
          />
        )}

        {step === AppStep.SHARE && (
          <ShareStep
            outline={outline}
            onBack={() => setStep(AppStep.PUBLISH)}
            onRestart={handleRestart}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
