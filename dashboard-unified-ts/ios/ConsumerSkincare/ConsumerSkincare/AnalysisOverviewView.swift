import SwiftUI

struct AnalysisOverviewView: View {
    let outcome: QuizOutcome
    /// Tighter layout for the Plan tab: no giant title, coach copy inside a disclosure group.
    var planCompactMode: Bool = false

    @State private var aiText: String?
    @State private var loading = false
    @State private var coachExpanded = false

    private var tiers: [(String, String, Double)] {
        let s = outcome.profile.scores
        let h = s[.hydration] ?? 12
        let r = s[.reactivity] ?? 15
        let p = s[.pigmentation] ?? 12
        return [
            ("Hydration balance", hydrationLabel(h), bar(h, 5, 20)),
            ("Calm & resilience", reactivityLabel(r), bar(r, 6, 24)),
            ("Even tone clarity", pigmentLabel(p), bar(p, 5, 20)),
        ]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: planCompactMode ? 14 : 20) {
            if !planCompactMode {
                Text("How we read your quiz")
                    .font(.title2)
                    .fontWeight(.semibold)

                Text(
                    "These scores translate your answers into three everyday priorities. They are educational—not a medical diagnosis."
                )
                .font(.footnote)
                .foregroundStyle(.secondary)
            }

            ForEach(Array(tiers.enumerated()), id: \.offset) { _, row in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(row.0)
                            .font(.subheadline)
                            .fontWeight(.medium)
                        Spacer()
                        Text(row.1)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    ProgressView(value: row.2)
                        .tint(Color.accentColor)
                }
            }

            Divider().padding(.vertical, 4)

            if planCompactMode {
                DisclosureGroup(isExpanded: $coachExpanded) {
                    coachNotesContent
                } label: {
                    Text("Personalized overview")
                        .font(.subheadline.weight(.semibold))
                }
            } else {
                Text("Coach notes")
                    .font(.headline)
                coachNotesContent
            }
        }
        .padding(.horizontal, 20)
        .task {
            await loadAI()
        }
    }

    @ViewBuilder
    private var coachNotesContent: some View {
        if loading {
            ProgressView("Drafting personalized notes…")
                .padding(.vertical, 12)
        } else if let aiText {
            Text(aiText)
                .font(.body)
                .foregroundStyle(.primary)
        } else {
            Text(fallbackCoachCopy)
                .font(.body)
            Button("Try live coach notes") {
                Task { await loadAI() }
            }
            .buttonStyle(.bordered)
        }
    }

    private var fallbackCoachCopy: String {
        let meta = SkinQuizEngine.gemstoneMeta(outcome.profile.primary)
        return "Your \(meta.name) profile points to routines that honor your hydration, resilience, and tone story. On Plan, open your AM/PM steps and glow map, or use Scan for a fresh photo and Learn for procedure guides."
    }

    private func bar(_ v: Int, _ lo: Int, _ hi: Int) -> Double {
        let clamped = max(lo, min(hi, v))
        return Double(clamped - lo) / Double(hi - lo)
    }

    private func hydrationLabel(_ h: Int) -> String {
        if h <= 9 { return "Needs moisture love" }
        if h <= 14 { return "Balanced to combo" }
        return "Oil-friendly care"
    }

    private func reactivityLabel(_ r: Int) -> String {
        if r <= 12 { return "Treat gently" }
        if r <= 18 { return "Steady & adaptable" }
        return "Tolerates active ingredients well"
    }

    private func pigmentLabel(_ p: Int) -> String {
        if p <= 9 { return "Tone support focus" }
        if p <= 14 { return "Mixed signals" }
        return "Naturally even canvas"
    }

    private func loadAI() async {
        loading = true
        let summary =
            "\(outcome.resultLabel): \(outcome.resultDescription)"
        let result = await AssessmentAPI.fetchPersonalizedOverview(
            profile: outcome.profile,
            patientSummary: summary
        )
        await MainActor.run {
            aiText = result
            loading = false
            if planCompactMode, let result, !result.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                coachExpanded = true
            }
        }
    }
}
