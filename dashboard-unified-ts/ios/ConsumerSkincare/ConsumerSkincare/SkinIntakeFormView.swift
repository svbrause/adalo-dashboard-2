import SwiftUI

struct SkinIntakeFormView: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var intake: SkinIntake?

    @State private var draft: SkinIntake

    init(intake: Binding<SkinIntake?>) {
        _intake = intake
        _draft = State(initialValue: intake.wrappedValue ?? .empty)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(
                        "This helps GlowPath personalize education and when we suggest in-office options—never a diagnosis."
                    )
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                }

                Section("Skin goals") {
                    ForEach(SkinGoal.allCases) { goal in
                        Toggle(goal.displayName, isOn: binding(for: goal))
                    }
                }

                Section("Skin tone (Fitzpatrick, self-assessment)") {
                    Picker("Type", selection: $draft.fitzpatrick) {
                        Text("Prefer not to say").tag(Int?.none)
                        ForEach(1 ... 6, id: \.self) { n in
                            Text("Type \(n)").tag(Int?.some(n))
                        }
                    }
                }

                Section("Comfort with in-office care") {
                    Picker("Openness", selection: $draft.openness) {
                        ForEach(TreatmentOpenness.allCases) { o in
                            Text(o.displayName).tag(o)
                        }
                    }
                }

                Section("Budget & downtime") {
                    Picker("Budget comfort", selection: $draft.budget) {
                        ForEach(BudgetComfort.allCases) { b in
                            Text(b.displayName).tag(b)
                        }
                    }
                    Picker("Downtime tolerance", selection: $draft.downtime) {
                        ForEach(DowntimeTolerance.allCases) { d in
                            Text(d.displayName).tag(d)
                        }
                    }
                }

                Section("Timeline") {
                    Picker("When you want to move", selection: $draft.timeline) {
                        ForEach(CareTimeline.allCases) { t in
                            Text(t.displayName).tag(t)
                        }
                    }
                }
            }
            .navigationTitle("Your skin profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        draft.updatedAt = Date()
                        intake = draft
                        dismiss()
                    }
                }
            }
        }
    }

    private func binding(for goal: SkinGoal) -> Binding<Bool> {
        Binding(
            get: { draft.goals.contains(goal) },
            set: { on in
                if on { draft.goals.insert(goal) } else { draft.goals.remove(goal) }
            }
        )
    }
}
