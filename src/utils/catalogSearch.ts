import type { CatalogArticle } from '../types';

/**
 * 日本語の助詞・ストップワード
 */
const STOP_WORDS = new Set([
  'の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し', 'れ', 'さ',
  'ある', 'いる', 'も', 'する', 'から', 'な', 'こと', 'として', 'い', 'や',
  'れる', 'など', 'なっ', 'ない', 'この', 'ため', 'その', 'あっ', 'よう',
  'また', 'もの', 'という', 'あり', 'まで', 'られ', 'なる', 'へ', 'か',
  'だ', 'これ', 'によって', 'により', 'おり', 'より', 'による', 'ず',
  'なり', 'られる', 'について', 'ので', 'ば', 'なかっ', 'なく',
  'しかし', 'について', 'せ', 'だっ', 'それ', 'あの', 'この', 'その',
  'って', 'です', 'ます', 'した', 'して', 'する', 'できる', 'という',
  'ている', 'ました', 'ません', 'けど', 'けれど', 'ので', 'のに',
  'だけ', 'しか', 'ほど', 'くらい', 'ぐらい', 'まで', 'でも',
  // 一般的すぎる単語
  '人', '方', '方法', '紹介', '解説', 'おすすめ', '完全', 'ガイド',
  'まとめ', 'とは', '記事', '選', 'つ', '個', '本',
]);

/**
 * テーマタイトルからキーワードを抽出する
 * 日本語テキストを意味のあるチャンクに分割
 */
export function extractKeywords(text: string): string[] {
  // 数字+単位のパターンを先に抽出
  const numberPatterns: string[] = [];
  text.replace(/\d+[万円%歳年月日時間回本件個選つ]/g, (m) => {
    numberPatterns.push(m);
    return '';
  });

  // 記号や空白で分割
  const chunks = text
    .replace(/[、。！？!?「」『』（）()【】\[\]・,.\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const keywords: string[] = [...numberPatterns];

  for (const chunk of chunks) {
    // 短すぎるチャンクやストップワードはスキップ
    if (chunk.length <= 1 || STOP_WORDS.has(chunk)) continue;

    // カタカナ語はそのまま（外来語として意味がある）
    if (/^[\u30A0-\u30FF]+$/.test(chunk) && chunk.length >= 2) {
      keywords.push(chunk);
      continue;
    }

    // 漢字を含む2文字以上のチャンクはそのまま
    if (/[\u4E00-\u9FFF]/.test(chunk) && chunk.length >= 2) {
      keywords.push(chunk);
      continue;
    }

    // ひらがなのみの場合は3文字以上のもの
    if (/^[\u3040-\u309F]+$/.test(chunk)) {
      if (chunk.length >= 3 && !STOP_WORDS.has(chunk)) {
        keywords.push(chunk);
      }
      continue;
    }

    // 英数字
    if (/^[a-zA-Z0-9]+$/i.test(chunk) && chunk.length >= 2) {
      keywords.push(chunk.toLowerCase());
      continue;
    }

    // 混合テキスト: そのまま追加
    if (chunk.length >= 2) {
      keywords.push(chunk);
    }
  }

  // 重複排除
  return [...new Set(keywords)];
}

/**
 * カタログ記事をスコアリングして検索結果を返す
 *
 * スコアリング:
 * - タイトルにキーワードが含まれる: ×3
 * - タグにキーワードが一致: ×2
 * - カテゴリにキーワードが含まれる: ×1
 */
export function searchCatalog(
  themeTitle: string,
  catalog: CatalogArticle[],
  maxResults = 10
): CatalogArticle[] {
  const keywords = extractKeywords(themeTitle);
  if (keywords.length === 0) return [];

  const scored = catalog.map((article) => {
    let score = 0;
    const titleLower = article.title.toLowerCase();
    const categoryLower = article.category.toLowerCase();
    const tagsLower = article.tags.map((t) => t.toLowerCase());

    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();

      // タイトル一致 (×3)
      if (titleLower.includes(kwLower)) {
        score += 3;
      }

      // タグ一致 (×2)
      if (tagsLower.some((tag) => tag.includes(kwLower) || kwLower.includes(tag))) {
        score += 2;
      }

      // カテゴリ一致 (×1)
      if (categoryLower.includes(kwLower)) {
        score += 1;
      }
    }

    return { article, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((s) => s.article);
}
