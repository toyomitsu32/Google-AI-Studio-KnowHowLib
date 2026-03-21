import { GoogleGenAI } from '@google/genai';
import type {
  UserProfile,
  ProfileAnalysis,
  ExtractedSkill,
  StyleProfile,
  ArticleTheme,
  ArticleDirection,
  KeyPoint,
  OutlinePattern,
  ArticleOutline,
  HeadingCandidate,
  HeadingOrder,
  HeadingExperience,
} from '../types';

const MODEL = 'gemini-2.5-flash';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function getClient(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

// プロフィール由来の表記ゆれを正規化（全プロンプトに適用）
const TEXT_REPLACEMENTS: [RegExp, string][] = [
  [/リベ大/g, 'リベシティ'],
];

function normalizePrompt(text: string): string {
  return TEXT_REPLACEMENTS.reduce((t, [pattern, replacement]) => t.replace(pattern, replacement), text);
}

/**
 * Classify API errors for proper handling
 */
function classifyError(error: any): { type: 'rate-limit' | 'auth' | 'network' | 'timeout' | 'unknown'; message: string } {
  const errorStr = error?.message || String(error);
  const status = error?.status || error?.code;

  if (status === 429 || errorStr.includes('quota') || errorStr.includes('rate limit')) {
    return { type: 'rate-limit', message: 'APIリクエストが多すぎます。しばらく待ってから再度お試しください。' };
  }
  if (status === 401 || status === 403 || errorStr.includes('API key') || errorStr.includes('unauthorized')) {
    return { type: 'auth', message: 'APIキーが無効です。設定を確認してください。' };
  }
  if (error?.name === 'AbortError' || errorStr.includes('timeout')) {
    return { type: 'timeout', message: 'リクエストがタイムアウトしました。接続を確認して再度お試しください。' };
  }
  if (!navigator.onLine || errorStr.includes('network') || errorStr.includes('fetch')) {
    return { type: 'network', message: 'ネットワーク接続を確認してください。' };
  }
  return { type: 'unknown', message: errorStr || 'AIとの通信中にエラーが発生しました。' };
}

async function callGemini(apiKey: string, prompt: string, useSearch = false, retryCount = 0): Promise<string> {
  try {
    const client = getClient(apiKey);
    const response = await client.models.generateContent({
      model: MODEL,
      contents: normalizePrompt(prompt),
      ...(useSearch && { tools: [{ googleSearch: {} }] }),
    });
    const text = response.text;
    if (!text) throw new Error('AIからの応答がありませんでした');
    return text;
  } catch (error: any) {
    const classification = classifyError(error);

    // Retry on rate limit and network errors
    if ((classification.type === 'rate-limit' || classification.type === 'network') && retryCount < MAX_RETRIES) {
      const delayMs = RETRY_DELAY_MS * Math.pow(2, retryCount); // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return callGemini(apiKey, prompt, useSearch, retryCount + 1);
    }

    // Throw user-friendly error
    throw new Error(classification.message);
  }
}

function repairTruncatedJSON(jsonStr: string): string {
  // Try to repair JSON that was truncated mid-stream
  let s = jsonStr.trim();

  // Remove trailing comma before attempting to close
  s = s.replace(/,\s*$/, '');

  // Count unmatched brackets/braces
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escape = false;
  for (const ch of s) {
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braces++;
    else if (ch === '}') braces--;
    else if (ch === '[') brackets++;
    else if (ch === ']') brackets--;
  }

  // If we're inside an unterminated string, close it
  if (inString) s += '"';

  // Remove trailing incomplete key-value (e.g. `"key": "unfinished`)
  // Already handled by closing the string above

  // Close unclosed braces/brackets
  while (braces > 0) { s += '}'; braces--; }
  while (brackets > 0) { s += ']'; brackets--; }

  return s;
}

function extractJSON(text: string): any {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    const start = jsonStr.indexOf('{');
    const startArr = jsonStr.indexOf('[');
    const idx = start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
    if (idx === -1) throw new Error('AIの応答からJSONを解析できませんでした');
    const sub = jsonStr.slice(idx);
    try {
      return JSON.parse(sub);
    } catch {
      // Attempt to repair truncated JSON
      const repaired = repairTruncatedJSON(sub);
      try {
        return JSON.parse(repaired);
      } catch {
        throw new Error('AIの応答が途中で切れたため、JSONを解析できませんでした。再度お試しください。');
      }
    }
  }
}

