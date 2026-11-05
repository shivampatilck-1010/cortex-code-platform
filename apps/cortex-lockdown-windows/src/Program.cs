using System;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using CortexLockdown.Security;
using CortexLockdown.UI;

namespace CortexLockdown
{
    static class Program
    {
        private static bool IsAllowedHost(string host)
        {
            if (string.IsNullOrEmpty(host)) return false;
            string h = host.ToLowerInvariant();
            return h == "cortex-code-platform.cortexbuild1.workers.dev" ||
                   h == "cortex-code-platform-staging.cortexbuild1.workers.dev" ||
                   h == "localhost" ||
                   h == "127.0.0.1";
        }

        private static bool IsValidExamId(string id)
        {
            if (string.IsNullOrEmpty(id)) return true;
            if (id.Length > 64) return false;
            return Regex.IsMatch(id, @"^[a-zA-Z0-9_\-]+$");
        }

        private static bool IsValidGrant(string grant)
        {
            if (string.IsNullOrEmpty(grant)) return true;
            return Regex.IsMatch(grant, @"^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$");
        }

        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string targetUrl = "https://cortex-code-platform.cortexbuild1.workers.dev/lockdown/workspace";
            string examId = "";
            string launchGrant = "";

            // Parse command line arguments:
            // 1. Custom protocol URL: cortex-lockdown://launch?examId=...&grant=...
            // 2. Standard CLI parameters: --url=..., --exam-id=..., --grant=...
            for (int i = 0; i < args.Length; i++)
            {
                string arg = args[i].Trim();
                if (arg.StartsWith("cortex-lockdown://", StringComparison.OrdinalIgnoreCase) ||
                    arg.StartsWith("cortex-lockdown:", StringComparison.OrdinalIgnoreCase))
                {
                    try
                    {
                        string uriStr = arg;
                        if (!uriStr.StartsWith("cortex-lockdown://", StringComparison.OrdinalIgnoreCase))
                        {
                            uriStr = "cortex-lockdown://" + uriStr.Substring(16);
                        }

                        Uri uri;
                        if (Uri.TryCreate(uriStr, UriKind.Absolute, out uri))
                        {
                            string query = uri.Query;
                            if (!string.IsNullOrEmpty(query))
                            {
                                if (query.StartsWith("?")) query = query.Substring(1);
                                string[] pairs = query.Split('&');
                                for (int p = 0; p < pairs.Length; p++)
                                {
                                    string[] kv = pairs[p].Split('=');
                                    if (kv.Length >= 2)
                                    {
                                        string key = Uri.UnescapeDataString(kv[0]).ToLowerInvariant();
                                        string val = Uri.UnescapeDataString(kv[1]);
                                        if (key == "examid" || key == "exam-id" || key == "exam_id")
                                        {
                                            examId = val;
                                        }
                                        else if (key == "grant" || key == "launchgrant" || key == "launch_grant")
                                        {
                                            launchGrant = val;
                                        }
                                        else if (key == "url" || key == "targeturl" || key == "target_url")
                                        {
                                            targetUrl = val;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    catch (Exception) { }
                }
                else if (arg.StartsWith("--url="))
                {
                    targetUrl = arg.Substring(6);
                }
                else if (arg.StartsWith("--exam-id="))
                {
                    examId = arg.Substring(10);
                }
                else if (arg.StartsWith("--grant="))
                {
                    launchGrant = arg.Substring(8);
                }
            }

            // Security Hardening: Validate Parameters and Target Host
            if (!IsValidExamId(examId) || !IsValidGrant(launchGrant))
            {
                MessageBox.Show(
                    "Security Error: Malformed examination ID or launch grant parameters supplied.",
                    "Invalid Launch Parameters",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            Uri parsedTarget;
            if (!Uri.TryCreate(targetUrl, UriKind.Absolute, out parsedTarget) ||
                !IsAllowedHost(parsedTarget.Host) ||
                (parsedTarget.Scheme != "https" && parsedTarget.Host != "localhost" && parsedTarget.Host != "127.0.0.1"))
            {
                MessageBox.Show(
                    string.Format("Security Error: Target URL host '{0}' is not authorized by Cortex Lockdown policy.\nOnly official Cortex domains are permitted.", parsedTarget != null ? parsedTarget.Host : "invalid"),
                    "Unauthorized Navigation Blocked",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            // Attach parsed parameters to target URL if present
            if (!string.IsNullOrEmpty(examId) || !string.IsNullOrEmpty(launchGrant))
            {
                string separator = targetUrl.Contains("?") ? "&" : "?";
                if (!string.IsNullOrEmpty(examId) && !targetUrl.Contains("examId="))
                {
                    targetUrl += separator + "examId=" + Uri.EscapeDataString(examId);
                    separator = "&";
                }
                if (!string.IsNullOrEmpty(launchGrant) && !targetUrl.Contains("launchGrant="))
                {
                    targetUrl += separator + "launchGrant=" + Uri.EscapeDataString(launchGrant);
                }
            }

            // Environment Inspection: Block RDP and virtualized sessions
            EnvironmentReport env = EnvironmentInspector.InspectEnvironment(Application.ExecutablePath);
            if (env.IsRemoteSession)
            {
                MessageBox.Show(
                    "Cortex Lockdown cannot execute over a Remote Desktop Protocol (RDP) or virtual session.\n\nPlease launch on your physical local machine.",
                    "Remote Session Blocked",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            // Multi-Display Confinement Check
            if (Screen.AllScreens.Length > 1)
            {
                DialogResult res = MessageBox.Show(
                    string.Format("Multiple displays detected ({0} monitors).\n\nCortex Lockdown security policy requires a single physical monitor.\nPlease disconnect secondary displays to enter the examination.", Screen.AllScreens.Length),
                    "Multi-Display Warning",
                    MessageBoxButtons.OKCancel,
                    MessageBoxIcon.Warning
                );
                if (res == DialogResult.Cancel)
                {
                    return;
                }
            }

            // Launch Main Kiosk Window
            MainWindow mainWindow = new MainWindow(targetUrl, examId, launchGrant);
            Application.Run(mainWindow);
        }
    }
}
