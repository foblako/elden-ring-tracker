import React, { useState, useRef, useEffect, useId } from 'react';
import { useTracker } from '../../context/TrackerContext';
import { parseSaveFile } from '../../services/saveParser';
import type { LocalSaveInfo, SaveSlotSummary } from '../../types';
import {
  Folder,
  FolderOpen,
  FileCheck,
  AlertCircle,
  X,
  Check,
  ShieldCheck,
  HelpCircle,
  Zap,
  Copy,
  CheckCheck,
  User,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Clock,
  Sparkles,
  HardDrive,
  FileText,
  Shuffle,
} from 'lucide-react';

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SaveModal: React.FC<SaveModalProps> = ({ isOpen, onClose }) => {
  const {
    allMarkers,
    liveSyncState,
    activeSavePath,
    activeSaveName,
    trackedSlotIndex,
    detectLocalSaves,
    scanFolder,
    getSaveSlots,
    selectSaveAndSlot,
    stopLiveSync,
    applyParsedSlot,
    isRandomizer,
    setIsRandomizer,
  } = useTracker();

  // Wizard step: 'folder' (pick folder/file) or 'slots' (pick character slot)
  const [step, setStep] = useState<'folder' | 'slots'>('folder');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Saves detected from backend
  const [localSaves, setLocalSaves] = useState<LocalSaveInfo[]>([]);
  const [customPathInput, setCustomPathInput] = useState('');

  // Selected file and slots state
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('ER0000.sl2');
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [parsedSlots, setParsedSlots] = useState<SaveSlotSummary[]>([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);
  const [showRandoHelp, setShowRandoHelp] = useState(false);
  const [copied, setCopied] = useState(false);

  // In-memory buffer if loaded via browser file picker / drag-and-drop
  const [inMemoryBuffer, setInMemoryBuffer] = useState<ArrayBuffer | null>(null);

  const fileInputId = useId();
  const folderInputId = useId();

  // Initialize and load detected saves when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    detectLocalSaves()
      .then(async (saves) => {
        setLocalSaves(saves);

        // If user already has an active configured save, pre-select it and show slots
        if (activeSavePath) {
          setSelectedFilePath(activeSavePath);
          setSelectedFileName(activeSaveName || 'ER0000.sl2');
          setSelectedSlotIndex(trackedSlotIndex);

          // Find if it's in detected saves
          const found = saves.find((s) => s.path === activeSavePath);
          if (found && found.slots && found.slots.length > 0) {
            setParsedSlots(found.slots);
            setStep('slots');
          } else {
            // Load slots from backend
            const slots = await getSaveSlots(activeSavePath);
            if (slots.length > 0) {
              setParsedSlots(slots);
              setStep('slots');
            } else {
              setStep('folder');
            }
          }
        } else if (saves.length > 0) {
          // Default to folder step so user sees detected saves clearly
          setStep('folder');
        }
      })
      .catch((e) => {
        console.error('Failed to detect saves:', e);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, activeSavePath, activeSaveName, trackedSlotIndex, detectLocalSaves, getSaveSlots]);

  if (!isOpen) return null;

  const handleCopyPath = () => {
    navigator.clipboard.writeText('%APPDATA%\\EldenRing');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * Handle user picking one of the detected Steam folders
   */
  const handleSelectLocalSave = async (save: LocalSaveInfo) => {
    setError(null);
    setIsLoading(true);
    setSelectedFilePath(save.path);
    setSelectedFileName(save.fileName);
    setSelectedFolderPath(save.folderPath);

    try {
      let slots = save.slots || [];
      if (!slots || slots.length === 0) {
        slots = await getSaveSlots(save.path);
      }

      if (slots.length === 0) {
        setError('В данном файле сохранения не найдено активных персонажей.');
        return;
      }

      setParsedSlots(slots);

      // Pre-select saved slot or highest level character
      const targetSlot = trackedSlotIndex >= 0 ? trackedSlotIndex : 0;
      const matched =
        slots.find((s) => s.index === targetSlot) ||
        slots.reduce((b, s) => (s.level > b.level ? s : b), slots[0]);

      setSelectedSlotIndex(matched.index);
      setStep('slots');
    } catch (err: any) {
      setError('Ошибка чтения файла: ' + (err.message || 'Неизвестная ошибка'));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle scanning a manually entered custom folder path
   */
  const handleScanCustomPath = async () => {
    if (!customPathInput.trim()) return;
    setError(null);
    setIsLoading(true);

    try {
      const res = await scanFolder(customPathInput.trim());
      if (res.error) {
        setError(res.error);
        return;
      }

      if (res.saves && res.saves.length > 0) {
        setLocalSaves((prev) => {
          const existingPaths = new Set(prev.map((p) => p.path));
          const newSaves = res.saves.filter((s) => !existingPaths.has(s.path));
          return [...newSaves, ...prev];
        });
        await handleSelectLocalSave(res.saves[0]);
      } else {
        setError('В указанной папке не найдено файлов сохранений (.sl2, .co2, .randobak).');
      }
    } catch (err: any) {
      setError('Ошибка при проверке папки: ' + (err.message || 'Неизвестная ошибка'));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle direct file upload / drag-and-drop
   */
  const handleFileProcess = async (file: File) => {
    setError(null);
    setIsLoading(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      setInMemoryBuffer(arrayBuffer);

      const slots = parseSaveFile(arrayBuffer, allMarkers);
      if (slots.length === 0) {
        setError('Не удалось обнаружить активных персонажей в данном файле.');
        return;
      }

      setSelectedFilePath(null); // in-memory browser mode
      setSelectedFileName(file.name);
      setParsedSlots(slots);

      const chosen = slots.reduce((best, s) => (s.level > best.level ? s : best), slots[0]);
      setSelectedSlotIndex(chosen.index);
      setStep('slots');
    } catch (err: any) {
      console.error(err);
      setError('Ошибка при чтении файла сохранения: ' + (err.message || 'Неизвестная ошибка'));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle folder selection via <input webkitdirectory>
   */
  const handleFolderInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Look for ER0000.sl2 or other saves
    let targetFile: File | null = null;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.name === 'ER0000.sl2') {
        targetFile = f;
        break;
      } else if (f.name.endsWith('.sl2') || f.name.endsWith('.co2') || f.name.endsWith('.randobak')) {
        targetFile = f;
      }
    }

    if (targetFile) {
      await handleFileProcess(targetFile);
    } else {
      setError('В выбранной папке не найден файл ER0000.sl2.');
    }
  };

  /**
   * Confirm character slot selection and activate live tracking
   */
  const handleConfirmSlot = async () => {
    const slot = parsedSlots.find((s) => s.index === selectedSlotIndex);
    if (!slot) return;

    setIsLoading(true);
    setError(null);

    try {
      if (selectedFilePath) {
        // Connect via local server live sync
        const res = await selectSaveAndSlot(selectedFilePath, selectedFileName, slot.index, slot);
        if (!res.success) {
          setError(res.error || 'Не удалось запустить отслеживание');
          return;
        }
      } else if (inMemoryBuffer) {
        // Apply progress directly in browser
        applyParsedSlot(slot);
      }

      setSuccessMsg(`Персонаж «${slot.name}» (Ур. ${slot.level}) успешно выбран!`);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Ошибка запуска отслеживания');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#10141c] border border-[#2b3042] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#212636] flex items-center justify-between bg-[#131722]/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-500/40 text-[#f5d38a] shadow-inner">
              {step === 'folder' ? <FolderOpen className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-cinzel font-bold text-base text-[#f5d38a] leading-none">
                  {step === 'folder' ? 'Шаг 1: Папка с сохранением' : 'Шаг 2: Выбор персонажа'}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1b2234] border border-[#2f3854] text-zinc-300 font-mono">
                  {step === 'folder' ? '1 / 2' : '2 / 2'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {step === 'folder'
                  ? 'Укажите папку с вашими сохранениями или выберите файл ER0000.sl2'
                  : 'Выберите персонажа, за которым будет следовать трекер'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Active Live Tracking Status Banner */}
          {liveSyncState.enabled && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                </div>
                <div className="text-xs">
                  <span className="text-emerald-300 font-semibold">Live-отслеживание активно: </span>
                  <strong className="text-white font-bold">{liveSyncState.charName || 'Погасший'}</strong>
                  {liveSyncState.charLevel && <span className="text-zinc-400"> (Ур. {liveSyncState.charLevel})</span>}
                  <span className="text-zinc-500 text-[11px] ml-1.5">[{liveSyncState.fileName || 'ER0000.sl2'}]</span>
                </div>
              </div>
              <button
                onClick={stopLiveSync}
                className="text-[11px] text-zinc-400 hover:text-red-400 underline cursor-pointer"
              >
                Остановить
              </button>
            </div>
          )}

          {/* STEP 1: FOLDER / FILE SELECTION */}
          {step === 'folder' && (
            <div className="flex flex-col gap-4">
              {/* Auto-detected Steam Save Folders */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Обнаруженные сохранения Steam:
                  </span>
                  <button
                    onClick={() => detectLocalSaves().then(setLocalSaves)}
                    className="text-[11px] text-zinc-400 hover:text-[#f5d38a] flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Обновить
                  </button>
                </div>

                {localSaves.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {localSaves.map((save) => {
                      const isSelected = selectedFilePath === save.path;
                      return (
                        <div
                          key={save.path}
                          onClick={() => handleSelectLocalSave(save)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 group ${
                            isSelected
                              ? 'bg-amber-950/40 border-amber-500/70 shadow-[0_0_15px_rgba(200,170,110,0.15)]'
                              : 'bg-[#141824] border-[#23283a] hover:border-[#3d4766] hover:bg-[#181d2c]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 rounded-lg bg-zinc-800/80 text-amber-300 group-hover:scale-105 transition-transform">
                                <HardDrive className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                                  <span>Steam ID: {save.steamId}</span>
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                                    {save.fileName}
                                  </span>
                                </div>
                                <div className="text-[11px] text-zinc-500 truncate max-w-md mt-0.5">
                                  {save.path}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              className="px-3 py-1.5 rounded-lg bg-[#c8aa6e] hover:bg-[#dfc185] text-black text-xs font-bold transition-all shadow flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>Выбрать</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Characters preview chips */}
                          {save.slots && save.slots.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#23283a]/60">
                              <span className="text-[10px] text-zinc-500">Персонажи:</span>
                              {save.slots.map((s) => (
                                <span
                                  key={s.index}
                                  className="text-[10px] px-2 py-0.5 rounded bg-[#1c2232] border border-[#2c364e] text-zinc-300 flex items-center gap-1"
                                >
                                  <strong className="text-[#f5d38a] font-semibold">{s.name}</strong>
                                  <span className="text-zinc-400">({s.level} ур.)</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-[#141824] border border-[#23283a] text-xs text-zinc-400 text-center">
                    Сохранения в стандартной папке Steam (%APPDATA%\EldenRing) не найдены. Укажите папку вручную ниже.
                  </div>
                )}
              </div>

              {/* Manual Selection Options */}
              <div className="pt-2 border-t border-[#212636] flex flex-col gap-3">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Или укажите другую папку / файл сохранения:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Folder Dialog Button */}
                  <label
                    htmlFor={folderInputId}
                    className="p-3 rounded-xl bg-[#141824] border border-[#23283a] hover:border-amber-500/50 hover:bg-[#181d2c] flex items-center gap-3 transition-all cursor-pointer group"
                  >
                    <div className="p-2 rounded-lg bg-zinc-800 text-amber-300 group-hover:scale-105 transition-transform">
                      <Folder className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-200">Выбрать папку на диске</div>
                      <div className="text-[10px] text-zinc-500">Открыть через проводник</div>
                    </div>
                    <input
                      id={folderInputId}
                      ref={folderInputRef}
                      type="file"
                      // @ts-expect-error webkitdirectory is standard for folder picking
                      webkitdirectory=""
                      directory=""
                      onChange={handleFolderInput}
                      className="hidden"
                    />
                  </label>

                  {/* Single File Picker Button */}
                  <label
                    htmlFor={fileInputId}
                    className="p-3 rounded-xl bg-[#141824] border border-[#23283a] hover:border-amber-500/50 hover:bg-[#181d2c] flex items-center gap-3 transition-all cursor-pointer group"
                  >
                    <div className="p-2 rounded-lg bg-zinc-800 text-amber-300 group-hover:scale-105 transition-transform">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-200">Выбрать файл .sl2 / .randobak</div>
                      <div className="text-[10px] text-zinc-500">Прямой выбор файла сохранения</div>
                    </div>
                    <input
                      id={fileInputId}
                      ref={fileInputRef}
                      type="file"
                      accept=".sl2,.co2,.randobak"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileProcess(file);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Path input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customPathInput}
                    onChange={(e) => setCustomPathInput(e.target.value)}
                    placeholder="Введите путь к папке (например: C:\...\EldenRing\7656119...)"
                    className="flex-1 bg-[#121622] border border-[#23283a] focus:border-[#c8aa6e] rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleScanCustomPath();
                    }}
                  />
                  <button
                    onClick={handleScanCustomPath}
                    disabled={!customPathInput.trim() || isLoading}
                    className="px-4 py-2 rounded-xl bg-[#1c2232] border border-[#2f3954] hover:bg-[#252e44] text-xs font-semibold text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Проверить
                  </button>
                </div>

                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileProcess(file);
                  }}
                  className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                    isDragging
                      ? 'border-[#c8aa6e] bg-[#c8aa6e]/10'
                      : 'border-[#23283a] hover:border-[#38405a] bg-[#121622]/40'
                  }`}
                >
                  <p className="text-xs text-zinc-400">
                    или перетащите файл <code className="text-[#f5d38a] font-mono">ER0000.sl2</code> сюда
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: CHARACTER SLOT SELECTION */}
          {step === 'slots' && (
            <div className="flex flex-col gap-4">
              {/* Selected File Header / Breadcrumb */}
              <div className="p-3 rounded-xl bg-[#141824] border border-[#23283a] flex items-center justify-between">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <FileCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <div className="truncate">
                    <div className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 truncate">
                      <span>Файл:</span>
                      <span className="text-[#f5d38a] font-mono">{selectedFileName}</span>
                    </div>
                    {selectedFilePath && (
                      <div className="text-[11px] text-zinc-500 truncate mt-0.5">{selectedFilePath}</div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setStep('folder')}
                  className="px-2.5 py-1 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1 flex-shrink-0 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Сменить папку</span>
                </button>
              </div>

              {/* Characters Grid */}
              <div>
                <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>Доступные персонажи в этом сохранении ({parsedSlots.length}):</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {parsedSlots.map((slot) => {
                    const isSelected = selectedSlotIndex === slot.index;
                    return (
                      <div
                        key={slot.index}
                        onClick={() => setSelectedSlotIndex(slot.index)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 relative ${
                          isSelected
                            ? 'bg-amber-950/40 border-amber-500/80 shadow-[0_0_15px_rgba(200,170,110,0.2)]'
                            : 'bg-[#141824] border-[#23283a] hover:border-[#38425e] hover:bg-[#171c2b]'
                        }`}
                      >
                        {/* Radio Checkmark Top Right */}
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 font-mono">
                              Слот {slot.index + 1}
                            </span>
                            <h3 className="font-cinzel font-bold text-sm text-[#f5d38a] mt-1.5 leading-tight">
                              {slot.name}
                            </h3>
                          </div>

                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'border-[#c8aa6e] bg-[#c8aa6e] text-black'
                                : 'border-zinc-700 bg-zinc-900 text-transparent'
                            }`}
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        </div>

                        {/* Stats Row */}
                        <div className="flex items-center gap-2 pt-1 border-t border-[#23283a]/80 text-[11px] text-zinc-400">
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-semibold">
                            Ур. {slot.level}
                          </span>
                          {slot.playtimeFormatted && (
                            <span className="flex items-center gap-1 text-zinc-400">
                              <Clock className="w-3 h-3 text-zinc-500" />
                              {slot.playtimeFormatted}
                            </span>
                          )}
                          {slot.gracesUnlockedCount > 0 && (
                            <span className="text-zinc-500">Благодатей: {slot.gracesUnlockedCount}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Randomizer Mode Option */}
              <div className="p-3 rounded-xl bg-[#141824] border border-[#23283a] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                      isRandomizer
                        ? 'bg-purple-950/80 text-purple-400 border border-purple-500/50'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    <Shuffle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                      <span>Режим Рандомайзера</span>
                      {isRandomizer && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                          Включен
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 max-w-md">
                      Отслеживает лут только по физическим событиям мира (сундуки, боссы, трупы) и отключает ванильный инвентарь, чтобы случайные предметы не закрывали точки в неизведанных локациях.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsRandomizer(!isRandomizer)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors flex-shrink-0 ${
                    isRandomizer ? 'bg-purple-600' : 'bg-zinc-700'
                  }`}
                  title={isRandomizer ? 'Отключить режим рандомайзера' : 'Включить режим рандомайзера'}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      isRandomizer ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Confirm Action Button */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  onClick={() => setStep('folder')}
                  className="px-3.5 py-2.5 rounded-xl border border-[#23283a] hover:bg-[#181d2a] text-xs font-semibold text-zinc-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Назад</span>
                </button>

                <button
                  onClick={handleConfirmSlot}
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#c8aa6e] via-[#deb874] to-[#c8aa6e] hover:brightness-110 text-black font-cinzel font-bold text-xs tracking-wider transition-all shadow-[0_0_15px_rgba(200,170,110,0.3)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 fill-black" />
                  <span>
                    Начать отслеживание:{' '}
                    {parsedSlots.find((s) => s.index === selectedSlotIndex)?.name || 'Персонаж'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Feedback messages */}
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/50 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-300">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 flex items-center gap-2.5">
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div className="text-xs text-emerald-300 font-semibold">{successMsg}</div>
            </div>
          )}

          {/* Security and Info Footnotes */}
          <div className="pt-2 border-t border-[#1d2232] flex items-center justify-between text-[11px] text-zinc-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Безопасная локальная расшифровка (AES-128)</span>
            </div>

            <button
              onClick={handleCopyPath}
              className="hover:text-zinc-300 flex items-center gap-1 cursor-pointer transition-colors"
              title="Скопировать стандартный путь к папке сохранений"
            >
              {copied ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Путь скопирован!' : '%APPDATA%\\EldenRing'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