// ============================================================
// 1. analyzeProfile
// ============================================================
export async function analyzeProfile(
  apiKey: string,
  profile: UserProfile
): Promise<ProfileAnalysis> {
  const prompt = `あなたは「ノウハウ図書館」の記事設計AIです。以下のプロフィール文を分析し、この人の記事執筆者としての特徴を抽出してください。

## プロフィール
${profile.profileText}

## タスク
上記のプロフィール文から以下を分析してください：
1. 人物特徴（この人にしかない経験の組み合わせ、読者がこの人の記事を読む理由、同ジャンル執筆者との差別点）
   - 「向上心がある」「努力家」のような汎用的な性格記述は避け、具体的な経験や強みの組み合わせを記述すること
2. 文体プロファイル（プロフィール文から推定する記事執筆時の文体傾向）
   - プロフィール文の文体と記事執筆時の文体は異なる可能性があることに留意
3. この人に合う記事テーマ（抽象的な「体験談」「ハウツー」ではなく、具体的な記事テーマとして成立するレベル）
4. この人のスキル・強み（10個）。記事テーマの起点として使える、具体的で差別化された能力・経験、家族構成、専門資格を抽出すること

## 注意事項
- 顔文字（(^^), (笑) 等）や記号装飾（♪, ☆, ！ 等）はプロフィールの個性として認識するが、frequentExpressionsには含めないこと
- frequentExpressionsには記事を書く際に使いそうな**言い回しや文末表現**を入れること（例: 「〜なんですよね」「正直に言うと」）

## 出力形式（JSON）
以下のJSON形式で出力してください。必ず有効なJSONのみを出力してください。

\`\`\`json
{
  "personality": "この人の人物特徴を200文字程度で記述。具体的な経験の組み合わせ、読者がこの人の記事を読む理由を中心に。",
  "writingStyle": "記事を書いた場合に想定される文体の特徴を150文字程度で記述。",
  "articleTypes": ["具体的な記事テーマ案を3-5個（例: SIerからWeb系への転職で年収を上げるロードマップ）"],
  "styleProfile": {
    "politeness": "丁寧さのレベル（例: カジュアル、やや丁寧、敬語中心）",
    "warmth": "温度感（例: 温かみがある、クール、情熱的）",
    "distance": "読者との距離感（例: 友達のよう、先輩後輩、プロフェッショナル）",
    "emotionExpression": "感情表現の度合い（例: 控えめ、率直、豊か）",
    "sentenceLength": "文の傾向（例: 短文中心、バランス型、説明が丁寧）",
    "frequentExpressions": ["記事で使いそうな言い回し・文末表現を3-5個"]
  },
  "skills": [
    { "id": "skill-1", "label": "スキル/強みの短い名前", "description": "このスキルの詳細説明（どんな経験に基づくか、記事テーマにどう活かせるか）" }
  ]
}
\`\`\``;

  const raw = await callGemini(apiKey, prompt);
  const result = extractJSON(raw) as ProfileAnalysis;
  // Backward compatibility: ensure skills array exists
  if (!result.skills) result.skills = [];
  return result;
}

// ============================================================
// 2. generateCategoryThemes / regenerateCategoryThemes
// ============================================================

export type ThemeCategoryKey = 'howto' | 'mindset' | 'story' | 'failure' | 'funny' | 'other';

export const THEME_CATEGORIES: Record<ThemeCategoryKey, { label: string; instruction: string }> = {
  howto: {
    label: 'ハウツー',
    instruction: '具体的な手順・方法論・ノウハウを中心にしたテーマ。読者がすぐ実践できるような「やり方」を伝える記事。',
  },
  mindset: {
    label: 'マインド・考え方',
    instruction: '価値観・哲学・思考法を中心にしたテーマ。読者の考え方を変えるきっかけになる記事。',
  },
  story: {
    label: '体験談・ストーリー',
    instruction: '個人的な経験・ストーリーを中心にしたテーマ。読者が感情移入できるリアルな体験記。',
  },
  failure: {
    label: '失敗談・教訓',
    instruction: '失敗から学んだこと・教訓を中心にしたテーマ。やらかしエピソードや後悔から得た学びを共有する記事。',
  },
  funny: {
    label: '面白エピソード',
    instruction: 'ユニークで意外性のある面白いエピソードを中心にしたテーマ。思わず「へぇ！」と言いたくなる切り口、ギャップのある経験、笑える裏話など。',
  },
  other: {
    label: 'その他',
    instruction: '上記カテゴリに収まらないユニークな切り口のテーマ。比較・まとめ・ランキング・意外な掛け合わせなど自由な発想で。',
  },
};

export const THEME_CATEGORY_KEYS: ThemeCategoryKey[] = ['howto', 'mindset', 'story', 'failure', 'funny', 'other'];

function buildThemePrompt(
  profile: UserProfile,
  analysis: ProfileAnalysis,
  categoryKey: ThemeCategoryKey,
  previousThemes?: string[],
  freeText?: string,
): string {
  const cat = THEME_CATEGORIES[categoryKey];

  const excludeSection = previousThemes && previousThemes.length > 0
    ? `\n## 除外テーマ（以下と重複・類似するテーマは絶対に提案しないこと）\n${previousThemes.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n`
    : '';

  const freeTextSection = freeText
    ? `\n## ユーザーからのリクエスト（最優先）\n${freeText}\n上記リクエストの内容・方向性に沿ったテーマを4個すべてで提案すること。リクエストに合わないテーマは出さないこと。\n`
    : '';

  return `あなたは記事企画のプロです。以下の人物分析結果を基に、この人が書くべき記事テーマを4個提案してください。

## 人物分析
- 人物特徴: ${analysis.personality}
- 文体: ${analysis.writingStyle}
- 得意な記事タイプ: ${analysis.articleTypes.join(', ')}

## プロフィール
${profile.profileText}

## 切り口カテゴリ: ${cat.label}
${cat.instruction}

## 条件
- 読者のニーズが明確なテーマ
- この人の経験・強みが活きるテーマ
- 差別化しやすいテーマ
- 「${cat.label}」の切り口に合ったテーマであること
- タイトルは必ず50文字以内にすること
- **重要：プロフィール文の情報をそのまま転記・羅列するテーマは避けること**。プロフィールの経験を「素材」として、読者の問題解決に直結した具体的なテーマに再構成すること
${excludeSection}${freeTextSection}
## タイトルのバリエーション（重要）
5個のテーマには、以下のようなキャッチーなタイトル形式をバランスよく含めてください：
- 「〇〇な人が知るべき△△3選」「おすすめ5選」などのリスト型
- 「〇〇してみた結果」「〇〇を試して分かったこと」などの体験型
- 「〇〇の教科書」「完全ガイド」などの網羅型
- 「なぜ〇〇は△△なのか」「〇〇が失敗する理由」などの問いかけ型
- 「〇〇だった私が△△できた方法」などのビフォーアフター型
同じ形式が連続しないよう、バリエーション豊かに提案してください。

## 出力形式（JSON）
\`\`\`json
[
  {
    "id": "${categoryKey}-1",
    "title": "キャッチーな記事タイトル（50文字以内）",
    "audience": "想定読者",
    "problem": "読者の悩み",
    "reason": "この人がこのテーマを書くべき理由"
  },
  ...
]
\`\`\`

4個のテーマをJSON配列で出力してください。必ず有効なJSONのみを出力してください。`;
}

