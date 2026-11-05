using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;

namespace CortexLockdown.Security
{
    public class ProcessWatchdog : IDisposable
    {
        private static readonly HashSet<string> BlacklistedProcesses = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            // Screen Recorders, Streamers & Capture Tools
            "obs64", "obs32", "obs", "streamlabs obs", "discord", "camtasia",
            "snagit32", "snagit64", "snagit", "action", "bandicam", "fraps",
            "xsplit", "geforceexperience", "nvcontainer", "radeonsoftware",
            "snippingtool", "screenclippinghost", "psr",

            // Remote Desktop & Collaboration Tools
            "teamviewer", "anydesk", "vncviewer", "tv_w32", "chromeremotedesktop",
            "logmein", "parsec", "ammyy", "radmin", "ultraviewer", "tightvnc",

            // Unauthorized Secondary Browsers & Communication
            "chrome", "firefox", "msedge", "brave", "opera", "vivaldi",
            "telegram", "whatsapp", "slack", "skype", "teams", "zoom",

            // Decompilers, Debuggers, Task Managers & Memory Editors
            "wireshark", "fiddler", "charles", "cheatengine", "x64dbg",
            "x32dbg", "ida64", "ida", "processhacker", "procexp", "procexp64",
            "taskmgr", "perfmon", "resmon", "ghidra", "regedit",

            // Unauthorized Command Line & Shells
            "cmd", "powershell", "pwsh"
        };

        private static readonly string[] ProhibitedTitleKeywords = new string[]
        {
            "obs", "streamlabs", "discord", "teamviewer", "anydesk", "vnc",
            "wireshark", "fiddler", "cheat engine", "x64dbg", "x32dbg", "ida pro",
            "ghidra", "task manager", "process hacker", "process explorer",
            "developer tools", "inspect element"
        };

        private Thread _watchdogThread;
        private bool _isRunning = false;
        private int _pollIntervalMs = 1500;
        private bool _autoTerminate = false;

        public event Action<string, int> OnProhibitedProcessDetected;

        public ProcessWatchdog(bool autoTerminate = false)
        {
            _autoTerminate = autoTerminate;
        }

        public void Start()
        {
            if (_isRunning) return;
            _isRunning = true;
            _watchdogThread = new Thread(ScanLoop)
            {
                IsBackground = true,
                Name = "CortexLockdownProcessWatchdog"
            };
            _watchdogThread.Start();
        }

        public void Stop()
        {
            _isRunning = false;
        }

        private void ScanLoop()
        {
            while (_isRunning)
            {
                try
                {
                    Process[] processes = Process.GetProcesses();
                    foreach (Process p in processes)
                    {
                        try
                        {
                            string procName = p.ProcessName.ToLower();
                            bool isViolation = false;
                            string violationIdentifier = p.ProcessName;

                            if (BlacklistedProcesses.Contains(procName))
                            {
                                isViolation = true;
                                violationIdentifier = p.ProcessName;
                            }
                            else
                            {
                                // Adversarial bypass defense: Inspect window title in case binary was renamed
                                try
                                {
                                    string windowTitle = p.MainWindowTitle;
                                    if (!string.IsNullOrEmpty(windowTitle))
                                    {
                                        string lowerTitle = windowTitle.ToLower();
                                        for (int k = 0; k < ProhibitedTitleKeywords.Length; k++)
                                        {
                                            if (lowerTitle.Contains(ProhibitedTitleKeywords[k]))
                                            {
                                                isViolation = true;
                                                violationIdentifier = string.Format("{0} [Title: {1}]", p.ProcessName, windowTitle);
                                                break;
                                            }
                                        }
                                    }
                                }
                                catch
                                {
                                    // Ignore access denied on specific process properties
                                }
                            }

                            if (isViolation)
                            {
                                if (OnProhibitedProcessDetected != null)
                                {
                                    OnProhibitedProcessDetected(violationIdentifier, p.Id);
                                }

                                if (_autoTerminate)
                                {
                                    try
                                    {
                                        p.Kill();
                                    }
                                    catch
                                    {
                                        // Ignore if process already exited or lacks kill permission
                                    }
                                }
                            }
                        }
                        catch
                        {
                            // Ignore access denied on system-level processes
                        }
                    }
                }
                catch
                {
                    // Ignore transient process table errors
                }

                Thread.Sleep(_pollIntervalMs);
            }
        }

        public void Dispose()
        {
            Stop();
        }
    }
}
