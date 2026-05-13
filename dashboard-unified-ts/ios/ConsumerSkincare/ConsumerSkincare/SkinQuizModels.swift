import Foundation

enum GemstoneId: String, Codable, CaseIterable, Identifiable {
    case opal, pearl, jade, quartz, amber, moonstone, turquoise, diamond
    var id: String { rawValue }
}

enum QuizSectionId: String, Codable {
    case hydration, reactivity, pigmentation
}

struct QuizAnswerOption: Identifiable {
    let id = UUID()
    let label: String
    let points: Int
}

struct QuizQuestionModel: Identifiable {
    let id: String
    let title: String
    let section: QuizSectionId
    let question: String
    let answers: [QuizAnswerOption]
}

struct SkinProfile: Codable, Equatable {
    let primary: GemstoneId
    let scores: [QuizSectionId: Int]
    let sectionLetters: [QuizSectionId: String]

    enum CodingKeys: String, CodingKey {
        case primary, scores
    }

    init(primary: GemstoneId, scores: [QuizSectionId: Int], sectionLetters: [QuizSectionId: String]) {
        self.primary = primary
        self.scores = scores
        self.sectionLetters = sectionLetters
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        primary = try c.decode(GemstoneId.self, forKey: .primary)
        let rawScores = try c.decode([String: Int].self, forKey: .scores)
        let decodedScores = Dictionary(uniqueKeysWithValues: rawScores.compactMap { pair -> (QuizSectionId, Int)? in
            guard let section = QuizSectionId(rawValue: pair.key) else { return nil }
            return (section, pair.value)
        })
        let letters = QuizSectionId.allCases.reduce(into: [QuizSectionId: String]()) { dict, s in
            dict[s] = Self.letter(for: decodedScores[s] ?? 0, section: s)
        }
        scores = decodedScores
        sectionLetters = letters
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(primary, forKey: .primary)
        let raw = Dictionary(uniqueKeysWithValues: scores.map { ($0.key.rawValue, $0.value) })
        try c.encode(raw, forKey: .scores)
    }

    private static func letter(for score: Int, section: QuizSectionId) -> String {
        switch section {
        case .hydration: return (5 ... 10).contains(score) ? "D" : "O"
        case .reactivity: return (6 ... 15).contains(score) ? "S" : "R"
        case .pigmentation: return (5 ... 12).contains(score) ? "P" : "N"
        }
    }
}

extension QuizSectionId: CaseIterable {
    static var allCases: [QuizSectionId] { [.hydration, .reactivity, .pigmentation] }
}