export async function regenerateCategoryThemes(
  apiKey: string,
  profile: UserProfile,
  analysis: ProfileAnalysis,
  categoryKey: ThemeCategoryKey,
  previousThemes: string[],
  freeText?: string,
): Promise<ArticleTheme[]> {
  const prompt = buildThemePrompt(profile, analysis, categoryKey, previousThemes, freeText);
  const raw = await callGemini(apiKey, prompt);
  return extractJSON(raw) as ArticleTheme[];
}

// ============================================================
// 2b. generateSkillAngleThemes (スキル+切り口テーマ生成)
// ============================================================
export async function generateSkillAngleThemes(
  apiKey: string,
  profile: UserProfile,
  analysis: ProfileAnalysis,
  skill: ExtractedSkill,
  angleKey: ThemeCategoryKey,
  previousThemes?: string[],
  freeText?: string,
): Promise<ArticleTheme[]> {
  const angle = THEME_CATEGORIES[angleKey];

  const excludeSection = previousThemes && previousThemes.length > 0
    ? `\n## 除外テーマ（以下と重複・類似するテーマは絶対に提案しないこと）\n${previousThemes.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n`
    : '';

  const freeTextSection = freeText
    ? `\n## ユーザーからのリクエスト（最優先）\n${freeText}\n上記リクエストの内容・方向性に沿ったテーマを4個すべてで提案すること。リクエストに合わないテーマは出さないこと。特に数字や固有名詞が入力されている場合は、数字やその固有名詞を必ず用いた沿ったテーマを提案すること。\n`
    : '';

  const prompt = `あなたは記事企画のプロです。以下の人物のスキル・強みと切り口を組み合わせて、この人が書くべき記事テーマを**4個**提案してください。

## 人物分析
- 人物特徴: ${analysis.personality}
- 文体: ${analysis.writingStyle}
- 得意な記事タイプ: ${analysis.articleTypes.join(', ')}

## プロフィール
${profile.profileText}

## 選択されたスキル・強み
- ${skill.label}: ${skill.description}

## 切り口: ${angle.label}
${angle.instruction}

## 条件
- 「${skill.label}」というスキル/強みを活かしたテーマであること
- 「${angle.label}」の切り口に合ったテーマであること
- 読者のニーズが明確なテーマ
- 差別化しやすいテーマ
- **タイトルは必ず50文字以内にすること**
- **重要：プロフィール文の情報をそのまま転記・羅列するテーマは避けること**。スキル説明をテーマ名にするのではなく、そのスキルで「読者が何を実現できるか」に焦点を当てたテーマに仕上げること
${excludeSection}${freeTextSection}
## タイトルのバリエーション（重要）
4個のテーマには、以下のようなキャッチーなタイトル形式をバランスよく含めてください：
- 「〇〇な人が知るべき△△3選」「おすすめ5選」などのリスト型
- 「〇〇してみた結果」「〇〇を試して分かったこと」などの体験型
- 「〇〇の教科書」「完全ガイド」などの網羅型
- 「なぜ〇〇は△△なのか」「〇〇が失敗する理由」などの問いかけ型
同じ形式が連続しないよう、バリエーション豊かに提案してください。

## 出力形式（JSON）
\`\`\`json
[
  {
    "id": "skill-${skill.id}-${angleKey}-1",
    "title": "キャッチーな記事タイトル（50文字以内）",
    "audience": "想定読者",
    "problem": "読者の悩み",
    "reason": "この人がこのテーマを書くべき理由"
  },
  ...
]
\`\`\`

4個のテーマをJSON配列で出力してください。必ず有効なJSONのみを出力してください。`;

  const raw = await callGemini(apiKey, prompt);
  return extractJSON(raw) as ArticleTheme[];
}

// ============================================================
// 2c. inferDirectionFromTheme
// ============================================================
export async function inferDirectionFromTheme(
  apiKey: string,
  themeTitle: string,
  profileText: string,
): Promise<{ reader: string; problem: string; conclusion: string }> {
  const prompt = `あなたは記事企画のプロです。以下の記事テーマとプロフィールから、想定読者・読者の悩み・記事の結論を推定してください。

## テーマ
「${themeTitle}」

## 執筆者プロフィール
${profileText}

## 出力形式（JSON）
\`\`\`json
{
  "reader": "想定読者（1文・30文字程度）",
  "problem": "読者の悩み（1-2文・50文字程度）",
  "conclusion": "この記事で伝えたい結論（1文・40文字程度）"
}
\`\`\`

必ず有効なJSONのみを出力してください。`;

  const raw = await callGemini(apiKey, prompt);
  return extractJSON(raw) as { reader: string; problem: string; conclusion: string };
}

