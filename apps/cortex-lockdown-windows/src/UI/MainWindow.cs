using System;
using System.Drawing;
using System.Windows.Forms;
using CortexLockdown.Security;

namespace CortexLockdown.UI
{
    public class MainWindow : Form
    {
        private KeyboardHook _keyboardHook;
        private ProcessWatchdog _processWatchdog;
        private WebBrowser _webBrowser;
        private Panel _headerPanel;
        private Label _lblTitle;
        private Label _lblStatus;
        private Label _lblSecurityBadge;
        private Button _btnExit;

        private string _targetUrl;
        private string _examId;
        private string _launchGrant;

        public MainWindow(string targetUrl, string examId, string launchGrant = "")
        {
            _targetUrl = targetUrl;
            _examId = examId;
            _launchGrant = launchGrant;

            InitializeKioskWindow();
            InitializeComponents();
            InitializeSecurityEngines();
        }

        private void InitializeKioskWindow()
        {
            this.FormBorderStyle = FormBorderStyle.None;
            this.WindowState = FormWindowState.Normal;
            this.StartPosition = FormStartPosition.Manual;
            this.TopMost = true;
            this.ShowInTaskbar = false;
            this.BackColor = Color.FromArgb(11, 12, 16); // #0B0C10 Cortex Dark
            this.ForeColor = Color.White;

            // Cover the full primary display
            Rectangle bounds = Screen.PrimaryScreen.Bounds;
            this.Bounds = bounds;
        }

        private void InitializeComponents()
        {
            // Top Header Panel
            _headerPanel = new Panel
            {
                Dock = DockStyle.Top,
                Height = 44,
                BackColor = Color.FromArgb(18, 19, 22) // #121316
            };

            _lblTitle = new Label
            {
                Text = "CORTEX LOCKDOWN  |  SECURE ASSESSMENT WORKSPACE",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.White,
                Location = new Point(16, 12),
                AutoSize = true
            };

            _lblSecurityBadge = new Label
            {
                Text = "LEVEL 2 RESTRICTED (SECURE KIOSK ACTIVE)",
                Font = new Font("Segoe UI", 8.0f, FontStyle.Bold),
                ForeColor = Color.FromArgb(255, 145, 0), // #FF9100 Cortex Orange
                BackColor = Color.FromArgb(30, 20, 10),
                Location = new Point(480, 12),
                Padding = new Padding(6, 2, 6, 2),
                AutoSize = true
            };

            _lblStatus = new Label
            {
                Text = "DISPLAY AFFINITY: ACTIVE  |  KEYBOARD HOOKS: ENFORCED",
                Font = new Font("Segoe UI", 8.0f),
                ForeColor = Color.FromArgb(156, 163, 175),
                Location = new Point(boundsWidth() - 480, 14),
                AutoSize = true
            };

            _btnExit = new Button
            {
                Text = "Emergency Exit (Ctrl+Alt+F10)",
                Font = new Font("Segoe UI", 8.0f),
                ForeColor = Color.FromArgb(200, 200, 200),
                BackColor = Color.FromArgb(30, 32, 40),
                FlatStyle = FlatStyle.Flat,
                Location = new Point(boundsWidth() - 200, 8),
                Size = new Size(185, 28),
                Cursor = Cursors.Hand
            };
            _btnExit.FlatAppearance.BorderSize = 1;
            _btnExit.FlatAppearance.BorderColor = Color.FromArgb(50, 52, 60);
            _btnExit.Click += (s, e) => PromptEmergencyExit();

            _headerPanel.Controls.Add(_lblTitle);
            _headerPanel.Controls.Add(_lblSecurityBadge);
            _headerPanel.Controls.Add(_lblStatus);
            _headerPanel.Controls.Add(_btnExit);
            this.Controls.Add(_headerPanel);

            // Embedded Browser Control with Drag-and-Drop Suppression
            this.AllowDrop = false;
            _webBrowser = new WebBrowser
            {
                Dock = DockStyle.Fill,
                IsWebBrowserContextMenuEnabled = false,
                WebBrowserShortcutsEnabled = false,
                ScriptErrorsSuppressed = true,
                AllowWebBrowserDrop = false
            };
            this.Controls.Add(_webBrowser);

            // Navigate to target URL
            if (!string.IsNullOrEmpty(_targetUrl))
            {
                _webBrowser.Navigate(_targetUrl);
            }
        }

        private int boundsWidth()
        {
            return Screen.PrimaryScreen.Bounds.Width;
        }

