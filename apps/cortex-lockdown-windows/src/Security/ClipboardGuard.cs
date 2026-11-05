using System;

namespace CortexLockdown.Security
{
    public static class ClipboardGuard
    {
        public static bool FlushClipboard(IntPtr hWnd)
        {
            if (Win32Native.OpenClipboard(hWnd))
            {
                try
                {
                    return Win32Native.EmptyClipboard();
                }
                finally
                {
                    Win32Native.CloseClipboard();
                }
            }
            return false;
        }
    }
}
