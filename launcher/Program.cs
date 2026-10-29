using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;

namespace EldenRingTrackerLauncher
{
    class Program
    {
        static Process serverProcess = null;

        static void Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.Title = "Elden Ring Map & Live Tracker";

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;

            // 1. Locate node.exe
            string nodePath = Path.Combine(baseDir, "node.exe");
            if (!File.Exists(nodePath))
            {
                // Fallback to tools/node.exe or bin/node.exe
                string alt1 = Path.Combine(baseDir, "tools", "node.exe");
                string alt2 = Path.Combine(baseDir, "bin", "node.exe");
                if (File.Exists(alt1)) nodePath = alt1;
                else if (File.Exists(alt2)) nodePath = alt2;
                else
                {
                    // Check system PATH
                    nodePath = FindInPath("node.exe");
                }
            }

            if (string.IsNullOrEmpty(nodePath) || !File.Exists(nodePath))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("\n[ОШИБКА] Файл node.exe не найден!");
                Console.ResetColor();
                Console.WriteLine("Убедитесь, что архив с программой распакован полностью.");
                Console.WriteLine("\nНажмите любую клавишу для выхода...");
                Console.ReadKey();
                return;
            }

            // 2. Locate server bundle
            string serverScript = Path.Combine(baseDir, "server.bundle.cjs");
            if (!File.Exists(serverScript))
            {
                string altServer = Path.Combine(baseDir, "server", "server.bundle.cjs");
                if (File.Exists(altServer)) serverScript = altServer;
            }

            if (!File.Exists(serverScript))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("\n[ОШИБКА] Файл server.bundle.cjs не найден!");
                Console.ResetColor();
                Console.WriteLine("Убедитесь, что все файлы программы находятся в одной папке.");
                Console.WriteLine("\nНажмите любую клавишу для выхода...");
                Console.ReadKey();
                return;
            }

            // Register cleanup handlers
            Console.CancelKeyPress += (s, e) => Cleanup();
            AppDomain.CurrentDomain.ProcessExit += (s, e) => Cleanup();

            Console.ForegroundColor = ConsoleColor.DarkYellow;
            Console.WriteLine(@"
   ______ __     __             ____  _             ______              __             
  / ____// /____/ /___   ____  / __ \(_)___  ____ _/_  __/________ _____/ /_____  _____
 / __/  / // __  // _ \ / __ \/ /_/ // // __ \/ __ `// /  / ___/ __ `/ ___// // _ \/ ___/
/ /___ / // /_/ //  __// / / // _, _// // / / / /_/ // /  / /  / /_/ / /__ / ,< /  __/ /    
/_____//_/ \__,_/ \___//_/ /_//_/ |_|/_//_/ /_/\__, //_/  /_/   \__,_/\___//_/|_|\___/_/     
                                              /____/                                         ");
            Console.ResetColor();
            Console.WriteLine("  Интерактивная карта и трекер прогресса (Shadow of the Erdtree Ready)");
            Console.WriteLine("  ---------------------------------------------------------------------");
            Console.WriteLine("  [1/3] Запуск локального сервера...");

            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = nodePath,
                    Arguments = "\"" + serverScript + "\"",
                    WorkingDirectory = baseDir,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                    StandardOutputEncoding = Encoding.UTF8,
                    StandardErrorEncoding = Encoding.UTF8
                };

                serverProcess = new Process { StartInfo = psi };

                string serverUrl = "http://localhost:5173";
                bool isReady = false;
                AutoResetEvent readyEvent = new AutoResetEvent(false);

                serverProcess.OutputDataReceived += (sender, lineArgs) =>
                {
                    if (string.IsNullOrEmpty(lineArgs.Data)) return;
                    if (lineArgs.Data.Contains("[SERVER_READY]"))
                    {
                        int idx = lineArgs.Data.IndexOf("http://");
                        if (idx >= 0)
                        {
                            serverUrl = lineArgs.Data.Substring(idx).Trim();
                        }
                        isReady = true;
                        readyEvent.Set();
                    }
                };

                serverProcess.ErrorDataReceived += (sender, lineArgs) =>
                {
                    if (!string.IsNullOrEmpty(lineArgs.Data))
                    {
                        // Filter out normal debug warnings
                        if (!lineArgs.Data.Contains("ExperimentalWarning") && !lineArgs.Data.Contains("DeprecationWarning"))
                        {
                            // keep silent or log
                        }
                    }
                };

                serverProcess.Start();
                serverProcess.BeginOutputReadLine();
                serverProcess.BeginErrorReadLine();

                // Wait up to 10 seconds for server to report ready
                readyEvent.WaitOne(10000);

                Console.WriteLine("  [2/3] Мониторинг сохранений и памяти игры активирован.");
                Console.WriteLine("  [3/3] Открытие карты в браузере...");

                try
                {
                    Process.Start(new ProcessStartInfo(serverUrl) { UseShellExecute = true });
                }
                catch
                {
                    Console.WriteLine("  [!] Не удалось открыть браузер автоматически. Откройте вручную: " + serverUrl);
                }

                Console.WriteLine("\n  =====================================================================");
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("  [✓] ПРОГРАММА УСПЕШНО ЗАПУЩЕНА И ГОТОВА К ИГРЕ!");
                Console.ResetColor();
                Console.WriteLine("  ---------------------------------------------------------------------");
                Console.WriteLine("  * Адрес карты:            " + serverUrl);
                Console.WriteLine("  * Сохранения (%APPDATA%): Автоматическое сканирование");
                Console.WriteLine("  * Чтение памяти игры:     Автоматически при запуске eldenring.exe");
                Console.WriteLine("  ---------------------------------------------------------------------");
                Console.ForegroundColor = ConsoleColor.DarkGray;
                Console.WriteLine("  Чтобы закрыть трекер, закройте это окно или нажмите [Enter] в любой момент.\n");
                Console.ResetColor();

                Console.ReadLine();
                Cleanup();
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("\n[ОШИБКА ЗАПУСКА]: " + ex.Message);
                Console.ResetColor();
                Console.WriteLine("Нажмите любую клавишу для выхода...");
                Console.ReadKey();
            }
        }

        static void Cleanup()
        {
            try
            {
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    serverProcess.Kill();
                    serverProcess = null;
                }

                // Also kill any orphaned er_tracker.exe
                Process[] trackers = Process.GetProcessesByName("er_tracker");
                foreach (var t in trackers)
                {
                    try { t.Kill(); } catch {}
                }
            }
            catch {}
        }

        static string FindInPath(string filename)
        {
            string pathEnv = Environment.GetEnvironmentVariable("PATH");
            if (string.IsNullOrEmpty(pathEnv)) return null;

            string[] paths = pathEnv.Split(';');
            foreach (string p in paths)
            {
                try
                {
                    string trimmed = p.Trim();
                    if (string.IsNullOrEmpty(trimmed)) continue;
                    string full = Path.Combine(trimmed, filename);
                    if (File.Exists(full)) return full;
                }
                catch {}
            }
            return null;
        }
    }
}
