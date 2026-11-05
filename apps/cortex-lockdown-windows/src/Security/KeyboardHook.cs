using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace CortexLockdown.Security
{
    public class KeyboardHook : IDisposable
    {
        private IntPtr _hookId = IntPtr.Zero;
        private Win32Native.LowLevelKeyboardProc _proc;
        private bool _isDisposed = false;

        public event Action<string> OnBlockedKeyAttempt;
        public event Action OnEmergencyExitRequested;

        public KeyboardHook()
        {
            _proc = HookCallback;
        }

        public bool Install()
        {
            if (_hookId != IntPtr.Zero) return true;

            using (Process curProcess = Process.GetCurrentProcess())
            using (ProcessModule curModule = curProcess.MainModule)
            {
                IntPtr hModule = Win32Native.GetModuleHandle(curModule.ModuleName);
                _hookId = Win32Native.SetWindowsHookEx(Win32Native.WH_KEYBOARD_LL, _proc, hModule, 0);
            }

            return _hookId != IntPtr.Zero;
        }

        public void Uninstall()
        {
            if (_hookId != IntPtr.Zero)
            {
                Win32Native.UnhookWindowsHookEx(_hookId);
                _hookId = IntPtr.Zero;
            }
        }

        private void TriggerBlockedKey(string keyName)
        {
            if (OnBlockedKeyAttempt != null)
            {
                OnBlockedKeyAttempt(keyName);
            }
        }

        [DllImport("user32.dll")]
        private static extern short GetAsyncKeyState(int vKey);

        private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0)
            {
                Win32Native.KBDLLHOOKSTRUCT hookStruct = (Win32Native.KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(Win32Native.KBDLLHOOKSTRUCT));
                uint vkCode = hookStruct.vkCode;
                bool isAltDown = (hookStruct.flags & 0x20) != 0;
                bool isCtrlDown = (GetAsyncKeyState(Win32Native.VK_CONTROL) & 0x8000) != 0;
                bool isShiftDown = (GetAsyncKeyState(0x10) & 0x8000) != 0; // VK_SHIFT

                // 0. Proctor Emergency Exit Hotkey: Ctrl + Alt + F10 (VK_F10 = 0x79)
                if (vkCode == 0x79 && isCtrlDown && isAltDown)
                {
                    if (OnEmergencyExitRequested != null)
                    {
                        OnEmergencyExitRequested();
                    }
                    return (IntPtr)1; // Handled
                }

                // 1. Windows Key (LWIN / RWIN)
                if (vkCode == Win32Native.VK_LWIN || vkCode == Win32Native.VK_RWIN)
                {
                    TriggerBlockedKey("WindowsKey");
                    return (IntPtr)1; // Suppress
                }

                // 2. Alt + Tab (Application Switcher)
                if (vkCode == Win32Native.VK_TAB && isAltDown)
                {
                    TriggerBlockedKey("AltTab");
                    return (IntPtr)1; // Suppress
                }

                // 3. Alt + Escape
                if (vkCode == Win32Native.VK_ESCAPE && isAltDown)
                {
                    TriggerBlockedKey("AltEscape");
                    return (IntPtr)1; // Suppress
                }

                // 4. Ctrl + Escape (Start Menu) or Ctrl + Shift + Escape (Task Manager)
                if (vkCode == Win32Native.VK_ESCAPE && isCtrlDown)
                {
                    TriggerBlockedKey(isShiftDown ? "CtrlShiftEscape_TaskMgr" : "CtrlEscape_StartMenu");
                    return (IntPtr)1; // Suppress
                }

                // 5. Alt + F4 (Window Close)
                if (vkCode == Win32Native.VK_F4 && isAltDown)
                {
                    TriggerBlockedKey("AltF4");
                    return (IntPtr)1; // Suppress
                }

                // 6. PrintScreen (Screen Capture)
                if (vkCode == Win32Native.VK_SNAPSHOT)
                {
                    TriggerBlockedKey("PrintScreen");
                    return (IntPtr)1; // Suppress
                }

                // 7. Developer Tools Hotkeys (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U)
                if (vkCode == Win32Native.VK_F12)
                {
                    TriggerBlockedKey("F12_DevTools");
                    return (IntPtr)1; // Suppress
                }

                if (isCtrlDown && isShiftDown && (vkCode == 0x49 || vkCode == 0x4A)) // 'I' or 'J'
                {
                    TriggerBlockedKey("CtrlShift_DevTools");
                    return (IntPtr)1; // Suppress
                }

                if (isCtrlDown && vkCode == 0x55) // 'U' (View Source)
                {
                    TriggerBlockedKey("CtrlU_ViewSource");
                    return (IntPtr)1; // Suppress
                }
            }

            return Win32Native.CallNextHookEx(_hookId, nCode, wParam, lParam);
        }

        public void Dispose()
        {
            if (!_isDisposed)
            {
                Uninstall();
                _isDisposed = true;
            }
        }
    }
}
