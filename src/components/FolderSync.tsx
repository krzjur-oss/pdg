import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  HelpCircle, 
  ExternalLink,
  Trash2
} from 'lucide-react';
import { SyncConfig } from '../types';
import { saveSyncFolderHandle, loadSyncFolderHandle, clearSyncFolderHandle } from '../utils';

interface FolderSyncProps {
  syncConfig: SyncConfig;
  onSyncConfigChange: (config: SyncConfig, handle: FileSystemDirectoryHandle | null) => void;
  onTriggerManualSync: () => Promise<void>;
}

export default function FolderSync({ syncConfig, onSyncConfigChange, onTriggerManualSync }: FolderSyncProps) {
  const [permissionState, setPermissionState] = useState<PermissionState | 'not-tested'>('not-tested');
  const [checking, setChecking] = useState<boolean>(true);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [isIframe, setIsIframe] = useState<boolean>(false);

  // Check if running inside iframe
  useEffect(() => {
    try {
      setIsIframe(window.self !== window.top);
    } catch {
      setIsIframe(true);
    }
  }, []);

  // Check initial permission for loaded directory handle if exists
  useEffect(() => {
    const initCheck = async () => {
      setChecking(true);
      try {
        const storedHandle = await loadSyncFolderHandle();
        if (storedHandle) {
          // Check query permission
          const status = await (storedHandle as any).queryPermission({ mode: 'readwrite' });
          setPermissionState(status);
          
          onSyncConfigChange({
            isSupported: 'showDirectoryPicker' in window,
            isSyncing: false,
            folderName: storedHandle.name,
            lastSyncedAt: syncConfig.lastSyncedAt,
            error: null
          }, storedHandle);
        } else {
          onSyncConfigChange({
            isSupported: 'showDirectoryPicker' in window,
            isSyncing: false,
            folderName: null,
            lastSyncedAt: null,
            error: null
          }, null);
        }
      } catch (err: any) {
        console.error('Błąd inicjalizacji folderu synchronizacji:', err);
        // Might be because of iframe sandbox
        onSyncConfigChange({
          isSupported: 'showDirectoryPicker' in window,
          isSyncing: false,
          folderName: null,
          lastSyncedAt: null,
          error: err.message || 'Brak uprawnień lub błąd piaskownicy iframe'
        }, null);
      } finally {
        setChecking(false);
      }
    };
    initCheck();
  }, []);

  // Request/Request re-authorization
  const requestPermission = async (handle: FileSystemDirectoryHandle): Promise<boolean> => {
    try {
      const status = await (handle as any).requestPermission({ mode: 'readwrite' });
      setPermissionState(status);
      return status === 'granted';
    } catch (err: any) {
      console.error('Użytkownik odrzucił lub błąd uprawnień:', err);
      return false;
    }
  };

  // Choose a new folder sync directory
  const handleSelectFolder = async () => {
    if (!('showDirectoryPicker' in window)) {
      alert('Twoja przeglądarka nie wspiera File System Access API. Użyj Google Chrome, Edge lub Opera.');
      return;
    }

    try {
      // Chrome sandbox iframe protection notice
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });
      
      const isGranted = await requestPermission(handle);
      if (isGranted) {
        await saveSyncFolderHandle(handle);
        onSyncConfigChange({
          isSupported: true,
          isSyncing: false,
          folderName: handle.name,
          lastSyncedAt: new Date().toLocaleTimeString(),
          error: null
        }, handle);
        
        // Trigger sync
        setTimeout(() => {
          onTriggerManualSync();
        }, 30);
      }
    } catch (err: any) {
      console.error('Błąd wyboru folderu:', err);
      let errorMsg = err.message || 'Anulowano wybór';
      if (isIframe) {
        errorMsg = 'Blokada Iframe: Otwórz aplikację w nowej karcie przyciskiem w prawym górnym rogu ekranu, aby móc wybrać folder.';
      }
      onSyncConfigChange({
        ...syncConfig,
        error: errorMsg
      }, null);
    }
  };

  // Disconnect sync folder
  const handleDisconnect = async () => {
    if (confirm('Czy na pewno chcesz odłączyć automatyczną synchronizację z folderem? Twój lokalny dysk nie zostanie zmieniony, ale nowe notatki nie będą się tam automatycznie zapisywać.')) {
      await clearSyncFolderHandle();
      setPermissionState('not-tested');
      onSyncConfigChange({
        isSupported: 'showDirectoryPicker' in window,
        isSyncing: false,
        folderName: null,
        lastSyncedAt: null,
        error: null
      }, null);
    }
  };

  // Grant access back to existing directory
  const handleRestoreAccess = async () => {
    const handle = await loadSyncFolderHandle();
    if (handle) {
      const granted = await requestPermission(handle);
      if (granted) {
        onSyncConfigChange({
          ...syncConfig,
          error: null
        }, handle);
        // Sync now
        onTriggerManualSync();
      }
    }
  };

  const isSupported = 'showDirectoryPicker' in window;

  return (
    <div className="bg-[#16191f] border border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-950/40 text-indigo-400 border border-indigo-900/50 rounded-xl">
            <Folder className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-200 text-sm">Automatyczna Synchronizacja</h3>
            <p className="text-xs text-slate-400">Zapisuj pliki Markdown bezpośrednio na komputerze</p>
          </div>
        </div>
        <button 
          onClick={() => setShowHelp(!showHelp)}
          className="text-slate-500 hover:text-white transition-colors p-1"
          title="Dowiedz się więcej"
        >
          <HelpCircle className="w-4.5 h-4.5" />
        </button>
      </div>

      {showHelp && (
        <div className="text-xs text-slate-400 bg-[#0f1115] p-4 rounded-xl border border-slate-805 leading-relaxed space-y-2">
          <p>
            <strong>File System Access API</strong> pozwala tej aplikacji zapisywać i aktualizować pliki Markdown (<code className="bg-[#16191f] text-slate-200 border border-slate-800 px-1 rounded">.md</code>) bezpośrednio w wybranym folderze lokalnym całkowicie w tle.
          </p>
          <p>
            Aplikacja działa w 100% offline. Zapis na dysku chroni Twoje wpisy przed utratą danych w przypadku usunięcia pamięci przeglądarki.
          </p>
          <p className="text-indigo-400 font-medium">
            Wskazówka: Pliki .md możesz otwierać w programach Obsidian, Notion, VS Code lub w dowolnym edytorze tekstu!
          </p>
        </div>
      )}

      {!isSupported ? (
        <div className="p-4 bg-amber-950/20 text-amber-300 rounded-xl border border-amber-900/40 text-xs leading-relaxed space-y-2">
          <p className="font-semibold flex items-center gap-1.5 text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Brak pełnego wsparcia dla zapisu folderu
          </p>
          <p>
            Twoja przeglądarka lub system nie dają pełnego dostępu do zapisu katalogów bezpośrednio na dysku (np. Safari na iOS / Firefox).
          </p>
          <p className="font-medium text-amber-200">
            Nadal możesz tworzyć wpisy! Twoje notatki są bezpiecznie zapisywane w lokalnej pamięci (IndexedDB) i możesz je ręcznie pobrać w formacie .md na żądanie.
          </p>
        </div>
      ) : checking ? (
        <div className="flex items-center justify-center py-4 gap-2 text-xs text-slate-400">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
          <span>Weryfikacja folderu zapisu...</span>
        </div>
      ) : syncConfig.folderName ? (
        <div className="space-y-3">
          {permissionState === 'granted' ? (
            <div className="p-3.5 bg-green-950/10 border border-green-900/40 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold text-green-300">Folder połączony</p>
                <p className="text-slate-300 font-mono mt-0.5 truncate max-w-[200px]" title={syncConfig.folderName}>
                  📁 {syncConfig.folderName}
                </p>
                {syncConfig.lastSyncedAt && (
                  <p className="text-slate-500 text-[10px] mt-1">
                    Ostatnia synchronizacja: {syncConfig.lastSyncedAt}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-[#251e18] border border-amber-900/40 rounded-xl space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200">
                  <p className="font-semibold">Zezwól na dostęp</p>
                  <p className="text-slate-300">Przeglądarka wymaga ponownego kliknięcia po załadowaniu strony, aby zapisać pliki w katalogu <strong className="font-mono text-amber-200">{syncConfig.folderName}</strong>.</p>
                </div>
              </div>
              <button
                onClick={handleRestoreAccess}
                className="w-full py-1.5 px-3 bg-amber-700 hover:bg-amber-600 text-white rounded-lg text-xs font-medium cursor-pointer transition-colors shadow-xs"
              >
                Przywróć zapis na dysku
              </button>
            </div>
          )}

          {syncConfig.error && (
            <div className="p-3 bg-rose-950/20 text-rose-300 border border-rose-900/50 rounded-xl text-xs space-y-1">
              <p className="font-semibold">Błąd synchronizacji:</p>
              <p className="text-[11px] leading-relaxed">{syncConfig.error}</p>
              {isIframe && (
                <p className="font-medium mt-1 text-rose-200 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  Otwórz w nowej karcie na górnym pasku!
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onTriggerManualSync}
              disabled={permissionState !== 'granted' || syncConfig.isSyncing}
              className="flex-1 py-1.5 px-3 bg-[#0f1115] hover:bg-slate-800 text-slate-200 border border-slate-805 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncConfig.isSyncing ? 'animate-spin text-indigo-500' : ''}`} />
              Synchronizuj teraz
            </button>
            <button
              onClick={handleDisconnect}
              className="py-1.5 px-2.5 bg-rose-950/20 hover:bg-rose-950/50 border border-rose-900/40 text-rose-450 rounded-lg transition-colors cursor-pointer"
              title="Odłącz folder"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {syncConfig.error && (
            <div className="p-3 bg-rose-950/20 text-rose-300 border border-rose-900/50 rounded-xl text-xs space-y-1">
              <p className="font-semibold">Brak dostępu lub błąd:</p>
              <p className="text-[11px] leading-relaxed">{syncConfig.error}</p>
              {isIframe && (
                <div className="mt-2 p-2 bg-[#0f1115] rounded border border-rose-900/30 text-[11px]">
                  <p className="font-semibold text-rose-400 flex items-center gap-1">
                    Praca w ramce iFrame
                  </p>
                  <p className="text-slate-400 mt-0.5 leading-relaxed">Polityka zabezpieczeń Chrome blokuje File System Access API wewnątrz ramki podglądu AI Studio. Kliknij przycisk <strong>Open in new window</strong> w prawym górnym rogu ekranu, aby korzystać z tej opcji!</p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleSelectFolder}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <Folder className="w-4 h-4" />
            Wybierz folder na dysku
          </button>
          <p className="text-[10px] text-slate-550 text-center leading-normal">
            Gwarancja 100% prywatności. Pliki lokalne nigdy nie opuszczają Twojego komputera.
          </p>
        </div>
      )}
    </div>
  );
}
