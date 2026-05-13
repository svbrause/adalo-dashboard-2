import SwiftUI

/// Thea-style “skin scan” surface: on-device geometry + quiz/intake context, framed as cosmetic guidance only.
struct FacialAnalysisScanView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var tabRouter: GlowPathTabRouter
    @State private var webSheet: GlowWebSheetItem?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    scanHero

                    MedicalDisclaimerCard()

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Live face map")
                            .font(.headline)
                        Text(
                            "Landmarks run on your device—nothing is uploaded. Tap a numbered sample, choose a selfie, or try the web portrait; the readout and shelf picks below update immediately."
                        )
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal, 4)

                    FaceMirrorView()

                    if let face = session.faceScan {
                        ScanInsightSummaryCard(face: face, outcome: session.outcome)
                        ScanProductRecommendationsRow(outcome: session.outcome, webSheet: $webSheet)
                        ScanTreatmentRecommendationsCard(
                            face: face,
                            outcome: session.outcome,
                            intake: session.skinIntake
                        )
                    }

                    let showBoard = session.outcome != nil || session.skinIntake != nil || session.faceScan != nil
                    if showBoard {
                        SignalSummaryGrid(cards: SkinScanSignalBuilder.cards(
                            outcome: session.outcome,
                            intake: session.skinIntake,
                            faceScan: session.faceScan
                        ))
                    } else {
                        ContentUnavailableView(
                            "Map a face to begin",
                            systemImage: "camera.metering.matrix",
                            description: Text("Tap a sample number or add a photo. Take the skin quiz so highlights, shelf picks, and in-office hypotheticals match your gemstone profile.")
                        )
                        .padding(.vertical, 8)
                    }

                    if session.outcome == nil {
                        Button {
                            tabRouter.requestOpenSkinQuiz()
                        } label: {
                            Label("Take the skin quiz", systemImage: "sparkles")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Skin scan")
            .navigationBarTitleDisplayMode(.large)
            .sheet(item: $webSheet) { item in
                GlowWebShellView(initialURL: item.url, suggestedNavigationTitle: item.pageTitle)
                    .presentationDragIndicator(.visible)
            }
        }
    }

    private var scanHero: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Computer vision + your story", systemImage: "viewfinder")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(Color.accentColor)
            Text("Decode focus zones, pair them with your quiz and goals, and keep everything in a cosmetic coaching lane—not a medical diagnosis.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
    }
}

struct MedicalDisclaimerCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Important")
                .font(.caption)
                .fontWeight(.semibold)
                .textCase(.uppercase)
            Text(
                "GlowPath does not diagnose conditions (for example melasma or rosacea). For changing moles, pain, infection, or urgent concerns, seek in-person medical care."
            )
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color.orange.opacity(0.45), lineWidth: 1)
        )
    }
}

struct SkinSignalCardModel: Identifiable {
    let id = UUID()
    let title: String
    let caption: String
    let band: String
}

enum SkinScanSignalBuilder {
    static func cards(outcome: QuizOutcome?, intake: SkinIntake?, faceScan: FaceScanSessionState?) -> [SkinSignalCardModel] {
        var list: [SkinSignalCardModel] = []

        if let o = outcome {
            let h = o.profile.scores[.hydration] ?? 12
            let r = o.profile.scores[.reactivity] ?? 15
            let p = o.profile.scores[.pigmentation] ?? 12
            list.append(
                SkinSignalCardModel(
                    title: "Hydration story",
                    caption: hydrationCaption(score: h),
                    band: band(for: h, low: 5, high: 20, invert: false)
                )
            )
            list.append(
                SkinSignalCardModel(
                    title: "Calm & resilience",
                    caption: reactivityCaption(score: r),
                    band: band(for: r, low: 6, high: 24, invert: true)
                )
            )
            list.append(
                SkinSignalCardModel(
                    title: "Tone & clarity",
                    caption: pigmentCaption(score: p),
                    band: band(for: p, low: 5, high: 20, invert: false)
                )
            )
        } else if faceScan != nil {
            list.append(
                SkinSignalCardModel(
                    title: "Photo-first mode",
                    caption: "Quiz not completed—we still ran on-device face mapping. Finish the quiz so hydration, calm, and pigment bands personalize.",
                    band: "Onboarding"
                )
            )
        }

        if let intake, !intake.goals.isEmpty {
            let top = intake.goals.sorted { $0.displayName < $1.displayName }.prefix(3).map(\.displayName).joined(separator: ", ")
            list.append(
                SkinSignalCardModel(
                    title: "Goals you named",
                    caption: top,
                    band: "Your words"
                )
            )
        }

        if let f = faceScan {
            let lock = f.landmarksFound
                ? String(format: "Landmarks locked (confidence %.0f%%). Highlights can follow your quiz zones.", Double(f.faceConfidence) * 100)
                : "No clear face landmarks—try another angle, brighter light, or a different sample."
            list.append(
                SkinSignalCardModel(
                    title: "Latest capture",
                    caption: "\(f.sourceSummary). \(lock)",
                    band: f.updatedAt.formatted(date: .abbreviated, time: .shortened)
                )
            )
        } else {
            list.append(
                SkinSignalCardModel(
                    title: "Scan session",
                    caption: "Tap a sample number or add a photo to store a dated on-device capture you can revisit.",
                    band: "Tracking"
                )
            )
        }

        return list
    }

