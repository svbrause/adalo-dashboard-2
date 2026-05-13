import SwiftUI

/// “When to see a provider” bridge from planDraft — readiness framing + consult prep share sheet.
struct ProviderReadinessView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var tabRouter: GlowPathTabRouter
    @State private var showPrepShare = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Provider path")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            Text("When home care isn’t enough")
                .font(.title3)
                .fontWeight(.semibold)

            Text(
                "Shelf care first—then matched in-office options when you want escalation."
            )
            .font(.caption)
            .foregroundStyle(.secondary)

            checklist

            Text("Use what you own first")
                .font(.subheadline.weight(.semibold))
            Text("Finish open jars before duplicates; watch for overlapping exfoliants or retinoids.")
                .font(.caption)
                .foregroundStyle(.secondary)

            Button {
                showPrepShare = true
            } label: {
                Label("Build consult prep summary", systemImage: "square.and.arrow.up")
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.accentColor)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .disabled(session.outcome == nil && session.skinIntake == nil)

            Button {
                tabRouter.select(.find)
            } label: {
                Label("Browse matched providers", systemImage: "mappin.and.ellipse")
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color(.secondarySystemGroupedBackground))
                    .foregroundStyle(.primary)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
        .padding(16)
        .sheet(isPresented: $showPrepShare) {
            NavigationStack {
                ConsultPrepSummaryView()
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Done") { showPrepShare = false }
                        }
                    }
            }
            .environmentObject(session)
        }
    }

    private var checklist: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Readiness signals")
                .font(.headline)
            ReadinessRow(
                title: "You’ve tracked 4+ weeks without the change you want",
                met: session.outcome != nil
            )
            ReadinessRow(
                title: "You want in-office options matched to your tone & goals",
                met: session.skinIntake.map { $0.fitzpatrick != nil || $0.openness != .atHomeFirst } ?? false
            )
            ReadinessRow(
                title: "You’re ready to discuss downtime & budget honestly",
                met: session.skinIntake != nil
            )
        }
        .padding()
        .background(RoundedRectangle(cornerRadius: 16).fill(Color(.secondarySystemGroupedBackground)))
    }
}

private struct ReadinessRow: View {
    let title: String
    let met: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: met ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(met ? Color.accentColor : .secondary)
            Text(title)
                .font(.subheadline)
        }
    }
}

struct ConsultPrepSummaryView: View {
    @EnvironmentObject private var session: AppSession

    private var summaryText: String {
        var lines: [String] = ["GlowPath — consult prep summary", ""]
        if let o = session.outcome {
            lines.append("Gemstone profile: \(o.resultLabel)")
            lines.append("Narrative: \(o.resultDescription)")
            lines.append("Hydration score: \(o.profile.scores[.hydration] ?? 0)")
            lines.append("Reactivity score: \(o.profile.scores[.reactivity] ?? 0)")
            lines.append("Pigment axis score: \(o.profile.scores[.pigmentation] ?? 0)")
            lines.append("")
        }
        if let intake = session.skinIntake {
            lines.append("Goals: \(intake.goals.map(\.displayName).joined(separator: ", "))")
            if let f = intake.fitzpatrick {
                lines.append("Fitzpatrick (self-ID): \(f)")
            }
            lines.append("Openness: \(intake.openness.displayName)")
            lines.append("Budget comfort: \(intake.budget.displayName)")
            lines.append("Downtime tolerance: \(intake.downtime.displayName)")
            lines.append("Timeline: \(intake.timeline.displayName)")
            lines.append("")
        }
        lines.append("Questions to ask (starter list):")
        lines.append("• How many sessions before I evaluate progress?")
        lines.append("• What is the post-care and flare plan?")
        lines.append("• How do you approach pigment in deeper skin tones?")
        lines.append("")
        lines.append("Photos: only share if you consent in your provider’s HIPAA-compliant channel.")
        return lines.joined(separator: "\n")
    }

    var body: some View {
        ScrollView {
            Text(summaryText)
                .font(.body)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
        }
        .navigationTitle("Share with provider")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                ShareLink(item: summaryText, subject: Text("GlowPath consult prep")) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
            }
        }
    }
}
