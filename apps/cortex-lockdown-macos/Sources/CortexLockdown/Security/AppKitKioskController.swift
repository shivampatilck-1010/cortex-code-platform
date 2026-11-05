import AppKit

public class AppKitKioskController {
    public static let shared = AppKitKioskController()

    public func activateKiosk() {
        let options: NSApplication.PresentationOptions = [
            .hideDock,
            .hideMenuBar,
            .disableProcessSwitching,
            .disableForceQuit,
            .disableSessionTermination,
            .disableAppleMenu,
            .autoHideToolbar
        ]
        NSApp.presentationOptions = options
    }

    public func deactivateKiosk() {
        NSApp.presentationOptions = []
    }
}
