import aesjs from 'aes-js';
import type { SaveSlotSummary, TrackerMarker, PlayerLocation, MapLayerId, ParseSaveOptions } from '../types/index.ts';

export type { ParseSaveOptions };
import { eventFlagOffset } from './eventFlags.ts';

/**
 * Verified Elden Ring Save Parser (.sl2 / .co2 / .randobak)
 * Supports both Plaintext (Randomizer/ModEngine) and AES-128-CBC encrypted (Steam) saves
 */

const ER_SAVE_KEY = new Uint8Array([
  0x18, 0xf6, 0x32, 0x66, 0x05, 0xbd, 0x17, 0x8a,
  0x55, 0x24, 0x52, 0x3a, 0xc0, 0xa0, 0xc6, 0x09,
]);

const MD5_LEN = 16;
const EF_LEN = 0x1bf99f; // 1,833,375 bytes

let cachedUniqueKeys: Set<string> | null = null;
let lastMarkersRef: TrackerMarker[] | null = null;

/**
 * Computes the set of truly unique itemKeys (keys that appear on exactly ONE marker in the entire world).
 * Any item that can be picked up multiple times (seeds, keys, tears, dew, materials) is excluded from inventory matching
 * and MUST be matched by its individual world pickup flagId.
 */
function getUniqueItemKeys(allMarkers: TrackerMarker[]): Set<string> {
  if (cachedUniqueKeys && lastMarkersRef === allMarkers) {
    return cachedUniqueKeys;
  }
  const keyCounts = new Map<string, number>();
  for (const m of allMarkers) {
    if (!m.itemKeys) continue;
    for (const k of m.itemKeys) {
      keyCounts.set(k, (keyCounts.get(k) || 0) + 1);
    }
  }
  const unique = new Set<string>();
  for (const [k, count] of keyCounts.entries()) {
    if (count === 1) {
      unique.add(k);
    }
  }
  cachedUniqueKeys = unique;
  lastMarkersRef = allMarkers;
  return unique;
}

interface Bnd4Entry {
  index: number;
  name: string;
  size: number;
  dataOffset: number;
}

export interface FlagMatchResult {
  matchedFlags: number[];
  matchedMarkerIds: string[];
  gracesUnlocked: number;
  bossesDefeatedCount: number;
}

