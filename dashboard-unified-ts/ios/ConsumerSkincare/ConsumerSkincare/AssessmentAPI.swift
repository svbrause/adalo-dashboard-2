import Foundation

/// Mirrors `AIAssessmentPayload` in `src/services/api.ts` for `POST /api/assessment`.
struct AIAssessmentPayload: Encodable {
    let overall: Int
    let categories: [CategoryRow]
    let focusCount: Int
    let detectedIssues: [String]
    let patientOverviewSummary: String?

    struct CategoryRow: Encodable {
        let name: String
        let score: Int
        let tier: String
    }
}

enum AssessmentAPI {
    /// Same default host as the Vite app (`VITE_BACKEND_API_URL`).
    static var baseURL: String {
        UserDefaults.standard.string(forKey: "consumerSkincareBackendURL")
            ?? "https://ponce-patient-backend.vercel.app"
    }

    /// Converts quiz section scores into scores the backend expects and returns personalized copy when available.
    static func fetchPersonalizedOverview(
        profile: SkinProfile,
        patientSummary: String
    ) async -> String? {
        let overall = Self.overallScore(from: profile.scores)
        let categories = Self.categoryRows(from: profile.scores)
        let focusCount = max(1, categories.filter { $0.tier != "Balanced" }.count)
        let issues = Self.detectedIssues(for: profile)

        let payload = AIAssessmentPayload(
            overall: overall,
            categories: categories,
            focusCount: focusCount,
            detectedIssues: issues,
            patientOverviewSummary: patientSummary
        )

        guard let url = URL(string: "\(baseURL)/api/assessment") else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 28

        do {
            req.httpBody = try JSONEncoder().encode(payload)
            let (data, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
            let decoded = try JSONDecoder().decode(AssessmentResponse.self, from: data)
            let text = decoded.assessment?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return text.isEmpty ? nil : text
        } catch {
            return nil
        }
    }

    private struct AssessmentResponse: Decodable {
        let assessment: String?
    }

    private static func overallScore(from scores: [QuizSectionId: Int]) -> Int {
        let h = normalize(scores[.hydration] ?? 12, min: 5, max: 20)
        let r = normalize(scores[.reactivity] ?? 15, min: 6, max: 24)
        let p = normalize(scores[.pigmentation] ?? 12, min: 5, max: 20)
        return (h + r + p) / 3
    }

    private static func normalize(_ v: Int, min lo: Int, max hi: Int) -> Int {
        let clamped = Swift.max(lo, Swift.min(hi, v))
        return Int(round(100 * (1 - Double(clamped - lo) / Double(hi - lo))))
    }

    /// Higher reactivity score in the quiz means *less* sensitivity; invert for consumer "sensitivity" axis.
    private static func categoryRows(from scores: [QuizSectionId: Int]) -> [AIAssessmentPayload.CategoryRow] {
        let hydration = scores[.hydration] ?? 12
        let reactivity = scores[.reactivity] ?? 15
        let pigment = scores[.pigmentation] ?? 12

        let moisture = tierForHydration(hydration)
        let resilience = tierForReactivity(resistancePoints: reactivity)
        let evenTone = tierForPigmentation(pigment)

        return [
            AIAssessmentPayload.CategoryRow(
                name: "Hydration balance",
                score: normalize(hydration, min: 5, max: 20),
                tier: moisture.rawValue
            ),
            AIAssessmentPayload.CategoryRow(
                name: "Calm & resilience",
                score: normalize(reactivity, min: 6, max: 24),
                tier: resilience.rawValue
            ),
            AIAssessmentPayload.CategoryRow(
                name: "Even tone clarity",
                score: normalize(pigment, min: 5, max: 20),
                tier: evenTone.rawValue
            ),
        ]
    }

    private enum SimpleTier: String {
        case focus = "Focus"
        case balanced = "Balanced"
        case strength = "Strength"
    }

    private static func tierForHydration(_ h: Int) -> SimpleTier {
        if h <= 9 { return .focus }
        if h <= 14 { return .balanced }
        return .strength
    }

    private static func tierForReactivity(resistancePoints r: Int) -> SimpleTier {
        if r <= 12 { return .focus }
        if r <= 18 { return .balanced }
        return .strength
    }

    private static func tierForPigmentation(_ p: Int) -> SimpleTier {
        if p <= 9 { return .focus }
        if p <= 14 { return .balanced }
        return .strength
    }

    private static func detectedIssues(for profile: SkinProfile) -> [String] {
        let h = profile.sectionLetters[.hydration] ?? "O"
        let r = profile.sectionLetters[.reactivity] ?? "R"
        let p = profile.sectionLetters[.pigmentation] ?? "N"
        var issues: [String] = []
        if h == "O" { issues.append("Shine & congestion in the T-zone") }
        if h == "D" { issues.append("Dryness and barrier support") }
        if r == "S" { issues.append("Sensitivity and reactivity") }
        if p == "P" { issues.append("Dark spots and uneven tone") }
        if issues.isEmpty { issues.append("Maintenance and healthy-aging support") }
        return issues
    }
}