// ============================================================
// 2d. generateHeadingCandidates / generateHeadingOrders
// ============================================================
export async function generateHeadingCandidates(
  apiKey: string,
  themeTitle: string,
  direction: ArticleDirection,
  profileText: string,
  excludeHeadings?: string[],
): Promise<HeadingCandidate[]> {
  const excludeSection = excludeHeadings && excludeHeadings.length > 0
    ? `\n## 除外する見出し（以下と同じ・類似の見出しは絶対に提案しないこと）\n${excludeHeadings.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n`
    : '';

  const prompt = `あなたは記事構成の専門家です。以下の記事テーマと方向性に基づき、記事の大見出し（H2）の候補を**10個**提案してください。

## テーマ
「${themeTitle}」

## 方向性
- 想定読者: ${direction.reader}
- 読者の悩み: ${direction.problem}
- 記事の結論: ${direction.conclusion || '（未設定）'}

## 執筆者プロフィール
${profileText}
${excludeSection}
## 条件
- これは1つの記事の中のセクション見出し（H2）であり、記事タイトルではない。記事タイトルは別にある前提で、その中の"章立て"に相当する粒度にすること
- 悪い例:「フリーランスが知っておくべきお金の全知識」← これは記事タイトルの粒度。大きすぎる
- 良い例:「開業届を出すタイミングと手順」「確定申告で見落としがちな3つの経費」← 1つの章として読み切れる具体的なトピック
- 読者の悩みから結論に至るまでのストーリーをカバーする見出し候補を出すこと
- 導入的な見出し、実践的な見出し、まとめ的な見出しをバランスよく含めること
- 執筆者の経験を活かせる具体的な見出しにすること
- 短く簡潔にすること（目安15〜30文字）。体言止めや「〜の方法」「〜する手順」「〜のコツ」など、セクション見出しらしい表現にすること
- 各見出しは、前後の見出しから**独立して読める単体トピック**であると同時に、全体の流れの中で**必然性を持つ**ものにすること。バラバラな見出しの列挙は避けること
- 見出しは「執筆者にしか書けない内容」を示唆しているものにすること。一般的な知識講座では差別化できない
${direction.stance === 'howto_guide' ? `
## 手順紹介型の見出し追加条件
- 読者が「この順番でやればできる」と思えるストーリーを構成すること
- 以下の要素を見出しに含めること（全部でなくてよいが、最低4つはカバー）:
  1. 事前準備・前提条件（「始める前に揃えるもの」「必要な知識」等）
  2. 最初のステップ（「まずやること」「第一歩」等）
  3. 実践手順の核心（メインの作業・やり方）
  4. つまずきやすいポイント・注意点（「ここで失敗しがち」「落とし穴」等）
  5. 時短・効率化のコツ（「もっと楽にやるには」等）
  6. 完了確認・成果チェック（「できたかどうかの確認方法」等）
- 「概要」「まとめ」のような抽象的な見出しより、「○○を設定する」「△△を確認する」のような行動ベースの見出しを優先すること
` : ''}
${excludeHeadings && excludeHeadings.length > 0 ? '- 除外リストにある見出しとは異なる切り口・表現の候補を出すこと\n' : ''}
## 出力形式（JSON）
\`\`\`json
[
  { "id": "heading-1", "label": "大見出しのテキスト" },
  { "id": "heading-2", "label": "大見出しのテキスト" },
  ...
]
\`\`\`

10個の見出し候補をJSON配列で出力してください。必ず有効なJSONのみを出力してください。`;

  const raw = await callGemini(apiKey, prompt);
  const candidates = extractJSON(raw) as { id: string; label: string }[];
  return candidates.map((c) => ({ ...c, selected: false }));
}

export async function generateHeadingOrders(
  apiKey: string,
  themeTitle: string,
  direction: ArticleDirection,
  selectedHeadings: string[],
): Promise<HeadingOrder[]> {
  const headingList = selectedHeadings.map((h, i) => `${i + 1}. ${h}`).join('\n');

  const prompt = `あなたは記事構成の専門家です。以下の記事テーマと選択された大見出しを使って、**3つの異なる並び順パターン**を提案してください。

## テーマ
「${themeTitle}」

## 方向性
- 想定読者: ${direction.reader}
- 読者の悩み: ${direction.problem}
- 記事の結論: ${direction.conclusion || '（未設定）'}

## 選択された大見出し
${headingList}

## 条件
- 3つのパターンはそれぞれ異なるストーリーの流れを持つこと
- 各パターンで見出しの順序に意味があり、前の見出しが次の土台になる構成にすること
- なぜその順番が効果的なのかの理由を簡潔に説明すること

## 出力形式（JSON）
\`\`\`json
[
  {
    "id": "order-1",
    "headings": ["見出し1のテキスト", "見出し2のテキスト", ...],
    "rationale": "この順番の理由（1-2文）"
  },
  ...
]
\`\`\`

3つのパターンをJSON配列で出力してください。必ず有効なJSONのみを出力してください。`;

  // Retry up to 2 times on JSON parse failure (truncated response)
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callGemini(apiKey, prompt);
      return extractJSON(raw) as HeadingOrder[];
    } catch (e: any) {
      lastError = e;
      if (attempt === 0 && e.message?.includes('JSON')) continue; // retry
      throw e;
    }
  }
  throw lastError || new Error('並び順生成に失敗しました');
}

