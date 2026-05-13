import SwiftUI

struct QuizResultsView: View {
    let outcome: QuizOutcome
    let onContinue: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                let meta = SkinQuizEngine.gemstoneMeta(outcome.profile.primary)
                Text(meta.emoji)
                    .font(.system(size: 56))

                Text("You're a \(meta.name)")
                    .font(.system(.title, design: .serif))
                    .fontWeight(.semibold)

                Text(meta.tagline)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                Text(outcome.resultDescription)
                    .font(.body)
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)
                    .padding(.horizontal, 4)

                scoreBreakdown

                Button(action: onContinue) {
                    Text("See my personalized plan")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.accentColor)
                        .foregroundStyle(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .padding(.top, 8)
            }
            .padding(24)
        }
        .background(
            LinearGradient(
                colors: [
                    Color(.systemGroupedBackground),
                    Color(red: 0.96, green: 0.94, blue: 0.99),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }

    private var scoreBreakdown: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("How we scored you")
                .font(.headline)
            ForEach(QuizSectionId.allCases, id: \.rawValue) { section in
                let score = outcome.profile.scores[section] ?? 0
                let letter = outcome.profile.sectionLetters[section] ?? ""
                let label = section.rawValue.capitalized
                HStack {
                    Text(label)
                    Spacer()
                    Text("\(score) pts · \(axisSubtitle(section: section, letter: letter))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                ProgressView(value: normalized(section: section, score: score))
                    .tint(Color.accentColor)
            }
        }
        .padding()
        .background(RoundedRectangle(cornerRadius: 16).fill(Color(.secondarySystemGroupedBackground)))
    }

    private func axisSubtitle(section: QuizSectionId, letter: String) -> String {
        switch section {
        case .hydration: return letter == "D" ? "Leans dry" : "Leans oily"
        case .reactivity: return letter == "S" ? "Leans sensitive" : "Leans resilient"
        case .pigmentation: return letter == "P" ? "Pigment-prone" : "Even-tone"
        }
    }

    private func normalized(section: QuizSectionId, score: Int) -> Double {
        switch section {
        case .hydration:
            return Double(score - 5) / Double(20 - 5)
        case .reactivity:
            return Double(score - 6) / Double(24 - 6)
        case .pigmentation:
            return Double(score - 5) / Double(20 - 5)
        }
    }
}
