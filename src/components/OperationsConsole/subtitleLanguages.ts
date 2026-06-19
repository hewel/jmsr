export const COMMON_SUBTITLE_LANGUAGE_OPTIONS = [
  { code: 'eng', label: 'English' },
  { code: 'jpn', label: 'Japanese' },
  { code: 'spa', label: 'Spanish' },
  { code: 'fre', label: 'French' },
  { code: 'ger', label: 'German' },
  { code: 'ita', label: 'Italian' },
  { code: 'por', label: 'Portuguese' },
  { code: 'chi', label: 'Chinese' },
  { code: 'kor', label: 'Korean' },
] as const;

export function parseSubtitleLanguageInput(value: string) {
  return value
    .split(/[\n,]+/)
    .map((language) => language.trim().toLowerCase())
    .filter((language) => language.length > 0);
}

export function normalizePreferredSubtitleLanguages(languages: string[] | null | undefined) {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const language of languages ?? []) {
    const [code] = parseSubtitleLanguageInput(language);
    if (!code || seen.has(code)) {
      continue;
    }
    seen.add(code);
    normalized.push(code);
  }

  return normalized;
}

export function getSubtitleLanguageLabel(code: string) {
  return COMMON_SUBTITLE_LANGUAGE_OPTIONS.find((option) => option.code === code)?.label ?? 'Custom';
}
