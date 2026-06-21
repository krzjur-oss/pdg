import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, 
  Mic, 
  MicOff, 
  Tag, 
  Calendar, 
  Clock, 
  BookOpen, 
  Eye, 
  Edit3, 
  Columns, 
  Download, 
  HelpCircle,
  Plus, 
  X,
  Keyboard,
  Sparkles,
  RefreshCw,
  Sliders,
  Maximize2
} from 'lucide-react';
import { JournalEntry, DictationLanguage } from '../types';
import { renderMarkdown, applyPolishVoiceFormatting, POLISH_VOICE_COMMANDS, mergeOverlappingText } from '../utils';

interface NoteEditorProps {
  entry: JournalEntry | null;
  onSaveEntry: (updated: JournalEntry) => void;
  syncFolderConnected: boolean;
  syncingState: boolean;
}

export default function NoteEditor({ 
  entry, 
  onSaveEntry, 
  syncFolderConnected,
  syncingState 
}: NoteEditorProps) {
  // Active state states declared unconditionally at top
  const [title, setTitle] = useState(entry?.title || '');
  const [content, setContent] = useState(entry?.content || '');
  const [date, setDate] = useState(entry?.date || '');
  const [time, setTime] = useState(entry?.time || '');
  const [tags, setTags] = useState<string[]>(entry?.tags || []);
  const [mood, setMood] = useState(entry?.mood || 'neutral');
  const [weather, setWeather] = useState(entry?.weather || 'none');
  
  // Tag input state
  const [newTagInput, setNewTagInput] = useState('');
  
  // Editor view modes: 'split' | 'edit' | 'preview'
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');

  // DICTATION SPEECH ENGINE
  const [isDictating, setIsDictating] = useState(false);
  const [dictationLang, setDictationLang] = useState<DictationLanguage>('pl-PL');
  const [interimSpeech, setInterimSpeech] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [showCommands, setShowCommands] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const saveDebounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedIndexRef = useRef<number>(-1);
  const contentBeforeDictationRef = useRef<string>('');
  const isIntentionalStopRef = useRef<boolean>(false);
  const contentRef = useRef<string>('');

  // Keep contentRef in sync with content state for callbacks/listeners
  useEffect(() => {
    contentRef.current = content;
  }, [content]);
  
  // Sync state variables with actual values
  useEffect(() => {
    if (entry) {
      setTitle(entry.title);
      setContent(entry.content);
      setDate(entry.date);
      setTime(entry.time);
      setTags(entry.tags);
      setMood(entry.mood);
      setWeather(entry.weather);
      contentBeforeDictationRef.current = entry.content;
    }
  }, [entry?.id]);

  // Adjust view mode based on screen width
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024 && viewMode === 'split') {
        setViewMode('edit');
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // run on mount
    return () => window.removeEventListener('resize', handleResize);
  }, [viewMode]);

  useEffect(() => {
    return () => {
      if (saveDebounceTimeout.current) clearTimeout(saveDebounceTimeout.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          console.error('Clean up speech recognition error:', err);
        }
      }
    };
  }, []);

  // If no note select, show empty state AFTER hook declarations
  if (!entry) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0f1115] text-center select-none h-full text-slate-350">
        <div className="max-w-md space-y-4">
          <div className="w-16 h-16 bg-[#16191f] text-indigo-400 border border-slate-805 rounded-2xl flex items-center justify-center mx-auto shadow-md">
            <Mic className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Gotowy do stworzenia wspomnień?</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Wybierz wpis z listy po lewej stronie lub dodaj nowy za pomocą ikony <strong>plus (+)</strong>, aby rozpocząć dyktowanie, pisać lub porządkować pliki.
          </p>
          <div className="pt-2">
            <p className="text-[11px] text-indigo-400 font-mono tracking-wider">WSZYSTKIE PRACE SĄ AUTOSYNCHRONIZOWANE LOKALNIE</p>
          </div>
        </div>
      </div>
    );
  }

  // Handle auto-saving on edits
  const triggerSave = (updates: Partial<JournalEntry>) => {
    const updatedEntry: JournalEntry = {
      ...entry,
      title: updates.title !== undefined ? updates.title : title,
      content: updates.content !== undefined ? updates.content : content,
      date: updates.date !== undefined ? updates.date : date,
      time: updates.time !== undefined ? updates.time : time,
      tags: updates.tags !== undefined ? updates.tags : tags,
      mood: updates.mood !== undefined ? updates.mood : mood,
      weather: updates.weather !== undefined ? updates.weather : weather,
      updatedAt: new Date().toISOString()
    };
    onSaveEntry(updatedEntry);
  };

  const handleFieldChange = (field: string, val: any) => {
    if (field === 'title') {
      setTitle(val);
      triggerSave({ title: val });
    } else if (field === 'content') {
      setContent(val);
      contentBeforeDictationRef.current = val;
      // Debounce saving main content text to prevent continuous write triggers
      if (saveDebounceTimeout.current) clearTimeout(saveDebounceTimeout.current);
      saveDebounceTimeout.current = setTimeout(() => {
        triggerSave({ content: val });
      }, 500);
    } else if (field === 'date') {
      setDate(val);
      triggerSave({ date: val });
    } else if (field === 'time') {
      setTime(val);
      triggerSave({ time: val });
    } else if (field === 'mood') {
      setMood(val);
      triggerSave({ mood: val });
    } else if (field === 'weather') {
      setWeather(val);
      triggerSave({ weather: val });
    }
  };

  const startDictation = () => {
    // Single instance guard: secure and stop any previous active dictation instance to avoid parallel double listeners
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error('Error stopping existing recognition instance:', err);
      }
      recognitionRef.current = null;
    }

    setSpeechError(null);
    lastProcessedIndexRef.current = -1;
    contentBeforeDictationRef.current = content || '';
    isIntentionalStopRef.current = false;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setSpeechError('Dyktowanie głosowe nie jest obsługiwane przez tę przeglądarkę. Spróbuj użyć Google Chrome.');
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = dictationLang;
      
      rec.onstart = () => {
        setIsDictating(true);
        setInterimSpeech('');
      };

      rec.onerror = (e: any) => {
        console.error('Speech recognition error:', e.error);
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
          if (e.error === 'not-allowed') {
            setSpeechError('Brak dostępu do mikrofonu. Nadaj uprawnienia mikrofonu w przeglądarce.');
          } else if (e.error === 'audio-capture') {
            setSpeechError('Nie wykryto mikrofonu. Podłącz urządzenie nagrywające.');
          } else {
            setSpeechError(`Błąd krytyczny mikrofonu: ${e.error}`);
          }
          stopDictation();
        } else {
          console.warn('Non-fatal speech recognition error, allowing auto-restart:', e.error);
        }
      };

      rec.onend = () => {
        // If the user did not click "Stop" explicitly, they expect the dictation to remain active.
        // Restart the recognition using our smart auto-resume to survive browser silence timeouts.
        if (!isIntentionalStopRef.current) {
          console.log('Automated stop detected. Reactivating speech recognition after silent pause...');
          // Sync baseline to the latest content buffer so we don't start counting from the original start point
          contentBeforeDictationRef.current = contentRef.current;
          
          try {
            if (recognitionRef.current) {
              recognitionRef.current.start();
            }
          } catch (err) {
            console.error('Immediate auto-restart failed:', err);
            // Fallback retry after brief timeout
            setTimeout(() => {
              if (!isIntentionalStopRef.current && recognitionRef.current) {
                try {
                  recognitionRef.current.start();
                } catch (retryErr) {
                  console.error('Delayed auto-restart failed:', retryErr);
                }
              }
            }, 300);
          }
        } else {
          setIsDictating(false);
          setInterimSpeech('');
        }
      };

      // Handle continuous voice streaming with smart overlap merge algorithm to resolve Gboard/mobile duplicating bugs
      rec.onresult = (event: any) => {
        let mergedFinalTranscript = '';
        let interimTrans = '';

        for (let i = 0; i < event.results.length; ++i) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          if (result.isFinal) {
            let formattedSegment = transcript;
            if (dictationLang === 'pl-PL') {
              formattedSegment = applyPolishVoiceFormatting(transcript);
            }
            mergedFinalTranscript = mergeOverlappingText(mergedFinalTranscript, formattedSegment);
          } else {
            interimTrans += transcript;
          }
        }

        setInterimSpeech(interimTrans);

        if (mergedFinalTranscript) {
          const baseline = contentBeforeDictationRef.current || '';
          const newContent = mergeOverlappingText(baseline, mergedFinalTranscript);
          
          setContent(newContent);
          triggerSave({ content: newContent });
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err: any) {
      console.error('Init speech failure:', err);
      setSpeechError('Nie udało się uruchomić rozpoznawania mowy.');
      setIsDictating(false);
    }
  };

  const stopDictation = () => {
    isIntentionalStopRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error(err);
      }
      recognitionRef.current = null;
    }
    setIsDictating(false);
    setInterimSpeech('');
  };

  const toggleDictation = () => {
    if (isDictating) {
      stopDictation();
    } else {
      startDictation();
    }
  };

  // Add custom tags
  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTag = newTagInput.trim().toLowerCase().replace(/#/g, '');
    if (cleanTag && !tags.includes(cleanTag)) {
      const nextTags = [...tags, cleanTag];
      setTags(nextTags);
      setNewTagInput('');
      triggerSave({ tags: nextTags });
    }
  };

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    const nextTags = tags.filter(t => t !== tagToRemove);
    setTags(nextTags);
    triggerSave({ tags: nextTags });
  };

  // Helper buttons to insert Markdown tags quickly
  const insertMarkdownHelper = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('raw-markdown-editor') as HTMLTextAreaElement;
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(startPos, endPos);

    const replacement = prefix + (selectedText || 'tekst') + suffix;
    const newContent = text.substring(0, startPos) + replacement + text.substring(endPos);
    
    setContent(newContent);
    triggerSave({ content: newContent });

    // refocus
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(startPos + prefix.length, startPos + prefix.length + (selectedText || 'tekst').length);
    }, 10);
  };

  // Static options maps
  const MOODS = [
    { key: 'neutral', emoji: '😐', label: 'Neutralny', color: 'hover:bg-slate-100 border-slate-200 text-slate-700 bg-slate-50' },
    { key: 'happy', emoji: '😊', label: 'Radosny', color: 'hover:bg-emerald-100 border-emerald-200 text-emerald-700 bg-emerald-50/40' },
    { key: 'excited', emoji: '🤩', label: 'Podekscytowany', color: 'hover:bg-amber-100 border-amber-200 text-amber-700 bg-amber-50/40' },
    { key: 'sad', emoji: '😢', label: 'Smutny', color: 'hover:bg-blue-100 border-blue-200 text-blue-750 bg-blue-50/40' },
    { key: 'tired', emoji: '🥱', label: 'Zmęczony', color: 'hover:bg-purple-100 border-purple-200 text-purple-700 bg-purple-50/40' },
    { key: 'peaceful', emoji: '😌', label: 'Spokojny', color: 'hover:bg-teal-100 border-teal-200 text-teal-700 bg-teal-50/40' }
  ];

  const WEATHERS = [
    { key: 'sunny', emoji: '☀️', label: 'Słonecznie' },
    { key: 'cloudy', emoji: '☁️', label: 'Pochmurno' },
    { key: 'rainy', emoji: '🌧️', label: 'Deszczowo' },
    { key: 'snowy', emoji: '❄️', label: 'Śnieżnie' },
    { key: 'windy', emoji: '💨', label: 'Wietrznie' },
    { key: 'stormy', emoji: '⛈️', label: 'Burzowo' },
    { key: 'none', emoji: '🌍', label: 'Brak' }
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#0f1115] h-full relative overflow-hidden">
      {/* HEADER CONTROLS SECTION */}
      <div className="border-b border-slate-800 p-5 shrink-0 space-y-4 bg-[#111418]">
        
        {/* Row 1: Title, View Toggles */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            placeholder="Tytuł dzisiejszego wpisu..."
            className="text-lg md:text-xl font-bold text-white placeholder:text-slate-700 focus:outline-hidden border-b border-transparent focus:border-slate-705 transition-colors py-1 flex-1 bg-transparent"
          />

          {/* Sync Status Badge */}
          <div className="flex items-center gap-1.5 shrink-0 self-start md:self-auto">
            {syncFolderConnected ? (
              <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-medium ${
                syncingState ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/55 animate-pulse' : 'bg-green-950/40 text-green-400 border border-green-900/50'
              }`}>
                <RefreshCw className={`w-3 h-3 ${syncingState ? 'animate-spin' : ''}`} />
                {syncingState ? 'Zapisywanie na dysku...' : 'Zsynchronizowano'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] bg-slate-800/80 text-slate-400 border border-slate-700 px-2.5 py-1 rounded-full font-medium">
                🛡️ Lokalny zapis (IndexedDB)
              </span>
            )}
          </div>

          {/* View Toggles */}
          <div className="hidden lg:flex items-center bg-[#0f1115] border border-slate-800 rounded-xl p-1 gap-1 self-start md:self-auto">
            <button
              onClick={() => setViewMode('edit')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'edit' ? 'bg-[#16191f] text-white border border-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edytor
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'split' ? 'bg-[#16191f] text-white border border-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              Podgląd i kod
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'preview' ? 'bg-[#16191f] text-white border border-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Podgląd
            </button>
          </div>

          {/* Mobile view toggles */}
          <div className="flex lg:hidden items-center bg-[#0f1115] border border-slate-800 rounded-xl p-1 gap-1 self-start">
            <button
              onClick={() => setViewMode('edit')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === 'edit' ? 'bg-[#16191f] text-white border border-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-350'
              }`}
            >
              Edytor
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === 'preview' ? 'bg-[#16191f] text-white border border-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-350'
              }`}
            >
              Podgląd
            </button>
          </div>
        </div>

        {/* Row 2: Date, Mood & Weather picker */}
        <div className="flex flex-wrap items-center gap-4 text-xs pt-1 border-t border-slate-800/80">
          
          {/* Time Picker */}
          <div className="flex items-center gap-2 text-slate-400 bg-[#0f1115] border border-slate-800 px-3 py-1.5 rounded-xl">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input 
              type="date" 
              value={date} 
              onChange={(e) => handleFieldChange('date', e.target.value)}
              className="bg-transparent focus:outline-hidden text-slate-300 font-medium cursor-pointer"
            />
            <span className="text-slate-700">|</span>
            <Clock className="w-4 h-4 text-slate-500" />
            <input 
              type="time" 
              value={time} 
              onChange={(e) => handleFieldChange('time', e.target.value)}
              className="bg-transparent focus:outline-hidden text-slate-300 font-medium cursor-pointer w-14"
            />
          </div>

          {/* Mood Select */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Nastrój:</span>
            <div className="flex items-center gap-0.5 bg-[#0f1115] border border-slate-800 p-1 rounded-xl">
              {MOODS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => handleFieldChange('mood', m.key)}
                  className={`p-1.5 rounded-lg transition-all text-sm cursor-pointer ${
                    mood === m.key 
                      ? 'bg-indigo-600 scale-105 shadow-xs text-white' 
                      : 'hover:bg-slate-800 text-slate-500 opacity-70 hover:opacity-100'
                  }`}
                  title={`${m.label}`}
                >
                  {m.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Weather Select */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Pogoda:</span>
            <div className="flex items-center gap-0.5 bg-[#0f1115] border border-slate-800 p-1 rounded-xl">
              {WEATHERS.map((w) => (
                <button
                  key={w.key}
                  onClick={() => handleFieldChange('weather', w.key)}
                  className={`p-1.5 rounded-lg transition-all text-sm cursor-pointer ${
                    weather === w.key 
                      ? 'bg-indigo-600 scale-105 shadow-xs text-white' 
                      : 'hover:bg-slate-800 text-slate-500 opacity-70 hover:opacity-100'
                  }`}
                  title={`Pogoda: ${w.label}`}
                >
                  {w.emoji}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Tagi list */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
          <div className="flex items-center gap-1 text-slate-405">
            <Tag className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-medium text-slate-400">Tagi:</span>
          </div>

          {tags.map((tg) => (
            <span
              key={tg}
              className="inline-flex items-center gap-1 bg-indigo-950/40 border border-indigo-900/60 rounded-full px-2.5 py-0.5 text-xs text-indigo-300 font-medium transition-all"
            >
              #{tg}
              <button 
                onClick={() => handleRemoveTag(tg)}
                className="text-indigo-450 hover:text-indigo-200 rounded-full hover:bg-indigo-900/40 p-0.5"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}

          {/* New Tag Form */}
          <form onSubmit={handleAddTag} className="inline-flex items-center gap-1">
            <input
              type="text"
              placeholder="+ taguj"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              className="bg-[#0f1115] border border-slate-805 focus:border-indigo-550 rounded-full px-2.5 py-0.5 text-xs text-slate-300 focus:outline-hidden transition-colors w-18 placeholder:text-slate-650"
            />
          </form>
        </div>
      </div>

      {/* CORE WORKSPACE INPUT / DOCK AREA */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* LEFT COMPACT RAW EDITING PANEL */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={`flex flex-col h-full border-r border-[#1a1d24] min-w-0 ${
            viewMode === 'split' ? 'w-1/2' : 'w-full'
          }`}>
            
            {/* Quick Helper Markdown Toolset */}
            <div className="bg-[#111418] border-b border-slate-800 p-2 shrink-0 flex items-center justify-between overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => insertMarkdownHelper('**', '**')}
                  className="p-1.5 hover:bg-slate-850 rounded text-slate-400 hover:text-white transition-colors text-xs font-bold font-mono"
                  title="Pogrubione"
                >
                  B
                </button>
                <button
                  onClick={() => insertMarkdownHelper('*', '*')}
                  className="p-1.5 hover:bg-slate-850 rounded text-slate-400 hover:text-white transition-colors text-xs italic font-mono"
                  title="Kursywa"
                >
                  I
                </button>
                <button
                  onClick={() => insertMarkdownHelper('# ')}
                  className="p-1.5 hover:bg-slate-850 rounded text-slate-400 hover:text-white transition-colors text-xs font-bold font-mono"
                  title="Nagłówek 1"
                >
                  H1
                </button>
                <button
                  onClick={() => insertMarkdownHelper('## ')}
                  className="p-1.5 hover:bg-slate-850 rounded text-slate-400 hover:text-white transition-colors text-xs font-bold font-mono"
                  title="Nagłówek 2"
                >
                  H2
                </button>
                <button
                  onClick={() => insertMarkdownHelper('\n- ')}
                  className="p-1.5 hover:bg-slate-850 rounded text-slate-400 hover:text-white transition-colors text-xs font-mono"
                  title="Lista punktowana"
                >
                  • Lista
                </button>
                <button
                  onClick={() => insertMarkdownHelper('> ')}
                  className="p-1.5 hover:bg-slate-850 rounded text-slate-400 hover:text-white transition-colors text-xs font-mono"
                  title="Cytat"
                >
                  ” Cytat
                </button>
                <button
                  onClick={() => insertMarkdownHelper('`', '`')}
                  className="p-1.5 hover:bg-slate-850 rounded text-slate-400 hover:text-white transition-colors text-xs font-mono"
                  title="Kod"
                >
                  &lt;&gt;
                </button>
                <button
                  onClick={() => insertMarkdownHelper('\n--- \n')}
                  className="p-1.5 hover:bg-slate-850 rounded text-slate-400 hover:text-white transition-colors text-xs font-mono"
                  title="Linia podziału"
                >
                  ― Linia
                </button>
              </div>

              {/* Character and word stats */}
              <div className="text-[10px] text-slate-500 font-mono pr-2 shrink-0">
                {content.split(/\s+/).filter(Boolean).length} słów | {content.length} znaków
              </div>
            </div>

            {/* TEXTAREA EDITOR */}
            <div className="flex-1 min-h-0 relative">
              <textarea
                id="raw-markdown-editor"
                value={content}
                onChange={(e) => handleFieldChange('content', e.target.value)}
                placeholder="Naciśnij 'Uruchom dyktowanie' poniżej, aby zacząć mówić, lub napisz cokolwiek w formacie Markdown..."
                className="w-full h-full p-5 lg:p-6 text-slate-300 placeholder:text-slate-700 focus:outline-hidden font-mono text-xs leading-relaxed resize-none bg-[#0f1115] overflow-y-auto"
              />
            </div>
          </div>
        )}

        {/* RIGHT LIVE MARKDOWN PREVIEW */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`p-5 lg:p-6 bg-[#0f1115] overflow-y-auto h-full min-w-0 ${
            viewMode === 'split' ? 'w-1/2' : 'w-full'
          }`}>
            <div className="max-w-2xl mx-auto bg-[#16191f] border border-slate-800/80 rounded-2xl p-6 lg:p-8 shadow-2xs min-h-full">
              
              {/* Journal Meta Banner on preview page */}
              <div className="pb-4 mb-5 border-b border-slate-800/60 flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider font-mono">
                <span>DRAFT WPISU (PODGLĄD MD)</span>
                <span>{date} {time}</span>
              </div>
              
              <div 
                className="markdown-preview"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} 
              />
            </div>
          </div>
        )}
      </div>

      {/* FLOATING ACTION BOTTOM DICTATION BAR */}
      <div className="border-t border-slate-805 p-4 shrink-0 bg-[#111418]/95 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl relative z-20">
        
        {/* Section 1: Error warnings or current dictation state */}
        <div className="flex-1 min-w-0">
          {speechError ? (
            <p className="text-xs text-rose-400 font-medium flex items-center gap-1.5 bg-rose-950/40 border border-rose-900/50 p-2.5 rounded-xl">
              <span className="shrink-0 text-rose-500">⚠</span>
              <span>{speechError}</span>
            </p>
          ) : isDictating ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
                </span>
                <span className="text-xs text-rose-500 font-bold tracking-tight">System słucha Twojego głosu...</span>
              </div>
              {/* Interim Real-time transcription bubble */}
              <p className="text-slate-300 text-xs italic truncate font-medium bg-[#0f1115] p-2 rounded-lg border border-slate-800">
                🎭 Słyszane teraz: {interimSpeech || <span className="opacity-40">Mów do mikrofonu...</span>}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#0f1115] rounded-lg text-indigo-400 shrink-0 border border-slate-800">
                <Keyboard className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-300 font-medium">Możesz pisać ręcznie lub użyć dyktowania głosowego.</p>
                <p className="text-[10px] text-slate-500">Zamieniaj wypowiedzi na kropki, przecinki oraz nowe akapity automatycznie.</p>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Controls (Lang Switcher, Help Commands, Core Dictation Record Trigger) */}
        <div className="flex items-center gap-2.5 shrink-0 justify-end">
          
          {/* Active Dictation Commands Dialog list trigger */}
          <div className="relative">
            <button
              onClick={() => setShowCommands(!showCommands)}
              className={`p-2.5 rounded-xl border text-xs font-semibold select-none flex items-center gap-1.5 transition-all text-slate-300 hover:text-white cursor-pointer ${
                showCommands ? 'bg-indigo-950/60 border-indigo-900/60 ring-2 ring-indigo-900/40' : 'bg-[#16191f] border-slate-800'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-indigo-400" />
              Komendy Głosowe
            </button>

            {/* Commands Popover menu */}
            {showCommands && (
              <div className="absolute bottom-14 right-0 w-80 md:w-96 bg-[#16191f] border border-slate-800 rounded-2xl shadow-xl p-4.5 space-y-3 z-30 max-h-[420px] overflow-y-auto no-scrollbar">
                <div className="flex items-center justify-between border-b border-slate-805 pb-2">
                  <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-404" />
                    Komendy dyktowania (PL)
                  </h4>
                  <button 
                    onClick={() => setShowCommands(false)}
                    className="text-slate-400 hover:text-white rounded-full p-0.5 hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Mówiąc te słowa podczas dyktowania po polsku, system automatycznie zamieni je na odpowiednie formatowanie Markdown lub znaki interpunkcyjne:
                </p>
                
                <div className="grid grid-cols-1 gap-2 divide-y divide-slate-800 pt-1">
                  {POLISH_VOICE_COMMANDS.map((cmd, idx) => (
                    <div key={idx} className="flex justify-between items-start pt-1.5 text-xs">
                      <div>
                        <code className="bg-indigo-950/40 text-indigo-300 font-bold px-1.5 py-0.5 rounded text-[11px] border border-indigo-900/50">
                          "{cmd.phrase}"
                        </code>
                        <p className="text-slate-500 text-[10px] mt-0.5">{cmd.action}</p>
                      </div>
                      <code className="bg-slate-900 text-slate-300 px-1 py-0.5 rounded font-mono text-[10px] whitespace-pre border border-slate-800">
                        {cmd.replacement.replace(/\n/g, '\\n')}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Language Switcher */}
          <select
            value={dictationLang}
            onChange={(e) => setDictationLang(e.target.value as DictationLanguage)}
            disabled={isDictating}
            className="bg-[#16191f] border border-slate-800 focus:border-indigo-500 text-slate-300 font-semibold rounded-xl text-xs px-3 py-2.5 focus:outline-hidden disabled:bg-slate-800 cursor-pointer"
          >
            <option value="pl-PL">🇵🇱 Polski</option>
            <option value="en-US">🇺🇸 English</option>
            <option value="de-DE">🇩🇪 Deutsch</option>
            <option value="es-ES">🇪🇸 Español</option>
            <option value="fr-FR">🇫🇷 Français</option>
          </select>

          {/* MAIN RECORD RECORD TRIGGER BIG ROUND BUTTON */}
          <div className="relative">
            {/* Wave animation circles when dictating */}
            {isDictating && (
              <>
                <div className="absolute inset-0 bg-rose-500 rounded-full animate-speech-wave-1 z-0"></div>
                <div className="absolute inset-0 bg-rose-500 rounded-full animate-speech-wave-2 z-0"></div>
                <div className="absolute inset-0 bg-rose-500 rounded-full animate-speech-wave-3 z-0"></div>
              </>
            )}

            <button
              onClick={toggleDictation}
              className={`relative z-10 px-5 py-3 rounded-xl font-bold text-xs text-white shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer hover:scale-103 active:scale-97 ${
                isDictating 
                  ? 'bg-rose-600 hover:bg-rose-700' 
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isDictating ? (
                <>
                  <MicOff className="w-4.5 h-4.5" />
                  <span>Zatrzymaj dyktowanie</span>
                </>
              ) : (
                <>
                  <Mic className="w-4.5 h-4.5" />
                  <span>Uruchom dyktowanie</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
