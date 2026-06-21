import { JournalEntry } from './types';

// ==========================================
// INDEXEDDB UTILITIES FOR FILESYSTEM HANDLES
// ==========================================
const DB_NAME = 'DziennikStore';
const STORE_NAME = 'settings';
const HANDLE_KEY = 'folderHandle';

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSyncFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(handle, HANDLE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function loadSyncFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(HANDLE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error loading handle from IndexedDB', err);
    return null;
  }
}

export async function clearSyncFolderHandle(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(HANDLE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ==========================================
// MARKDOWN TO HTML CONVERTER (FULLY CLIENT)
// ==========================================
export function renderMarkdown(markdown: string): string {
  if (!markdown) return '<p class="text-slate-400 italic">Pusta notatka. Użyj dyktowania lub wpisz tekst...</p>';

  const lines = markdown.split('\n');
  let html = '';
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;
  let inBlockquote = false;
  let inPre = false;
  let preContent: string[] = [];

  const flushList = () => {
    if (inList) {
      html += listType === 'ul' ? '</ul>' : '</ol>';
      inList = false;
      listType = null;
    }
  };

  const flushBlockquote = () => {
    if (inBlockquote) {
      html += '</div></blockquote>';
      inBlockquote = false;
    }
  };

  const parseInline = (text: string): string => {
    let result = text
      // Escape HTML entities to avoid breaking script tags
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold **text**
    result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    result = result.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Inline code `code`
    result = result.replace(/`(.*?)`/g, '<code>$1</code>');
    // Images ![alt](url)
    result = result.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" referrerPolicy="no-referrer" class="max-w-full rounded-md shadow border border-slate-100 my-2" />');
    // Links [text](url)
    result = result.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline hover:text-blue-800">$1</a>');

    return result;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks ```
    if (trimmed.startsWith('```')) {
      if (inPre) {
        // Close code block
        html += `<pre><code>${preContent.join('\n')}</code></pre>`;
        inPre = false;
        preContent = [];
      } else {
        // Open code block
        flushList();
        flushBlockquote();
        inPre = true;
      }
      continue;
    }

    if (inPre) {
      preContent.push(line);
      continue;
    }

    // Horizontal Rule
    if (trimmed === '---') {
      flushList();
      flushBlockquote();
      html += '<hr class="my-4 border-t border-slate-200" />';
      continue;
    }

    // Headings
    if (trimmed.startsWith('# ')) {
      flushList();
      flushBlockquote();
      html += `<h1>${parseInline(trimmed.substring(2))}</h1>`;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      flushBlockquote();
      html += `<h2>${parseInline(trimmed.substring(3))}</h2>`;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushList();
      flushBlockquote();
      html += `<h3>${parseInline(trimmed.substring(4))}</h3>`;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      flushList();
      if (!inBlockquote) {
        html += '<blockquote class="border-l-4 border-blue-500 pl-4 py-1 my-2 bg-slate-50 italic text-slate-600 rounded-r-md"><div class="markdown-paragraph">';
        inBlockquote = true;
      } else if (trimmed === '>') {
        html += '<br/>';
        continue;
      }
      html += parseInline(line.substring(2)) + ' ';
      continue;
    } else {
      flushBlockquote();
    }

    // Unordered List (- item or * item)
    const ulMatch = line.match(/^(\s*)([-*])\s+(.*)/);
    if (ulMatch) {
      const content = ulMatch[3];
      if (!inList || listType !== 'ul') {
        flushList();
        html += '<ul class="list-disc pl-6 space-y-1 my-2">';
        inList = true;
        listType = 'ul';
      }
      html += `<li>${parseInline(content)}</li>`;
      continue;
    }

    // Ordered List (1. item)
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
    if (olMatch) {
      const content = olMatch[3];
      if (!inList || listType !== 'ol') {
        flushList();
        html += '<ol class="list-decimal pl-6 space-y-1 my-2">';
        inList = true;
        listType = 'ol';
      }
      html += `<li>${parseInline(content)}</li>`;
      continue;
    }

    // If it's building up standard content but isn't part of list anymore
    if (trimmed === '') {
      flushList();
      html += '<div class="h-2"></div>';
    } else {
      flushList();
      html += `<p class="my-1.5 leading-relaxed text-slate-700">${parseInline(line)}</p>`;
    }
  }

  // Flush remaining
  flushList();
  flushBlockquote();
  if (inPre && preContent.length > 0) {
    html += `<pre><code>${preContent.join('\n')}</code></pre>`;
  }

  return `<div class="markdown-preview">${html}</div>`;
}

// Generate MD content string with Front Matter metadata for full journaling experience
export function serializeEntryToMarkdown(entry: JournalEntry): string {
  return `---
title: ${entry.title.replace(/"/g, '\\"')}
date: ${entry.date}
time: ${entry.time}
tags: ${entry.tags.join(', ')}
mood: ${entry.mood}
weather: ${entry.weather}
updatedAt: ${entry.updatedAt}
---

# ${entry.title || 'Bez tytułu'}

${entry.content}
`;
}

// Parse markdown string to retrieve content if importing
export function parseMarkdownToEntry(mdString: string, id: string): Partial<JournalEntry> {
  const result: Partial<JournalEntry> = {
    id,
    title: 'Bez tytułu',
    tags: [],
    mood: 'neutral',
    weather: 'none',
    content: ''
  };

  if (!mdString.startsWith('---')) {
    result.content = mdString;
    return result;
  }

  const parts = mdString.split('---');
  if (parts.length < 3) {
    result.content = mdString;
    return result;
  }

  const frontMatter = parts[1];
  const content = parts.slice(2).join('---').trim();
  result.content = content;

  // Trim main heading if it repeats the title
  if (content.startsWith('# ')) {
    const lines = content.split('\n');
    const firstLine = lines[0].replace('# ', '').trim();
    result.title = firstLine;
    result.content = lines.slice(1).join('\n').trim();
  }

  const fmLines = frontMatter.split('\n');
  for (const line of fmLines) {
    const match = line.match(/^([a-zA-Z0-9_]+):\s*(.*)/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim();
      if (key === 'title') result.title = val.replace(/^"|"$/g, '').replace(/\\"/g, '"');
      else if (key === 'date') result.date = val;
      else if (key === 'time') result.time = val;
      else if (key === 'tags') result.tags = val ? val.split(',').map(t => t.trim()).filter(Boolean) : [];
      else if (key === 'mood') {
        const check = val as any;
        if (['neutral', 'happy', 'excited', 'sad', 'tired', 'peaceful'].includes(check)) {
          result.mood = check;
        }
      }
      else if (key === 'weather') {
        const check = val as any;
        if (['sunny', 'cloudy', 'rainy', 'snowy', 'windy', 'stormy', 'none'].includes(check)) {
          result.weather = check;
        }
      }
    }
  }

  return result;
}

// Generate file safe title
export function getSafeFileName(entry: JournalEntry): string {
  const dateStr = entry.date; // YYYY-MM-DD
  const cleanTitle = entry.title
    .toLowerCase()
    .replace(/[ą]+/g, 'a')
    .replace(/[ć]+/g, 'c')
    .replace(/[ę]+/g, 'e')
    .replace(/[ł]+/g, 'l')
    .replace(/[ń]+/g, 'n')
    .replace(/[ó]+/g, 'o')
    .replace(/[ś]+/g, 's')
    .replace(/[źż]+/g, 'z')
    .replace(/[^a-z0-0\s-_]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  
  return `${dateStr}_${cleanTitle || 'wpis'}.md`;
}

// Voice Command Rules dictionary for PL
export const POLISH_VOICE_COMMANDS = [
  { phrase: 'nowa linia', action: 'Dodaje nową linię we wpisie', replacement: '\n' },
  { phrase: 'nowy akapit', action: 'Dodaje pustą linię podziału', replacement: '\n\n' },
  { phrase: 'nagłówek', action: 'Wstawia nagłówek Markdown (#)', replacement: '\n# ' },
  { phrase: 'podnagłówek', action: 'Wstawia mniejszy nagłówek (##)', replacement: '\n## ' },
  { phrase: 'kropka', action: 'Wstawia znak kropki', replacement: '.' },
  { phrase: 'przecinek', action: 'Wstawia znak przecinka', replacement: ',' },
  { phrase: 'pytajnik', action: 'Wstawia pytajnik na końcu', replacement: '?' },
  { phrase: 'wykrzyknik', action: 'Wstawia wykrzyknik', replacement: '!' },
  { phrase: 'dwukropek', action: 'Wstawia dwukropek', replacement: ':' },
  { phrase: 'pogrub', action: 'Odwija tekst w format pogrubiony', replacement: ' **tekst**' },
  { phrase: 'kursywa', action: 'Odwija tekst w pochylenie', replacement: ' *tekst*' },
  { phrase: 'od punktu', action: 'Tworzy nowy punkt na liście (-)', replacement: '\n- ' },
  { phrase: 'punkt', action: 'Tworzy nowy punkt na liście (-)', replacement: '\n- ' }
];

export function applyPolishVoiceFormatting(text: string): string {
  let formatted = text;
  
  // Replace typical punctuation voice pronunciations
  // Map spaces following punctuation so they don't look weird
  formatted = formatted
    .replace(/\s*kropka\s*/gi, '. ')
    .replace(/\s*przecinek\s*/gi, ', ')
    .replace(/\s*pytajnik\s*/gi, '? ')
    .replace(/\s*wykrzyknik\s*/gi, '! ')
    .replace(/\s*dwukropek\s*/gi, ': ')
    .replace(/\s*nowy akapit\s*/gi, '\n\n')
    .replace(/\s*nowa linia\s*/gi, '\n')
    .replace(/\s*nagłówek\s*/gi, '\n# ')
    .replace(/\s*podnagłówek\s*/gi, '\n## ')
    .replace(/\s*od punktu\s*/gi, '\n- ')
    .replace(/\s*rozpocznij listę\s*/gi, '\n- ')
    .replace(/\s*cudzysłów\s*(.*?)\s*cudzysłów/gi, ' "$1" ')
    .replace(/\s*pogrub\s*(.*?)\s*pogrub/gi, ' **$1** ')
    .replace(/\s*kursywa\s*(.*?)\s*kursywa/gi, ' *$1* ');

  // Clean double spaces and fix double puncts
  formatted = formatted
    .replace(/\s\s+/g, ' ')
    .replace(/\s+\./g, '.')
    .replace(/\s+,/g, ',')
    .replace(/\s+\?/g, '?')
    .replace(/\s+\!/g, '!');

  return formatted;
}

/**
 * Intelligent text-overlap merger.
 * Identifies suffix-prefix word overlap between two strings and merges them
 * to prevent duplicates, particularly on unstable mobile/Android speech recognition,
 * while strictly preserving whitespace-based formatting commands and punctuation.
 */
export function mergeOverlappingText(s1: string, s2: string): string {
  if (!s1) return s2;
  if (!s2) return s1;

  // Normalize spaces/punctuation for comparison only
  const cleanString = (str: string) => {
    return str
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  };

  const norm1 = cleanString(s1);
  const norm2 = cleanString(s2);

  // If after cleaning, s2 is empty (e.g. it was just punctuation, spaces, or newlines)
  if (!norm2) {
    const s2Trimmed = s2.trim();
    if (s2Trimmed && s1.endsWith(s2Trimmed)) {
      return s1;
    }
    if (s1.endsWith(s2)) {
      return s1;
    }
    return s1 + s2;
  }

  // If s2 (cleaned) is fully contained in s1, it's a duplicate chunk
  if (norm1.includes(norm2)) {
    const words1 = norm1.split(" ");
    const words2 = norm2.split(" ");
    const lastWords1 = words1.slice(-words2.length * 2).join(" ");
    if (lastWords1.includes(norm2)) {
      return s1;
    }
  }

  // Word-level suffix-prefix overlap search using normalized words
  const words1 = norm1.split(" ");
  const words2 = norm2.split(" ");
  
  const maxOverlap = Math.min(words1.length, words2.length);
  let overlapWordCount = 0;

  for (let k = maxOverlap; k > 0; k--) {
    let match = true;
    for (let i = 0; i < k; i++) {
      if (words1[words1.length - k + i] !== words2[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      overlapWordCount = k;
      break;
    }
  }

  if (overlapWordCount > 0) {
    // We found an overlap of 'overlapWordCount' words.
    // We want to merge s1 and s2 while preserving formatting of s2.
    const originalWords2 = s2.trim().split(/\s+/);
    if (overlapWordCount < originalWords2.length) {
      const nonOverlappingPart = originalWords2.slice(overlapWordCount).join(" ");
      const gap = s1.endsWith(" ") || nonOverlappingPart.startsWith(" ") ? "" : " ";
      return s1 + gap + nonOverlappingPart;
    } else {
      // The entire s2 is an overlap, so it's a duplicate transcript
      return s1;
    }
  }

  // If there's no word overlap, check if s2 starts with punctuation or newlines
  const isPunctuationOrNewline = /^[.,!?:;\n\r]/.test(s2) || /^[.,!?:;\n\r]/.test(s2.trim());
  
  if (isPunctuationOrNewline) {
    return s1 + s2;
  }

  // Check if s1 ends with whitespace or s2 starts with whitespace to determine slot spacing
  const endsWithWhitespace = /\s$/.test(s1) || /^\s/.test(s2);
  const gap = endsWithWhitespace ? "" : " ";
  return s1 + gap + s2;
}