enum SkinQuizEngine {
    static let questions: [QuizQuestionModel] = [
        QuizQuestionModel(
            id: "q1",
            title: "Hydration",
            section: .hydration,
            question: "When you wake up in the morning, your skin feels:",
            answers: [
                QuizAnswerOption(label: "Tight and in need of moisturizer", points: 1),
                QuizAnswerOption(label: "Comfortable and balanced", points: 2),
                QuizAnswerOption(label: "Slightly oily in some areas", points: 3),
                QuizAnswerOption(label: "Oily all over", points: 4),
            ]
        ),
        QuizQuestionModel(
            id: "q2",
            title: "Hydration",
            section: .hydration,
            question: "By midday, your T-zone (forehead, nose, chin):",
            answers: [
                QuizAnswerOption(label: "Still feels tight or normal", points: 1),
                QuizAnswerOption(label: "Has a slight shine", points: 2),
                QuizAnswerOption(label: "Is noticeably shiny", points: 3),
                QuizAnswerOption(label: "Is very oily and shiny", points: 4),
            ]
        ),
        QuizQuestionModel(
            id: "q3",
            title: "Hydration",
            section: .hydration,
            question: "How does your skin feel 2-3 hours after cleansing (without moisturizer)?",
            answers: [
                QuizAnswerOption(label: "Very tight and uncomfortable", points: 1),
                QuizAnswerOption(label: "Slightly tight", points: 2),
                QuizAnswerOption(label: "Comfortable", points: 3),
                QuizAnswerOption(label: "Already showing oil", points: 4),
            ]
        ),
        QuizQuestionModel(
            id: "q4",
            title: "Hydration",
            section: .hydration,
            question: "Your pores are:",
            answers: [
                QuizAnswerOption(label: "Barely visible", points: 1),
                QuizAnswerOption(label: "Small and fine", points: 2),
                QuizAnswerOption(label: "Visible, especially on nose and cheeks", points: 3),
                QuizAnswerOption(label: "Large and visible across face", points: 4),
            ]
        ),
        QuizQuestionModel(
            id: "q5",
            title: "Hydration",
            section: .hydration,
            question: "How often do you typically need to moisturize?",
            answers: [
                QuizAnswerOption(label: "Multiple times a day", points: 1),
                QuizAnswerOption(label: "Twice daily (morning and night)", points: 2),
                QuizAnswerOption(label: "Once daily", points: 3),
                QuizAnswerOption(label: "Rarely or only occasionally", points: 4),
            ]
        ),
        QuizQuestionModel(
            id: "q6",
            title: "Reactivity",
            section: .reactivity,
            question: "When trying new skincare products, your skin:",
            answers: [
                QuizAnswerOption(label: "Often breaks out, stings, or gets irritated", points: 1),
                QuizAnswerOption(label: "Sometimes reacts but usually adjusts", points: 2),
                QuizAnswerOption(label: "Rarely has reactions", points: 3),
                QuizAnswerOption(label: "Can handle almost anything", points: 4),
            ]
        ),
        QuizQuestionModel(
            id: "q7",
            title: "Reactivity",
            section: .reactivity,
            question: "In windy or cold weather, your skin:",
            answers: [
                QuizAnswerOption(label: "Becomes very red and irritated", points: 1),
                QuizAnswerOption(label: "Gets slightly red or tight", points: 2),
                QuizAnswerOption(label: "Feels a bit dry but manageable", points: 3),
                QuizAnswerOption(label: "Doesn't seem affected", points: 4),
            ]
        ),
        QuizQuestionModel(
            id: "q8",
            title: "Reactivity",
            section: .reactivity,
            question: "Fragranced products (perfumes, scented lotions):",
            answers: [
                QuizAnswerOption(label: "Always cause irritation or breakouts", points: 1),
                QuizAnswerOption(label: "Sometimes cause problems", points: 2),
                QuizAnswerOption(label: "Rarely bother you", points: 3),
                QuizAnswerOption(label: "Never cause issues", points: 4),
            ]
        ),
        QuizQuestionModel(
            id: "q9",
            title: "Reactivity",
            section: .reactivity,
            question: "After sun exposure (even with sunscreen), your skin:",
            answers: [
                QuizAnswerOption(label: "Gets very red and burns easily", points: 1),
                QuizAnswerOption(label: "Sometimes gets pink or burns", points: 2),
                QuizAnswerOption(label: "Tans gradually with minimal burning", points: 3),
                QuizAnswerOption(label: "Rarely burns, tans easily", points: 4),
            ]
        ),
        QuizQuestionModel(
            id: "q10",
            title: "Reactivity",
            section: .reactivity,
            question: "How does your skin react to stress, hormonal changes, or diet?",
            answers: [
                QuizAnswerOption(label: "Very noticeable reactions (breakouts, redness, sensitivity)", points: 1),
                QuizAnswerOption(label: "Some reactions during major changes", points: 2),
                QuizAnswerOption(label: "Mild reactions occasionally", points: 3),
                QuizAnswerOption(label: "Skin stays pretty much the same", points: 4),
            ]
        ),
        QuizQuestionModel(
            id: "q11",
            title: "Reactivity",
            section: .reactivity,
            question: "Retinol or acid products (AHA/BHA):",
            answers: [
                QuizAnswerOption(label: "Cause irritation even in small amounts", points: 1),
                QuizAnswerOption(label: "Need to be introduced very slowly", points: 2),
                QuizAnswerOption(label: "Can be tolerated with gradual introduction", points: 3),
                QuizAnswerOption(label: "Can use regularly without issues", points: 4),
            ]
        ),
        QuizQuestionModel(
            id: "q12",
            title: "Pigmentation",
            section: .pigmentation,
            question: "When you get a pimple or minor injury, afterward you:",
            answers: [
                QuizAnswerOption(label: "Almost always get a dark mark that lasts months", points: 1),
                QuizAnswerOption(label: "Sometimes get marks that fade slowly", points: 2),
                QuizAnswerOption(label: "Occasionally get marks that fade quickly", points: 3),
                QuizAnswerOption(label: "Rarely get any lasting marks", points: 4),
            ]
        ),
        QuizQuestionModel(
            id: "q13",
            title: "Pigmentation",
            section: .pigmentation,
            question: "Your skin tone on your face is:",
            answers: [
                QuizAnswerOption(label: "Very uneven with many dark spots or patches", points: 1),
                QuizAnswerOption(label: "Somewhat uneven with some spots", points: 2),
                QuizAnswerOption(label: "Mostly even with occasional spots", points: 3),
                QuizAnswerOption(label: "Very even with few to no spots", points: 4),
            ]
        ),
        QuizQuestionModel(
            id: "q14",
            title: "Pigmentation",
            section: .pigmentation,
            question: "In the past, sun exposure has caused:",
            answers: [
                QuizAnswerOption(label: "Many freckles, sun spots, or melasma", points: 1),
                QuizAnswerOption(label: "Some freckles or spots", points: 2),
                QuizAnswerOption(label: "Occasional light freckling", points: 3),
                QuizAnswerOption(label: "Very little pigmentation change", points: 4),
            ]
        ),
        QuizQuestionModel(
            id: "q15",
            title: "Pigmentation",
            section: .pigmentation,
            question: "Your family history includes:",
            answers: [
                QuizAnswerOption(label: "Many relatives with melasma, sun spots, or uneven skin tone", points: 1),
                QuizAnswerOption(label: "Some relatives with pigmentation issues", points: 2),
                QuizAnswerOption(label: "Few relatives with these issues", points: 3),
                QuizAnswerOption(label: "No family history of pigmentation problems", points: 4),
            ]
        ),
        QuizQuestionModel(
            id: "q16",
            title: "Pigmentation",
            section: .pigmentation,
            question: "When your skin is exposed to the sun, what usually happens?",
            answers: [
                QuizAnswerOption(label: "You burn and peel without developing much of a tan", points: 1),
                QuizAnswerOption(label: "You burn first, then fade into a light tan", points: 2),
                QuizAnswerOption(label: "You may burn slightly, then develop a tan soon after", points: 3),
                QuizAnswerOption(label: "You tan evenly without burning", points: 4),
            ]
        ),
    ]