    private static func hydrationCaption(score: Int) -> String {
        if score <= 10 { return "Signals lean dry—prioritize barrier-friendly hydration and fewer stripping steps." }
        if score <= 16 { return "Balanced to combination—alternate lighter hydrators with targeted actives." }
        return "Oil-friendly profile—layer humectants and consider clarifying cadence without over-stripping."
    }

    private static func reactivityCaption(score: Int) -> String {
        if score <= 12 { return "Introduce actives slowly; favor soothing support and fewer simultaneous irritants." }
        if score <= 18 { return "Moderate tolerance—still space strong actives and watch seasonal swings." }
        return "Resilient canvas—still respect sunscreen and recovery days between intensive treatments."
    }

    private static func pigmentCaption(score: Int) -> String {
        if score <= 10 { return "Pigment-prone axis—daily photoprotection and gentle brightening cadence matter most." }
        if score <= 15 { return "Mixed signals—pair antioxidants with disciplined SPF and avoid picking." }
        return "Even-tone friendly—maintain prevention with SPF and antioxidants."
    }

    private static func band(for value: Int, low: Int, high: Int, invert: Bool) -> String {
        let t = Double(value - low) / Double(max(1, high - low))
        let focus = invert ? t > 0.55 : t < 0.35
        let strength = invert ? t < 0.35 : t > 0.55
        if focus { return "Focus" }
        if strength { return "Strength" }
        return "Balanced"
    }
}

// MARK: - Scan insights & recommendations

private struct ScanInsightSummaryCard: View {
    let face: FaceScanSessionState
    let outcome: QuizOutcome?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Scan readout", systemImage: "waveform.path.ecg")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.accentColor)
            Text(headline)
                .font(.title3.weight(.semibold))
            ForEach(bullets, id: \.self) { line in
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "circle.fill")
                        .font(.system(size: 6))
                        .padding(.top, 6)
                    Text(line)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            Text("Cosmetic coaching only—not a medical diagnosis.")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
    }

    private var headline: String {
        if face.landmarksFound {
            return outcome != nil ? "Your map and quiz are paired" : "Face map ready—add your quiz"
        }
        return "Photo loaded—landmarks unclear"
    }

    private var bullets: [String] {
        var lines: [String] = []
        if face.landmarksFound {
            lines.append(
                "On-device geometry locked—glow highlights follow your quiz-driven zones when a profile exists."
            )
        } else {
            lines.append(
                "Try a straight-on selfie, even lighting, or another bundled sample so Vision can outline eyes, nose, and cheeks."
            )
        }
        if let o = outcome {
            let g = o.profile.primary.rawValue.capitalized
            lines.append(
                "Quiz anchor: \(g) type—hydration, resilience, and pigment scores steer both shelf rotation and in-office hypotheticals below."
            )
        } else {
            lines.append(
                "Take the skin quiz so picks and highlight colors align with your hydration, calm, and clarity story—not a generic default."
            )
        }
        return lines
    }
}

private struct ScanProductRecommendationsRow: View {
    let outcome: QuizOutcome?
    @Binding var webSheet: GlowWebSheetItem?

    private var gemstone: GemstoneId {
        outcome?.profile.primary ?? .opal
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Shelf picks from this scan")
                .font(.headline)
            if outcome == nil {
                Text("Showing a starter shelf until your quiz sets your gemstone type.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(Array(ProductCatalog.recommendedProducts(for: gemstone).prefix(3))) { row in
                        ScanProductCard(row: row) { url in
                            webSheet = GlowWebSheetItem(url: url, pageTitle: scanSheetProductTitle(row.name))
                        }
                    }
                }
            }
        }
        .onAppear { ProductCatalog.loadIfNeeded() }
    }
}