// ============================================================
// 3. generateOutlinePatterns
// ============================================================
export async function generateOutlinePatterns(
  apiKey: string,
  themeTitle: string,
  direction: ArticleDirection,
  profileText: string,
  userRequest?: string
): Promise<OutlinePattern[]> {
  const stanceLabel = direction.stance === 'empathy' ? '寄り添い型' : direction.stance === 'senior' ? '先輩型' : '手順紹介型';

  const userRequestSection = userRequest
    ? `\n## ユーザーからのリクエスト\n${userRequest}\n上記リクエストを踏まえてパターンを生成してください。\n`
    : '';

  const prompt = `あなたは記事構成の専門家です。以下の記事テーマと方向性に基づき、**3つの異なるアプローチ**の骨子パターンを提案してください。

各パターンは「3つのポイントがストーリーとして繋がった構成」です。バラバラなポイントではなく、読者が自然に読み進められる流れを意識してください。

## テーマ
「${themeTitle}」

## 方向性
- 想定読者: ${direction.reader}
- 読者の悩み: ${direction.problem}
- 記事の結論: ${direction.conclusion || '（未設定）'}
- スタンス: ${stanceLabel}

## 執筆者プロフィール
${profileText}
${userRequestSection}
## 条件
- 3つのパターンはそれぞれ異なる切り口・アプローチであること
- 各パターンの3つのポイントは順序に意味があり、前のポイントが次のポイントの土台になる流れにすること
- 各ポイントのdescriptionには、前後のポイントとのつながりも記述すること
- 読者の悩みに直結し、執筆者の経験を活かせる構成にすること

## 出力形式（JSON）
\`\`\`json
[
  {
    "id": "pattern-1",
    "concept": "パターンのコンセプト名（例: 時系列ストーリー型）",
    "storyArc": "全体の流れの説明（1-2文）",
    "flowRationale": "3つのポイントがなぜこの順番で繋がるかの説明（1-2文）",
    "points": [
      {
        "id": "pattern-1-point-1",
        "label": "ポイントのタイトル（短く）",
        "description": "このポイントの概要と、次のポイントへの繋がり（50-80文字）"
      },
      {
        "id": "pattern-1-point-2",
        "label": "ポイントのタイトル（短く）",
        "description": "前のポイントを受けての展開と、次への繋がり（50-80文字）"
      },
      {
        "id": "pattern-1-point-3",
        "label": "ポイントのタイトル（短く）",
        "description": "前のポイントを受けての締めくくり（50-80文字）"
      }
    ]
  },
  ...
]
\`\`\`

3つのパターンをJSON配列で出力してください。必ず有効なJSONのみを出力してください。`;

  const raw = await callGemini(apiKey, prompt);
  const patterns = extractJSON(raw) as OutlinePattern[];

  // Add selected: false to each point for type compatibility
  return patterns.map((pattern) => ({
    ...pattern,
    points: pattern.points.map((p) => ({ ...p, selected: false })),
  }));
}

const CATEGORIES = `貯める > 家計管理の準備
貯める > パソコン・スマホ
貯める > 銀行・証券
貯める > キャッシュレス
貯める > 通信費
貯める > 食費
貯める > 保険
貯める > 税金
貯める > ローン
貯める > 車
貯める > その他支出の見直し
貯める > 引っ越し・賃貸
貯める > 価値観マップ
貯める > ライフプラン
貯める > 簿記・FP
貯める > 公的制度の活用
貯める > その他貯める力
増やす > 投資の基礎
増やす > インデックス投資
増やす > 高配当株投資
増やす > その他株式投資
増やす > その他増やす力
稼ぐ > ITリテラシー
稼ぐ > 人に会う・オフ会
稼ぐ > 転職
稼ぐ > ブログ・アフィリエイト
稼ぐ > Webライティング
稼ぐ > プログラミング
稼ぐ > Web制作
稼ぐ > デザイン
稼ぐ > イラスト・漫画
稼ぐ > 動画編集
稼ぐ > YouTube配信
稼ぐ > ライバー
稼ぐ > SNS
稼ぐ > ハンドメイド
稼ぐ > せどり・その他物販
稼ぐ > コンテンツ販売
稼ぐ > コンサルティング
稼ぐ > 不動産賃貸業
稼ぐ > 民泊
稼ぐ > オンライン秘書
稼ぐ > LINE構築
稼ぐ > マーケティング
稼ぐ > 副業全般
稼ぐ > その他稼ぐ力
使う > 自己投資
使う > 時間を買う
使う > 健康への投資
使う > 豊かな浪費
使う > 寄付・プレゼント
使う > その他使う力
守る > 詐欺・ぼったくり
守る > 事故・病気
守る > 被災・盗難
守る > インフレ
守る > 相続
守る > セキュリティ
守る > その他守る力`;

