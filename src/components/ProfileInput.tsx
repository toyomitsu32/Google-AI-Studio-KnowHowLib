import React from 'react';
import {
  UserProfile,
  ProfileAnalysis,
} from '../types';
import { SparklesIcon } from './icons';
import { analyzeProfile } from '../services/geminiService';

interface ProfileInputProps {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  apiKey: string;
  onAnalyzed: (analysis: ProfileAnalysis) => void;
  startLoading: (msg: string, sub?: string) => void;
  stopLoading: () => void;
  onError: (msg: string) => void;
}

export default function ProfileInput({
  profile,
  setProfile,
  apiKey,
  onAnalyzed,
  startLoading,
  stopLoading,
  onError,
}: ProfileInputProps) {
  const canSubmit = apiKey && profile.profileText.trim().length > 0;

  const handleAnalyze = async () => {
    if (!canSubmit) return;

    startLoading('あなたのプロフィールを分析中...', 'AIが人物像と文体を読み解いています');
    try {
      const analysisResult = await analyzeProfile(apiKey, profile);
      stopLoading();
      onAnalyzed(analysisResult);
    } catch (error: any) {
      stopLoading();
      // Provide user-friendly error message
      const errorMsg = error?.message || 'プロフィール分析中にエラーが発生しました';
      onError(errorMsg);
      // Log for debugging
      console.error('Profile analysis error:', error);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <span className="font-bold tracking-widest text-xs uppercase" style={{ color: '#944a00' }}>Step 01</span>
        <h2 className="font-serif text-3xl md:text-4xl leading-tight mt-2 mb-3" style={{ color: '#1b1c1c' }}>まずは自己紹介</h2>
        <p className="text-base leading-relaxed" style={{ color: '#564337' }}>
          あなた自身のことを自由に教えてください。編集部があなたの人物像と文体を読み解き、最適なテーマを提案します。
        </p>
      </div>

      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e7e5e4' }}>
        <label className="block text-sm font-bold mb-1" style={{ color: '#1b1c1c' }}>
          プロフィール<span className="text-red-400 ml-0.5">*</span>
        </label>
        <p className="text-xs mb-3" style={{ color: '#564337' }}>
          自己紹介、経験・得意なこと、価値観・大切にしていることなどを自由に教えてください。
          普段の言葉づかいで書くと、文体の分析精度が上がります。
        </p>
        <textarea
          value={profile.profileText}
          onChange={(e) => setProfile({ profileText: e.target.value })}
          rows={12}
          className="w-full px-4 py-3 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none bg-stone-50"
          placeholder={`例:\n私はWebデザイナーとして10年ほど活動しています。\nもともとは印刷系のデザインをしていましたが、独学でWebを学び、フリーランスとして独立しました。\n\n得意なのはLP制作と、クライアントの想いを形にするヒアリングです。\n大切にしているのは「伝わるデザイン」。見た目だけでなく、ユーザーの行動につながるデザインを心がけています。`}
        />
        <p className="text-xs text-stone-400 mt-2 text-right">
          {profile.profileText.length} 文字
        </p>
      </div>

      {/* Submit */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleAnalyze}
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 px-6 py-3 font-medium rounded-full shadow-xl transition-all duration-300 hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          style={{ background: '#e67e22', color: '#502600', boxShadow: '0 20px 40px -12px rgba(148,74,0,0.15)' }}
        >
          <SparklesIcon size={18} />
          編集部に送る
        </button>
      </div>
    </div>
  );
}
