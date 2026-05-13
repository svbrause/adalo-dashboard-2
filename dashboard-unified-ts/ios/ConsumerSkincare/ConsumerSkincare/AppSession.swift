import Foundation
import SwiftUI

/// Last on-device face map run (photo + Vision)—drives Scan tab insights and recommendations.
struct FaceScanSessionState: Equatable {
    var updatedAt: Date
    /// e.g. "Sample 3" or "Photo library" or "Web sample"
    var sourceSummary: String
    var landmarksFound: Bool
    /// Vision `VNFaceObservation.confidence` when landmarks exist, else 0.
    var faceConfidence: Float
}

/// Persists quiz outcome + optional skin intake (`planDraft.md` onboarding).
final class AppSession: ObservableObject {
    private static let outcomeKey = "consumerSkincareQuizOutcome"
    private static let intakeKey = "glowpathSkinIntake"

    @Published var outcome: QuizOutcome? {
        didSet { saveOutcome() }
    }

    @Published var skinIntake: SkinIntake? {
        didSet { saveIntake() }
    }

    /// In-memory only: updated when you load a photo on the Scan tab (sample, library, or web).
    @Published var faceScan: FaceScanSessionState?

    init() {
        outcome = Self.loadOutcome()
        skinIntake = Self.loadIntake()
    }

    func recordFaceScan(sourceSummary: String, landmarksFound: Bool, faceConfidence: Float) {
        faceScan = FaceScanSessionState(
            updatedAt: Date(),
            sourceSummary: sourceSummary,
            landmarksFound: landmarksFound,
            faceConfidence: faceConfidence
        )
    }

    func clearFaceScan() {
        faceScan = nil
    }

    private func saveOutcome() {
        guard let outcome else {
            UserDefaults.standard.removeObject(forKey: Self.outcomeKey)
            return
        }
        if let data = try? JSONEncoder().encode(outcome) {
            UserDefaults.standard.set(data, forKey: Self.outcomeKey)
        }
    }

    private func saveIntake() {
        guard let skinIntake else {
            UserDefaults.standard.removeObject(forKey: Self.intakeKey)
            return
        }
        if let data = try? JSONEncoder().encode(skinIntake) {
            UserDefaults.standard.set(data, forKey: Self.intakeKey)
        }
    }

    private static func loadOutcome() -> QuizOutcome? {
        guard let data = UserDefaults.standard.data(forKey: outcomeKey) else { return nil }
        return try? JSONDecoder().decode(QuizOutcome.self, from: data)
    }

    private static func loadIntake() -> SkinIntake? {
        guard let data = UserDefaults.standard.data(forKey: intakeKey) else { return nil }
        return try? JSONDecoder().decode(SkinIntake.self, from: data)
    }
}

struct QuizOutcome: Codable, Equatable {
    let completedAt: Date
    let answers: [String: Int]
    let profile: SkinProfile
    let resultLabel: String
    let resultDescription: String

    static func build(answers: [String: Int]) -> QuizOutcome {
        let profile = SkinQuizEngine.computeProfile(answers: answers)
        let summary = SkinQuizEngine.resultSummary(for: profile)
        return QuizOutcome(
            completedAt: Date(),
            answers: answers,
            profile: profile,
            resultLabel: summary.label,
            resultDescription: summary.description
        )
    }
}