// ============================================================
// 5. generateOutline
// ============================================================
export async function generateOutline(
  apiKey: string,
  profile: UserProfile,
  styleProfile: StyleProfile,
  themeTitle: string,
  direction: ArticleDirection,
  selectedPoints: KeyPoint[],
  orderedHeadings?: string[],
  headingExperiences?: HeadingExperience[],
): Promise<ArticleOutline> {
  const pointsList = selectedPoints
    .map((p, i) => `${i + 1}. ${p.label}: ${p.description}`)
    .join('\n');

  // Build stance-specific writing instructions
  const stanceInstructions: Record<string, string> = {
    empathy: `寄り添い型の書き方:
- 読者の感情を言語化する文を各セクション冒頭に入れる（例:「不安ですよね」「わかります」）
- 解決策を提示する際は「私もそうでした」のような共感を前置きする
- 命令形は使わない。「〜してみてください」「〜かもしれません」のような柔らかい提案にする
- 読者を否定しない。現状を肯定した上で選択肢を示す`,
    senior: `先輩型の書き方:
- 経験者としての説得力を出す。「私が実際に試した結果」のような実績ベースで語る
- 読者に具体的な行動を促す。「まずは〜してみましょう」のような導きの表現を使う
- 上から目線にならないよう注意。あくまで「少し先を歩いている先輩」の距離感
- **先輩型の前提条件**: プロフィールに記載されたテーマ関連の経験が3年以上、または明確な実績（数値成果）がある場合のみフル先輩型で書くこと
- プロフィールの経験が浅い場合（1年未満、成果がまだ出ていない等）は、先輩型ライトとして「少し先に始めた仲間」の距離感にトーンダウンし、断定的な助言を避けて「私はこうしてみた」ベースにすること`,
    howto_guide: `手順紹介型の書き方:
- 読者がすぐ実践できるよう、具体的なステップ・手順を明確に示す
- 各ステップに番号を付け、順序に意味があることを示す（「まず〜」「次に〜」「最後に〜」）
- 手順だけの無機質な説明にならないよう、各ステップに「なぜそうするのか」の理由や、執筆者が実際にやったときのワンポイントを添える
- 読者がつまずきやすいポイントや注意点を適宜補足する（「⚠️ ここが落とし穴」のようなマーカーを使ってよい）
- 画面操作や具体的なツール名がある場合は、スクリーンショットのプレースホルダー [※画像: 〜の画面] を挿入すること
- 各セクションの冒頭に「このステップでやること」を1文で要約してから詳細に入ること
- 事前準備セクションでは必要なもの・前提知識を箇条書きで明示すること
- コツや時短テクニックは「💡 ポイント:」で目立たせること
- 所要時間の目安があれば「⏱ 所要時間: 約○分」を各ステップに記載すること`,
  };
  const stanceLabel = direction.stance === 'empathy' ? '寄り添い型' : direction.stance === 'senior' ? '先輩型' : '手順紹介型';
  const stanceDetail = stanceInstructions[direction.stance] || '';

  // Detect investment/finance theme for disclaimer
  const financeKeywords = [
    '投資', '株', 'NISA', '配当', '資産運用', 'FX', '仮想通貨', 'iDeCo',
    'ETF', 'インデックス', 'ビットコイン', '含み損', 'ポートフォリオ',
    '積立', '新NISA', 'つみたて', 'S&P', 'オルカン', '全世界株式',
    '米国株', '日本株', '高配当', '利回り', 'リターン', '元本割れ',
    '信託報酬', '証券口座', '楽天証券', 'SBI証券', '暗号資産',
  ];
  const financeCheckText = `${themeTitle} ${direction.problem} ${direction.reader} ${direction.conclusion} ${profile.profileText}`;
  const isFinanceTheme = financeKeywords.some(kw => financeCheckText.includes(kw));
  const financeRules = isFinanceTheme ? `
**投資・金融テーマの必須ルール:**
- 具体的な銘柄名、利回り、株価、リターン率などの数値はプロフィールに明記されていない限り**絶対に捏造しないこと**
- 投資判断に関わる具体的な数値が必要な箇所には [※具体的な数値をご記入ください] とプレースホルダーを入れること
- チャート、グラフ、具体的な投資成績の描写よりも、**心理的な変化のプロセス**の描写に重点を置くこと` : '';

  const prompt = `あなたは「ノウハウ図書館」の記事構成設計AIです。読者の人生を変えるきっかけになる、価値ある記事を設計してください。

## テーマ
「${themeTitle}」

## 方向性
- 想定読者: ${direction.reader}
- 読者の悩み: ${direction.problem}
- 記事の結論: ${direction.conclusion || '（未設定）'}
- スタンス: ${stanceLabel}

## ${stanceLabel}の具体的な書き方
${stanceDetail}

${orderedHeadings && orderedHeadings.length > 0 ? (() => {
  let section = `## 指定された大見出し（この順番で記事を構成すること）\n`;
  section += orderedHeadings.map((h, i) => `${i + 1}. ${h}`).join('\n');
  if (headingExperiences && headingExperiences.length > 0) {
    section += `\n\n## 各見出しの体験・感情メモ（執筆者が入力した素材。これを元に記事を膨らませること）\n`;
    section += orderedHeadings.map((h, i) => {
      const exp = headingExperiences.find((e) => e.headingId === `heading-ordered-${i}`);
      if (!exp || !exp.text.trim()) return `- ${h}: （メモなし）`;
      return `- ${h}: ${exp.text}`;
    }).join('\n');
  }
  return section;
})() : `## 選択されたポイント\n${pointsList}`}

## 執筆者の文体プロファイル
- 丁寧さ: ${styleProfile.politeness}
- 温度感: ${styleProfile.warmth}
- 距離感: ${styleProfile.distance}
- 感情表現: ${styleProfile.emotionExpression}
- 文の傾向: ${styleProfile.sentenceLength}

## 執筆者プロフィール
${profile.profileText}

## 出力要件

### メタ情報
- title: 記事タイトル（50文字以内、読者の興味を引くキャッチーなもの）
  - **テーマ名をそのまま記事タイトルにしないこと**。テーマ名はあくまで素材。読者が思わずクリックしたくなるよう、表現・構文・切り口を変えてリライトすること
  - 必ず執筆者の**ユニークな体験要素**をタイトルに含めること
    - 具体例：「3度の転職」「年間120万円の節約」のような**プロフィールに明記されている数字や経歴**
    - 失敗・ビフォーのインパクト：「3回落ちた」「貯金ゼロから」のように、リアルな困難さが見える要素
    - ただし、プロフィールに書かれていない数字は捏造せず、定性的な表現で代替すること（「何度も落ちた」「ずっと赤字だった」など）
  - 一般的な「〇〇の方法」だけでなく、「面接で何度も落ちた僕が」「貯金ゼロだった私が」のような個人的要素を入れること
  - テーマ名の数字とプロフィールの数字が矛盾する場合は、**プロフィールの数字を優先**すること
