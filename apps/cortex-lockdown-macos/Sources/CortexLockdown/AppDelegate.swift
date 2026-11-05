import AppKit
import WebKit

public class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var aacController: AppleAssessmentController?

    public func applicationDidFinishLaunching(_ notification: Notification) {
        let screenRect = NSScreen.main?.frame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        
        window = NSWindow(
            contentRect: screenRect,
            styleMask: [.borderless, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        
        WindowProtector.configureShieldedWindow(window)
        AppKitKioskController.shared.activateKiosk()
        PasteboardGuard.flushPasteboard()

        // Configure Hardened WebKit
        let preferences = WKWebpagePreferences()
        preferences.allowsContentJavaScript = true

        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences = preferences
        config.allowsAirPlayForMediaPlayback = false

        // Inject script to block right-click and dragging
        let blockScript = WKUserScript(
            source: "document.addEventListener('contextmenu', e => e.preventDefault(), true); document.addEventListener('dragstart', e => e.preventDefault(), true);",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        config.userContentController.addUserScript(blockScript)

        webView = WKWebView(frame: screenRect, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        window.contentView = webView

        // Load Default Workspace or Target URL
        let targetUrl = URL(string: "https://cortex-code-platform.cortexbuild1.workers.dev/lockdown/workspace")!
        webView.load(URLRequest(url: targetUrl))

        // Attempt Apple Assessment Session (AAC)
        if #available(macOS 12.0, *) {
            aacController = AppleAssessmentController()
            aacController?.beginAssessment()
        }
    }

    // Handle custom protocol invocation cortex-lockdown://launch?examId=...&grant=...
    public func application(_ application: NSApplication, open urls: [URL]) {
        guard let url = urls.first else { return }
        guard url.scheme?.lowercased() == "cortex-lockdown" else { return }

        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: true) else { return }
        var targetUrlString = "https://cortex-code-platform.cortexbuild1.workers.dev/lockdown/workspace"
        var queryParams: [String] = []

        if let queryItems = components.queryItems {
            for item in queryItems {
                let name = item.name.lowercased()
                if let val = item.value {
                    if name == "url" || name == "targeturl" {
                        targetUrlString = val
                    } else if name == "examid" || name == "exam-id" {
                        queryParams.append("examId=\(val)")
                    } else if name == "grant" || name == "launchgrant" {
                        queryParams.append("launchGrant=\(val)")
                    }
                }
            }
        }

        if !queryParams.isEmpty {
            let sep = targetUrlString.contains("?") ? "&" : "?"
            targetUrlString += sep + queryParams.joined(separator: "&")
        }

        if let finalUrl = URL(string: targetUrlString) {
            webView?.load(URLRequest(url: finalUrl))
        }
    }

    public func applicationWillTerminate(_ notification: Notification) {
        AppKitKioskController.shared.deactivateKiosk()
        PasteboardGuard.flushPasteboard()
        if #available(macOS 12.0, *) {
            aacController?.endAssessment()
        }
    }
}
