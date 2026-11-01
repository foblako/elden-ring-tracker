using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace EldenRingTrackerLauncher
{
    static class Program
    {
        private static Mutex singleInstanceMutex = null;
        private static Process serverProcess = null;
        private static NotifyIcon trayIcon = null;
        private static string serverUrl = "http://localhost:5173";

        [STAThread]
        static void Main()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string logFile = Path.Combine(baseDir, "launcher.log");
            Action<string> log = (msg) => {
                try { File.AppendAllText(logFile, DateTime.Now.ToString("HH:mm:ss.fff") + " " + msg + Environment.NewLine); } catch {}
            };

            log("Starting launcher...");

            // 1. Single-instance protection
            bool isNewInstance = false;
            singleInstanceMutex = new Mutex(true, "EldenRingTracker_SingleInstance_Mutex", out isNewInstance);

            if (!isNewInstance)
            {
                log("Already running - opening browser and exiting.");
                try
                {
                    Process.Start(new ProcessStartInfo(serverUrl) { UseShellExecute = true });
                }
                catch {}
                return;
            }

            log("Single instance acquired.");

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
            Application.ThreadException += (s, e) => {
                log("ThreadException: " + e.Exception.ToString());
            };
            AppDomain.CurrentDomain.UnhandledException += (s, e) => {
                log("UnhandledException: " + e.ExceptionObject.ToString());
            };

            // 2. Locate node.exe
            string nodePath = Path.Combine(baseDir, "node.exe");
            if (!File.Exists(nodePath))
            {
                string alt1 = Path.Combine(baseDir, "tools", "node.exe");
                string alt2 = Path.Combine(baseDir, "bin", "node.exe");
                if (File.Exists(alt1)) nodePath = alt1;
                else if (File.Exists(alt2)) nodePath = alt2;
                else nodePath = FindInPath("node.exe");
            }

            if (string.IsNullOrEmpty(nodePath) || !File.Exists(nodePath))
            {
                MessageBox.Show(
                    "Файл node.exe не найден!\n\nУбедитесь, что архив с программой распакован полностью.",
                    "Elden Ring Tracker",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            // 3. Locate server bundle
            string serverScript = Path.Combine(baseDir, "server.bundle.cjs");
            if (!File.Exists(serverScript))
            {
                string altServer = Path.Combine(baseDir, "server", "server.bundle.cjs");
                if (File.Exists(altServer)) serverScript = altServer;
            }

            if (!File.Exists(serverScript))
            {
                MessageBox.Show(
                    "Файл server.bundle.cjs не найден!\n\nУбедитесь, что все файлы программы находятся в одной папке.",
                    "Elden Ring Tracker",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            // 4. Start background server process (Zero Console Window!)
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
                    CreateNoWindow = true
                };

                serverProcess = new Process { StartInfo = psi };
                AutoResetEvent readyEvent = new AutoResetEvent(false);

                serverProcess.OutputDataReceived += (s, e) =>
                {
                    if (string.IsNullOrEmpty(e.Data)) return;
                    if (e.Data.Contains("[SERVER_READY]"))
                    {
                        int idx = e.Data.IndexOf("http://");
                        if (idx >= 0)
                        {
                            serverUrl = e.Data.Substring(idx).Trim();
                        }
                        readyEvent.Set();
                    }
                };

                serverProcess.Start();
                serverProcess.BeginOutputReadLine();
                serverProcess.BeginErrorReadLine();

                // Wait up to 10 seconds for server to be ready
                bool isReady = readyEvent.WaitOne(10000);
                log("Server ready: " + isReady + " URL: " + serverUrl);

                // Open browser
                try
                {
                    Process.Start(new ProcessStartInfo(serverUrl) { UseShellExecute = true });
                }
                catch (Exception bex) { log("Browser open error: " + bex.Message); }

                // 5. Setup System Tray Icon
                trayIcon = new NotifyIcon();
                trayIcon.Text = "Elden Ring Tracker (Работает)";

                Icon appIcon = null;
                try
                {
                    appIcon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                }
                catch {}

                if (appIcon == null)
                {
                    appIcon = SystemIcons.Application;
                }
                trayIcon.Icon = appIcon;
                trayIcon.Visible = true;

                // Context Menu
                ContextMenu contextMenu = new ContextMenu();

                MenuItem itemOpen = new MenuItem("🗺️ Открыть карту в браузере", (s, e) =>
                {
                    try { Process.Start(new ProcessStartInfo(serverUrl) { UseShellExecute = true }); } catch {}
                });
                itemOpen.DefaultItem = true; // Bold font, triggers on click
                contextMenu.MenuItems.Add(itemOpen);

                contextMenu.MenuItems.Add(new MenuItem("📁 Папка сохранений Elden Ring", (s, e) =>
                {
                    try
                    {
                        string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                        string savesPath = Path.Combine(appData, "EldenRing");
                        if (Directory.Exists(savesPath))
                        {
                            Process.Start("explorer.exe", savesPath);
                        }
                        else
                        {
                            Process.Start("explorer.exe", appData);
                        }
                    }
                    catch {}
                }));

                contextMenu.MenuItems.Add("-");

                ApplicationContext appContext = new ApplicationContext();

                contextMenu.MenuItems.Add(new MenuItem("❌ Выход", (s, e) =>
                {
                    Cleanup();
                    try { appContext.ExitThread(); } catch {}
                    Application.Exit();
                }));

                trayIcon.ContextMenu = contextMenu;

                trayIcon.DoubleClick += (s, e) =>
                {
                    try { Process.Start(new ProcessStartInfo(serverUrl) { UseShellExecute = true }); } catch {}
                };

                // Notification tip
                trayIcon.ShowBalloonTip(
                    3000,
                    "Elden Ring Tracker",
                    "Карта открыта в браузере. Управление доступно в трее.",
                    ToolTipIcon.Info
                );

                Application.ApplicationExit += (s, e) => { log("ApplicationExit"); Cleanup(); };
                AppDomain.CurrentDomain.ProcessExit += (s, e) => { log("ProcessExit"); Cleanup(); };

                log("Entering Application.Run(appContext)...");
                Application.Run(appContext);
                log("Application.Run(appContext) exited.");
            }
            catch (Exception ex)
            {
                log("Exception: " + ex.ToString());
                MessageBox.Show(
                    "Ошибка запуска программы:\n" + ex.Message,
                    "Elden Ring Tracker",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                Cleanup();
            }
        }

        private static void Cleanup()
        {
            try
            {
                if (trayIcon != null)
                {
                    trayIcon.Visible = false;
                    trayIcon.Dispose();
                    trayIcon = null;
                }

                if (serverProcess != null && !serverProcess.HasExited)
                {
                    serverProcess.Kill();
                    serverProcess = null;
                }

                Process[] trackers = Process.GetProcessesByName("er_tracker");
                foreach (var t in trackers)
                {
                    try { t.Kill(); } catch {}
                }

                if (singleInstanceMutex != null)
                {
                    singleInstanceMutex.ReleaseMutex();
                    singleInstanceMutex.Dispose();
                    singleInstanceMutex = null;
                }
            }
            catch {}
        }

        private static string FindInPath(string filename)
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
