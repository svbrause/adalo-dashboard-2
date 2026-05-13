import Foundation
import SwiftUI

// MARK: - Models

enum SkinTrend: String, Codable, CaseIterable, Identifiable, Hashable {
    case better
    case same
    case worse

    var id: String { rawValue }

    var label: String {
        switch self {
        case .better: return "Better"
        case .same: return "About the same"
        case .worse: return "Flare / worse"
        }
    }
}

/// One dated check-in while you trial products (stored on-device only).
struct ProgressJournalEntry: Identifiable, Codable, Equatable {
    let id: UUID
    var loggedAt: Date
    /// 1 = rough day … 5 = great skin day (optional).
    var skinDayScore: Int?
    var trend: SkinTrend?
    var symptomTags: [String]
    /// Product display names you were actively using (from shelf or freeform).
    var productsInPlay: [String]
    var notes: String

    init(
        id: UUID = UUID(),
        loggedAt: Date = Date(),
        skinDayScore: Int? = nil,
        trend: SkinTrend? = nil,
        symptomTags: [String] = [],
        productsInPlay: [String] = [],
        notes: String = ""
    ) {
        self.id = id
        self.loggedAt = loggedAt
        self.skinDayScore = skinDayScore
        self.trend = trend
        self.symptomTags = symptomTags
        self.productsInPlay = productsInPlay
        self.notes = notes
    }
}

// MARK: - Store

@MainActor
final class ProgressJournalStore: ObservableObject {
    private static let storageKey = "glowpathProgressJournalEntries"

    @Published private(set) var entries: [ProgressJournalEntry] = []

    static let symptomChipOptions: [String] = [
        "Dryness", "Oiliness", "Redness", "Breakouts", "Texture",
        "Glow", "Irritation", "Dark spots", "Pores", "Tightness",
    ]

    init() {
        load()
    }

    func add(_ entry: ProgressJournalEntry) {
        entries.insert(entry, at: 0)
        save()
    }

    func replace(_ entry: ProgressJournalEntry) {
        guard let i = entries.firstIndex(where: { $0.id == entry.id }) else { return }
        entries[i] = entry
        save()
    }

    func remove(id: UUID) {
        entries.removeAll { $0.id == id }
        save()
    }

    private func save() {
        if let data = try? JSONEncoder().encode(entries) {
            UserDefaults.standard.set(data, forKey: Self.storageKey)
        }
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: Self.storageKey),
              let decoded = try? JSONDecoder().decode([ProgressJournalEntry].self, from: data)
        else {
            entries = []
            return
        }
        entries = decoded.sorted { $0.loggedAt > $1.loggedAt }
    }
}

// MARK: - Plan section

struct ProgressJournalSection: View {
    @EnvironmentObject private var journal: ProgressJournalStore
    @EnvironmentObject private var session: AppSession
    @State private var showLog = false
    @State private var showFullTimeline = false
    /// Shorter disclaimer when the Plan tab already explains context in a section header.
    var compactIntro: Bool = false

    private var gemstone: GemstoneId? {
        session.outcome?.profile.primary
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                if !compactIntro {
                    Text("Progress & symptoms")
                        .font(.title2)
                        .fontWeight(.semibold)
                }
                Spacer(minLength: 0)
                Button {
                    showLog = true
                } label: {
                    Label("Log", systemImage: "square.and.pencil")
                        .font(.subheadline.weight(.semibold))
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
            }
            .padding(.horizontal, 20)

            if !compactIntro {
                Text(
                    "Quick check-ins while you trial products—scores and tags are for your own trend spotting, not a diagnosis. Everything stays on this device."
                )
                .font(.footnote)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 20)
            }

            if journal.entries.isEmpty {
                ContentUnavailableView(
                    "No entries yet",
                    systemImage: "chart.line.uptrend.xyaxis",
                    description: Text("After a few days on a new active, log how your skin felt so you can see patterns over time.")
                )
                .padding(.vertical, 8)
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(journal.entries.prefix(6)) { entry in
                        ProgressEntryRow(entry: entry) {
                            journal.remove(id: entry.id)
                        }
                    }
                    if journal.entries.count > 6 {
                        Button {
                            showFullTimeline = true
                        } label: {
                            Text("See all \(journal.entries.count) entries")
                                .font(.subheadline.weight(.semibold))
                        }
                        .padding(.horizontal, 20)
                        .padding(.top, 4)
                    }
                }
            }
        }
        .padding(.top, 8)
        .sheet(isPresented: $showLog) {
            LogProgressEntrySheet(gemstone: gemstone) { entry in
                journal.add(entry)
            }
            .presentationDetents([.large])
        }
        .sheet(isPresented: $showFullTimeline) {
            NavigationStack {
                List {
                    ForEach(journal.entries) { entry in
                        ProgressEntryRow(entry: entry) {
                            journal.remove(id: entry.id)
                        }
                        .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                journal.remove(id: entry.id)
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    }
                }
                .listStyle(.plain)
                .navigationTitle("Full timeline")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { showFullTimeline = false }
                    }
                }
            }
        }
    }
}

// MARK: - Row

