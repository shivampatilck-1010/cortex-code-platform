import AppKit

public class PasteboardGuard {
    public static func flushPasteboard() {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
    }
}