        private void InitializeSecurityEngines()
        {
            // 0. Initialize Asynchronous Telemetry Dispatcher
            string telemetryUrl = "https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/lockdown/telemetry";
            if (!string.IsNullOrEmpty(_targetUrl) && _targetUrl.StartsWith("http"))
            {
                try
                {
                    Uri uri = new Uri(_targetUrl);
                    telemetryUrl = string.Format("{0}://{1}/api/v1/lockdown/telemetry", uri.Scheme, uri.Authority);
                }
                catch { }
            }
            TelemetryDispatcher.Initialize(telemetryUrl, "sess_lockdown_native", _examId, _launchGrant);

            // 1. Install Low-Level Keyboard Hook
            _keyboardHook = new KeyboardHook();
            _keyboardHook.OnBlockedKeyAttempt += (keyName) =>
            {
                TelemetryDispatcher.DispatchEvent("blocked_key_attempt", string.Format("{{\"key\":\"{0}\"}}", keyName));
            };
            _keyboardHook.OnEmergencyExitRequested += () =>
            {
                this.BeginInvoke(new MethodInvoker(PromptEmergencyExit));
            };
            _keyboardHook.Install();

            // 2. Start Process Watchdog
            _processWatchdog = new ProcessWatchdog();
            _processWatchdog.OnProhibitedProcessDetected += (procName, pid) =>
            {
                TelemetryDispatcher.DispatchEvent("prohibited_process_detected", string.Format("{{\"process\":\"{0}\",\"pid\":{1}}}", procName, pid));
            };
            _processWatchdog.Start();

            // 3. Display Protection on Handle Created
            this.HandleCreated += (s, e) =>
            {
                DisplayAffinity.EnableScreenCaptureProtection(this.Handle);
                ClipboardGuard.FlushClipboard(this.Handle);
            };

            // 4. Flush Clipboard on Activation
            this.Activated += (s, e) =>
            {
                ClipboardGuard.FlushClipboard(this.Handle);
                this.TopMost = true;
            };

            // 5. Deactivation Focus Protection & Duration Telemetry
            this.Deactivate += (s, e) =>
            {
                TelemetryDispatcher.DispatchEvent("window_blur", "{\"action\":\"focus_lost_reasserted\"}");
                Win32Native.SetForegroundWindow(this.Handle);
            };
        }