private struct ProgressEntryRow: View {
    let entry: ProgressJournalEntry
    var onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(entry.loggedAt.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                if let s = entry.skinDayScore {
                    HStack(spacing: 2) {
                        ForEach(1 ... 5, id: \.self) { i in
                            Image(systemName: i <= s ? "circle.fill" : "circle")
                                .font(.caption2)
                                .foregroundStyle(i <= s ? Color.accentColor : Color.secondary.opacity(0.45))
                        }
                    }
                }
                if let t = entry.trend {
                    Text(t.label)
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(trendColor(t).opacity(0.2), in: Capsule())
                }
            }

            if !entry.symptomTags.isEmpty {
                FlowTagWrap(tags: entry.symptomTags)
            }

            if !entry.productsInPlay.isEmpty {
                Text("Using: \(entry.productsInPlay.joined(separator: ", "))")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }

            if !entry.notes.isEmpty {
                Text(entry.notes)
                    .font(.subheadline)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
        .padding(.horizontal, 20)
        .contextMenu {
            Button(role: .destructive) {
                onDelete()
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    private func trendColor(_ t: SkinTrend) -> Color {
        switch t {
        case .better: return .green
        case .same: return .secondary
        case .worse: return .orange
        }
    }
}

// MARK: - Log sheet

struct LogProgressEntrySheet: View {
    let gemstone: GemstoneId?
    var onSave: (ProgressJournalEntry) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var loggedAt = Date()
    @State private var skinDayScore: Int = 3
    @State private var hasScore = true
    @State private var trend: SkinTrend = .same
    @State private var hasTrend = false
    @State private var pickedSymptoms: Set<String> = []
    @State private var pickedProducts: Set<String> = []
    @State private var notes = ""

    private var shelfProducts: [BoutiqueProductRow] {
        guard let g = gemstone else { return [] }
        ProductCatalog.loadIfNeeded()
        return ProductCatalog.recommendedProducts(for: g)
    }

    private func shortName(_ row: BoutiqueProductRow) -> String {
        if let pipe = row.name.firstIndex(of: "|") {
            return String(row.name[..<pipe]).trimmingCharacters(in: .whitespaces)
        }
        return row.name
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("When") {
                    DatePicker("Date", selection: $loggedAt, displayedComponents: [.date])
                }

                Section("Skin day") {
                    Toggle("Rate this day 1–5", isOn: $hasScore)
                    if hasScore {
                        Stepper(value: $skinDayScore, in: 1 ... 5) {
                            Text("\(skinDayScore) — \(scoreLabel(skinDayScore))")
                        }
                    }
                }

                Section("Trend vs last check-in") {
                    Toggle("Note direction", isOn: $hasTrend)
                    if hasTrend {
                        Picker("Compared to before", selection: $trend) {
                            ForEach(SkinTrend.allCases, id: \.self) { t in
                                Text(t.label).tag(t)
                            }
                        }
                    }
                }

                Section("Symptoms / focus") {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 92), spacing: 8)], spacing: 8) {
                        ForEach(ProgressJournalStore.symptomChipOptions, id: \.self) { tag in
                            let on = pickedSymptoms.contains(tag)
                            Button {
                                if on { pickedSymptoms.remove(tag) } else { pickedSymptoms.insert(tag) }
                            } label: {
                                Text(tag)
                                    .font(.caption)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .frame(maxWidth: .infinity)
                                    .background(
                                        Capsule().fill(on ? Color.accentColor.opacity(0.22) : Color(.tertiarySystemFill))
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                if !shelfProducts.isEmpty {
                    Section("Products in rotation") {
                        ForEach(shelfProducts) { row in
                            let name = shortName(row)
                            Toggle(name, isOn: Binding(
                                get: { pickedProducts.contains(name) },
                                set: { isOn in
                                    if isOn { pickedProducts.insert(name) } else { pickedProducts.remove(name) }
                                }
                            ))
                        }
                    }
                }

                Section("Notes") {
                    TextField("What changed? Reactions, texture, sleep, stress…", text: $notes, axis: .vertical)
                        .lineLimit(3 ... 8)
                }
            }
            .navigationTitle("Log check-in")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let entry = ProgressJournalEntry(
                            loggedAt: loggedAt,
                            skinDayScore: hasScore ? skinDayScore : nil,
                            trend: hasTrend ? trend : nil,
                            symptomTags: pickedSymptoms.sorted(),
                            productsInPlay: pickedProducts.sorted(),
                            notes: notes.trimmingCharacters(in: .whitespacesAndNewlines)
                        )
                        onSave(entry)
                        dismiss()
                    }
                }
            }
        }
    }

    private func scoreLabel(_ s: Int) -> String {
        switch s {
        case 1: return "Rough"
        case 2: return "Off"
        case 3: return "OK"
        case 4: return "Good"
        default: return "Great"
        }
    }
}

// MARK: - Tag wrap (symptom chips on entry row)

private struct FlowTagWrap: View {
    let tags: [String]

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 64), spacing: 6)], spacing: 6) {
            ForEach(tags, id: \.self) { t in
                Text(t)
                    .font(.caption2)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Color.accentColor.opacity(0.12)))
            }
        }
    }
}
