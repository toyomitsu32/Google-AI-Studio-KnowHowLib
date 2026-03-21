export interface SectionInfo {
  heading: string;
  level: number; // 2 = ##, 3 = ###
  charCount: number;
  lineCount: number;
}

export interface ValidationWarning {
  type: 'short_section' | 'long_section' | 'bullet_run' | 'no_episode_marker' | 'total_short' | 'total_long';
  section?: string;
  message: string;
}

export interface ValidationResult {
  sections: SectionInfo[];
  totalChars: number;
  warnings: ValidationWarning[];
}

/**
 * Parse markdown body into sections and validate structure.
 */
export function validateArticleStructure(bodyMarkdown: string): ValidationResult {
  const lines = bodyMarkdown.split('\n');
  const sections: SectionInfo[] = [];
  const warnings: ValidationWarning[] = [];

  let currentHeading = '導入文';
  let currentLevel = 0;
  let currentContent = '';

  function flushSection() {
    const text = currentContent.trim();
    if (text || currentHeading !== '導入文') {
      sections.push({
        heading: currentHeading,
        level: currentLevel,
        charCount: text.replace(/\s/g, '').length,
        lineCount: text.split('\n').filter((l) => l.trim()).length,
      });
    }
    currentContent = '';
  }

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flushSection();
      currentHeading = line.slice(3).trim();
      currentLevel = 2;
    } else if (line.startsWith('### ')) {
      flushSection();
      currentHeading = line.slice(4).trim();
      currentLevel = 3;
    } else {
      currentContent += line + '\n';
    }
  }
  flushSection();

  // Validate section lengths
  for (const sec of sections) {
    if (sec.level === 2) {
      if (sec.charCount < 200) {
        warnings.push({
          type: 'short_section',
          section: sec.heading,
          message: `「${sec.heading}」が短すぎます（${sec.charCount}字 / 推奨400-600字）`,
        });
      } else if (sec.charCount > 800) {
        warnings.push({
          type: 'long_section',
          section: sec.heading,
          message: `「${sec.heading}」が長すぎます（${sec.charCount}字 / 推奨400-600字）`,
        });
      }
    }
  }

  // Check for bullet runs (3+ consecutive bullet lines)
  let bulletRun = 0;
  let lastBulletRunStart = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || /^\d+\.\s/.test(trimmed)) {
      bulletRun++;
      if (bulletRun === 1) {
        // Find which section this is in
        const headingBefore = lines.slice(0, lines.indexOf(line)).reverse()
          .find((l) => l.startsWith('## ') || l.startsWith('### '));
        lastBulletRunStart = headingBefore ? headingBefore.replace(/^#+\s*/, '') : '導入文';
      }
      if (bulletRun === 3) {
        warnings.push({
          type: 'bullet_run',
          section: lastBulletRunStart,
          message: `「${lastBulletRunStart}」で箇条書きが3項目以上連続しています`,
        });
      }
    } else if (trimmed !== '') {
      bulletRun = 0;
    }
  }

  // Total character count
  const totalChars = bodyMarkdown.replace(/\s/g, '').length;
  if (totalChars < 2000) {
    warnings.push({
      type: 'total_short',
      message: `記事全体が短すぎます（${totalChars}字 / 推奨3000字以上）`,
    });
  } else if (totalChars > 6000) {
    warnings.push({
      type: 'total_long',
      message: `記事全体が長すぎます（${totalChars}字 / 推奨3000-5000字）`,
    });
  }

  return { sections, totalChars, warnings };
}
