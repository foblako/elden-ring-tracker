using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace ErTracker
{
    class DungeonAnchor
    {
        public int Area;
        public int Sub;
        public float Px;
        public float Py;
        public string Layer;
        public string Name;

        public DungeonAnchor(int area, int sub, float px, float py, string layer, string name)
        {
            Area = area;
            Sub = sub;
            Px = px;
            Py = py;
            Layer = layer;
            Name = name;
        }
    }

    class Program
    {
        [DllImport("kernel32.dll")]
        static extern IntPtr OpenProcess(int dwDesiredAccess, bool bInheritHandle, int dwProcessId);

        [DllImport("kernel32.dll")]
        static extern bool ReadProcessMemory(IntPtr hProcess, IntPtr lpBaseAddress, byte[] lpBuffer, int dwSize, out IntPtr lpNumberOfBytesRead);

        [DllImport("kernel32.dll")]
        static extern bool CloseHandle(IntPtr hObject);

        const int PROCESS_VM_READ = 0x0010;
        const int PROCESS_QUERY_INFORMATION = 0x0400;

        static byte[] Read(IntPtr hProc, long addr, int size)
        {
            byte[] buf = new byte[size];
            IntPtr read;
            if (ReadProcessMemory(hProc, (IntPtr)addr, buf, size, out read) && read.ToInt64() == size)
            {
                return buf;
            }
            return null;
        }

        static long ReadInt64(IntPtr hProc, long addr)
        {
            byte[] buf = Read(hProc, addr, 8);
            if (buf != null) return BitConverter.ToInt64(buf, 0);
            return 0;
        }

        static float ReadFloat(IntPtr hProc, long addr)
        {
            byte[] buf = Read(hProc, addr, 4);
            if (buf != null) return BitConverter.ToSingle(buf, 0);
            return 0f;
        }

        static long FindCSMenuManOffset(IntPtr hProc, long baseAddr)
        {
            byte[] mem = Read(hProc, baseAddr, 0x1500000);
            if (mem == null) return 0x3D72840;
            for (int i = 0; i < mem.Length - 14; i++)
            {
                if (mem[i] == 0x48 && mem[i + 1] == 0x8B && mem[i + 2] == 0x05 &&
                    mem[i + 7] == 0x33 && mem[i + 8] == 0xDB && mem[i + 9] == 0x48 &&
                    mem[i + 10] == 0x89 && mem[i + 11] == 0x74 && mem[i + 12] == 0x24)
                {
                    int rel = BitConverter.ToInt32(mem, i + 3);
                    long rip = baseAddr + i + 7;
                    return (rip + rel) - baseAddr;
                }
            }
            return 0x3D72840;
        }

        static long FindCSEventManOffset(IntPtr hProc, long baseAddr)
        {
            byte[] mem = Read(hProc, baseAddr, 0x1500000);
            if (mem == null) return 0x3D6F4D8;
            for (int i = 0; i < mem.Length - 15; i++)
            {
                if (mem[i] == 0x48 && mem[i + 1] == 0x8B && mem[i + 2] == 0x3D &&
                    mem[i + 7] == 0x48 && mem[i + 8] == 0x85 && mem[i + 9] == 0xFF &&
                    mem[i + 10] == 0x74 &&
                    mem[i + 12] == 0x48 && mem[i + 13] == 0x8B && mem[i + 14] == 0x49)
                {
                    int rel = BitConverter.ToInt32(mem, i + 3);
                    long rip = baseAddr + i + 7;
                    return (rip + rel) - baseAddr;
                }
            }
            return 0x3D6F4D8;
        }

        private static readonly Dictionary<int, DungeonAnchor> DungeonMap = new Dictionary<int, DungeonAnchor>
        {
            { 0xA00, new DungeonAnchor(10, 0, 3179.20f, 6697.52f, "base-game", "Stormveil Castle") },
            { 0xB00, new DungeonAnchor(11, 0, 4325.28f, 3589.94f, "base-game", "Leyndell, Royal Capital") },
            { 0xB05, new DungeonAnchor(11, 5, 4366.70f, 3446.60f, "base-game", "Leyndell, Capital of Ash") },
            { 0xC01, new DungeonAnchor(12, 1, 2362.39f, 4580.02f, "base-game-underground", "Ainsel River / Nokstella") },
            { 0xC02, new DungeonAnchor(12, 2, 5016.63f, 6666.57f, "base-game-underground", "Siofra River") },
            { 0xC03, new DungeonAnchor(12, 3, 4417.10f, 3368.65f, "base-game-underground", "Deeproot Depths") },
            { 0xC04, new DungeonAnchor(12, 4, 1599.50f, 6093.80f, "base-game-underground", "Lake of Rot / Grand Cloister") },
            { 0xC05, new DungeonAnchor(12, 5, 5710.20f, 6809.88f, "base-game-underground", "Mohgwyn Palace") },
            { 0xC07, new DungeonAnchor(12, 7, 4569.05f, 6992.95f, "base-game-underground", "Siofra River Well Depths") },
            { 0xD00, new DungeonAnchor(13, 0, 8504.07f, 4455.02f, "base-game", "Crumbling Farum Azula") },
            { 0xE00, new DungeonAnchor(14, 0, 1884.92f, 4928.58f, "base-game", "Academy of Raya Lucaria") },
            { 0xF00, new DungeonAnchor(15, 0, 5683.64f, 1486.53f, "base-game", "Miquella's Haligtree") },
            { 0x1000, new DungeonAnchor(16, 0, 2254.14f, 2975.46f, "base-game", "Volcano Manor") },
            { 0x1200, new DungeonAnchor(18, 0, 3756.95f, 7370.00f, "base-game", "Chapel of Anticipation / Cave of Knowledge") },
            { 0x1300, new DungeonAnchor(19, 0, 4665.00f, 3913.20f, "base-game", "Fractured Marika / Roundtable Hold") },
            { 0x1400, new DungeonAnchor(20, 0, 4275.40f, 5362.25f, "dlc", "Belurat, Tower Settlement") },
            { 0x1401, new DungeonAnchor(20, 1, 4131.52f, 5207.12f, "dlc", "Gate of Divinity") },
            { 0x1500, new DungeonAnchor(21, 0, 5549.60f, 4422.35f, "dlc", "Shadow Keep") },
            { 0x1501, new DungeonAnchor(21, 1, 5464.23f, 4345.00f, "dlc", "Messmer's Dark Chamber") },
            { 0x1502, new DungeonAnchor(21, 2, 5297.00f, 4372.80f, "dlc", "West Rampart") },
            { 0x1600, new DungeonAnchor(22, 0, 5311.22f, 7331.80f, "dlc", "Stone Coffin Fissure") },
            { 0x1900, new DungeonAnchor(25, 0, 5910.90f, 4792.90f, "dlc", "Enir-Ilim") },
            { 0x1C00, new DungeonAnchor(28, 0, 5456.80f, 6191.08f, "dlc", "Midra's Manse") },
            { 0x1E00, new DungeonAnchor(30, 0, 3872.30f, 7956.70f, "base-game", "Tombsward Catacombs") },
            { 0x1E01, new DungeonAnchor(30, 1, 4453.30f, 7858.30f, "base-game", "Impaler's Catacombs") },
            { 0x1E02, new DungeonAnchor(30, 2, 3498.60f, 7051.20f, "base-game", "Stormfoot Catacombs") },
            { 0x1E03, new DungeonAnchor(30, 3, 1398.60f, 5528.10f, "base-game", "Road's End Catacombs") },
            { 0x1E04, new DungeonAnchor(30, 4, 4057.20f, 6719.00f, "base-game", "Murkwater Catacombs") },
            { 0x1E05, new DungeonAnchor(30, 5, 2870.80f, 4112.80f, "base-game", "Black Knife Catacombs") },
            { 0x1E06, new DungeonAnchor(30, 6, 3019.50f, 5946.30f, "base-game", "Cliffbottom Catacombs") },
            { 0x1E07, new DungeonAnchor(30, 7, 2560.90f, 3078.20f, "base-game", "Wyndham Catacombs") },
            { 0x1E08, new DungeonAnchor(30, 8, 3247.10f, 3191.90f, "base-game", "Sainted Hero's Grave") },
            { 0x1E09, new DungeonAnchor(30, 9, 2536.60f, 2928.30f, "base-game", "Gelmir Hero's Grave") },
            { 0x1E0A, new DungeonAnchor(30, 10, 4542.50f, 3318.30f, "base-game", "Auriza Hero's Grave") },
            { 0x1E0B, new DungeonAnchor(30, 11, 3881.90f, 6497.80f, "base-game", "Deathtouched Catacombs") },
            { 0x1E0C, new DungeonAnchor(30, 12, 2137.00f, 3350.60f, "base-game", "Unsightly Catacombs") },
            { 0x1E0D, new DungeonAnchor(30, 13, 4582.80f, 3174.20f, "base-game", "Auriza Side Tomb") },
            { 0x1E0E, new DungeonAnchor(30, 14, 4937.50f, 6204.40f, "base-game", "Minor Erdtree Catacombs") },
            { 0x1E0F, new DungeonAnchor(30, 15, 5338.20f, 7226.90f, "base-game", "Caelid Catacombs") },
            { 0x1E10, new DungeonAnchor(30, 16, 6309.70f, 6150.70f, "base-game", "War-Dead Catacombs") },
            { 0x1E11, new DungeonAnchor(30, 17, 5641.40f, 2824.00f, "base-game", "Giant-Conquering Hero's Grave") },
            { 0x1E12, new DungeonAnchor(30, 18, 5786.20f, 2834.70f, "base-game", "Giants' Mountaintop Catacombs") },
            { 0x1E13, new DungeonAnchor(30, 19, 5690.40f, 2518.40f, "base-game", "Consecrated Snowfield Catacombs") },
            { 0x1E14, new DungeonAnchor(30, 20, 5398.90f, 2810.70f, "base-game", "Hidden Path to the Haligtree") },
            { 0x1F00, new DungeonAnchor(31, 0, 4043.20f, 6978.90f, "base-game", "Murkwater Cave") },
            { 0x1F01, new DungeonAnchor(31, 1, 4120.80f, 7848.20f, "base-game", "Earthbore Cave") },
            { 0x1F02, new DungeonAnchor(31, 2, 3597.90f, 8032.80f, "base-game", "Tombsward Cave") },
            { 0x1F03, new DungeonAnchor(31, 3, 3652.40f, 7051.00f, "base-game", "Groveside Cave") },
            { 0x1F04, new DungeonAnchor(31, 4, 2958.50f, 6310.10f, "base-game", "Stillwater Cave") },
            { 0x1F05, new DungeonAnchor(31, 5, 2315.90f, 6020.20f, "base-game", "Lakeside Crystal Cave") },
            { 0x1F06, new DungeonAnchor(31, 6, 1737.00f, 4871.50f, "base-game", "Academy Crystal Cave") },
            { 0x1F07, new DungeonAnchor(31, 7, 2422.90f, 2802.70f, "base-game", "Seethewater Cave") },
            { 0x1F09, new DungeonAnchor(31, 9, 2364.70f, 2492.20f, "base-game", "Volcano Cave") },
            { 0x1F0A, new DungeonAnchor(31, 10, 6018.80f, 6187.30f, "base-game", "Dragonbarrow Cave") },
            { 0x1F0B, new DungeonAnchor(31, 11, 5887.10f, 6464.10f, "base-game", "Sellia Hideaway") },
            { 0x1F0C, new DungeonAnchor(31, 12, 5705.10f, 2132.00f, "base-game", "Cave of the Forlorn") },
            { 0x1F0F, new DungeonAnchor(31, 15, 3504.10f, 7337.90f, "base-game", "Coastal Cave") },
            { 0x1F11, new DungeonAnchor(31, 17, 4028.10f, 6431.60f, "base-game", "Highroad Cave") },
            { 0x1F12, new DungeonAnchor(31, 18, 3505.50f, 3432.90f, "base-game", "Perfumer's Grotto") },
            { 0x1F13, new DungeonAnchor(31, 19, 2533.30f, 3255.80f, "base-game", "Sage's Cave") },
            { 0x1F14, new DungeonAnchor(31, 20, 5385.80f, 6485.60f, "base-game", "Abandoned Cave") },
            { 0x1F15, new DungeonAnchor(31, 21, 4927.70f, 6750.10f, "base-game", "Gaol Cave") },
            { 0x1F16, new DungeonAnchor(31, 22, 6489.70f, 2061.50f, "base-game", "Spiritcaller Cave") },
            { 0x2000, new DungeonAnchor(32, 0, 4004.10f, 8133.90f, "base-game", "Morne Tunnel") },
            { 0x2001, new DungeonAnchor(32, 1, 3846.30f, 7074.90f, "base-game", "Limgrave Tunnels") },
            { 0x2002, new DungeonAnchor(32, 2, 2320.00f, 4463.70f, "base-game", "Raya Lucaria Crystal Tunnel") },
            { 0x2004, new DungeonAnchor(32, 4, 2775.70f, 3058.50f, "base-game", "Old Altus Tunnel") },
            { 0x2005, new DungeonAnchor(32, 5, 3403.70f, 3159.30f, "base-game", "Altus Tunnel") },
            { 0x2007, new DungeonAnchor(32, 7, 4797.20f, 6487.70f, "base-game", "Gael Tunnel") },
            { 0x2008, new DungeonAnchor(32, 8, 5522.40f, 6417.40f, "base-game", "Sellia Crystal Tunnel") },
            { 0x200B, new DungeonAnchor(32, 11, 5037.90f, 2493.00f, "base-game", "Yelough Anix Tunnel") },
            { 0x220A, new DungeonAnchor(34, 10, 3766.40f, 6442.30f, "base-game", "Divine Tower of Limgrave") },
            { 0x220B, new DungeonAnchor(34, 11, 3137.95f, 5167.60f, "base-game", "Divine Tower of Liurnia") },
            { 0x220C, new DungeonAnchor(34, 12, 3915.33f, 3895.97f, "base-game", "Divine Tower of West Altus") },
            { 0x220D, new DungeonAnchor(34, 13, 5585.80f, 6031.70f, "base-game", "Divine Tower of Caelid") },
            { 0x220E, new DungeonAnchor(34, 14, 5107.68f, 3806.34f, "base-game", "Divine Tower of East Altus") },
            { 0x220F, new DungeonAnchor(34, 15, 5989.50f, 4845.80f, "base-game", "Isolated Divine Tower") },
            { 0x2300, new DungeonAnchor(35, 0, 4469.62f, 3461.44f, "base-game-underground", "Subterranean Shunning-Grounds") },
            { 0x2700, new DungeonAnchor(39, 0, 2465.40f, 3613.87f, "base-game", "Ruin-Strewn Precipice") },
            { 0x2714, new DungeonAnchor(39, 20, 2465.40f, 3613.87f, "base-game", "Ruin-Strewn Precipice (Magma Wyrm Makar)") },
            { 0x2800, new DungeonAnchor(40, 0, 4900.00f, 4805.00f, "dlc", "Fog Rift Catacombs") },
            { 0x2801, new DungeonAnchor(40, 1, 4161.30f, 4677.70f, "dlc", "Scorpion River Catacombs") },
            { 0x2802, new DungeonAnchor(40, 2, 5969.80f, 5392.50f, "dlc", "Darklight Catacombs") },
            { 0x2900, new DungeonAnchor(41, 0, 4379.30f, 5354.40f, "dlc", "Belurat Gaol") },
            { 0x2901, new DungeonAnchor(41, 1, 5714.60f, 5529.50f, "dlc", "Bonny Gaol") },
            { 0x2902, new DungeonAnchor(41, 2, 4821.80f, 6267.40f, "dlc", "Lamenter's Gaol") },
            { 0x2A00, new DungeonAnchor(42, 0, 5131.60f, 5688.70f, "dlc", "Ruined Forge Lava Intake") },
            { 0x2A02, new DungeonAnchor(42, 2, 5312.50f, 5342.50f, "dlc", "Ruined Forge of Starfall Past") },
            { 0x2A03, new DungeonAnchor(42, 3, 5208.10f, 4316.40f, "dlc", "Taylew's Ruined Forge") },
            { 0x2B00, new DungeonAnchor(43, 0, 4653.60f, 5104.20f, "dlc", "Rivermouth Cave") },
            { 0x2B01, new DungeonAnchor(43, 1, 5233.90f, 6031.85f, "dlc", "Dragon's Pit") }
        };

        static void Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.InputEncoding = Encoding.UTF8;

            long baseAddr = 0;
            long csMenuManOffset = 0x3D72840;
            long csEventManOffset = 0x3D6F4D8;
            byte[] lastFlags = null;
            long lastFlagCheckMs = 0;
            int flagVersion = 0;
            bool flagsAvailable = false;
            IntPtr hProc = IntPtr.Zero;
            Process targetProc = null;

            float lastValidPx = 0f;
            float lastValidPy = 0f;
            float lastValidAlt = 0f;
            double lastValidYaw = 0;
            string lastValidLayer = "base-game";
            int lastValidGridX = 0;
            int lastValidGridZ = 0;
            int lastValidMapArea = 0;
            int lastValidDunArea = 0;
            int lastValidDunSub = 0;
            bool hasValidPos = false;

            while (true)
            {
                try
                {
                    if (hProc == IntPtr.Zero || targetProc == null || targetProc.HasExited)
                    {
                        if (hProc != IntPtr.Zero)
                        {
                            CloseHandle(hProc);
                            hProc = IntPtr.Zero;
                        }

                        Process[] procs = Process.GetProcessesByName("eldenring");
                        if (procs.Length == 0)
                        {
                            Console.WriteLine("{\"running\":false,\"active\":false}");
                            Thread.Sleep(1000);
                            continue;
                        }

                        targetProc = procs[0];
                        hProc = OpenProcess(PROCESS_VM_READ | PROCESS_QUERY_INFORMATION, false, targetProc.Id);
                        if (hProc == IntPtr.Zero)
                        {
                            Console.WriteLine("{\"running\":true,\"active\":false,\"accessError\":true}");
                            Thread.Sleep(1000);
                            continue;
                        }

                        baseAddr = targetProc.MainModule.BaseAddress.ToInt64();
                        csMenuManOffset = FindCSMenuManOffset(hProc, baseAddr);
                        csEventManOffset = FindCSEventManOffset(hProc, baseAddr);
                        lastFlags = null;
                    }

                    // Static WorldChrMan pointer at base + 0x3D6D018
                    long worldChrMan = ReadInt64(hProc, baseAddr + 0x3D6D018);
                    if (worldChrMan == 0)
                    {
                        Console.WriteLine("{\"running\":true,\"active\":false,\"reason\":\"no_worldchrman\"}");
                        Thread.Sleep(100);
                        continue;
                    }

                    long playerIns = ReadInt64(hProc, worldChrMan + 0x1E508);
                    if (playerIns == 0)
                    {
                        Console.WriteLine("{\"running\":true,\"active\":false,\"reason\":\"no_player\"}");
                        Thread.Sleep(100);
                        continue;
                    }

                    long chrModules = ReadInt64(hProc, playerIns + 0x190);
                    long chrPhysics = 0;
                    if (chrModules != 0)
                    {
                        chrPhysics = ReadInt64(hProc, chrModules + 0x68);
                    }

                    // Tile-space local coordinates at PlayerIns + 0x6C0
                    float posX = ReadFloat(hProc, playerIns + 0x6C0);
                    float posY = ReadFloat(hProc, playerIns + 0x6C4);
                    float posZ = ReadFloat(hProc, playerIns + 0x6C8);

                    // Heading unit vector from ChrPhysics + 0x54, 0x5C
                    float fwdX = 0f;
                    float fwdZ = 0f;
                    if (chrPhysics != 0)
                    {
                        fwdX = ReadFloat(hProc, chrPhysics + 0x54);
                        fwdZ = ReadFloat(hProc, chrPhysics + 0x5C);
                    }

                    double yawDeg = lastValidYaw;
                    if (Math.Abs(fwdX) > 0.001f || Math.Abs(fwdZ) > 0.001f)
                    {
                        yawDeg = Math.Atan2(fwdZ, fwdX) * 180.0 / Math.PI;
                        yawDeg = ((yawDeg % 360) + 360) % 360;
                    }

                    // In Elden Ring, PlayerIns + 0x6D0 directly stores the exact 4-byte Map ID tuple
                    // [sec, gridZ, gridX, mapArea] paired 1-to-1 with the 0x6C0 local position coordinates!
                    int gridX = -1, gridZ = -1, mapArea = -1;
                    int dunArea = -1, dunSub = -1;

                    byte[] coordMapId = Read(hProc, playerIns + 0x6D0, 4);
                    if (coordMapId != null && coordMapId[3] > 0)
                    {
                        int area = coordMapId[3];
                        int b2 = coordMapId[2];
                        int b1 = coordMapId[1];

                        bool isValidOverworldTile = (area == 60 && b2 >= 30 && b2 <= 65 && b1 >= 25 && b1 <= 65) ||
                                                    (area == 61 && b2 >= 40 && b2 <= 55 && b1 >= 30 && b1 <= 55);

                        if (isValidOverworldTile)
                        {
                            gridX = b2;
                            gridZ = b1;
                            mapArea = area;
                        }
                        else if (area > 0 && area < 60)
                        {
                            dunArea = area;
                            dunSub = b2;
                        }
                    }

                    // Read 32 bytes starting at PlayerIns + 0x30 for fallback and interior overworld tile projection
                    byte[] mem32 = Read(hProc, playerIns + 0x30, 32);
                    if (mem32 != null)
                    {
                        int slot0Area = mem32[3];
                        int slot0Sub = mem32[2];

                        if (dunArea == -1 && slot0Area > 0 && slot0Area < 60)
                        {
                            dunArea = slot0Area;
                            dunSub = slot0Sub;
                        }

                        // If overworld tile not resolved from 0x6D0, search loaded map slots for host overworld tile
                        if (gridX == -1 || gridZ == -1 || mapArea == -1)
                        {
                            for (int slot = 0; slot < 8; slot++)
                            {
                                int b1 = mem32[slot * 4 + 1];
                                int b2 = mem32[slot * 4 + 2];
                                int b3 = mem32[slot * 4 + 3];

                                bool isHostOverworld = (b3 == 60 && b2 >= 30 && b2 <= 65 && b1 >= 25 && b1 <= 65) ||
                                                       (b3 == 61 && b2 >= 40 && b2 <= 55 && b1 >= 30 && b1 <= 55);

                                if (isHostOverworld)
                                {
                                    gridX = b2;
                                    gridZ = b1;
                                    mapArea = b3;
                                    break;
                                }
                            }
                        }
                    }

                    bool isPosResolved = false;
                    float calculatedPx = 0f;
                    float calculatedPy = 0f;
                    string calculatedLayer = "base-game";

                    // Priority 0: Native in-game map coordinates directly from CSMenuMan -> 0x80 -> 0x250 + 0x24
                    // This is the EXACT calculation computed internally by Elden Ring's engine for map tracking.
                    // Works natively across Overworld, Haligtree, Farum Azula, Underground (Ainsel/Siofra/Deeproot), DLC, and all dungeons!
                    long csMenuMan = ReadInt64(hProc, baseAddr + csMenuManOffset);
                    if (csMenuMan != 0)
                    {
                        long p80 = ReadInt64(hProc, csMenuMan + 0x80);
                        if (p80 != 0)
                        {
                            long p250 = ReadInt64(hProc, p80 + 0x250);
                            if (p250 != 0)
                            {
                                byte[] buf20 = Read(hProc, p250 + 0x24, 20);
                                if (buf20 != null)
                                {
                                    int map = BitConverter.ToInt32(buf20, 0);
                                    float mapX = BitConverter.ToSingle(buf20, 4);
                                    float mapY = BitConverter.ToSingle(buf20, 8);
                                    bool under = BitConverter.ToBoolean(buf20, 12);
                                    float rad = BitConverter.ToSingle(buf20, 16);

                                    if (mapX >= 50f && mapY >= 50f && mapX <= 10450f && mapY <= 10450f)
                                    {
                                        calculatedPx = mapX;
                                        calculatedPy = mapY;
                                        yawDeg = rad;
                                        if (map == 10)
                                        {
                                            calculatedLayer = "dlc";
                                        }
                                        else if (under)
                                        {
                                            calculatedLayer = "base-game-underground";
                                        }
                                        else
                                        {
                                            calculatedLayer = "base-game";
                                        }
                                        isPosResolved = true;
                                    }
                                }
                            }
                        }
                    }

                    // Priority 1: When a valid host overworld tile is available (either directly at 0x6D0 or via loaded 0x30 slots):
                    // Fallback for when CSMenuMan is not ready or during transitions
                    if (!isPosResolved && gridX != -1 && gridZ != -1 && mapArea != -1 && dunArea != 12)
                    {
                        calculatedPx = (gridX - 28) * 256.0f + 128.0f + posX;
                        calculatedPy = (64 - gridZ) * 256.0f + 128.0f - posZ;
                        
                        if (mapArea == 61 || (dunArea >= 20 && dunArea <= 29) || (dunArea >= 40 && dunArea <= 45))
                        {
                            calculatedLayer = "dlc";
                        }
                        else
                        {
                            calculatedLayer = "base-game";
                        }
                        isPosResolved = true;
                    }
                    // Priority 2: Isolated Dungeons, Towers, Catacombs, Caves & Underground
                    else if (!isPosResolved && dunArea > 0 && dunArea < 60)
                    {
                        if (dunArea == 15) // Haligtree & Elphael oblique perspective elevation correction
                        {
                            calculatedPx = 5590.91f + posX + 0.47932f * posY;
                            calculatedPy = 1325.50f - posZ + 0.83238f * posY;
                            calculatedLayer = "base-game";
                            isPosResolved = true;
                        }
                        else
                        {
                            int key = (dunArea << 8) | dunSub;
                            int areaKey = (dunArea << 8);

                            DungeonAnchor anchor = null;
                            if (!DungeonMap.TryGetValue(key, out anchor))
                            {
                                DungeonMap.TryGetValue(areaKey, out anchor);
                            }

                            if (anchor != null)
                            {
                                calculatedPx = anchor.Px + posX;
                                calculatedPy = anchor.Py - posZ;
                                calculatedLayer = anchor.Layer;
                                isPosResolved = true;
                            }
                        }
                    }

                    if (isPosResolved && calculatedPx >= 50f && calculatedPx <= 10450f && calculatedPy >= 50f && calculatedPy <= 10450f)
                    {
                        lastValidPx = calculatedPx;
                        lastValidPy = calculatedPy;
                        lastValidAlt = posY;
                        lastValidYaw = yawDeg;
                        lastValidLayer = calculatedLayer;
                        lastValidGridX = gridX;
                        lastValidGridZ = gridZ;
                        lastValidMapArea = mapArea;
                        lastValidDunArea = dunArea;
                        lastValidDunSub = dunSub;
                        hasValidPos = true;
                    }

                    // Read HP
                    int hp = 0;
                    int maxHp = 0;
                    if (chrModules != 0)
                    {
                        long dataMod = ReadInt64(hProc, chrModules + 0x00);
                        if (dataMod != 0)
                        {
                            byte[] hpBytes = Read(hProc, dataMod + 0x138, 8);
                            if (hpBytes != null)
                            {
                                hp = BitConverter.ToInt32(hpBytes, 0);
                                maxHp = BitConverter.ToInt32(hpBytes, 4);
                            }
                        }
                    }

                    long nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

                    // Realtime event flag check (instant loot and event sync)
                    if (nowMs - lastFlagCheckMs >= 100)
                    {
                        lastFlagCheckMs = nowMs;
                        long eventMan = ReadInt64(hProc, baseAddr + csEventManOffset);
                        if (eventMan != 0)
                        {
                            long flagBlocks = ReadInt64(hProc, eventMan + 0x28);
                            if (flagBlocks != 0)
                            {
                                flagsAvailable = true;
                                byte[] currentFlags = Read(hProc, flagBlocks, 1833375);
                                if (currentFlags != null)
                                {
                                    bool changed = false;
                                    if (lastFlags == null)
                                    {
                                        changed = true;
                                    }
                                    else
                                    {
                                        int step = 8;
                                        int len = currentFlags.Length - (currentFlags.Length % step);
                                        for (int f = 0; f < len; f += step)
                                        {
                                            if (BitConverter.ToInt64(currentFlags, f) != BitConverter.ToInt64(lastFlags, f))
                                            {
                                                changed = true;
                                                break;
                                            }
                                        }
                                    }

                                    if (changed)
                                    {
                                        lastFlags = currentFlags;
                                        flagVersion++;
                                        try
                                        {
                                            string dir = Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location);
                                            string binPath = Path.Combine(dir, "live_flags.bin");
                                            string tmpPath = binPath + ".tmp";
                                            File.WriteAllBytes(tmpPath, currentFlags);
                                            if (File.Exists(binPath)) File.Delete(binPath);
                                            File.Move(tmpPath, binPath);
                                        }
                                        catch {}
                                    }
                                }
                            }
                        }
                    }

                    if (hasValidPos)
                    {
                        string json = string.Format(
                            System.Globalization.CultureInfo.InvariantCulture,
                            "{{\"running\":true,\"active\":true,\"px\":{0:F2},\"py\":{1:F2},\"altitude\":{2:F2},\"yawDeg\":{3:F1},\"layer\":\"{4}\",\"gridX\":{5},\"gridZ\":{6},\"mapArea\":{7},\"dunArea\":{8},\"dunSub\":{9},\"hp\":{10},\"maxHp\":{11},\"loading\":{12},\"ts\":{13},\"flagVersion\":{14},\"flagsAvailable\":{15}}}",
                            lastValidPx, lastValidPy, lastValidAlt, lastValidYaw, lastValidLayer, lastValidGridX, lastValidGridZ, lastValidMapArea, lastValidDunArea, lastValidDunSub, hp, maxHp, isPosResolved ? "false" : "true", nowMs, flagVersion, flagsAvailable ? "true" : "false"
                        );
                        Console.WriteLine(json);
                    }
                    else
                    {
                        Console.WriteLine(string.Format(
                            System.Globalization.CultureInfo.InvariantCulture,
                            "{{\"running\":true,\"active\":false,\"loading\":true,\"hp\":{0},\"maxHp\":{1},\"ts\":{2},\"flagVersion\":{3},\"flagsAvailable\":{4}}}",
                            hp, maxHp, nowMs, flagVersion, flagsAvailable ? "true" : "false"
                        ));
                    }

                    // 15 updates per second (~66ms) for silky-smooth 60fps interpolation on client
                    Thread.Sleep(66);
                }
                catch (Exception ex)
                {
                    Console.WriteLine("{\"running\":false,\"error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
                    Thread.Sleep(1000);
                }
            }
        }
    }
}