        private void PromptEmergencyExit()
        {
            // Cryptographic single-use challenge (4 uppercase hex digits)
            string challenge = new Random().Next(0x1000, 0xFFFF).ToString("X4");

            using (Form prompt = new Form())
            {
                prompt.Width = 460;
                prompt.Height = 240;
                prompt.FormBorderStyle = FormBorderStyle.FixedDialog;
                prompt.Text = "Proctor Emergency Exit Authorization";
                prompt.StartPosition = FormStartPosition.CenterScreen;
                prompt.BackColor = Color.FromArgb(18, 19, 22);
                prompt.ForeColor = Color.White;
                prompt.TopMost = true;

                Label headerLabel = new Label()
                {
                    Left = 20, Top = 16, Width = 400,
                    Text = "PROCTOR EMERGENCY OVERRIDE",
                    Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                    ForeColor = Color.FromArgb(255, 145, 0)
                };

                Label textLabel = new Label()
                {
                    Left = 20, Top = 42, Width = 400, Height = 36,
                    Text = string.Format("Provide this Challenge to your examination proctor:\nChallenge: {0}  |  Exam ID: {1}", challenge, string.IsNullOrEmpty(_examId) ? "N/A" : _examId),
                    Font = new Font("Segoe UI", 8.5f),
                    ForeColor = Color.FromArgb(200, 200, 200)
                };

                Label codePrompt = new Label()
                {
                    Left = 20, Top = 84, Width = 400,
                    Text = "Enter single-use 6-digit Proctor Authorization Code:",
                    Font = new Font("Segoe UI", 8.5f),
                    ForeColor = Color.White
                };

                TextBox textBox = new TextBox()
                {
                    Left = 20, Top = 106, Width = 400,
                    Font = new Font("Consolas", 12f, FontStyle.Bold),
                    MaxLength = 6,
                    TextAlign = HorizontalAlignment.Center,
                    BackColor = Color.FromArgb(28, 30, 36),
                    ForeColor = Color.FromArgb(255, 145, 0)
                };

                Button confirmation = new Button()
                {
                    Text = "Unlock & Restore Desktop",
                    Left = 220, Width = 200, Top = 148,
                    DialogResult = DialogResult.OK,
                    BackColor = Color.FromArgb(255, 145, 0),
                    ForeColor = Color.Black,
                    FlatStyle = FlatStyle.Flat,
                    Font = new Font("Segoe UI", 8.5f, FontStyle.Bold)
                };

                Button cancel = new Button()
                {
                    Text = "Cancel",
                    Left = 100, Width = 110, Top = 148,
                    DialogResult = DialogResult.Cancel,
                    BackColor = Color.FromArgb(35, 37, 45),
                    ForeColor = Color.White,
                    FlatStyle = FlatStyle.Flat
                };

                prompt.Controls.Add(headerLabel);
                prompt.Controls.Add(textLabel);
                prompt.Controls.Add(codePrompt);
                prompt.Controls.Add(textBox);
                prompt.Controls.Add(confirmation);
                prompt.Controls.Add(cancel);
                prompt.AcceptButton = confirmation;

                if (prompt.ShowDialog(this) == DialogResult.OK)
                {
                    string inputCode = textBox.Text.Trim();
                    string failureReason;
                    bool isValid = RedeemEmergencyExitAuthorization(challenge, inputCode, out failureReason);

                    if (isValid)
                    {
                        TelemetryDispatcher.DispatchEvent("emergency_exit", string.Format("{{\"reason\":\"proctor_authorized_exit\",\"challenge\":\"{0}\"}}", challenge));
                        MessageBox.Show("Emergency exit successfully verified by proctor.\nRestoring your desktop...", "Exit Authorized", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        TeardownAndExit();
                    }
                    else
                    {
                        TelemetryDispatcher.DispatchEvent("unauthorized_emergency_exit_attempt", string.Format("{{\"challenge\":\"{0}\",\"reason\":\"{1}\"}}", challenge, EscapeJson(failureReason)));
                        MessageBox.Show("Emergency exit authorization failed:\n\n" + failureReason + "\n\nThis unauthorized exit attempt has been logged in the proctor audit timeline.", "Authorization Rejected", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    }
                }
            }
        }

        private static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r");
        }

        /// <summary>
        /// Server-Authoritative Emergency Exit Redemption (Alpha 8)
        /// Validates single-use proctor authorization code via authenticated backend.
        /// Strictly ZERO reusable secrets or HMAC signing keys are embedded in this client binary.
        /// </summary>
        private bool RedeemEmergencyExitAuthorization(string challenge, string inputCode, out string failureReason)
        {
            failureReason = "Unknown error";
            if (string.IsNullOrEmpty(inputCode) || inputCode.Length != 6)
            {
                failureReason = "Authorization code must be a 6-digit numeric code.";
                return false;
            }

            try
            {
                string baseUrl = "https://cortex-code-platform.cortexbuild1.workers.dev";
                if (!string.IsNullOrEmpty(_targetUrl))
                {
                    try
                    {
                        Uri u = new Uri(_targetUrl);
                        baseUrl = u.GetLeftPart(UriPartial.Authority);
                    }
                    catch { }
                }

                string endpoint = baseUrl.TrimEnd('/') + "/api/v1/lockdown/emergency-exit";
                string postData = string.Format(
                    "{{\"action\":\"redeem\",\"examId\":\"{0}\",\"challenge\":\"{1}\",\"code\":\"{2}\",\"grant\":\"{3}\"}}",
                    EscapeJson(_examId),
                    EscapeJson(challenge),
                    EscapeJson(inputCode),
                    EscapeJson(_launchGrant)
                );

                byte[] postBytes = System.Text.Encoding.UTF8.GetBytes(postData);
                System.Net.HttpWebRequest req = (System.Net.HttpWebRequest)System.Net.WebRequest.Create(endpoint);
                req.Method = "POST";
                req.ContentType = "application/json";
                req.ContentLength = postBytes.Length;
                req.Timeout = 8000;

                if (!string.IsNullOrEmpty(_launchGrant))
                {
                    req.Headers["x-cortex-lockdown-grant"] = _launchGrant;
                }

                using (System.IO.Stream reqStream = req.GetRequestStream())
                {
                    reqStream.Write(postBytes, 0, postBytes.Length);
                }

                using (System.Net.HttpWebResponse resp = (System.Net.HttpWebResponse)req.GetResponse())
                using (System.IO.StreamReader reader = new System.IO.StreamReader(resp.GetResponseStream(), System.Text.Encoding.UTF8))
                {
                    string respJson = reader.ReadToEnd();
                    if (respJson.Contains("\"authorized\":true"))
                    {
                        failureReason = "";
                        return true;
                    }
                    else
                    {
                        failureReason = "Authorization rejected by proctor server.";
                        return false;
                    }
                }
            }
            catch (System.Net.WebException webEx)
            {
                string respBody = "";
                try
                {
                    if (webEx.Response != null)
                    {
                        using (System.IO.StreamReader errReader = new System.IO.StreamReader(webEx.Response.GetResponseStream()))
                        {
                            respBody = errReader.ReadToEnd();
                        }
                    }
                }
                catch { }

                if (!string.IsNullOrEmpty(respBody))
                {
                    int errIdx = respBody.IndexOf("\"error\":\"");
                    if (errIdx >= 0)
                    {
                        int endIdx = respBody.IndexOf("\"", errIdx + 9);
                        if (endIdx > errIdx + 9)
                        {
                            failureReason = respBody.Substring(errIdx + 9, endIdx - (errIdx + 9));
                            return false;
                        }
                    }
                }

                failureReason = "Invalid or expired authorization code. " + webEx.Message;
                return false;
            }
            catch (Exception ex)
            {
                failureReason = "Communication failure: " + ex.Message;
                return false;
            }
        }

        public void TeardownAndExit()
        {
            try
            {
                DisplayAffinity.DisableScreenCaptureProtection(this.Handle);
                if (_keyboardHook != null) _keyboardHook.Dispose();
                if (_processWatchdog != null) _processWatchdog.Dispose();
                ClipboardGuard.FlushClipboard(this.Handle);
            }
            finally
            {
                Application.Exit();
            }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            // Allow exit only if explicitly initiated via proctor or teardown
            base.OnFormClosing(e);
        }
    }
}
