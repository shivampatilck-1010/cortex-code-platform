using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Windows.Forms;
using Microsoft.Win32;

namespace CortexLockdown.Setup
{
    public static class SetupProgram
    {
        public const string AppName = "Cortex Lockdown";
        public const string AppVersion = "1.0.0-rc1.2";
        public const string Publisher = "Cortex Online Examination System";
        public const string ProtocolScheme = "cortex-lockdown";
        public const string ExpectedPayloadHash = "82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895";
        public const int ExpectedPayloadSize = 35840;

        public static string InstallDir
        {
            get
            {
                string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                return Path.Combine(localApp, "CortexLockdown");
            }
        }

        public static string TargetExePath
        {
            get { return Path.Combine(InstallDir, "CortexLockdown.exe"); }
        }

        public static string UninstallerPath
        {
            get { return Path.Combine(InstallDir, "uninstall.exe"); }
        }

        public static string LogFilePath
        {
            get { return Path.Combine(InstallDir, "install.log"); }
        }

        public static string StartMenuShortcutPath
        {
            get
            {
                string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                string programs = Path.Combine(appData, @"Microsoft\Windows\Start Menu\Programs");
                return Path.Combine(programs, "Cortex Lockdown.lnk");
            }
        }

        public static string DesktopShortcutPath
        {
            get
            {
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                return Path.Combine(desktop, "Cortex Lockdown.lnk");
            }
        }

        [STAThread]
        public static int Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            bool isSilent = false;
            bool isUninstall = false;
            bool launchAfter = false;

            for (int i = 0; i < args.Length; i++)
            {
                string arg = args[i].Trim().ToLowerInvariant();
                if (arg == "/s" || arg == "/silent" || arg == "--silent" || arg == "-s")
                {
                    isSilent = true;
                }
                else if (arg == "/u" || arg == "/uninstall" || arg == "--uninstall" || arg == "-u")
                {
                    isUninstall = true;
                }
                else if (arg == "/launch" || arg == "--launch")
                {
                    launchAfter = true;
                }
            }

            if (isUninstall)
            {
                return PerformUninstall(isSilent);
            }

            if (isSilent)
            {
                return PerformInstallSilent(launchAfter);
            }

            // Run interactive UI
            using (SetupWizardForm form = new SetupWizardForm())
            {
                Application.Run(form);
                return form.InstallSucceeded ? 0 : 1;
            }
        }

        public static void Log(string message)
        {
            try
            {
                if (!Directory.Exists(InstallDir))
                {
                    Directory.CreateDirectory(InstallDir);
                }
                string line = string.Format("[{0:yyyy-MM-dd HH:mm:ss}] {1}", DateTime.UtcNow, message);
                File.AppendAllText(LogFilePath, line + Environment.NewLine, Encoding.UTF8);
            }
            catch { }
        }

