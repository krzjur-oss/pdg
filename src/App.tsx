import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Plus, 
  Download, 
  Upload, 
  Settings, 
  ChevronRight, 
  WifiOff, 
  RefreshCw, 
  Menu, 
  X,
  FileText,
  HelpCircle,
  FolderOpen
} from 'lucide-react';
import { JournalEntry, SyncConfig } from './types';
import NoteList from './components/NoteList';
import NoteEditor from './components/NoteEditor';
import FolderSync from './components/FolderSync';
import { 
  getSafeFileName, 
  serializeEntryToMarkdown, 
  loadSyncFolderHandle,
  POLISH_VOICE_COMMANDS
} from './utils';

// Default initial tutorial notes in Polish
const INITIAL_NOTES: JournalEntry[] = [
  {
    id: 'tutorial-1',
    title: 'Witaj w Twoim Głosowym Dzienniku! 🎙️📖',
    content: `To jest Twój w pełni offline, bezpieczny i prywatny notatnik głosowy w formie dziennika. Posiada zaawansowaną integrację z przeglądarką i pozwala na wygodne mówienie zamiast pisania.

### 🚀 Jak zacząć dyktowanie?
1. Naciśnij niebieski przycisk **"Uruchom dyktowanie"** na dolnym pasku.
2. Nadaj uprawnienia do mikrofonu (jeśli przeglądarka zapyta).
3. Zacznij mówić! Twój głos zostanie zamieniony na tekst w czasie rzeczywistym.

### ✍️ Model automatycznego formatowania (Komendy głosowe)
Aplikacja automatycznie zamienia polskie wyrażenia leksykalne na formatowanie Markdown oraz interpunkcję. Spróbuj powiedzieć:
- *"... radosny dzień kropka"* -> "... radosny dzień."
- *"... ważna myśl wykrzyknik"* -> "... ważna myśl!"
- *"... nagłówek Moje wspomnienia nowy akapit"* -> tworzy nagłówek pierwszego stopnia i przechodzi do nowej sekcji.
- *"... punkt kupić mleko"* -> automatycznie wstawia punktor listy.

Pełną listę reguł znajdziesz po kliknięciu przycisku **"Komendy Głosowe"** obok przycisku nagrywania!

### 🔒 Bezpieczeństwo i Praca Offline
Ta aplikacja to Progressive Web App (PWA). Działa całkowicie lokalnie w Twojej przeglądarce i nie wysyła żadnych danych na zewnętrzne serwery. Nic nie jest zapisywane w chmurze – Twoje sekrety są w pełni bezpieczne na Twoim urządzeniu!`,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString().substring(0, 5),
    tags: ['instrukcja', 'poczatek', 'poradnik'],
    mood: 'happy',
    weather: 'sunny',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tutorial-2',
    title: 'Dlaczego warto synchronizować z folderem lokalnym? 📁',
    content: `Jedną z najfajniejszych funkcji tej aplikacji jest opcja **automatycznej synchronizacji z lokalnym folderem na dysku** komputera przy użyciu nowoczesnego **File System Access API**.

### 💡 Jakie płyną z tego korzyści?
1. **Pełna kontrola nad danymi**: Tworzone wpisy są automatycznie zapisywane jako pliki standardu Markdown (\`.md\`) w wybranym katalogu (np. \`Dokumenty/Dziennik\`).
2. **Kompatybilność z Obsidian / Notion**: Możesz wskazać swój vault (katalog) w programie Obsidian, a podyktowane notatki natychmiast pojawią się w Twojej bazie wiedzy!
3. **Ochrona przed utratą danych**: Standardowe przeglądarki mogą usunąć pamięć pomocniczą strony po długim braku aktywności. Zapis plików na rzeczywistym dysku daje 100% gwarancji, że pamiętnik nigdy nie zniknie!

### 🔧 Jak włączyć automatyczną synchronizację?
W panelu po lewej stronie (lub w ustawieniach) znajdź sekcję **Automatyczna Synchronizacja** i kliknij przycisk **"Wybierz folder na dysku"**. Wskaż pusty folder lub swój dotychczasowy katalog i zaakceptuj uprawnienia do zapisu!`,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString().substring(0, 5),
    tags: ['markdown', 'synchronizacja', 'dane'],
    mood: 'peaceful',
    weather: 'cloudy',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export default function App() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Sync state tracking
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    isSupported: 'showDirectoryPicker' in window,
    isSyncing: false,
    folderName: null,
    lastSyncedAt: null,
    error: null
  });
  
  const directoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null);

  // Responsive sidebar drawer menu state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // On mount, load notes from localStorage, check sync settings
  useEffect(() => {
    const rawNotes = localStorage.getItem('dziennik_entries');
    if (rawNotes) {
      try {
        const parsed = JSON.parse(rawNotes);
        setEntries(parsed);
        if (parsed.length > 0) {
          setSelectedId(parsed[0].id);
        }
      } catch (err) {
        console.error('Error reloading saved notes, seeding templates...', err);
        setEntries(INITIAL_NOTES);
        setSelectedId('tutorial-1');
      }
    } else {
      // First boot: set sample tutorials
      setEntries(INITIAL_NOTES);
      setSelectedId('tutorial-1');
      localStorage.setItem('dziennik_entries', JSON.stringify(INITIAL_NOTES));
    }

    // Auto toggle sidebar close on narrow mobile screens
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  // Sync state changes from child component
  const handleSyncConfigChange = (newConfig: SyncConfig, handle: FileSystemDirectoryHandle | null) => {
    setSyncConfig(newConfig);
    directoryHandleRef.current = handle;
  };

  // Create single file writer function
  const writeSingleFileToDisk = async (entry: JournalEntry, handle: FileSystemDirectoryHandle) => {
    try {
      const fileName = getSafeFileName(entry);
      const fileHandle = await handle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      
      const contentMD = serializeEntryToMarkdown(entry);
      await writable.write(contentMD);
      await writable.close();
    } catch (err) {
      console.error(`Błąd zapisu pliku ${entry.title}:`, err);
      throw err;
    }
  };

  // Create single file remover function
  const deleteSingleFileFromDisk = async (entry: JournalEntry, handle: FileSystemDirectoryHandle) => {
    try {
      const fileName = getSafeFileName(entry);
      await handle.removeEntry(fileName);
    } catch (err: any) {
      // If file doesn't exist on disk, that's fine to bypass
      if (err.name !== 'NotFoundError') {
        console.error(`Błąd usuwania pliku ${entry.title}:`, err);
      }
    }
  };

  // Bulk manual/initial sync of all notes
  const triggerManualSync = async () => {
    const handle = directoryHandleRef.current;
    if (!handle) return;

    setSyncConfig(prev => ({ ...prev, isSyncing: true, error: null }));
    try {
      // Re-verify permission
      const status = await handle.queryPermission({ mode: 'readwrite' });
      if (status !== 'granted') {
        const requestStatus = await handle.requestPermission({ mode: 'readwrite' });
        if (requestStatus !== 'granted') {
          throw new Error('Przeglądarka zablokowała re-autoryzację folderu dyskowego. Kliknij przycisk „Przywróć zapis” w panelu.');
        }
      }

      // Write each note
      for (const entry of entries) {
        await writeSingleFileToDisk(entry, handle);
      }

      setSyncConfig(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncedAt: new Date().toLocaleTimeString(),
        error: null
      }));
    } catch (err: any) {
      console.error('Batch sync failure:', err);
      setSyncConfig(prev => ({
        ...prev,
        isSyncing: false,
        error: err.message || 'Nie udało się zachować notatek w folderze.'
      }));
    }
  };

  // Add / Save Note logic
  const handleSaveEntry = async (updatedEntry: JournalEntry) => {
    // 1. Update React state
    let nextEntries: JournalEntry[] = [];
    setEntries((prev) => {
      const exists = prev.some(e => e.id === updatedEntry.id);
      if (exists) {
        nextEntries = prev.map(e => e.id === updatedEntry.id ? updatedEntry : e);
      } else {
        nextEntries = [updatedEntry, ...prev];
      }
      // 2. Persist in LocalStorage
      localStorage.setItem('dziennik_entries', JSON.stringify(nextEntries));
      return nextEntries;
    });

    // 3. Auto sync trigger to local folder if active
    const handle = directoryHandleRef.current;
    if (handle) {
      setSyncConfig(prev => ({ ...prev, isSyncing: true }));
      try {
        await writeSingleFileToDisk(updatedEntry, handle);
        setSyncConfig(prev => ({
          ...prev,
          isSyncing: false,
          lastSyncedAt: new Date().toLocaleTimeString(),
          error: null
        }));
      } catch (err: any) {
        console.error('Single note sync error:', err);
        setSyncConfig(prev => ({
          ...prev,
          isSyncing: false,
          error: `Auto-zapis nie powiódł się: ${err.message || 'brak dostępu'}`
        }));
      }
    }
  };

  // Delete note
  const handleDeleteEntry = async (id: string) => {
    const entryToDelete = entries.find(e => e.id === id);
    if (!entryToDelete) return;

    if (!confirm(`Czy na pewno chcesz bezpowrotnie usunąć wpis: "${entryToDelete.title || 'bez tytułu'}"?`)) {
      return;
    }

    // 1. Update React State
    const nextEntries = entries.filter(e => e.id !== id);
    setEntries(nextEntries);
    localStorage.setItem('dziennik_entries', JSON.stringify(nextEntries));

    if (selectedId === id) {
      setSelectedId(nextEntries.length > 0 ? nextEntries[0].id : null);
    }

    // 2. Clear from disk if sync active
    const handle = directoryHandleRef.current;
    if (handle) {
      setSyncConfig(prev => ({ ...prev, isSyncing: true }));
      try {
        await deleteSingleFileFromDisk(entryToDelete, handle);
        setSyncConfig(prev => ({
          ...prev,
          isSyncing: false,
          lastSyncedAt: new Date().toLocaleTimeString(),
          error: null
        }));
      } catch (err: any) {
        console.error('Error removing file during sync:', err);
        setSyncConfig(prev => ({
          ...prev,
          isSyncing: false,
          error: `Błąd usuwania pliku z dysku: ${err.message}`
        }));
      }
    }
  };

  // Create brand new entry
  const handleAddNewEntry = () => {
    const now = new Date();
    const newEntry: JournalEntry = {
      id: `note_${Date.now()}`,
      title: `Wpis z dnia ${now.toLocaleDateString()}`,
      content: '',
      date: now.toISOString().split('T')[0],
      time: now.toLocaleTimeString().substring(0, 5),
      tags: ['nowy'],
      mood: 'neutral',
      weather: 'none',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    const nextEntries = [newEntry, ...entries];
    setEntries(nextEntries);
    localStorage.setItem('dziennik_entries', JSON.stringify(nextEntries));
    setSelectedId(newEntry.id);
    
    // Auto sync to folder if active
    const handle = directoryHandleRef.current;
    if (handle) {
      writeSingleFileToDisk(newEntry, handle).catch(err => {
        console.error('Failed to sync new blank note', err);
      });
    }

    // Close mobile sidebars to focus input layout immediately
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  // JSON Backups Export
  const downloadJSONBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(entries, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `dziennik-kopia-zapasowa_${new Date().toISOString().split('T')[0]}.json`);
    dlAnchorElem.click();
  };

  // JSON Backups Import
  const handleJSONBackupImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const files = e.target.files;
    if (!files || files.length === 0) return;

    fileReader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0 && 'content' in parsed[0]) {
          const merged = [...parsed, ...entries.filter(e => !parsed.some(o => o.id === e.id))];
          setEntries(merged);
          localStorage.setItem('dziennik_entries', JSON.stringify(merged));
          if (merged.length > 0) setSelectedId(merged[0].id);
          
          alert(`Pomyślnie zaimportowano ${parsed.length} wpisów!`);
          
          // trigger complete disk sync
          const handle = directoryHandleRef.current;
          if (handle) {
            alert('Rozpoczynam synchronizację zaimportowanych wpisów z dyskiem lokalnym...');
            await triggerManualSync();
          }
        } else {
          alert('Błędny plik kopii zapasowej. Wybierz poprawny plik .json dziennika.');
        }
      } catch (err) {
        alert('Nie udało się odczytać pliku backupu.');
      }
    };
    fileReader.readAsText(files[0]);
  };

  const activeEntry = entries.find(e => e.id === selectedId) || null;

  return (
    <div className="flex h-screen bg-[#0f1115] overflow-hidden font-sans antialiased text-slate-100">
      
      {/* MOBILE HEADER BAR */}
      <div className="absolute top-0 left-0 right-0 h-14 bg-[#16191f] border-b border-slate-800 flex items-center justify-between px-4 z-30 lg:hidden text-white shrink-0">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <span className="font-bold text-sm tracking-tight flex items-center gap-1.5">
          <BookOpen className="w-4.5 h-4.5 text-indigo-400" />
          Dziennik Głosowy PWA
        </span>
        <button
          onClick={handleAddNewEntry}
          className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* SIDEBAR MAIN AREA */}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 lg:relative w-[320px] lg:w-[350px] shrink-0 border-r border-slate-800 bg-[#16191f] text-slate-100 flex flex-col justify-between transform transition-transform duration-300 lg:transform-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } pt-14 lg:pt-0`}
      >
        {/* Upper Sidebar Column: Note Lists */}
        <div className="flex-1 overflow-hidden">
          <NoteList
            entries={entries}
            selectedId={selectedId}
            onSelectEntry={(id) => {
              setSelectedId(id);
              if (window.innerWidth < 1024) {
                setSidebarOpen(false); // Auto close menu drawer on mobile clicks
              }
            }}
            onDeleteEntry={handleDeleteEntry}
            onAddNewEntry={handleAddNewEntry}
          />
        </div>

        {/* Lower Sidebar Column: PWA Sync & Utilities Drawer */}
        <div className="p-4 border-t border-slate-850 bg-[#111418] space-y-3">
          
          {/* File System Access Sync Section */}
          <FolderSync
            syncConfig={syncConfig}
            onSyncConfigChange={handleSyncConfigChange}
            onTriggerManualSync={triggerManualSync}
          />

          {/* Backup / Tool Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex-1 py-2 px-3 bg-[#1e222b]/80 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-400" />
              Kopia & Narzędzia
            </button>
          </div>
        </div>
      </aside>

      {/* OVERLAY FOR MOBILE SIDEBAR CLOSURES */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/70 z-30 lg:hidden"
        ></div>
      )}

      {/* CENTRAL EDITOR WORKSPACE AREA */}
      <main className="flex-1 flex flex-col h-full bg-[#0f1115] relative pt-14 lg:pt-0 overflow-hidden min-w-0">
        <NoteEditor
          entry={activeEntry}
          onSaveEntry={handleSaveEntry}
          syncFolderConnected={!!syncConfig.folderName}
          syncingState={syncConfig.isSyncing}
        />
      </main>

      {/* SETTINGS BACKUP POPUP DRAWER */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in">
          <div className="bg-[#16191f] border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-5 animate-scale-up text-slate-300">
            
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" />
                Dziennik Głosowy - Kopia Zapasowa
              </h3>
              <button 
                onClick={() => setShowSettings(false)}
                className="text-slate-450 hover:text-white hover:bg-slate-800 rounded-full p-1 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <p>
                Twoje dane są w całości przechowywane na tym komputerze w bezpiecznej, wydzielonej pamięci lokalnej (IndexedDB).
              </p>
              
              {/* Box 1: Export backup option */}
              <div className="p-3 bg-[#111418] rounded-2xl border border-slate-850 space-y-2">
                <p className="font-bold text-slate-200">1. Pobierz kopię wszystkich wpisów jako plik JSON</p>
                <p className="text-[10px] text-slate-500">
                  Używaj tego, aby przenieść dziennik do innej przeglądarki lub na inne urządzenie (np. telefon).
                </p>
                <button
                  onClick={downloadJSONBackup}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Eksportuj kopię (.JSON)
                </button>
              </div>

              {/* Box 2: Import backup option */}
              <div className="p-3 bg-[#111418] rounded-2xl border border-slate-850 space-y-2">
                <p className="font-bold text-slate-200">2. Przywróć lub scal wpisy z pliku JSON</p>
                <p className="text-[10px] text-slate-500">
                  Wybierz wyeksportowany wcześniej plik JSON, aby wczytać notatki. Istniejące wpisy nie zostaną nadpisane.
                </p>
                <label className="block w-full py-2 bg-slate-800 hover:bg-slate-705 text-white font-bold rounded-xl text-center cursor-pointer transition-colors border border-slate-700">
                  <div className="flex items-center justify-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-indigo-400" />
                    Wgraj kopię zapasową (.JSON)
                  </div>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleJSONBackupImport}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="p-3 bg-indigo-950/30 border border-indigo-900/50 rounded-2xl text-[10px] text-indigo-300 leading-normal">
                💡 <strong>Dobra rada:</strong> Jeśli połączyłeś folder z automatyczną synchronizacją, aplikacja automatycznie stworzy i uaktualni pliki .md na Twoim dysku za każdym razem, gdy dodasz, wyedytujesz lub usuniesz dowolny wpis!
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
            >
              Zamknij panel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
