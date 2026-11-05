using System;

namespace CortexLockdown.Security
{
    public static class DisplayAffinity
    {
        public static bool EnableScreenCaptureProtection(IntPtr hWnd)
        {
            if (hWnd == IntPtr.Zero) return false;

            // Attempt WDA_EXCLUDEFROMCAPTURE (Windows 10 2004+)
            bool result = Win32Native.SetWindowDisplayAffinity(hWnd, Win32Native.WDA_EXCLUDEFROMCAPTURE);
            if (!result)
            {
                // Fall back to WDA_MONITOR (Windows 7 / 8 / early 10)
                result = Win32Native.SetWindowDisplayAffinity(hWnd, Win32Native.WDA_MONITOR);
            }

            return result;
        }

        public static bool DisableScreenCaptureProtection(IntPtr hWnd)
        {
            if (hWnd == IntPtr.Zero) return false;
            return Win32Native.SetWindowDisplayAffinity(hWnd, Win32Native.WDA_NONE);
        }
    }
}