    static func computeScores(answers: [String: Int]) -> [QuizSectionId: Int] {
        var totals: [QuizSectionId: Int] = [.hydration: 0, .reactivity: 0, .pigmentation: 0]
        for q in questions {
            guard let idx = answers[q.id], idx >= 0, idx < q.answers.count else { continue }
            totals[q.section, default: 0] += q.answers[idx].points
        }
        return totals
    }

    static func sectionLetters(scores: [QuizSectionId: Int]) -> [QuizSectionId: String] {
        var out: [QuizSectionId: String] = [:]
        for s in QuizSectionId.allCases {
            let v = scores[s] ?? 0
            switch s {
            case .hydration: out[s] = (5 ... 10).contains(v) ? "D" : "O"
            case .reactivity: out[s] = (6 ... 15).contains(v) ? "S" : "R"
            case .pigmentation: out[s] = (5 ... 12).contains(v) ? "P" : "N"
            }
        }
        return out
    }

    static func gemstone(from scores: [QuizSectionId: Int]) -> GemstoneId {
        let l = sectionLetters(scores: scores)
        let code = (l[.hydration] ?? "O") + (l[.reactivity] ?? "R") + (l[.pigmentation] ?? "N")
        let map: [String: GemstoneId] = [
            "OSP": .opal, "OSN": .pearl, "ORP": .jade, "ORN": .quartz,
            "DSP": .amber, "DSN": .moonstone, "DRP": .turquoise, "DRN": .diamond,
        ]
        return map[code] ?? .quartz
    }

