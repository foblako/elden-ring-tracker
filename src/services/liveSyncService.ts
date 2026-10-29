import type {
  LiveSyncState,
  TrackerMarker,
  SaveSlotSummary,
  PlayerLocation,
  LocalSaveInfo,
} from '../types';
import { parseSaveFile } from './saveParser';

export type { LocalSaveInfo };

export class LiveSyncService {
  private timer: number | null = null;
  private memoryTimer: number | null = null;
  private lastMtime: number = 0;
  private isChecking: boolean = false;
  private fileHandle: FileSystemFileHandle | null = null;
  private localSavePath: string | null = null;
  private mode: 'api' | 'fsa' | null = null;
  private currentSlotIndex: number = 0;
  private currentMarkers: TrackerMarker[] = [];
  private lastCharName: string = '';
  private lastCharLevel: number = 1;
  private lastSaveChangeMs: number = 0;
  private lastFlagVersion: number = -1;
  private lastMatchedCount: number = -1;
  private locationListeners = new Set<(loc: PlayerLocation) => void>();
  public isRandomizer: boolean = true;

  public setIsRandomizer(val: boolean) {
    this.isRandomizer = val;
    this.updateState({ isRandomizer: val });
  }

  public async resyncNow() {
    if (this.mode === 'api' && this.localSavePath) {
      await this.pollLocalSave(true);
    } else if (this.mode === 'fsa' && this.fileHandle) {
      try {
        const file = await this.fileHandle.getFile();
        const buffer = await file.arrayBuffer();
        this.processSaveBuffer(buffer, this.currentMarkers, this.currentSlotIndex);
      } catch (err) {
        console.warn('resyncNow error:', err);
      }
    }
  }

  private onUpdateCallback?: (data: {
    collectedIds: Record<string, boolean>;
    level: number;
    name: string;
    playtimeSeconds: number;
    matchedCount: number;
    slotIndex: number;
    playerLocation?: PlayerLocation;
  }) => void;

  private onLocationUpdateCallback?: (loc: PlayerLocation) => void;
  private onStatusChangeCallback?: (state: LiveSyncState) => void;

  private state: LiveSyncState = {
    enabled: false,
    status: 'idle',
  };

  public setCallbacks(
    onUpdate: (data: {
      collectedIds: Record<string, boolean>;
      level: number;
      name: string;
      playtimeSeconds: number;
      matchedCount: number;
      slotIndex: number;
      playerLocation?: PlayerLocation;
    }) => void,
    onStatusChange: (state: LiveSyncState) => void,
    onLocationUpdate?: (loc: PlayerLocation) => void
  ) {
    this.onUpdateCallback = onUpdate;
    this.onStatusChangeCallback = onStatusChange;
    this.onLocationUpdateCallback = onLocationUpdate;
    this.startMemoryPolling();
  }

  public subscribeToLocation(listener: (loc: PlayerLocation) => void): () => void {
    this.locationListeners.add(listener);
    return () => {
      this.locationListeners.delete(listener);
    };
  }

  public getState(): LiveSyncState {
    return this.state;
  }

  public isSupported(): boolean {
    return true;
  }