export function matchMarkersFromFlags(
  rawFlags: Uint8Array,
  allMarkers: TrackerMarker[],
  isRandomizer?: boolean
): FlagMatchResult {
  const matchedFlags: number[] = [];
  const matchedMarkerIds: string[] = [];
  let gracesUnlocked = 0;
  let bossesDefeatedCount = 0;

  const isFlagSet = (flagId: number): boolean => {
    const offset = eventFlagOffset(flagId);
    if (!offset) return false;
    const [byteOffset, bitPos] = offset;
    return byteOffset < rawFlags.length && ((rawFlags[byteOffset] & (1 << bitPos)) !== 0);
  };

  const isFlagOrSubFlagSet = (flagId: number): boolean => {
    if (isFlagSet(flagId)) return true;
    // In FromSoftware engine, world item lots (10xxxx70xx, 18xxx70xx, 3xxxx70xx) and bosses
    // frequently trigger sub-lot flags flagId + 1 or flagId + 2 on pickup/kill.
    if (flagId >= 10000000 && flagId % 10 === 0) {
      if (isFlagSet(flagId + 1) || isFlagSet(flagId + 2)) return true;
    }
    return false;
  };

  for (const m of allMarkers) {
    let flagMatched = false;

    // In Randomizer mode, 67xxx and 68xxx flags on item markers are recipe unlock flags,
    // and 69xxx are note unlocks, NOT physical world location flags!
    // We skip recipe flags on primary flagId and match strictly on physical flags (including dynamic altFlags).
    const isRecipeFlag =
      isRandomizer && m.id.startsWith('item-') && m.flagId && m.flagId >= 67000 && m.flagId < 70000;

    if (!isRecipeFlag && m.flagId && m.flagId > 0 && isFlagOrSubFlagSet(m.flagId)) {
      flagMatched = true;
      matchedFlags.push(m.flagId);
    } else if (m.altFlags && m.altFlags.length > 0) {
      for (const af of m.altFlags) {
        if (af > 0 && isFlagOrSubFlagSet(af)) {
          flagMatched = true;
          matchedFlags.push(af);
          break;
        }
      }
    }

    if (flagMatched) {
      matchedMarkerIds.push(m.id);
      if (m.type === 'grace') gracesUnlocked++;
      else if (m.category === 'bosses' || m.type.startsWith('boss')) bossesDefeatedCount++;
    }
  }

  // Boss & drop synchronization pass (both directions):
  // 1. If a boss is defeated, automatically mark its drops as collected
  // 2. If a boss's drop is collected, mark the boss as defeated
  const matchedSet = new Set(matchedMarkerIds);
  const bossMarkers = allMarkers.filter((m) => m.type.startsWith('boss') || m.category === 'bosses');

  for (const item of allMarkers) {
    if (item.type !== 'item' || !item.dropSource) continue;
    const dName = item.dropSource.toLowerCase().replace(/['"’()]/g, '').trim();
    let closestBoss: TrackerMarker | null = null;
    let minDist = Infinity;
    for (const b of bossMarkers) {
      if (b.layer !== item.layer) continue;
      const bName = b.name.toLowerCase().replace(/['"’()]/g, '').trim();
      if (dName.includes(bName) || bName.includes(dName)) {
        const dist = Math.hypot(item.px - b.px, item.py - b.py);
        if (dist < minDist) {
          minDist = dist;
          closestBoss = b;
        }
      }
    }
    if (closestBoss && minDist < 1200) {
      if (matchedSet.has(closestBoss.id) && !matchedSet.has(item.id)) {
        matchedSet.add(item.id);
        matchedMarkerIds.push(item.id);
      } else if (matchedSet.has(item.id) && !matchedSet.has(closestBoss.id)) {
        matchedSet.add(closestBoss.id);
        matchedMarkerIds.push(closestBoss.id);
        bossesDefeatedCount++;
      }
    }
  }

  return { matchedFlags, matchedMarkerIds, gracesUnlocked, bossesDefeatedCount };
}

export function parseSaveFile(
  buffer: ArrayBuffer,
  allMarkers: TrackerMarker[],
  targetSlotOnly?: number,
  options?: ParseSaveOptions
): SaveSlotSummary[] {
  const bytes = new Uint8Array(buffer);
  const dataView = new DataView(buffer);

  if (bytes.length < 0x40 || decodeAscii(bytes, 0, 4) !== 'BND4') {
    throw new Error('Файл не является контейнером BND4 (Elden Ring .sl2 / .randobak).');
  }

  // 1. Read BND4 entries
  const fileCount = dataView.getUint32(0x0c, true);
  if (fileCount <= 0 || fileCount > 256) {
    throw new Error(`Недопустимое количество файлов в BND4: ${fileCount}`);
  }

  const entries: Bnd4Entry[] = [];
  for (let i = 0; i < fileCount; i++) {
    const o = 0x40 + i * 0x20;
    const size = Number(dataView.getBigUint64(o + 0x08, true));
    const dataOffset = dataView.getUint32(o + 0x10, true);
    const nameOffset = dataView.getUint32(o + 0x14, true);

    const name = decodeUtf16z(bytes, nameOffset, 64);
    entries.push({ index: i, name, size, dataOffset });
  }

  // 2. Locate USER_DATA010 (Profile Summary header)
  const entry010 = entries.find((e) => e.name.includes('USER_DATA010'));
  if (!entry010) {
    throw new Error('В файле сохранения не найден заголовок USER_DATA010.');
  }

  const payload010 = readEntryPayload(bytes, entry010);
  const profiles = readProfilesFromUserData010(payload010);

  const summaries: SaveSlotSummary[] = [];

  // 3. For each active profile, find matching USER_DATA00X and walk slot for event flags
  for (let slotIdx = 0; slotIdx < 10; slotIdx++) {
    if (typeof targetSlotOnly === 'number' && targetSlotOnly >= 0 && slotIdx !== targetSlotOnly) {
      continue;
    }
    const prof = profiles[slotIdx];
    if (!prof || !prof.active) continue;

    const slotEntryName = `USER_DATA00${slotIdx}`;
    const slotEntry = entries.find((e) => e.name.includes(slotEntryName));
    if (!slotEntry) continue;

    let slotData: SlotWalkResult | null = null;
    try {
      const slotPayload = readEntryPayload(bytes, slotEntry);
      slotData = walkSlotEventFlagsAndInventory(slotPayload, allMarkers);
    } catch (err) {
      console.warn(`Ошибка при разборе слота ${slotIdx}:`, err);
    }

    let bossesDefeated = 0;
    let gracesUnlocked = 0;
    const matchedFlags: number[] = [];
    const matchedMarkerIds: string[] = [];
    const matchedMarkerIdSet = new Set<string>();

    if (slotData) {
      const { rawFlags, heldKeys } = slotData;

      // 1. Match markers by event flags (including primary flagId and altFlags)
      const flagResult = matchMarkersFromFlags(rawFlags, allMarkers, options?.isRandomizer);
      bossesDefeated = flagResult.bossesDefeatedCount;
      gracesUnlocked = flagResult.gracesUnlocked;
      for (const f of flagResult.matchedFlags) matchedFlags.push(f);
      for (const id of flagResult.matchedMarkerIds) {
        matchedMarkerIdSet.add(id);
        matchedMarkerIds.push(id);
      }

      // 2. Match markers by player inventory for unique items
      // (NPC quest rewards, boss remembrances, unique quest weapons/armor not tied to simple world pickup flags)
      // NOTE: In Randomizer mode, inventory matching is strictly disabled because items are randomized across
      // the game world, and possessing an item does NOT mean the player visited its vanilla map location!
      if (!options?.isRandomizer) {
        const uniqueKeys = getUniqueItemKeys(allMarkers);

        for (const m of allMarkers) {
          if (matchedMarkerIdSet.has(m.id)) continue;
          if (!m.itemKeys || m.itemKeys.length === 0) continue;

          // Skip stackable materials, runes, smithing stones, gloveworts, and consumables
          const isStackableOrMaterial =
            (m.category === 'materials' && !m.name.includes('Cookbook')) ||
            (m.category === 'other' &&
              (m.name.includes('Rune') ||
                m.name.includes('Grease') ||
                m.name.includes('Meat') ||
                m.name.includes('Remedy') ||
                m.name.includes('Pot') ||
                m.name.includes('Arrow') ||
                m.name.includes('Bolt'))) ||
            (m.category === 'upgrades' &&
              (m.name.includes('Smithing Stone') || m.name.includes('Glovewort')));

          if (isStackableOrMaterial) continue;

          // Strictly verify that the item is held by the player AND is unique to this specific marker in the world
          const hasUniqueHeldItem = m.itemKeys.some((k: string) => heldKeys.has(k) && uniqueKeys.has(k));
          if (hasUniqueHeldItem) {
            matchedMarkerIdSet.add(m.id);
            matchedMarkerIds.push(m.id);
          }
        }
      }
    }

    const hours = Math.floor(prof.secondsPlayed / 3600);
    const minutes = Math.floor((prof.secondsPlayed % 3600) / 60);

    if (slotData?.playerLocation) {
      slotData.playerLocation.charName = prof.name || `Персонаж #${slotIdx + 1}`;
      slotData.playerLocation.charLevel = prof.level > 0 && prof.level < 999 ? prof.level : 1;
    }

    summaries.push({
      index: slotIdx,
      name: prof.name || `Персонаж #${slotIdx + 1}`,
      level: prof.level > 0 && prof.level < 999 ? prof.level : 1,
      playtimeFormatted: `${hours}ч ${minutes}мин`,
      bossesDefeatedCount: bossesDefeated,
      gracesUnlockedCount: gracesUnlocked,
      matchedFlags,
      matchedMarkerIds,
      playerLocation: slotData?.playerLocation,
    });
  }

  return summaries;
}

/** Decrypts entry payload if encrypted with AES-128-CBC, or returns plaintext body */
export function readEntryPayload(saveBytes: Uint8Array, entry: Bnd4Entry): Uint8Array {
  const block = saveBytes.subarray(entry.dataOffset, entry.dataOffset + entry.size);
  if (block.length < MD5_LEN + 16) {
    throw new Error(`Блок ${entry.name} слишком мал (${block.length} байт).`);
  }

  const rawBody = block.subarray(MD5_LEN);

  // Check if plaintext:
  if (entry.name.includes('USER_DATA010')) {
    // Check if active array at 0x1954 has 0 or 1
    if (rawBody.length > 0x195e) {
      const act0 = rawBody[0x1954];
      const act1 = rawBody[0x1955];
      if ((act0 === 0 || act0 === 1) && (act1 === 0 || act1 === 1)) {
        return rawBody;
      }
    }
  } else {
    // For character slots: first 4 bytes is version (typically 70..350)
    const view = new DataView(rawBody.buffer, rawBody.byteOffset, rawBody.byteLength);
    const ver = view.getUint32(0, true);
    if (ver >= 70 && ver <= 350) {
      return rawBody;
    }
  }

  // Encrypted with AES-128-CBC: IV = first 16 bytes, Ciphertext = remaining bytes
  const iv = block.subarray(0, 16);
  const ciphertext = block.subarray(16);

  try {
    const aesCbc = new aesjs.ModeOfOperation.cbc(ER_SAVE_KEY, iv);
    const decrypted = aesCbc.decrypt(ciphertext);
    return decrypted.subarray(MD5_LEN);
  } catch (err: any) {
    console.warn(`AES-128 decrypt fallback for ${entry.name}:`, err);
    return rawBody;
  }
}

/** Parses USER_DATA010 for the 10 character profiles */
function readProfilesFromUserData010(payload: Uint8Array): Array<{
  slot: number;
  active: boolean;
  name: string;
  level: number;
  secondsPlayed: number;
}> {
  const dataView = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const HDR = {
    ACTIVE: 0x1954, // uint8[10]
    NAME0: 0x195e, // UTF-16LE, 16 chars + NUL
    STRIDE: 0x24c,
    LEVEL: 0x22,
    SECONDS: 0x26,
  };

  const profiles = [];
  for (let i = 0; i < 10; i++) {
    const nameOffset = HDR.NAME0 + i * HDR.STRIDE;
    if (nameOffset + HDR.SECONDS + 4 > payload.length) break;

    const isActive = payload[HDR.ACTIVE + i] === 1;
    const name = decodeUtf16z(payload, nameOffset, 32);
    const level = dataView.getUint32(nameOffset + HDR.LEVEL, true);
    const secondsPlayed = dataView.getUint32(nameOffset + HDR.SECONDS, true);

    profiles.push({
      slot: i,
      active: isActive,
      name: name || `Персонаж #${i + 1}`,
      level: level > 0 && level < 999 ? level : 1,
      secondsPlayed: secondsPlayed > 0 && secondsPlayed < 100000000 ? secondsPlayed : 0,
    });
  }

  return profiles;
}

interface SlotWalkResult {
  rawFlags: Uint8Array;
  heldKeys: Set<string>;
  playerLocation?: PlayerLocation;
}

/** Walks one character slot payload to extract event flags, inventory, and player position */
export function walkSlotEventFlagsAndInventory(payload: Uint8Array, allMarkers: TrackerMarker[]): SlotWalkResult {
  const dataView = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const u32 = (o: number) => dataView.getUint32(o, true);
  const f32 = (o: number) => dataView.getFloat32(o, true);

  const version = u32(0);
  let p = 0x20;

  // 1. Gaitem map (0x1400 or 0x13fe entries)
  const n = version > 81 ? 0x1400 : 0x13fe;
  for (let i = 0; i < n; i++) {
    const handle = u32(p);
    p += 8;
    if (handle !== 0) {
      const top = (handle & 0xf0000000) >>> 0;
      if (top === 0x80000000) p += 13;
      else if (top === 0x90000000) p += 8;
    }
  }

  // 2. Fixed headers
  p += 0x1b0; // PlayerGameData
  p += 0xd * 0x10; // SPEffect[13]
  p += 0x58; // EquippedItemsEquipIndex
  p += 0x1c; // ActiveWeaponSlots / ArmStyle
  p += 0x58; // EquippedItemsItemId
  p += 0x58; // EquippedItemsGaitemHandle

  const heldKeys = new Set<string>();

  // 3. InventoryHeld (common: 0xa80 * 12, key: 0x180 * 12)
  const commonOffset = p + 4;
  for (let i = 0; i < 0xa80; i++) {
    const h = u32(commonOffset + i * 12);
    if (h !== 0 && h !== 0xffffffff) {
      const top = (h & 0xf0000000) >>> 0;
      const id = h & 0x0fffffff;
      if (top === 0xb0000000) heldKeys.add(`g:${id}`);
      else if (top === 0xa0000000) heldKeys.add(`t:${id}`);
      else if (top === 0xc0000000) heldKeys.add(`e:${id}`);
    }
  }

  const keyOffset = commonOffset + 0xa80 * 12 + 4;
  for (let i = 0; i < 0x180; i++) {
    const h = u32(keyOffset + i * 12);
    if (h !== 0 && h !== 0xffffffff) {
      const top = (h & 0xf0000000) >>> 0;
      const id = h & 0x0fffffff;
      if (top === 0xb0000000) heldKeys.add(`g:${id}`);
    }
  }

  p += 4 + 0xa80 * 12 + 4 + 0x180 * 12 + 8;

  // Equipped Spells
  for (let i = 0; i < 14; i++) {
    const spellId = u32(p + i * 8);
    if (spellId !== 0 && spellId !== 0xffffffff) {
      heldKeys.add(`g:${spellId}`);
    }
  }
  p += 14 * 8 + 4; // EquippedSpells
  p += 0xa * 8 + 4 + 6 * 8 + 8; // EquippedItems
  p += 6 * 4; // EquippedGestures
  const projCount = u32(p);
  p += 4 + projCount * 8; // AcquiredProjectiles (variable)
  p += 0x27 * 4; // EquippedArmamentsAndItems
  p += 0xc; // EquippedPhysics

  // 4. FaceData
  p += 0x12f;

  // 5. InventoryStorageBox
  const boxCommonOffset = p + 4;
  for (let i = 0; i < 0x780; i++) {
    const h = u32(boxCommonOffset + i * 12);
    if (h !== 0 && h !== 0xffffffff) {
      const top = (h & 0xf0000000) >>> 0;
      const id = h & 0x0fffffff;
      if (top === 0xb0000000) heldKeys.add(`g:${id}`);
      else if (top === 0xa0000000) heldKeys.add(`t:${id}`);
      else if (top === 0xc0000000) heldKeys.add(`e:${id}`);
    }
  }

  const boxKeyOffset = boxCommonOffset + 0x780 * 12 + 4;
  for (let i = 0; i < 0x80; i++) {
    const h = u32(boxKeyOffset + i * 12);
    if (h !== 0 && h !== 0xffffffff) {
      const top = (h & 0xf0000000) >>> 0;
      const id = h & 0x0fffffff;
      if (top === 0xb0000000) heldKeys.add(`g:${id}`);
    }
  }

  p += 4 + 0x780 * 12 + 4 + 0x80 * 12 + 8;
  p += 0x40 * 4; // Gestures

  // 6. Regions (variable)
  const regionCount = u32(p);
  p += 4 + regionCount * 4;

  const rideOffset = p;
  const ridePosX = f32(rideOffset);
  const ridePosY = f32(rideOffset + 4);
  const ridePosZ = f32(rideOffset + 8);
  const rideGridX = payload[rideOffset + 13];
  const rideGridZ = payload[rideOffset + 14];
  const rideMapArea = payload[rideOffset + 15];
  const rideYawRad = f32(rideOffset + 20);

  p += 0x28; // RideGameData
  p += 1; // control byte
  p += 0x44; // BloodStain
  p += 8; // two unknown u32
  const menuSize = u32(p + 4);
  p += 8 + menuSize; // MenuProfileSaveLoad (variable)
  p += 0x34; // TrophyEquipData

  // GaitemGameData (weapons, shields, armor, ashes of war)
  const gaOffset = p + 8;
  for (let i = 0; i < 7000; i++) {
    const h = u32(gaOffset + i * 16);
    const itemId = u32(gaOffset + i * 16 + 8);
    if (h !== 0 && h !== 0xffffffff && itemId !== 0) {
      heldKeys.add(`w:${itemId}`);
      heldKeys.add(`w:${Math.floor(itemId / 100) * 100}`);
      heldKeys.add(`w:${Math.floor(itemId / 10000) * 10000}`);
      heldKeys.add(`a:${itemId}`);
      heldKeys.add(`a:${Math.floor(itemId / 100) * 100}`);
      heldKeys.add(`e:${itemId}`);
    }
  }
  p += 8 + 7000 * 0x10; // GaitemGameData

  // 7. TutorialData (variable)
  const tSize = u32(p + 4);
  const tCount = u32(p + 8);
  p += 8 + (tCount === 0 ? 4 : 4 + Math.floor((tSize - 4) / 4) * 4);

  // 8. Gameman scalars
  p += 3;
  p += 4; // deaths
  p += 4; // characterType
  p += 1; // in_online_session_flag
  p += 4; // typeOnline
  const lastRestedGrace = u32(p);
  p += 4; // lastRestedGrace
  p += 1; // not_alone_flag
  p += 4; // in_game_countdown_timer
  p += 4; // unk

  // Calculate live player location from RideGameData if in valid overworld
  let playerLocation: PlayerLocation | undefined;
  if (
    rideMapArea !== 255 &&
    rideGridX !== 255 &&
    rideGridZ !== 255 &&
    (rideMapArea === 60 || rideMapArea === 61)
  ) {
    const layer: MapLayerId = rideMapArea === 61 ? 'dlc' : 'base-game';
    const px = (rideGridX - 28) * 256 + 128 + ridePosX;
    const py = (64 - rideGridZ) * 256 + 128 - ridePosZ;
    let yawDeg = (rideYawRad * 180) / Math.PI;
    if (isNaN(yawDeg)) yawDeg = 0;
    yawDeg = ((yawDeg % 360) + 360) % 360;

    if (px >= 50 && px <= 10450 && py >= 50 && py <= 10450) {
      playerLocation = {
        px,
        py,
        altitude: ridePosY,
        yawDeg,
        layer,
        mapId: `m${rideMapArea}_${rideGridX}_${rideGridZ}`,
        charName: '',
        charLevel: 1,
        lastUpdated: Date.now(),
      };
    }
  } else if (lastRestedGrace > 0) {
    let matchedGrace: TrackerMarker | undefined;

    // 1. Direct dungeon site of grace flag: 70000 + Math.floor(lastRestedGrace / 10000)
    // In Elden Ring, all dungeon graces use event flag 7XXXX
    const dFlag = 70000 + Math.floor(lastRestedGrace / 10000);
    matchedGrace = allMarkers.find(
      (m) => m.type === 'grace' && (m.flagId === dFlag || m.flagId === lastRestedGrace)
    );

    // 2. Direct marker ID match (grace-XXXXXX)
    if (!matchedGrace) {
      const dId = Math.floor(lastRestedGrace / 10000);
      matchedGrace = allMarkers.find(
        (m) =>
          m.type === 'grace' &&
          (m.id === `grace-${dId}00` || m.id === `grace-${dId}0` || m.id === `grace-${dId}`)
      );
    }

    // 3. Open-world tile grid encoding: AAGGYZZZZ (10-digit number)
    if (!matchedGrace && lastRestedGrace >= 1000000000) {
      const sGrace = lastRestedGrace.toString();
      const gArea = parseInt(sGrace.slice(0, 2), 10);
      const gX = parseInt(sGrace.slice(2, 4), 10);
      const gZ = parseInt(sGrace.slice(4, 6), 10);

      let targetLayer: MapLayerId = 'base-game';
      if (gArea === 61) {
        targetLayer = 'dlc';
      } else if ([30, 31, 32, 34, 35].includes(gArea)) {
        targetLayer = 'base-game-underground';
      }

      const approxPx = (gX - 28) * 256 + 128;
      const approxPy = (64 - gZ) * 256 + 128;

      let bestDist = 800;
      for (const m of allMarkers) {
        if (m.type === 'grace' && m.layer === targetLayer) {
          const d = Math.hypot(m.px - approxPx, m.py - approxPy);
          if (d < bestDist) {
            bestDist = d;
            matchedGrace = m;
          }
        }
      }

      if (!matchedGrace) {
        playerLocation = {
          px: approxPx,
          py: approxPy,
          altitude: 0,
          yawDeg: 0,
          layer: targetLayer,
          mapId: `m${gArea}_${gX}_${gZ}`,
          charName: '',
          charLevel: 1,
          lastUpdated: Date.now(),
        };
      }
    }

    if (matchedGrace) {
      playerLocation = {
        px: matchedGrace.px,
        py: matchedGrace.py,
        altitude: 0,
        yawDeg: 0,
        layer: matchedGrace.layer,
        mapId: matchedGrace.id,
        charName: '',
        charLevel: 1,
        lastUpdated: Date.now(),
      };
    }
  }

  // p is now positioned at the start of raw event flags!
  if (p + EF_LEN > payload.length) {
    throw new Error(`Слот поврежден: ожидалось ${EF_LEN} байт флагов по смещению 0x${p.toString(16)}.`);
  }

  return {
    rawFlags: payload.subarray(p, p + EF_LEN),
    heldKeys,
    playerLocation,
  };
}

function decodeUtf16z(bytes: Uint8Array, off: number, maxBytes: number): string {
  let e = off;
  const limit = Math.min(off + maxBytes, bytes.length - 1);
  while (e < limit && !(bytes[e] === 0 && bytes[e + 1] === 0)) {
    e += 2;
  }
  if (e <= off) return '';
  try {
    return new TextDecoder('utf-16le').decode(bytes.subarray(off, e)).trim();
  } catch {
    return '';
  }
}

function decodeAscii(bytes: Uint8Array, off: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    if (off + i < bytes.length) s += String.fromCharCode(bytes[off + i]);
  }
  return s;
}
