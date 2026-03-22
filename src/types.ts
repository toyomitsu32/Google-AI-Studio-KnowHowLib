export enum AppStep {
  HUB = 'HUB',
  PROFILE_INPUT = 'PROFILE_INPUT',
  ANALYSIS = 'ANALYSIS',
  DESIGN = 'DESIGN',
  OUTPUT = 'OUTPUT',
  IMAGE_PROMPTS = 'IMAGE_PROMPTS',
  PUBLISH = 'PUBLISH',
  SHARE = 'SHARE',
}

export interface UserProfile {
  profileText: string;
}

export interface EmojiUsage {
  level: 'none' | 'minimal' | 'moderate' | 'heavy';
  style: string;
  frequentEmojis: string[];
  bulletPrefix: boolean;
  titleEmoji: boolean;
}

export interface StyleProfile {
  politeness: string;
  warmth: string;
  distance: string;
  emotionExpression: string;
  sentenceLength: string;
  frequentExpressions: string[];
  emojiUsage: EmojiUsage;
}

export interface ExtractedSkill {
  id: string;
  label: string;
  description: string;
}

export interface ProfileAnalysis {
  personality: string;
  writingStyle: string;
  articleTypes: string[];
  styleProfile: StyleProfile;
  skills: ExtractedSkill[];
}

export interface ArticleTheme {
  id: string;
  title: string;
  audience: string;
  problem: string;
  reason: string;
}

export interface SimilarArticleAnalysis {
  articles: { title: string; summary: string; url?: string }[];
  insights: {
    trend: string;
    missing: string;
    differentiation: string;
  };
}

export interface ArticleDirection {
  reader: string;
  problem: string;
  conclusion: string;
  stance: 'empathy' | 'senior' | 'howto_guide';
}

export interface KeyPoint {
  id: string;
  label: string;
  description: string;
  selected: boolean;
}

export interface OutlinePattern {
  id: string;               // "pattern-1"
  concept: string;           // "時系列ストーリー型"
  storyArc: string;          // 全体の流れの説明 1-2文
  flowRationale: string;     // 3点がなぜこの順で繋がるか
  points: KeyPoint[];        // 3つのKeyPoint（順序付き）
}

export interface ImagePrompts {
  thumbnail: string;
  eyecatches: { heading: string; prompt: string }[];
  review: string;
}

export interface ArticleOutline {
  title: string;
  category: string;
  summary: string;
  tags: string[];
  bodyMarkdown: string;
  imagePrompts?: ImagePrompts;
}

export interface CatalogArticle {
  title: string;
  url: string;
  category: string;
  tags: string[];
}

// Step 3 redesign: heading-centric article design
export interface HeadingCandidate {
  id: string;
  label: string;
  selected: boolean;
}

export interface HeadingOrder {
  id: string;
  headings: string[];
  rationale: string;
}

export interface HeadingExperience {
  headingId: string;
  text: string;
  tags: string[];
}

/** @deprecated AI生成ヒント (generateWritingHints) に置き換え。後方互換のため残存。 */
export const EXPERIENCE_TAGS = [
  '成功体験',
  '失敗から学んだこと',
  '具体的な数字がある',
  '感情の変化',
  '読者への問いかけ',
  'ビフォーアフター',
] as const;