        public static bool CheckDotNetPrerequisite(out string detail)
        {
            detail = "Unknown";
            try
            {
                using (RegistryKey ndpKey = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full"))
                {
                    if (ndpKey != null)
                    {
                        object releaseVal = ndpKey.GetValue("Release");
                        if (releaseVal != null && releaseVal is int)
                        {
                            int rel = (int)releaseVal;
                            if (rel >= 528040)
                            {
                                detail = string.Format(".NET Framework 4.8+ Verified (Release {0})", rel);
                                return true;
                            }
                            detail = string.Format(".NET Framework older build detected (Release {0}). 4.8+ recommended.", rel);
                            return false;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                detail = "Prerequisite query error: " + ex.Message;
                return false;
            }
            detail = ".NET Framework 4.8 key not found in HKLM registry.";
            return false;
        }

        public static bool CheckWebView2Prerequisite(out string detail)
        {
            detail = "Available via system runtime";
            try
            {
                using (RegistryKey rk = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-F670AFA547F3}"))
                {
                    if (rk != null && rk.GetValue("pv") != null)
                    {
                        detail = "Microsoft Edge WebView2 Evergreen Runtime Verified (Machine)";
                        return true;
                    }
                }
                using (RegistryKey rkUser = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-F670AFA547F3}"))
                {
                    if (rkUser != null && rkUser.GetValue("pv") != null)
                    {
                        detail = "Microsoft Edge WebView2 Evergreen Runtime Verified (User)";
                        return true;
                    }
                }
            }
            catch { }
            return true; // Fallback to system edge
        }

        public static byte[] ExtractEmbeddedPayload()
        {
            Assembly asm = Assembly.GetExecutingAssembly();
            string[] names = asm.GetManifestResourceNames();
            string targetName = null;
            for (int i = 0; i < names.Length; i++)
            {
                if (names[i].EndsWith("Payload.exe", StringComparison.OrdinalIgnoreCase) ||
                    names[i].EndsWith("CortexLockdown-Hardened.exe", StringComparison.OrdinalIgnoreCase))
                {
                    targetName = names[i];
                    break;
                }
            }

            if (targetName == null && names.Length > 0)
            {
                targetName = names[0];
            }

            if (targetName == null)
            {
                throw new InvalidOperationException("Embedded application payload was not found inside the installer binary.");
            }

            using (Stream s = asm.GetManifestResourceStream(targetName))
            {
                if (s == null)
                {
                    throw new InvalidOperationException("Cannot read embedded manifest resource stream: " + targetName);
                }
                byte[] buffer = new byte[s.Length];
                int read = 0;
                while (read < buffer.Length)
                {
                    int r = s.Read(buffer, read, buffer.Length - read);
                    if (r <= 0) break;
                    read += r;
                }
                return buffer;
            }
        }

        public static string ComputeSha256(byte[] data)
        {
            using (SHA256 sha = SHA256.Create())
            {
                byte[] hash = sha.ComputeHash(data);
                StringBuilder sb = new StringBuilder(hash.Length * 2);
                for (int i = 0; i < hash.Length; i++)
                {
                    sb.Append(hash[i].ToString("X2"));
                }
                return sb.ToString();
            }
        }

        public static void RegisterProtocol(string targetExe)
        {
            string rootKeyPath = @"Software\Classes\" + ProtocolScheme;
            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(rootKeyPath))
            {
                if (key == null) throw new InvalidOperationException("Failed to create protocol registry key in HKCU.");
                key.SetValue("", "URL:Cortex Lockdown Secure Protocol", RegistryValueKind.String);
                key.SetValue("URL Protocol", "", RegistryValueKind.String);

                using (RegistryKey iconKey = key.CreateSubKey("DefaultIcon"))
                {
                    if (iconKey != null)
                    {
                        iconKey.SetValue("", string.Format("\"{0}\",0", targetExe), RegistryValueKind.String);
                    }
                }

                using (RegistryKey cmdKey = key.CreateSubKey(@"shell\open\command"))
                {
                    if (cmdKey != null)
                    {
                        cmdKey.SetValue("", string.Format("\"{0}\" \"%1\"", targetExe), RegistryValueKind.String);
                    }
                }
            }
        }

        public static void RegisterUninstall(string installDir, string exePath, string uninstallerPath)
        {
            string unKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\CortexLockdown";
            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(unKeyPath))
            {
                if (key == null) return;
                key.SetValue("DisplayName", AppName, RegistryValueKind.String);
                key.SetValue("DisplayVersion", AppVersion, RegistryValueKind.String);
                key.SetValue("Publisher", Publisher, RegistryValueKind.String);
                key.SetValue("InstallLocation", installDir, RegistryValueKind.String);
                key.SetValue("UninstallString", string.Format("\"{0}\" /uninstall", uninstallerPath), RegistryValueKind.String);
                key.SetValue("QuietUninstallString", string.Format("\"{0}\" /uninstall /silent", uninstallerPath), RegistryValueKind.String);
                key.SetValue("DisplayIcon", string.Format("\"{0}\",0", exePath), RegistryValueKind.String);
                key.SetValue("HelpLink", "https://cortex-code-platform-staging.cortexbuild1.workers.dev/lockdown", RegistryValueKind.String);
                key.SetValue("URLInfoAbout", "https://cortex-code-platform-staging.cortexbuild1.workers.dev", RegistryValueKind.String);
                key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                key.SetValue("EstimatedSize", 72, RegistryValueKind.DWord);
            }
        }

        public static void CreateShortcut(string shortcutPath, string targetExe, string workDir, string desc)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    object shell = Activator.CreateInstance(shellType);
                    object shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath });
                    if (shortcut != null)
                    {
                        Type scType = shortcut.GetType();
                        scType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { targetExe });
                        scType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { workDir });
                        scType.InvokeMember("Description", BindingFlags.SetProperty, null, shortcut, new object[] { desc });
                        scType.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
                    }
                }
            }
            catch (Exception ex)
            {
                Log("Warning: Could not create shortcut via WScript.Shell: " + ex.Message);
            }
        }

        public static int PerformInstallSilent(bool launchAfter)
        {
            try
            {
                Log("Silent installation initiated.");
                if (!Directory.Exists(InstallDir))
                {
                    Directory.CreateDirectory(InstallDir);
                }

                byte[] payloadBytes = ExtractEmbeddedPayload();
                string payloadHash = ComputeSha256(payloadBytes);
                if (payloadHash != ExpectedPayloadHash)
                {
                    Log("CRITICAL: Embedded payload hash mismatch. Expected: " + ExpectedPayloadHash + ", Actual: " + payloadHash);
                    return 2;
                }

                File.WriteAllBytes(TargetExePath, payloadBytes);
                Log(string.Format("Payload written to {0} ({1} bytes, SHA-256: {2})", TargetExePath, payloadBytes.Length, payloadHash));

                File.WriteAllText(Path.Combine(InstallDir, "sha256.txt"), payloadHash, Encoding.ASCII);

                // Copy installer as uninstaller
                string currentExe = Application.ExecutablePath;
                if (File.Exists(currentExe))
                {
                    try
                    {
                        File.Copy(currentExe, UninstallerPath, true);
                    }
                    catch { }
                }

                RegisterProtocol(TargetExePath);
                Log("Protocol cortex-lockdown:// registered successfully.");

                CreateShortcut(StartMenuShortcutPath, TargetExePath, InstallDir, "Cortex Lockdown Secure Assessment Client");
                CreateShortcut(DesktopShortcutPath, TargetExePath, InstallDir, "Cortex Lockdown Secure Assessment Client");
                Log("Start Menu and Desktop shortcuts created.");

                RegisterUninstall(InstallDir, TargetExePath, UninstallerPath);
                Log("Add/Remove Programs entry registered.");

                Log("Silent installation completed successfully.");

                if (launchAfter)
                {
                    Process.Start(new ProcessStartInfo(TargetExePath));
                }
                return 0;
            }
            catch (Exception ex)
            {
                Log("Silent installation failed with error: " + ex.ToString());
                return 1;
            }
        }

        public static int PerformUninstall(bool isSilent)
        {
            try
            {
                Log("Uninstallation initiated.");

                // 1. Unregister protocol
                try
                {
                    Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\" + ProtocolScheme, false);
                    Log("Protocol unregister completed.");
                }
                catch { }

                // 2. Unregister Add/Remove Programs
                try
                {
                    Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\CortexLockdown", false);
                    Log("Add/Remove Programs registry entry deleted.");
                }
                catch { }

                // 3. Remove shortcuts
                try
                {
                    if (File.Exists(StartMenuShortcutPath)) File.Delete(StartMenuShortcutPath);
                    if (File.Exists(DesktopShortcutPath)) File.Delete(DesktopShortcutPath);
                    Log("Shortcuts deleted.");
                }
                catch { }

                // 4. Remove executable and metadata
                try
                {
                    if (File.Exists(TargetExePath)) File.Delete(TargetExePath);
                    string shaFile = Path.Combine(InstallDir, "sha256.txt");
                    if (File.Exists(shaFile)) File.Delete(shaFile);
                    Log("Application executable removed.");
                }
                catch { }

                // 5. Check offline examination answer store preservation
                string secureStorageDir = Path.Combine(InstallDir, "SecureStorage");
                if (Directory.Exists(secureStorageDir))
                {
                    Log("IMPORTANT: Preserving student offline encrypted examination store in " + secureStorageDir + " for academic appeals.");
                    if (!isSilent)
                    {
                        MessageBox.Show(
                            "Cortex Lockdown has been uninstalled successfully.\n\nNote: Student offline encrypted answer records in SecureStorage have been preserved to support academic review windows.",
                            "Cortex Lockdown Uninstalled",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Information
                        );
                    }
                }
                else
                {
                    try
                    {
                        string logFile = LogFilePath;
                        if (File.Exists(logFile)) File.Delete(logFile);
                        if (Directory.Exists(InstallDir))
                        {
                            Directory.Delete(InstallDir, true);
                        }
                    }
                    catch { }

                    if (!isSilent)
                    {
                        MessageBox.Show(
                            "Cortex Lockdown has been uninstalled successfully.",
                            "Cortex Lockdown Uninstalled",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Information
                        );
                    }
                }

                return 0;
            }
            catch (Exception ex)
            {
                if (!isSilent)
                {
                    MessageBox.Show(
                        "Error during uninstallation: " + ex.Message,
                        "Uninstallation Error",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                }
                return 1;
            }
        }
    }

    public class SetupWizardForm : Form
    {
        public bool InstallSucceeded { get; private set; }

        private Label lblHeaderTitle;
        private Label lblHeaderSubtitle;
        private Panel pnlHeader;
        private Panel pnlFooter;
        private Button btnInstall;
        private Button btnCancel;
        private CheckBox chkLaunch;
        private CheckBox chkDesktopShortcut;
        private Label lblDotNetStatus;
        private Label lblWebViewStatus;
        private Label lblInstallDir;
        private Label lblProtocolStatus;
        private ProgressBar progressBar;
        private Label lblProgressStatus;

        public SetupWizardForm()
        {
            InstallSucceeded = false;
            InitializeComponent();
            CheckPrerequisites();
        }

        private void InitializeComponent()
        {
            this.Text = "Cortex Lockdown Setup - v" + SetupProgram.AppVersion;
            this.ClientSize = new Size(520, 420);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(11, 12, 16); // #0B0C10
            this.ForeColor = Color.White;
            this.Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);

            // Header Panel
            pnlHeader = new Panel();
            pnlHeader.Dock = DockStyle.Top;
            pnlHeader.Height = 70;
            pnlHeader.BackColor = Color.FromArgb(18, 19, 22); // #121316

            lblHeaderTitle = new Label();
            lblHeaderTitle.Text = "Cortex Lockdown Setup";
            lblHeaderTitle.Font = new Font("Segoe UI", 13F, FontStyle.Bold, GraphicsUnit.Point);
            lblHeaderTitle.ForeColor = Color.FromArgb(255, 145, 0); // #FF9100
            lblHeaderTitle.Location = new Point(20, 12);
            lblHeaderTitle.AutoSize = true;

            lblHeaderSubtitle = new Label();
            lblHeaderSubtitle.Text = "Dedicated Assessment Security Client (Windows 10/11 x64)";
            lblHeaderSubtitle.Font = new Font("Segoe UI", 8.5F, FontStyle.Regular, GraphicsUnit.Point);
            lblHeaderSubtitle.ForeColor = Color.FromArgb(156, 163, 175);
            lblHeaderSubtitle.Location = new Point(21, 38);
            lblHeaderSubtitle.AutoSize = true;

            pnlHeader.Controls.Add(lblHeaderTitle);
            pnlHeader.Controls.Add(lblHeaderSubtitle);

            // Footer Panel
            pnlFooter = new Panel();
            pnlFooter.Dock = DockStyle.Bottom;
            pnlFooter.Height = 55;
            pnlFooter.BackColor = Color.FromArgb(18, 19, 22); // #121316

            btnInstall = new Button();
            btnInstall.Text = "Install";
            btnInstall.Size = new Size(110, 32);
            btnInstall.Location = new Point(280, 11);
            btnInstall.BackColor = Color.FromArgb(255, 145, 0); // #FF9100
            btnInstall.ForeColor = Color.Black;
            btnInstall.FlatStyle = FlatStyle.Flat;
            btnInstall.FlatAppearance.BorderSize = 0;
            btnInstall.Font = new Font("Segoe UI", 9F, FontStyle.Bold, GraphicsUnit.Point);
            btnInstall.Click += BtnInstall_Click;

            btnCancel = new Button();
            btnCancel.Text = "Cancel";
            btnCancel.Size = new Size(100, 32);
            btnCancel.Location = new Point(400, 11);
            btnCancel.BackColor = Color.FromArgb(30, 32, 40);
            btnCancel.ForeColor = Color.FromArgb(220, 220, 220);
            btnCancel.FlatStyle = FlatStyle.Flat;
            btnCancel.FlatAppearance.BorderSize = 0;
            btnCancel.Click += (s, e) => { this.Close(); };

            pnlFooter.Controls.Add(btnInstall);
            pnlFooter.Controls.Add(btnCancel);

            // Body Controls
            int y = 85;

            Label lblIntro = new Label();
            lblIntro.Text = "This setup will install Cortex Lockdown on your local workstation and register the secure browser handoff protocol.";
            lblIntro.Location = new Point(20, y);
            lblIntro.Size = new Size(480, 30);
            lblIntro.ForeColor = Color.FromArgb(209, 213, 219);
            y += 35;

            // Details group box
            GroupBox grpDetails = new GroupBox();
            grpDetails.Text = "System Readiness & Installation Specifications";
            grpDetails.Location = new Point(20, y);
            grpDetails.Size = new Size(480, 160);
            grpDetails.ForeColor = Color.FromArgb(0, 229, 255); // #00E5FF

            lblDotNetStatus = new Label();
            lblDotNetStatus.Location = new Point(15, 24);
            lblDotNetStatus.Size = new Size(450, 20);
            lblDotNetStatus.ForeColor = Color.FromArgb(229, 231, 235);

            lblWebViewStatus = new Label();
            lblWebViewStatus.Location = new Point(15, 48);
            lblWebViewStatus.Size = new Size(450, 20);
            lblWebViewStatus.ForeColor = Color.FromArgb(229, 231, 235);

            lblInstallDir = new Label();
            lblInstallDir.Text = "Install Location: " + SetupProgram.InstallDir;
            lblInstallDir.Location = new Point(15, 72);
            lblInstallDir.Size = new Size(450, 20);
            lblInstallDir.ForeColor = Color.FromArgb(156, 163, 175);

            lblProtocolStatus = new Label();
            lblProtocolStatus.Text = "Protocol Handler: cortex-lockdown:// (Registered in HKCU)";
            lblProtocolStatus.Location = new Point(15, 96);
            lblProtocolStatus.Size = new Size(450, 20);
            lblProtocolStatus.ForeColor = Color.FromArgb(156, 163, 175);

            Label lblPrivileges = new Label();
            lblPrivileges.Text = "Execution Privilege: Per-User Unprivileged (asInvoker, No Admin Required)";
            lblPrivileges.Location = new Point(15, 120);
            lblPrivileges.Size = new Size(450, 20);
            lblPrivileges.ForeColor = Color.FromArgb(156, 163, 175);

            grpDetails.Controls.Add(lblDotNetStatus);
            grpDetails.Controls.Add(lblWebViewStatus);
            grpDetails.Controls.Add(lblInstallDir);
            grpDetails.Controls.Add(lblProtocolStatus);
            grpDetails.Controls.Add(lblPrivileges);
            y += 170;

            chkDesktopShortcut = new CheckBox();
            chkDesktopShortcut.Text = "Create Desktop shortcut";
            chkDesktopShortcut.Checked = true;
            chkDesktopShortcut.Location = new Point(20, y);
            chkDesktopShortcut.AutoSize = true;
            chkDesktopShortcut.ForeColor = Color.FromArgb(229, 231, 235);

            chkLaunch = new CheckBox();
            chkLaunch.Text = "Launch Cortex Lockdown upon completion";
            chkLaunch.Checked = false;
            chkLaunch.Location = new Point(220, y);
            chkLaunch.AutoSize = true;
            chkLaunch.ForeColor = Color.FromArgb(229, 231, 235);
            y += 30;

            progressBar = new ProgressBar();
            progressBar.Location = new Point(20, y);
            progressBar.Size = new Size(480, 14);
            progressBar.Visible = false;

            lblProgressStatus = new Label();
            lblProgressStatus.Location = new Point(20, y + 18);
            lblProgressStatus.Size = new Size(480, 20);
            lblProgressStatus.ForeColor = Color.FromArgb(255, 145, 0);
            lblProgressStatus.Text = "Ready to install.";

            this.Controls.Add(pnlHeader);
            this.Controls.Add(lblIntro);
            this.Controls.Add(grpDetails);
            this.Controls.Add(chkDesktopShortcut);
            this.Controls.Add(chkLaunch);
            this.Controls.Add(progressBar);
            this.Controls.Add(lblProgressStatus);
            this.Controls.Add(pnlFooter);
        }

        private void CheckPrerequisites()
        {
            string dotNetDetail;
            bool dotNetOk = SetupProgram.CheckDotNetPrerequisite(out dotNetDetail);
            lblDotNetStatus.Text = ".NET Framework: " + dotNetDetail;
            if (!dotNetOk)
            {
                lblDotNetStatus.ForeColor = Color.FromArgb(251, 191, 36); // Amber
            }

            string webViewDetail;
            SetupProgram.CheckWebView2Prerequisite(out webViewDetail);
            lblWebViewStatus.Text = "WebView2: " + webViewDetail;
        }

        private void BtnInstall_Click(object sender, EventArgs e)
        {
            btnInstall.Enabled = false;
            btnCancel.Enabled = false;
            progressBar.Visible = true;
            progressBar.Value = 20;
            lblProgressStatus.Text = "Extracting verified executable payload...";
            Application.DoEvents();

            try
            {
                byte[] payload = SetupProgram.ExtractEmbeddedPayload();
                progressBar.Value = 40;
                lblProgressStatus.Text = "Verifying payload cryptographic integrity...";
                Application.DoEvents();

                string hash = SetupProgram.ComputeSha256(payload);
                if (hash != SetupProgram.ExpectedPayloadHash)
                {
                    throw new InvalidOperationException("Payload hash mismatch. Expected: " + SetupProgram.ExpectedPayloadHash + ", Computed: " + hash);
                }

                if (!Directory.Exists(SetupProgram.InstallDir))
                {
                    Directory.CreateDirectory(SetupProgram.InstallDir);
                }

                progressBar.Value = 60;
                lblProgressStatus.Text = "Writing application files...";
                Application.DoEvents();

                File.WriteAllBytes(SetupProgram.TargetExePath, payload);
                File.WriteAllText(Path.Combine(SetupProgram.InstallDir, "sha256.txt"), hash, Encoding.ASCII);

                // Copy uninstaller
                try
                {
                    File.Copy(Application.ExecutablePath, SetupProgram.UninstallerPath, true);
                }
                catch { }

                progressBar.Value = 80;
                lblProgressStatus.Text = "Configuring protocol handler and shortcuts...";
                Application.DoEvents();

                SetupProgram.RegisterProtocol(SetupProgram.TargetExePath);
                SetupProgram.CreateShortcut(SetupProgram.StartMenuShortcutPath, SetupProgram.TargetExePath, SetupProgram.InstallDir, "Cortex Lockdown Secure Assessment Client");
                if (chkDesktopShortcut.Checked)
                {
                    SetupProgram.CreateShortcut(SetupProgram.DesktopShortcutPath, SetupProgram.TargetExePath, SetupProgram.InstallDir, "Cortex Lockdown Secure Assessment Client");
                }
                SetupProgram.RegisterUninstall(SetupProgram.InstallDir, SetupProgram.TargetExePath, SetupProgram.UninstallerPath);

                progressBar.Value = 100;
                lblProgressStatus.Text = "Installation complete.";
                SetupProgram.Log("Interactive installation completed successfully.");
                InstallSucceeded = true;

                if (chkLaunch.Checked)
                {
                    Process.Start(new ProcessStartInfo(SetupProgram.TargetExePath));
                }

                MessageBox.Show(
                    "Cortex Lockdown has been successfully installed on your computer.\n\nYou may now launch assessments directly from the Cortex Classroom portal.",
                    "Installation Complete",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );

                this.Close();
            }
            catch (Exception ex)
            {
                SetupProgram.Log("Installation error: " + ex.ToString());
                MessageBox.Show(
                    "Installation failed: " + ex.Message,
                    "Setup Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                btnInstall.Enabled = true;
                btnCancel.Enabled = true;
                lblProgressStatus.Text = "Installation failed.";
            }
        }
    }
}
