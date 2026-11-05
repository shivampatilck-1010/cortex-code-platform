using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Win32;

namespace CortexLockdown.Security
{
    public class EnvironmentReport
    {
        public bool IsRemoteSession { get; set; }
        public int MonitorCount { get; set; }
        public string HardwareFingerprint { get; set; }
        public string ClientBinaryHash { get; set; }
        public bool IsVirtualMachine { get; set; }
        public string VmDetectionReason { get; set; }
    }

    public static class EnvironmentInspector
    {
        public static EnvironmentReport InspectEnvironment(string executablePath)
        {
            var report = new EnvironmentReport();

            // 1. Remote Session Inspection
            report.IsRemoteSession = Win32Native.GetSystemMetrics(Win32Native.SM_REMOTESESSION) != 0;

            // 2. Monitor Count Inspection
            report.MonitorCount = Win32Native.GetSystemMetrics(Win32Native.SM_CMONITORS);
            if (report.MonitorCount <= 0) report.MonitorCount = 1;

            // 3. Hardware Fingerprint
            string rawEntropy = Environment.MachineName + "_" + Environment.UserDomainName + "_" + Environment.ProcessorCount + "_" + Environment.OSVersion.VersionString;
            using (SHA256 sha = SHA256.Create())
            {
                byte[] hash = sha.ComputeHash(Encoding.UTF8.GetBytes(rawEntropy));
                report.HardwareFingerprint = BitConverter.ToString(hash).Replace("-", "").ToLower();
            }

            // 4. Client Binary Hash
            if (!string.IsNullOrEmpty(executablePath) && File.Exists(executablePath))
            {
                using (SHA256 sha = SHA256.Create())
                using (FileStream stream = File.OpenRead(executablePath))
                {
                    byte[] bHash = sha.ComputeHash(stream);
                    report.ClientBinaryHash = BitConverter.ToString(bHash).Replace("-", "").ToLower();
                }
            }
            else
            {
                report.ClientBinaryHash = "unknown";
            }

            // 5. Virtual Machine / Hypervisor Detection
            report.IsVirtualMachine = false;
            report.VmDetectionReason = "None (Bare-Metal)";

            try
            {
                // Check registry BIOS system information
                using (RegistryKey biosKey = Registry.LocalMachine.OpenSubKey(@"HARDWARE\DESCRIPTION\System\BIOS"))
                {
                    if (biosKey != null)
                    {
                        string sysManufacturer = (biosKey.GetValue("SystemManufacturer") as string ?? "").ToLower();
                        string sysProductName = (biosKey.GetValue("SystemProductName") as string ?? "").ToLower();
                        string biosVersion = (biosKey.GetValue("SystemBiosVersion") as string ?? "").ToLower();

                        string combined = sysManufacturer + " " + sysProductName + " " + biosVersion;
                        if (combined.Contains("vmware"))
                        {
                            report.IsVirtualMachine = true;
                            report.VmDetectionReason = "VMware BIOS Artifacts Detected";
                        }
                        else if (combined.Contains("virtualbox") || combined.Contains("vbox"))
                        {
                            report.IsVirtualMachine = true;
                            report.VmDetectionReason = "VirtualBox BIOS Artifacts Detected";
                        }
                        else if (combined.Contains("qemu") || combined.Contains("kvm"))
                        {
                            report.IsVirtualMachine = true;
                            report.VmDetectionReason = "QEMU/KVM Virtual Hardware Detected";
                        }
                    }
                }

                // Check hypervisor driver paths
                string sys32 = Environment.GetFolderPath(Environment.SpecialFolder.System);
                if (File.Exists(Path.Combine(sys32, @"drivers\VBoxMouse.sys")) ||
                    File.Exists(Path.Combine(sys32, @"drivers\VBoxGuest.sys")))
                {
                    report.IsVirtualMachine = true;
                    report.VmDetectionReason = "VirtualBox Guest Drivers Present";
                }
                else if (File.Exists(Path.Combine(sys32, @"drivers\vmmouse.sys")) ||
                         File.Exists(Path.Combine(sys32, @"drivers\vmhgfs.sys")))
                {
                    report.IsVirtualMachine = true;
                    report.VmDetectionReason = "VMware Tools Drivers Present";
                }
            }
            catch
            {
                // Ignore permissions on restricted registry hives
            }

            return report;
        }
    }
}
