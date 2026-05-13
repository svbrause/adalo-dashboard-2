import SwiftUI

struct SkinQuizFlowView: View {
    @EnvironmentObject private var session: AppSession
    @Environment(\.dismiss) private var dismiss
    let onFinish: () -> Void

    @State private var index = 0
    @State private var answers: [String: Int] = [:]
    @State private var outcome: QuizOutcome?

    private var progress: Double {
        guard !SkinQuizEngine.questions.isEmpty else { return 0 }
        return Double(index) / Double(SkinQuizEngine.questions.count)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                if let outcome {
                    QuizResultsView(outcome: outcome) {
                        session.outcome = outcome
                        onFinish()
                        dismiss()
                    }
                } else if index < SkinQuizEngine.questions.count {
                    quizContent
                }
            }
            .navigationTitle(outcome == nil ? "Skin quiz" : "")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var quizContent: some View {
        let q = SkinQuizEngine.questions[index]
        VStack(alignment: .leading, spacing: 0) {
            ProgressView(value: progress)
                .tint(.accentColor)
                .padding(.horizontal)
                .padding(.top, 8)

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text(q.section == .hydration ? "Hydration" : q.section == .reactivity ? "Reactivity" : "Pigmentation")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)

                    Text(q.question)
                        .font(.title3)
                        .fontWeight(.semibold)
                        .fixedSize(horizontal: false, vertical: true)

                    VStack(spacing: 10) {
                        ForEach(Array(q.answers.enumerated()), id: \.offset) { offset, answer in
                            let selected = answers[q.id] == offset
                            Button {
                                answers[q.id] = offset
                            } label: {
                                HStack(alignment: .top) {
                                    Text(answer.label)
                                        .font(.body)
                                        .foregroundStyle(.primary)
                                        .multilineTextAlignment(.leading)
                                    Spacer(minLength: 0)
                                    if selected {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(Color.accentColor)
                                    }
                                }
                                .padding(16)
                                .background(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .fill(selected ? Color.accentColor.opacity(0.12) : Color(.secondarySystemBackground))
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(20)
                .padding(.bottom, 100)
            }
            .safeAreaInset(edge: .bottom) {
                SafeAreaInsetNextButton(disabled: answers[q.id] == nil) {
                    if index + 1 < SkinQuizEngine.questions.count {
                        index += 1
                    } else {
                        outcome = QuizOutcome.build(answers: answers)
                    }
                }
            }
        }
        .background(Color(.systemGroupedBackground))
    }
}

private struct SafeAreaInsetNextButton: View {
    let disabled: Bool
    let action: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Divider()
            Button(action: action) {
                Text("Next")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(disabled ? Color.gray.opacity(0.3) : Color.accentColor)
                    .foregroundStyle(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .disabled(disabled)
            .padding(16)
        }
        .background(.regularMaterial)
    }
}
