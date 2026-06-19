import React, { useState } from 'react';
import { 
  Search, 
  Tag, 
  Calendar, 
  Plus, 
  Trash2, 
  BookOpen, 
  Smile, 
  CloudRain,
  ChevronRight,
  Sparkles,
  Download
} from 'lucide-react';
import { JournalEntry } from '../types';
import { getSafeFileName, serializeEntryToMarkdown } from '../utils';

interface NoteListProps {
  entries: JournalEntry[];
  selectedId: string | null;
  onSelectEntry: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onAddNewEntry: () => void;
}

export default function NoteList({ 
  entries, 
  selectedId, 
  onSelectEntry, 
  onDeleteEntry, 
  onAddNewEntry 
}: NoteListProps) {
  const [search, setSearch] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);

  // Collect all unique tags
  const allTags = Array.from(
    new Set(entries.flatMap((e) => e.tags))
  ).filter(Boolean);

  // Group entries by year-month for premium editorial timeline feel
  const filteredEntries = entries.filter((entry) => {
    const matchesSearch = 
      entry.title.toLowerCase().includes(search.toLowerCase()) ||
      entry.content.toLowerCase().includes(search.toLowerCase());
    
    const matchesTag = !selectedTag || entry.tags.includes(selectedTag);
    const matchesMood = !selectedMood || entry.mood === selectedMood;

    return matchesSearch && matchesTag && matchesMood;
  });

  // Mood configuration mapping for design colors and emojis
  const MOODS_MAP: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
    neutral: { emoji: '😐', label: 'Neutralny', color: 'text-slate-600', bg: 'bg-slate-100' },
    happy: { emoji: '😊', label: 'Radosny', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    excited: { emoji: '🤩', label: 'Ekscytacja', color: 'text-amber-600', bg: 'bg-amber-50' },
    sad: { emoji: '😢', label: 'Smutny', color: 'text-blue-600', bg: 'bg-blue-50' },
    tired: { emoji: '🥱', label: 'Zmęczony', color: 'text-purple-600', bg: 'bg-purple-50' },
    peaceful: { emoji: '😌', label: 'Spokojny', color: 'text-teal-600', bg: 'bg-teal-50' },
  };

  const WEATHER_MAP: Record<string, string> = {
    sunny: '☀️',
    cloudy: '☁️',
    rainy: '🌧️',
    snowy: '❄️',
    windy: '💨',
    stormy: '⛈️',
    none: '🌍'
  };

  // Helper for manual single note download
  const downloadSingleMD = (entry: JournalEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    const md = serializeEntryToMarkdown(entry);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', getSafeFileName(entry));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-[#16191f] border-r border-slate-800 text-slate-100 w-full">
      {/* Sidebar Header */}
      <div className="p-5 border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 rounded-lg">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight">Głosowy Dziennik</h1>
              <p className="text-[10px] text-indigo-400 font-mono tracking-wider">100% OFFLINE</p>
            </div>
          </div>
          <button
            onClick={onAddNewEntry}
            className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-md flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95"
            title="Nowy wpis"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Szukaj wpisów..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#111418] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-white transition-all placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Filters bar: tag select and clear filters */}
      {(allTags.length > 0 || selectedTag || selectedMood) && (
        <div className="px-5 py-3 border-b border-slate-800 shrink-0 bg-slate-950/40">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
            <span className="font-semibold flex items-center gap-1 text-slate-300">
              <Sparkles className="w-3 h-3 text-amber-500" /> Filtrowanie
            </span>
            {(selectedTag || selectedMood) && (
              <button 
                onClick={() => { setSelectedTag(null); setSelectedMood(null); }}
                className="text-indigo-400 hover:text-indigo-300 font-medium font-mono"
              >
                wyczyść
              </button>
            )}
          </div>
          
          {/* Tags list */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto no-scrollbar">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`text-[10px] px-2 py-0.5 rounded-full transition-colors font-medium flex items-center gap-1 ${
                    selectedTag === tag 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-slate-800 hover:bg-slate-705 text-slate-300'
                  }`}
                >
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Quick Mood Filter */}
          <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar">
            {Object.keys(MOODS_MAP).map((mKey) => {
              const m = MOODS_MAP[mKey];
              return (
                <button 
                  key={mKey}
                  onClick={() => setSelectedMood(selectedMood === mKey ? null : mKey)}
                  className={`text-slate-350 text-xs px-2 py-0.5 rounded-md hover:bg-slate-800 shrink-0 transition-all ${
                    selectedMood === mKey ? 'bg-indigo-950 text-white font-semibold ring-1 ring-indigo-500' : 'bg-[#0f1115]'
                  }`}
                  title={`Filtruj nastrój: ${m.label}`}
                >
                  {m.emoji}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Entries List Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-10 px-4">
            <div className="w-12 h-12 bg-slate-800/65 rounded-full flex items-center justify-center mx-auto mb-3.5">
              <Search className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-slate-400 font-medium text-xs">Brak wpisów w dzienniku</p>
            <p className="text-slate-500 text-[11px] mt-1">Zmień filtry wyszukiwania lub stwórz swój pierwszy wpis.</p>
            {!search && !selectedTag && !selectedMood && (
              <button
                onClick={onAddNewEntry}
                className="mt-4 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Dodaj notatkę
              </button>
            )}
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isSelected = entry.id === selectedId;
            const moodInfo = MOODS_MAP[entry.mood];
            
            // Generate clean clean preview excerpt safely
            const textContent = entry.content
              .replace(/[-*#>`]/g, '') // remove markdown characters for thumbnail preview
              .trim();
            const excerpt = textContent
              ? textContent.substring(0, 75) + (textContent.length > 75 ? '...' : '')
              : 'Pusty wpis...';

            return (
              <div
                key={entry.id}
                onClick={() => onSelectEntry(entry.id)}
                className={`group relative p-4 rounded-xl cursor-pointer transition-all border text-left ${
                  isSelected 
                    ? 'bg-indigo-950/20 border-indigo-600/80 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                    : 'bg-[#1e222b]/40 hover:bg-[#1e222b]/80 border-slate-800/80 hover:border-slate-700/85'
                }`}
              >
                {/* Meta details */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    {entry.date} {entry.time}
                  </span>
                  
                  {/* Icons for mood & weather */}
                  <div className="flex items-center gap-1.5 shrink-0 bg-slate-900/60 px-1.5 py-0.5 rounded-full border border-slate-800">
                    <span title={`Nastrój: ${moodInfo?.label}`}>{moodInfo?.emoji}</span>
                    <span title={`Pogoda`}>{WEATHER_MAP[entry.weather]}</span>
                  </div>
                </div>

                <h3 className="font-bold text-slate-100 text-sm tracking-tight mb-1 group-hover:text-indigo-400 transition-colors truncate max-w-[90%]">
                  {entry.title || 'Bez tytułu'}
                </h3>
                
                <p className="text-xs text-slate-400 font-normal leading-relaxed mb-3 line-clamp-2">
                  {excerpt}
                </p>

                {/* Foot indicators */}
                <div className="flex items-center justify-between gap-2">
                  {/* Tag List */}
                  <div className="flex flex-wrap gap-1 items-center overflow-hidden max-w-[80%]">
                    {entry.tags.length > 0 ? (
                      entry.tags.slice(0, 2).map((tg) => (
                        <span 
                          key={tg} 
                          className="text-[9px] bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5 text-slate-400 font-medium"
                        >
                          #{tg}
                        </span>
                      ))
                    ) : (
                      <span className="text-[9px] text-slate-500 italic">brak tagów</span>
                    )}
                    {entry.tags.length > 2 && (
                      <span className="text-[9px] text-slate-500 font-semibold">+{entry.tags.length - 2}</span>
                    )}
                  </div>

                  {/* Actions buttons accessible easily */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => downloadSingleMD(entry, e)}
                      className="p-1 px-1.5 rounded-md hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="Pobierz plik Markdown (.md)"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEntry(entry.id);
                      }}
                      className="p-1 px-1.5 rounded-md hover:bg-rose-950 text-rose-400 hover:text-rose-300 transition-colors"
                      title="Usuń wpis"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Selected Accent line */}
                {isSelected && (
                  <div className="absolute left-0 top-3 bottom-3 w-1 bg-indigo-500 rounded-r-md"></div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Note Stats Summary Footer */}
      <div className="p-4 border-t border-slate-850 bg-[#111418] text-center shrink-0">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#16191f] p-2 rounded-lg border border-slate-800/80">
            <span className="block text-xs font-mono font-bold text-indigo-400">{entries.length}</span>
            <span className="text-[9px] text-slate-500 font-medium">Wpisy</span>
          </div>
          <div className="bg-[#16191f] p-2 rounded-lg border border-slate-800/80">
            <span className="block text-xs font-mono font-bold text-amber-500">
              {entries.reduce((sum, e) => sum + e.content.split(/\s+/).filter(Boolean).length, 0)}
            </span>
            <span className="text-[9px] text-slate-500 font-medium">Słów</span>
          </div>
          <div className="bg-[#16191f] p-2 rounded-lg border border-slate-800/80">
            <span className="block text-xs font-mono font-bold text-teal-400">
              {allTags.length}
            </span>
            <span className="text-[9px] text-slate-500 font-medium">Tagi</span>
          </div>
        </div>
      </div>
    </div>
  );
}
