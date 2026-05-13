import Foundation

/// Lightweight onboarding aligned with `ios/planDraft.md` (goals, tone, openness, budget, timeline).
struct SkinIntake: Codable, Equatable {
    var goals: Set<SkinGoal>
    var fitzpatrick: Int?
    var openness: TreatmentOpenness
    var budget: BudgetComfort
    var downtime: DowntimeTolerance
    var timeline: CareTimeline
    var updatedAt: Date

    static let empty = SkinIntake(
        goals: [],
        fitzpatrick: nil,
        openness: .atHomeFirst,
        budget: .moderate,
        downtime: .minimal,
        timeline: .browsing,
        updatedAt: Date()
    )
}

enum SkinGoal: String, Codable, CaseIterable, Identifiable {
    case acne, texture, pores, redness, pigmentation, scarring, aging, glow, dryness, sensitivity

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .acne: return "Acne / breakouts"
        case .texture: return "Texture"
        case .pores: return "Pores"
        case .redness: return "Redness"
        case .pigmentation: return "Dark spots / tone"
        case .scarring: return "Scarring"
        case .aging: return "Lines / firmness"
        case .glow: return "Glow / dullness"
        case .dryness: return "Dryness"
        case .sensitivity: return "Sensitivity"
        }
    }
}

enum TreatmentOpenness: String, Codable, CaseIterable, Identifiable {
    case atHomeFirst
    case openToFacials
    case openToLasers
    case openToInjectables

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .atHomeFirst: return "At-home care first"
        case .openToFacials: return "Open to facials & peels"
        case .openToLasers: return "Open to lasers & energy devices"
        case .openToInjectables: return "Open to injectables too"
        }
    }
}

enum BudgetComfort: String, Codable, CaseIterable, Identifiable {
    case mindful, moderate, flexible
    var id: String { rawValue }
    var displayName: String {
        switch self {
        case .mindful: return "Budget-conscious"
        case .moderate: return "Balanced spend"
        case .flexible: return "Flexible for results"
        }
    }
}

enum DowntimeTolerance: String, Codable, CaseIterable, Identifiable {
    case none, minimal, okWithSocialDowntime
    var id: String { rawValue }
    var displayName: String {
        switch self {
        case .none: return "No visible downtime"
        case .minimal: return "1–3 days max"
        case .okWithSocialDowntime: return "Okay hiding out ~1 week"
        }
    }
}

enum CareTimeline: String, Codable, CaseIterable, Identifiable {
    case browsing, thisMonth, beforeEvent, maintenance
    var id: String { rawValue }
    var displayName: String {
        switch self {
        case .browsing: return "Just browsing"
        case .thisMonth: return "Acting this month"
        case .beforeEvent: return "Before an event"
        case .maintenance: return "Ongoing maintenance"
        }
    }
}