- category: **以下のカテゴリ一覧から最も適切なものを1つ選択**し、必ず「大項目 > 小項目」の形式で記載すること（例: 「稼ぐ > 転職」「貯める > 保険」）。リストにある値をそのまま使うこと。該当するカテゴリがない場合は各大項目の「その他○○力」を選択すること。複数カテゴリにまたがる場合は記事の主軸テーマで選ぶ
- summary: 記事の要約（140文字以内）
  - 最初の一文で想定読者に直接語りかけること（例: 「SIerで疲弊しているあなたへ。」）
  - 記事を読むことで得られる具体的なメリットを明記すること
- tags: 記事のタグ（3つ）
  - 読者が実際に検索しそうなキーワードを選ぶこと
  - 3つのうち少なくとも1つは執筆者の状況に固有のキーワードを含めること

### カテゴリ一覧（この中から選択）
${CATEGORIES}

### 記事本文（bodyMarkdown）
Markdown形式で記事本文を生成してください。

**使える装飾（これ以外は使わないこと）:**
- テキスト（通常の段落）
- \`##\` 大見出し
- \`###\` 小見出し
- \`**太字**\`
- \`[テキスト](URL)\` リンク（プレースホルダーでOK）

**構成ルール:**
- 導入文 → 大見出し×${orderedHeadings ? orderedHeadings.length : '3'}（${orderedHeadings ? '指定された見出し' : '選択ポイント'}を軸）→ まとめ の流れ
- 各大見出しの下に小見出し2〜3個を設ける
- 各大見出しセクションは400〜600文字程度、導入文は300〜400文字（読者の共感を得るビフォー描写には十分な文字数が必要）、まとめは200〜300文字を目安にすること
- 導入文は読者の共感を得る内容（執筆者自身のビフォーの状況描写から始める）
- まとめは行動を促す内容（読者が今日からできる具体的な一歩を提示）

**体験・エピソードのルール（最重要）:**
- 各大見出しセクションに最低1つ、執筆者のプロフィールに基づく**具体的なエピソード**を含めること
  - 良い例: 「3社目の面接では、技術の仕組みを聞かれてまったく答えられず、面接官の困った顔が忘れられません」
  - 悪い例: 「面接では技術的な質問に答えられないこともありました」
- 感情の動き（焦り、悔しさ、喜びなど）を**具体的な状況描写とセットで**書くこと
- **箇条書きのルール（重要）**: 箇条書き（- や 1. で始まる行）は**2項目ごとに地の文を挟む**こと。3項目以上の連続箇条書きは禁止。

  良い例（プロフィールに金額がある場合）:
  \`\`\`
  まず最初に取り組んだのは固定費の見直しです。
  - スマホを格安SIMに乗り換え（月5,000円削減）
  - 不要なサブスクを整理（月3,000円削減）
  この2つだけで月8,000円、年間で約10万円の節約になりました。
  \`\`\`

  良い例（プロフィールに金額がない場合 → 定性表現で代替）:
  \`\`\`
  まず取り組んだのは固定費の見直しです。
  - スマホを格安SIMに乗り換えた（想像以上に差額が大きくて驚きました）
  - 使っていないサブスクを全て解約した
  正直「たったこれだけ？」と思ったのですが、翌月の明細を見て節約効果に驚きました。
  \`\`\`

  悪い例（箇条書きの羅列）:
  \`\`\`
  固定費の見直しでやったことは以下です。
  - スマホを格安SIMに乗り換え
  - 不要なサブスクを整理
  - 掛け捨て保険に切り替え
  - 医療保険を解約
  - 電気会社を切り替え
  \`\`\`
- 一般論やテンプレ的なアドバイスだけで終わらせず、「この執筆者だからこそ言える」独自の視点を必ず含めること

**捏造の禁止（厳守・情報種別ごとのルール）:**

A) **数字（金額・期間・回数・年齢など）**:
   - プロフィールに明記された数字 → そのまま使用OK
   - プロフィールにない数字 → [※具体的な数字をご記入ください] とプレースホルダーにする
   - 絶対に推測で具体的数字を生成しないこと

B) **固有名詞（サービス名・商品名・企業名・人名）**:
   - プロフィールに明記されたもの → そのまま使用OK
   - プロフィールにないもの → カテゴリ表現で代替する（例: 「利用していた家計簿アプリ」「当時勤めていた会社」）
   - 一般的に知られた公共サービス名（NISA、ふるさと納税、確定申告など）は使用OK

C) **エピソード・体験の詳細（3段階ルール）**:
   - レベル1（そのまま使用OK）: プロフィールに書かれた出来事・事実
   - レベル2（補完OK・ただし上限あり）: プロフィールの文脈から論理的に導ける**感情・心理**のみ（例: 「不安を感じた」「嬉しかった」「正直焦りました」）
     ※ 補完は感情層の深掘りに留め、プロフィールにない新しい行動や具体的な状況は追加しないこと（例：「◯◯のような経験をした」と推測で書くのはNG）
   - レベル3（禁止）: プロフィールにない**具体的なシチュエーション**の創作（例: 「面接で〇〇を聞かれて答えられなかった」のような架空のシーン）
   - レベル3に該当する箇所が必要な場合は、[※ご自身のエピソードに差し替えてください（例: 〇〇のような体験）] とプレースホルダーにすること

D) **プレースホルダーの上限ルール**:
   - 記事全体でプレースホルダー（[※...]）は**最大3個まで**とすること
   - 3個を超えそうな場合は、数字や固有名詞に依存しない別の書き方にすること（例: 「具体的な金額は覚えていませんが、かなりの節約になった実感がありました」のような定性的表現）
   - 数字がなくても説得力のある書き方: 感情の変化、行動の前後比較、読者への問いかけを活用する
${financeRules}

**プロフィール情報が限定的な場合の対処（重要：プロフィール転記の防止）:**
- プロフィールから使える具体的事実が少ない場合は、無理に「プロフィールを補完」するのではなく、以下の手法で記事の密度を保つこと:
  - 読者への問いかけ形式を増やす（「あなたもこんな経験はありませんか？」）
  - 一般的なあるある体験を提示し、読者に重ね合わせてもらう書き方にする
  - 行動のハードルを下げる提案を厚くする（「まずは○○だけでOK」）
  - 数字がなくても伝わる前後比較を使う（「以前は〜だったのが、今では〜になりました」）
- **「プロフィールに書いていないから、推測で追加する」という補完は絶対にしないこと**。短編集的な記事でも、「執筆者の実体験に基づいていない情報」を入れると信頼性が落ちる

**スタンスとテーマの整合性:**
- 手順紹介型（howto_guide）で体験要素が必要な場合: ステップ解説を軸にしつつ、「私の場合は〜」のような体験補足を各ステップに1つ添える構成にすること
- 寄り添い型（empathy）で実用情報が求められるテーマの場合: 共感→情報提供→行動提案の三段構成を各セクション内で繰り返すこと。共感だけで終わらせない

**文体の一貫性:**
- 記事の最初から最後まで、文体プロファイルに記載されたトーンを維持すること
- 箇条書きや手順説明のセクションでも、文末表現は文体プロファイルに合わせること
- 顔文字（(^^), (笑) 等）、記号装飾（♪, ☆ 等）は記事本文では**使用しないこと**

## 出力形式（JSON）
\`\`\`json
{
  "title": "記事タイトル（50文字以内）",
  "category": "親カテゴリ > サブカテゴリ（例: 稼ぐ > 転職）",
  "summary": "140文字以内の記事要約",
  "tags": ["タグ1", "タグ2", "タグ3"],
  "bodyMarkdown": "## 大見出し\\n\\n本文...\\n\\n### 小見出し\\n\\n..."
}
\`\`\`

必ず有効なJSONのみを出力してください。bodyMarkdown内の改行は \\n で表記してください。`;

  const raw = await callGemini(apiKey, prompt);
  return extractJSON(raw) as ArticleOutline;
}