    static func computeProfile(answers: [String: Int]) -> SkinProfile {
        let scores = computeScores(answers: answers)
        let letters = sectionLetters(scores: scores)
        let primary = gemstone(from: scores)
        return SkinProfile(primary: primary, scores: scores, sectionLetters: letters)
    }

    static func resultSummary(for profile: SkinProfile) -> (label: String, description: String) {
        if let meta = gemstonePresentation[profile.primary] {
            return (meta.name, meta.longDescription)
        }
        let fallback = profile.primary.rawValue.prefix(1).uppercased() + profile.primary.rawValue.dropFirst()
        return (String(fallback), "")
    }

    static func gemstoneMeta(_ g: GemstoneId) -> (emoji: String, tagline: String, name: String) {
        guard let m = gemstonePresentation[g] else {
            let name = g.rawValue.prefix(1).uppercased() + g.rawValue.dropFirst()
            return ("✨", "", String(name))
        }
        return (m.emoji, m.tagline, m.name)
    }

    private struct GemMeta {
        let name: String
        let tagline: String
        let emoji: String
        let longDescription: String
    }

    private static let gemstonePresentation: [GemstoneId: GemMeta] = [
        .opal: .init(
            name: "Opal",
            tagline: "Iridescent and reactive",
            emoji: "✨",
            longDescription: "Your skin is oily, reactive, and prone to pigmentation. Like the opal gemstone, your skin shows a beautiful play of color but can reveal imperfections clearly. Targeted treatments focus on controlling oil, calming sensitivity, and addressing pigmentation for a balanced, radiant complexion."
        ),
        .pearl: .init(
            name: "Pearl",
            tagline: "Lustrous but delicate",
            emoji: "🦪",
            longDescription: "You have oily, sensitive skin that stays mostly clear of pigmentation. Like a pearl, your skin is beautiful yet delicate, needing gentle care to maintain balance and minimize irritation while controlling shine and reactivity."
        ),
        .jade: .init(
            name: "Jade",
            tagline: "Strong and precious, shows every mark",
            emoji: "💚",
            longDescription: "Your skin is oily and resistant with pigmentation concerns. Like the jade gemstone, your skin is resilient but reveals imperfections clearly. Treatment aims to reduce discoloration while enhancing skin texture and clarity."
        ),
        .quartz: .init(
            name: "Quartz",
            tagline: "Clear and resilient",
            emoji: "💎",
            longDescription: "Oily, resistant, and non-pigmented — your skin is clear and tough like quartz. You benefit from treatments that maintain clarity, improve texture, and prevent aging while controlling oil production effectively."
        ),
        .amber: .init(
            name: "Amber",
            tagline: "Warm golden treasure",
            emoji: "🧡",
            longDescription: "Your dry, sensitive skin with pigmentation is like amber — warm, beautiful, but delicate. Treatments focus on strengthening your skin barrier, reducing pigmentation, and deeply hydrating for a luminous glow."
        ),
        .moonstone: .init(
            name: "Moonstone",
            tagline: "Ethereal inner glow",
            emoji: "🌙",
            longDescription: "With dry, sensitive, and non-pigmented skin, your skin resembles the soft glow of moonstone. Gentle, nurturing treatments that protect and restore moisture help maintain your skin's natural radiance."
        ),
        .turquoise: .init(
            name: "Turquoise",
            tagline: "Sacred weathered beauty",
            emoji: "💙",
            longDescription: "Your skin is dry, resistant, and pigmented. It is tough yet delicate like turquoise. You respond well to therapies that balance pigmentation and restore hydration while promoting skin strength."
        ),
        .diamond: .init(
            name: "Diamond",
            tagline: "Rare perfect clarity",
            emoji: "💍",
            longDescription: "Dry, resistant, and non-pigmented — your skin is clear and resilient like a diamond. You're well suited for advanced rejuvenation that enhances firmness, hydration, and youthful radiance."
        ),
    ]
}
