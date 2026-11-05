import AppKit

public class WindowProtector {
    public static func configureShieldedWindow(_ window: NSWindow) {
        window.level = .floating
        window.styleMask = [.borderless, .fullSizeContentView]
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenPrimary]
        
        // Prevent window image from being captured via CGWindowListCreateImage / ScreenCaptureKit
        window.sharingType = .none
        
        if let screen = NSScreen.main {
            window.setFrame(screen.frame, display: true)
        }
        
        window.makeKeyAndOrderFront(nil)
    }
}
