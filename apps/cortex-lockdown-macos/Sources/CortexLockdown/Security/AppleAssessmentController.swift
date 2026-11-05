import Foundation
import AutomaticAssessmentConfiguration

@available(macOS 12.0, *)
public class AppleAssessmentController: NSObject, AEAssessmentSessionDelegate {
    private var session: AEAssessmentSession?
    public private(set) var isActive: Bool = false
    public var onSessionInterrupted: (() -> Void)?
    public var onSessionFailed: ((Error) -> Void)?

    public func beginAssessment() {
        let configuration = AEAssessmentConfiguration()
        configuration.allowsSpellCheck = false
        configuration.allowsPredictiveKeyboard = false
        configuration.allowsKeyboardShortcuts = false
        configuration.allowsActivityContinuation = false
        configuration.allowsDictation = false
        configuration.allowsAccessibilitySpeech = false

        session = AEAssessmentSession(configuration: configuration)
        session?.delegate = self
        session?.begin()
    }

    public func endAssessment() {
        session?.end()
        session = nil
        isActive = false
    }

    public func assessmentSessionDidBegin(_ session: AEAssessmentSession) {
        isActive = true
    }

    public func assessmentSession(_ session: AEAssessmentSession, failedToBeginWithError error: Error) {
        isActive = false
        onSessionFailed?(error)
    }

    public func assessmentSession(_ session: AEAssessmentSession, wasInterruptedWithError error: Error) {
        onSessionInterrupted?()
    }
}
