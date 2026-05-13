import SwiftUI

/// Lightweight “AI skin coach” surface (planDraft § AI Skin Coach) — educational canned replies, not telemedicine.
struct SkinCoachView: View {
    @State private var messages: [CoachMessage] = [
        CoachMessage(role: .assistant, text: SkinCoachEngine.welcome),
    ]
    @State private var input = ""

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(messages) { msg in
                            CoachBubble(message: msg)
                        }
                    }
                    .padding()
                }
                .onChange(of: messages.count) { _, _ in
                    if let last = messages.last?.id {
                        withAnimation { proxy.scrollTo(last, anchor: .bottom) }
                    }
                }
            }

            suggestedChips

            HStack(spacing: 8) {
                TextField("Ask a skincare question…", text: $input, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1 ... 3)
                Button("Send") { send() }
                    .buttonStyle(.borderedProminent)
                    .disabled(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding()
            .background(.ultraThinMaterial)
        }
        .navigationTitle("Skin coach")
        .navigationBarTitleDisplayMode(.large)
    }

    private var suggestedChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(SkinCoachEngine.suggestions, id: \.self) { q in
                    Button(q) {
                        input = q
                        send()
                    }
                    .buttonStyle(.bordered)
                    .font(.caption)
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 8)
        }
    }

    private func send() {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        input = ""
        messages.append(CoachMessage(role: .user, text: trimmed))
        let reply = SkinCoachEngine.reply(for: trimmed)
        messages.append(CoachMessage(role: .assistant, text: reply))
    }
}

private struct CoachMessage: Identifiable, Equatable {
    enum Role { case user, assistant }
    let id = UUID()
    let role: Role
    let text: String
}

private struct CoachBubble: View {
    let message: CoachMessage

    var body: some View {
        HStack {
            if message.role == .user { Spacer(minLength: 40) }
            Text(message.text)
                .font(.body)
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(message.role == .user ? Color.accentColor.opacity(0.18) : Color(.secondarySystemGroupedBackground))
                )
            if message.role == .assistant { Spacer(minLength: 40) }
        }
    }
}

enum SkinCoachEngine {
    static let welcome =
        "Hi! I’m your GlowPath coach—here for routines, ingredients, and what to ask in-office. I’m not a doctor and can’t diagnose. Emergencies need real-world care."

    static let suggestions: [String] = [
        "Can I use vitamin C with retinol?",
        "Do I need microneedling or a peel?",
        "What should I ask at a Botox consult?",
        "How do I prep for a pigment-safe laser chat?",
    ]

    static func reply(for question: String) -> String {
        let q = question.lowercased()
        if q.contains("vitamin c") || q.contains("retinol") || q.contains("tretinoin") {
            return "Layering vitamin C and retinoids is common but can irritate sensitive skin. Many people alternate nights (C in AM, retinoid PM) or buffer retinoid over moisturizer. If you’re pregnant or on prescriptions, ask your clinician before changing actives."
        }
        if q.contains("microneedling") || q.contains("peel") {
            return "Peels often address surface tone/texture quickly in a series; microneedling targets collagen remodeling over multiple visits—especially for certain scars. Neither replaces daily SPF. A provider can match depth/device to your skin type and downtime tolerance."
        }
        if q.contains("botox") || q.contains("neuromodulator") || q.contains("consult") {
            return "Ask how many units vs areas, follow-up policy, brow balance goals, and timeline for peak effect. Share photos of expressions you like. Discuss medical history (pregnancy, neuro conditions) openly—only licensed prescribers should treat."
        }
        if q.contains("laser") || q.contains("pigment") {
            return "Pigment lasers/IPL vary hugely by device and operator experience with skin of color. Discuss recent sun, melasma vs sun spots, and pre/post pigment regimen. If something feels like ‘instant cure’ marketing, get a second opinion."
        }
        return "Great question. I can share general education: prioritize SPF, introduce one active at a time, and photograph progress monthly. For diagnosis, prescriptions, or procedures, book a licensed dermatology or med-spa consult—they can examine you in person."
    }
}