// ============================================================
// 6. generateWritingHints (インタビュー用の書き方ヒント)
// ============================================================
export async function generateWritingHints(
  apiKey: string,
  themeTitle: string,
  direction: ArticleDirection,
  profileText: string,
  orderedHeadings: string[],
): Promise<Record<string, string[]>> {
  const headingList = orderedHeadings.map((h, i) => `- heading-ordered-${i}: 「${h}」`).join('\n');

  const isHowTo = direction.stance === 'howto_guide';

  const prompt = `あなたは記事執筆のコーチです。以下の記事テーマと見出し構成に基づき、各見出しに対して${isHowTo ? '「手順・ノウハウを引き出すインタビュー質問」' : '「体験・エピソードを引き出す書き方ヒント」'}を生成してください。

## テーマ
「${themeTitle}」

## 方向性
- 想定読者: ${direction.reader}
- 読者の悩み: ${direction.problem}
- 記事の結論: ${direction.conclusion || '（未設定）'}
- 記事スタイル: ${isHowTo ? '手順紹介型（How-to）' : direction.stance === 'empathy' ? '寄り添い型' : '先輩型'}

## 執筆者プロフィール
${profileText}

## 見出し一覧
${headingList}

## 条件
- 各見出しに対して3〜5個のヒントを生成すること
- ヒントは20〜40文字程度の問いかけ形式にすること
- 執筆者のプロフィールと見出しの内容に特化した具体的なヒントにすること
- ヒントは**プロフィールに書かれた経験や状況を基に**、その詳細を引き出す問いかけにすること
  - 良い例：プロフィールに「◯◯を経験した」と書かれている場合 → 「その時どんなことを考えていた？」「何が最大の課題だった？」
  - 悪い例：プロフィールに書かれていない架空の経験を促すヒント → 「△△のような体験をしたことはある？」
- 汎用的すぎるヒント（「感じたこと」「思ったこと」だけ）は避けること
${isHowTo ? `
## 手順紹介型の追加条件
- ヒントは以下の6カテゴリを意識して生成すること:
  1. **具体的な手順**: 「実際にどういう順番でやった？」「最初に何をした？」
  2. **事前準備**: 「始める前に用意したものは？」「前提知識は必要だった？」
  3. **つまずきポイント**: 「一番難しかったステップは？」「ここで失敗した経験は？」
  4. **時短・効率化のコツ**: 「もっと楽にやる方法は見つけた？」「2回目以降に改善したことは？」
  5. **所要時間・ボリューム感**: 「全体でどのくらい時間がかかった？」「何回くらい試行した？」
  6. **初心者への注意点**: 「初めての人がよくやりがちなミスは？」「事前に知っておくべきことは？」
- 体験・感情の質問も1〜2個は含めてよいが、メインは「手順・方法・コツ」を引き出す実践的な問いかけにすること
- 例: 「そのツールを選んだ決め手は？」「設定で迷ったポイントは？」「完了後の確認方法は？」
` : '- ヒントは体験・感情・エピソードを引き出すものにすること'}

## 出力形式（JSON）
\`\`\`json
{
  "heading-ordered-0": ["ヒント1", "ヒント2", "ヒント3"],
  "heading-ordered-1": ["ヒント1", "ヒント2", "ヒント3", "ヒント4"],
  ...
}
\`\`\`

必ず有効なJSONのみを出力してください。`;

  const raw = await callGemini(apiKey, prompt);
  return extractJSON(raw) as Record<string, string[]>;
}