  /**
   * Detect Elden Ring save files in %APPDATA%\EldenRing on local server
   */
  public async detectLocalSaves(): Promise<LocalSaveInfo[]> {
    try {
      const res = await fetch('/api/save/detect');
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data.saves) ? data.saves : [];
      }
    } catch {
      // Not running with local Vite dev server
    }
    return [];
  }

  /**
   * Scan custom directory for saves (.sl2 / .co2 / .randobak)
   */
  public async scanFolder(folderPath: string): Promise<{ folderPath: string; saves: LocalSaveInfo[]; error?: string }> {
    try {
      const res = await fetch(`/api/save/scan-folder?path=${encodeURIComponent(folderPath)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e: any) {
      return { folderPath, saves: [], error: e.message };
    }
    return { folderPath, saves: [], error: 'Не удалось просканировать папку' };
  }

  /**
   * Quick read slots list for a given save file path
   */
  public async getSaveSlots(filePath: string): Promise<SaveSlotSummary[]> {
    try {
      const res = await fetch(`/api/save/slots?path=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data.slots) ? data.slots : [];
      }
    } catch {}
    return [];
  }

  /**
   * Start live monitoring using the local Vite server endpoint (bypasses browser %APPDATA% restrictions)
   */
  public async startWithLocalSave(
    filePath: string,
    fileName: string,
    allMarkers: TrackerMarker[],
    targetSlot = 0
  ): Promise<{ success: boolean; slots?: SaveSlotSummary[]; error?: string }> {
    this.currentMarkers = allMarkers;
    this.currentSlotIndex = targetSlot;
    this.localSavePath = filePath;
    this.mode = 'api';
    this.fileHandle = null;

    try {
      const res = await fetch(`/api/save/read?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) {
        throw new Error(`Ошибка чтения файла (${res.statusText})`);
      }

      const mtimeHeader = res.headers.get('x-save-mtime');
      this.lastMtime = mtimeHeader ? Number(mtimeHeader) : Date.now();

      const buffer = await res.arrayBuffer();
      const slots = parseSaveFile(buffer, allMarkers, undefined, { isRandomizer: this.isRandomizer });

      const chosenSlot = slots.find((s) => s.index === targetSlot) || slots[0];
      if (chosenSlot) {
        this.currentSlotIndex = chosenSlot.index;
        if (chosenSlot.name) this.lastCharName = chosenSlot.name;
        if (chosenSlot.level) this.lastCharLevel = chosenSlot.level;
      }

      this.updateState({
        enabled: true,
        status: 'active',
        fileName,
        folderPath: filePath,
        trackedSlot: this.currentSlotIndex,
        charName: this.lastCharName,
        charLevel: this.lastCharLevel,
        error: undefined,
      });

      this.processSaveBuffer(buffer, allMarkers, this.currentSlotIndex);

      this.stopTimer();
      this.timer = window.setInterval(() => {
        this.pollLocalSave();
      }, 2000);

      this.startMemoryPolling();

      return { success: true, slots };
    } catch (err: any) {
      console.error('Local Save LiveSync Error:', err);
      const errMsg = err.message || 'Не удалось открыть сохранение';
      this.updateState({ enabled: false, status: 'error', error: errMsg });
      return { success: false, error: errMsg };
    }
  }

  private updateState(partial: Partial<LiveSyncState>) {
    this.state = {
      ...this.state,
      ...partial,
      trackedSlot: partial.trackedSlot !== undefined ? partial.trackedSlot : this.currentSlotIndex,
      charName: partial.charName !== undefined ? partial.charName : this.lastCharName,
      charLevel: partial.charLevel !== undefined ? partial.charLevel : this.lastCharLevel,
    };
    this.onStatusChangeCallback?.(this.state);
  }

  /**
   * Start live monitoring using browser File System Access API
   */
  public async start(
    allMarkers: TrackerMarker[],
    targetSlot = 0
  ): Promise<{ success: boolean; slots?: SaveSlotSummary[]; error?: string }> {
    this.currentMarkers = allMarkers;
    this.currentSlotIndex = targetSlot;

    if (!this.isSupported()) {
      const err =
        'Ваш браузер не поддерживает File System Access API (рекомендуется Chrome, Edge, Opera или Яндекс.Браузер). Вы можете загружать файл вручную через Drag & Drop.';
      this.updateState({ enabled: false, status: 'error', error: err });
      return { success: false, error: err };
    }

    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'Elden Ring Save File (*.sl2, *.co2, *.randobak)',
            accept: {
              'application/octet-stream': ['.sl2', '.co2', '.randobak'],
            },
          },
        ],
        multiple: false,
      });

      if (!handle) {
        return { success: false };
      }

      this.fileHandle = handle;
      this.mode = 'fsa';
      this.localSavePath = null;
      const file = await handle.getFile();
      this.lastMtime = file.lastModified;

      const buffer = await file.arrayBuffer();
      const slots = parseSaveFile(buffer, allMarkers, undefined, { isRandomizer: this.isRandomizer });

      const chosenSlot = slots.find((s) => s.index === targetSlot) || slots[0];
      if (chosenSlot) {
        this.currentSlotIndex = chosenSlot.index;
        if (chosenSlot.name) this.lastCharName = chosenSlot.name;
        if (chosenSlot.level) this.lastCharLevel = chosenSlot.level;
      }

      this.updateState({
        enabled: true,
        status: 'active',
        fileName: handle.name,
        trackedSlot: this.currentSlotIndex,
        charName: this.lastCharName,
        charLevel: this.lastCharLevel,
      });

      this.processSaveBuffer(buffer, allMarkers, this.currentSlotIndex);

      this.stopTimer();
      this.timer = window.setInterval(() => {
        this.pollFileHandle();
      }, 400);

      this.startMemoryPolling();

      return { success: true, slots };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false };
      }
      console.error('File Picker LiveSync Error:', err);
      let errMsg = err.message || 'Не удалось открыть файл сохранения';
      const isSystemFileBlock =
        err.name === 'NotAllowedError' ||
        err.name === 'SecurityError' ||
        /sensitive|system files|системные файлы|заблокирован/i.test(errMsg);

      if (isSystemFileBlock) {
        errMsg =
          'Браузер (Chrome/Edge) блокирует выбор файлов из системной папки %APPDATA% для постоянного Live-слежения. ' +
          'Вы можете использовать локальный сервер или скопировать ER0000.sl2 в другую папку.';
      }

      this.updateState({ enabled: false, status: 'error', error: errMsg });
      return { success: false, error: errMsg };
    }
  }

  /**
   * Change tracked character slot for an active file handle or local save
   */
  public async setTrackedSlot(slotIndex: number, allMarkers?: TrackerMarker[]) {
    this.currentSlotIndex = slotIndex;
    try {
      localStorage.setItem('er_tracked_slot', String(slotIndex));
    } catch {}

    if (allMarkers) {
      this.currentMarkers = allMarkers;
    }

    if (this.state.enabled) {
      try {
        if (this.mode === 'api' && this.localSavePath) {
          await this.pollLocalSave();
        } else if (this.mode === 'fsa' && this.fileHandle) {
          const file = await this.fileHandle.getFile();
          const buffer = await file.arrayBuffer();
          this.processSaveBuffer(buffer, this.currentMarkers, slotIndex);
        }
      } catch (err) {
        console.error('Error switching slot:', err);
      }
    }
  }

  /**
   * Stop live monitoring
   */
  public stop() {
    this.stopTimer();
    this.stopMemoryPolling();
    this.fileHandle = null;
    this.localSavePath = null;
    this.mode = null;
    this.updateState({
      enabled: false,
      status: 'idle',
      error: undefined,
    });
  }

  private stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private stopMemoryPolling() {
    if (this.memoryTimer) {
      clearInterval(this.memoryTimer);
      this.memoryTimer = null;
    }
  }

  private startMemoryPolling() {
    this.stopMemoryPolling();
    this.memoryTimer = window.setInterval(async () => {
      try {
        const res = await fetch('/api/player/live-memory');
        if (!res.ok) return;
        const data = await res.json();
        if (data.running && data.active && typeof data.px === 'number') {
          const loc: PlayerLocation = {
            px: data.px,
            py: data.py,
            altitude: data.altitude ?? 0,
            yawDeg: data.yawDeg ?? 0,
            layer: data.layer || 'base-game',
            mapId: `m${data.mapArea || 60}_${data.gridX || 0}_${data.gridZ || 0}`,
            charName: this.lastCharName || 'Погасший',
            charLevel: this.lastCharLevel || 1,
            lastUpdated: data.ts || Date.now(),
          };
          this.onLocationUpdateCallback?.(loc);
        }

        // Instant save change reaction triggered by Node.js file watcher (within 100ms)
        if (data.saveChangeMs && data.saveChangeMs > this.lastSaveChangeMs) {
          this.lastSaveChangeMs = data.saveChangeMs;
          this.pollLocalSave(true);
        }
      } catch {
        // Dev server live-memory endpoint not responding
      }
    }, 100);
  }

  private async pollLocalSave(force = false) {
    if (!this.localSavePath || (this.isChecking && !force)) return;
    this.isChecking = true;

    try {
      const res = await fetch(
        `/api/save/sync-state?path=${encodeURIComponent(this.localSavePath)}&slot=${this.currentSlotIndex}&randomizer=${this.isRandomizer ? 'true' : 'false'}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.exists && data.matchedMarkerIds) {
          const mtimeChanged = data.mtime && data.mtime !== this.lastMtime;
          const countChanged = typeof data.matchedCount === 'number' && data.matchedCount !== this.lastMatchedCount;

          this.lastMtime = data.mtime;
          this.lastMatchedCount = data.matchedCount;
          if (data.name) this.lastCharName = data.name;
          if (data.level) this.lastCharLevel = data.level;
          if (typeof data.slotIndex === 'number') this.currentSlotIndex = data.slotIndex;

          if (mtimeChanged || countChanged) {
            const collectedIds: Record<string, boolean> = {};
            for (const id of data.matchedMarkerIds) {
              collectedIds[id] = true;
            }

            this.updateState({
              status: 'active',
              lastSyncTime: Date.now(),
              matchedCount: data.matchedCount,
              trackedSlot: this.currentSlotIndex,
              charName: this.lastCharName,
              charLevel: this.lastCharLevel,
              error: undefined,
            });

            this.onUpdateCallback?.({
              collectedIds,
              level: data.level,
              name: data.name,
              playtimeSeconds: 0,
              matchedCount: data.matchedCount,
              slotIndex: data.slotIndex,
              playerLocation: data.playerLocation,
            });
          }
        }
      }
    } catch (e: any) {
      console.warn('Local save sync warning:', e);
    } finally {
      this.isChecking = false;
    }
  }

  private async pollFileHandle() {
    if (!this.fileHandle || this.isChecking) return;
    this.isChecking = true;

    try {
      const file = await this.fileHandle.getFile();
      if (file.lastModified > this.lastMtime) {
        this.lastMtime = file.lastModified;
        this.updateState({ status: 'checking' });
        const buffer = await file.arrayBuffer();
        this.processSaveBuffer(buffer, this.currentMarkers, this.currentSlotIndex);
      }
    } catch (e: any) {
      console.warn('File handle poll warning:', e);
    } finally {
      this.isChecking = false;
    }
  }

  private processSaveBuffer(buffer: ArrayBuffer, allMarkers: TrackerMarker[], targetSlot: number) {
    try {
      const slots = parseSaveFile(buffer, allMarkers, undefined, { isRandomizer: this.isRandomizer });
      if (!slots || slots.length === 0) {
        return;
      }

      let slot = slots.find((s) => s.index === targetSlot);
      if (!slot && slots.length > 0) {
        slot = slots[0];
      }
      if (!slot) return;

      this.currentSlotIndex = slot.index;
      try {
        localStorage.setItem('er_tracked_slot', String(slot.index));
      } catch {}

      if (slot.name) this.lastCharName = slot.name;
      if (slot.level) this.lastCharLevel = slot.level;

      const collectedIds: Record<string, boolean> = {};
      let matchedCount = 0;

      if (slot.matchedMarkerIds && slot.matchedMarkerIds.length > 0) {
        for (const id of slot.matchedMarkerIds) {
          collectedIds[id] = true;
          matchedCount++;
        }
      } else {
        const flagSet = new Set(slot.matchedFlags);
        for (const m of allMarkers) {
          if (m.flagId && flagSet.has(m.flagId)) {
            collectedIds[m.id] = true;
            matchedCount++;
          }
        }
      }

      this.updateState({
        status: 'active',
        lastSyncTime: Date.now(),
        matchedCount,
        trackedSlot: slot.index,
        charName: slot.name,
        charLevel: slot.level,
        error: undefined,
      });

      this.onUpdateCallback?.({
        collectedIds,
        level: slot.level,
        name: slot.name,
        playtimeSeconds: 0,
        matchedCount,
        slotIndex: slot.index,
        playerLocation: slot.playerLocation,
      });
    } catch (err: any) {
      console.warn('Save parsing error during live sync (file may be mid-write by game):', err);
    }
  }
}

export const liveSync = new LiveSyncService();