private struct ScanProductCard: View {
    let row: BoutiqueProductRow
    var onShopURL: (URL) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            AsyncImage(url: row.imageUrl.flatMap { URL(string: $0) }) { phase in
                switch phase {
                case .empty:
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(.tertiarySystemFill))
                        .frame(width: 140, height: 100)
                case .success(let img):
                    img
                        .resizable()
                        .scaledToFill()
                        .frame(width: 140, height: 100)
                        .clipped()
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                case .failure:
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(.tertiarySystemFill))
                        .frame(width: 140, height: 100)
                        .overlay { Image(systemName: "photo").foregroundStyle(.secondary) }
                @unknown default:
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(.tertiarySystemFill))
                        .frame(width: 140, height: 100)
                }
            }
            Text(scanSheetProductTitle(row.name))
                .font(.caption.weight(.semibold))
                .lineLimit(3)
                .frame(width: 140, alignment: .leading)
            if let urlString = row.productUrl, let url = URL(string: urlString) {
                Button("Shop") { onShopURL(url) }
                    .font(.caption.weight(.semibold))
            }
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
    }
}

private struct ScanTreatmentRecommendationsCard: View {
    let face: FaceScanSessionState
    let outcome: QuizOutcome?
    let intake: SkinIntake?

    private var tags: [String] {
        ScanTreatmentTagBuilder.tags(face: face, outcome: outcome, intake: intake)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("In-office ideas to discuss")
                .font(.headline)
            Text("Hypothetical angles for you and a licensed provider—not a treatment plan.")
                .font(.caption)
                .foregroundStyle(.secondary)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 8) {
                ForEach(tags, id: \.self) { tag in
                    Text(tag)
                        .font(.caption2.weight(.medium))
                        .multilineTextAlignment(.leading)
                        .padding(.vertical, 8)
                        .padding(.horizontal, 10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(Color.accentColor.opacity(0.12))
                        )
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
    }
}

private enum ScanTreatmentTagBuilder {
    static func tags(face: FaceScanSessionState, outcome: QuizOutcome?, intake: SkinIntake?) -> [String] {
        var ordered: [String] = ["Consultation & baseline photos"]
        if let g = outcome?.profile.primary {
            ordered.append(contentsOf: treatmentIdeas(for: g))
        } else {
            ordered.append(contentsOf: ["Gentle facial", "Photoprotection review", "Barrier-support peel consult"])
        }
        if face.landmarksFound {
            ordered.append("Mid-face contour / volume consult (discussion only)")
        }
        if let intake {
            if intake.goals.contains(.texture) || intake.goals.contains(.pores) {
                ordered.append("Texture or pore refinement consult")
            }
            if intake.goals.contains(.pigmentation) {
                ordered.append("Tone-evening series consult")
            }
            if intake.goals.contains(.redness) || intake.goals.contains(.sensitivity) {
                ordered.append("Calming facial or vascular laser education")
            }
            if intake.goals.contains(.aging) {
                ordered.append("Collagen-stimulating modality consult")
            }
            switch intake.openness {
            case .openToFacials:
                ordered.append("Medical-grade facial cadence")
            case .openToLasers:
                ordered.append("Non-ablative device consult")
            case .openToInjectables:
                ordered.append("Neuromodulator education (provider-led)")
            case .atHomeFirst:
                break
            }
        }
        var seen = Set<String>()
        return ordered.filter { seen.insert($0).inserted }
    }

    private static func treatmentIdeas(for g: GemstoneId) -> [String] {
        switch g {
        case .opal:
            return ["Barrier-nourishing facial", "LED calm session"]
        case .pearl:
            return ["Brightening facial", "Antioxidant infusion visit"]
        case .jade:
            return ["Oil-balancing peel consult", "BHA maintenance facial"]
        case .quartz:
            return ["Hydrating resurfacing consult", "Polish-style facial"]
        case .amber:
            return ["Pigment-evening peel series consult", "IPL-style tone consult (provider-led)"]
        case .moonstone:
            return ["Soothing facial", "Barrier recovery peel"]
        case .turquoise:
            return ["Oxygen or humectant facial", "Hydration layering visit"]
        case .diamond:
            return ["Preventive antioxidant facial", "Light peel for polish"]
        }
    }
}

private func scanSheetProductTitle(_ name: String) -> String {
    if let pipe = name.firstIndex(of: "|") {
        return String(name[..<pipe]).trimmingCharacters(in: .whitespaces)
    }
    return name
}

private struct SignalSummaryGrid: View {
    let cards: [SkinSignalCardModel]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Signal board")
                .font(.headline)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ForEach(cards) { card in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(card.band)
                            .font(.caption2)
                            .fontWeight(.semibold)
                            .foregroundStyle(Color.accentColor)
                        Text(card.title)
                            .font(.caption)
                            .fontWeight(.semibold)
                        Text(card.caption)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Color(.secondarySystemGroupedBackground))
                    )
                }
            }
        }
    }
}
