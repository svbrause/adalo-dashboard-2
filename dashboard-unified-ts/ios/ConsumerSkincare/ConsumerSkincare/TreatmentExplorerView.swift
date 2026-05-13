import SwiftUI

/// Consumer treatment education hub from `planDraft.md` § Treatment Explorer (static v1).
struct TreatmentExplorerView: View {
    var body: some View {
        List(TreatmentLibrary.all) { item in
            NavigationLink(value: item) {
                HStack(alignment: .center, spacing: 14) {
                    Image(systemName: item.listSymbolName)
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(width: 48, height: 48)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(Color.accentColor.gradient)
                        )
                        .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.title)
                            .font(.headline)
                        Text(item.tagline)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .navigationTitle("Treatment hub")
        .navigationBarTitleDisplayMode(.large)
        .navigationDestination(for: TreatmentArticle.self) { article in
            TreatmentArticleDetailView(article: article)
        }
    }
}

struct TreatmentArticle: Identifiable, Hashable {
    let title: String
    let tagline: String
    /// SF Symbol shown on the Treatment hub list row.
    let listSymbolName: String
    let bestFor: [String]
    let notIdeal: [String]
    let downtime: String
    let pain: String
    let sessions: String
    let maintenance: String
    let askProvider: [String]
    let skinOfColorNote: String

    var id: String { title }
}

private struct TreatmentArticleDetailView: View {
    let article: TreatmentArticle

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(article.tagline)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                bulletBlock("Best for", article.bestFor)
                bulletBlock("Usually not first-line if…", article.notIdeal)
                factRow("Downtime", article.downtime)
                factRow("Comfort / pain", article.pain)
                factRow("Typical cadence", article.sessions)
                factRow("Maintenance", article.maintenance)
                bulletBlock("Questions for your provider", article.askProvider)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Skin of color & pigment safety")
                        .font(.headline)
                    Text(article.skinOfColorNote)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 14).fill(Color(.secondarySystemGroupedBackground)))
            }
            .padding(20)
        }
        .navigationTitle(article.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func bulletBlock(_ heading: String, _ items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(heading)
                .font(.headline)
            ForEach(items, id: \.self) { line in
                HStack(alignment: .top, spacing: 8) {
                    Text("•")
                    Text(line)
                        .font(.body)
                }
            }
        }
    }

    private func factRow(_ k: String, _ v: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(k)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(v)
                .font(.body)
        }
    }
}

private enum TreatmentLibrary {
    static let all: [TreatmentArticle] = [
        TreatmentArticle(
            title: "HydraFacial / hydradermabrasion",
            tagline: "Entry-level glow and congestion polish with minimal downtime.",
            listSymbolName: "bubbles.and.sparkles.fill",
            bestFor: ["Dullness", "Mild congestion", "Event prep", "First-timer facials"],
            notIdeal: ["Deep acne scars alone", "Melasma as sole solution"],
            downtime: "Often same-day makeup friendly; mild pinkness <24h for many.",
            pain: "Most describe gentle suction + infusion as comfortable.",
            sessions: "Monthly to quarterly for maintenance.",
            maintenance: "Home SPF + antioxidants keep results longer.",
            askProvider: [
                "Which boosters are included?",
                "How do you calibrate suction for sensitive skin?",
            ],
            skinOfColorNote:
                "Generally friendly across tones when suction is conservative; still disclose pigment concerns and recent breakouts."
        ),
        TreatmentArticle(
            title: "Chemical peels",
            tagline: "Controlled exfoliation for tone, texture, and acne support.",
            listSymbolName: "flask.fill",
            bestFor: ["Texture", "Superficial pigment", "Acne-prone skin (selected peels)"],
            notIdeal: ["Active infection", "Open wounds", "Recent isotretinoin without clearance"],
            downtime: "From none (superficial) to visible flaking/peeling for medium-depth—confirm your plan.",
            pain: "Mild tingling common; deeper peels feel stronger.",
            sessions: "Series of 3–6 spaced weeks apart is common for corrective goals.",
            maintenance: "Strict photoprotection; avoid picking flaking skin.",
            askProvider: [
                "Which acid and depth for my goals?",
                "What is the post-peel kit?",
            ],
            skinOfColorNote:
                "Pigment-prone skin needs conservative peel choice and pre/post pigment support—ask about experience with deeper tones."
        ),
        TreatmentArticle(
            title: "Microneedling (collagen induction)",
            tagline: "Tiny channels to remodel scars, pores, and fine lines over time.",
            listSymbolName: "circle.grid.cross.fill",
            bestFor: ["Acne scars (selected types)", "Texture", "Fine lines"],
            notIdeal: ["Active inflammatory acne", "Poor sun compliance"],
            downtime: "Redness 24–72h common; makeup timing per clinic guidance.",
            pain: "Topical numbing used; feels scratchy/pressure.",
            sessions: "Often 3+ spaced ~4–6 weeks for scars.",
            maintenance: "Gentle barrier care + SPF between sessions.",
            askProvider: [
                "Device depth and protocol for my scar type?",
                "Do you pair with PRP or serums?",
            ],
            skinOfColorNote:
                "Generally versatile with correct settings; disclose history of keloids or post-inflammatory hyperpigmentation."
        ),
        TreatmentArticle(
            title: "IPL / broad-band light",
            tagline: "Light pulses targeting pigment and redness—device-dependent.",
            listSymbolName: "sun.max.fill",
            bestFor: ["Sun spots", "Diffuse redness (selected cases)"],
            notIdeal: ["Deeper melasma without specialist oversight", "Very recent tan"],
            downtime: "Darkening of spots (“coffee grounds”) can occur before flaking.",
            pain: "Rubber-band snaps; eye shields mandatory.",
            sessions: "Series common; maintenance 1–2x yearly in some plans.",
            maintenance: "Daily SPF is non-negotiable.",
            askProvider: [
                "Which filters for my concern mix?",
                "How do you treat darker skin tones safely?",
            ],
            skinOfColorNote:
                "Not all IPL devices are appropriate for deeper Fitzpatrick types—seek operators with explicit skin-of-color experience."
        ),
        TreatmentArticle(
            title: "Neuromodulators (e.g., Botox)",
            tagline: "Softens dynamic lines by relaxing specific muscles—prescription in-office.",
            listSymbolName: "syringe.fill",
            bestFor: ["Forehead / crow’s lines (dynamic)", "Jaw tension protocols (off-label, clinician-specific)"],
            notIdeal: ["Heavy eyelid laxity without assessment", "Pregnancy / breastfeeding (contraindicated—ask clinician)"],
            downtime: "Pinpoint bumps minutes; bruise risk small.",
            pain: "Quick pinches.",
            sessions: "Every 3–4 months typical for maintenance.",
            maintenance: "SPF + skincare continue to matter for skin quality.",
            askProvider: [
                "Units vs areas—how do you dose conservatively for first-timers?",
                "Follow-up policy if asymmetry appears?",
            ],
            skinOfColorNote:
                "Technique matters for brow position and balance across ethnic features—bring reference photos of natural movement you like."
        ),
    ]
}
