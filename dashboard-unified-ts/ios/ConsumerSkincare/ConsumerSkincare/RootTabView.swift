import SwiftUI

enum GlowPathTab: Int, CaseIterable, Hashable {
    case today = 0
    case plan
    case find
    case scan
}

/// Destinations pushed inside the Plan tab’s stack (Learn + Coach live here so the tab bar stays to four items).
enum PlanGuideDestination: String, Hashable, CaseIterable {
    case learn
    case coach
}

@MainActor
final class GlowPathTabRouter: ObservableObject {
    @Published var selected: GlowPathTab = .today
    /// When set together with `selected == .plan`, `MyPlanView` appends this to its path then clears it.
    @Published var planGuideDestination: PlanGuideDestination?
    /// `RootTabView` presents the full-screen quiz when this flips to `true`, then clears it.
    @Published var pendingQuizPresentation = false

    func select(_ tab: GlowPathTab) {
        selected = tab
    }

    /// Selects Plan and optionally opens Learn or Coach on top of the plan scroll (same pattern as deep links from Today).
    func openPlanGuide(_ destination: PlanGuideDestination? = nil) {
        planGuideDestination = destination
        selected = .plan
    }

    /// Opens the skin quiz from any tab (e.g. Scan) using the same `fullScreenCover` as Today / Plan.
    func requestOpenSkinQuiz() {
        pendingQuizPresentation = true
    }
}

struct RootTabView: View {
    @EnvironmentObject private var session: AppSession
    @StateObject private var tabRouter = GlowPathTabRouter()
    @State private var showQuiz = false
    @State private var showIntake = false

    var body: some View {
        TabView(selection: Binding(
            get: { tabRouter.selected },
            set: { tabRouter.selected = $0 }
        )) {
            HomeView(showQuiz: $showQuiz, showIntake: $showIntake)
                .tabItem {
                    Label("Today", systemImage: "sun.max.fill")
                }
                .tag(GlowPathTab.today)

            MyPlanView(showQuiz: $showQuiz)
                .tabItem {
                    Label("Plan", systemImage: "rectangle.stack.fill")
                }
                .tag(GlowPathTab.plan)

            ProviderFinderView()
                .tabItem {
                    Label("Providers", systemImage: "mappin.and.ellipse")
                }
                .tag(GlowPathTab.find)

            FacialAnalysisScanView()
                .tabItem {
                    Label("Scan", systemImage: "camera.viewfinder")
                }
                .tag(GlowPathTab.scan)
        }
        .environmentObject(tabRouter)
        .onChange(of: tabRouter.pendingQuizPresentation) { _, shouldShow in
            guard shouldShow else { return }
            showQuiz = true
            tabRouter.pendingQuizPresentation = false
        }
        .fullScreenCover(isPresented: $showQuiz) {
            SkinQuizFlowView {
                showQuiz = false
            }
            .environmentObject(session)
            .environmentObject(tabRouter)
        }
        .sheet(isPresented: $showIntake) {
            SkinIntakeFormView(intake: Binding(
                get: { session.skinIntake },
                set: { session.skinIntake = $0 }
            ))
            .presentationDetents([.large])
            .environmentObject(tabRouter)
        }
    }
}

// MARK: - Today setup (profile, quiz, face map)

struct TodaySetupView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var tabRouter: GlowPathTabRouter
    @Binding var showQuiz: Bool
    @Binding var showIntake: Bool

    private var hasIntake: Bool { session.skinIntake != nil }
    private var hasQuiz: Bool { session.outcome != nil }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Finish these once so Today can show your shelf, providers, and scan readouts in context.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                setupChecklist

                nextStepGradientCard
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Setup")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var setupChecklist: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Checklist")
                .font(.subheadline.weight(.semibold))

            VStack(spacing: 0) {
                setupRow(
                    title: "Skin profile",
                    detail: hasIntake ? "Goals, budget, openness—tap to update" : "Adds goals, tone, and treatment openness",
                    done: hasIntake,
                    action: { showIntake = true }
                )
                Divider().padding(.leading, 36)
                setupRow(
                    title: "Gemstone quiz",
                    detail: hasQuiz ? "Tap to retake or confirm your type" : "Unlocks routines and match % on providers",
                    done: hasQuiz,
                    action: { tabRouter.requestOpenSkinQuiz() }
                )
                Divider().padding(.leading, 36)
                setupRow(
                    title: "Face map",
                    detail: session.faceScan.map { "Last capture: \($0.sourceSummary)" }
                        ?? "Optional—Scan tab has bundled samples offline",
                    done: session.faceScan != nil,
                    action: { tabRouter.select(.scan) }
                )
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
    }

    private func setupRow(title: String, detail: String, done: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: done ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(done ? Color.accentColor : Color.secondary)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.subheadline.weight(.semibold))
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var nextStepGradientCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Next step")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white.opacity(0.9))
                .textCase(.uppercase)

            if !hasIntake {
                Text("Add goals, tone notes, and how far you’ll go in-office—everything downstream uses this.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.95))
                Button {
                    showIntake = true
                } label: {
                    Text("Complete skin profile")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(.white.opacity(0.95), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .foregroundStyle(Color.accentColor)
                }
            } else if !hasQuiz {
                Text("Map your gemstone skin archetype so scans, routines, and provider match scores line up.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.95))
                Button {
                    showQuiz = true
                } label: {
                    Text("Take gemstone quiz")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(.white.opacity(0.95), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .foregroundStyle(Color.accentColor)
                }
            } else {
                Text("You’re done with setup—head back to Today for your daily log and recommendation summary.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.95))
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Color.accentColor, Color.accentColor.opacity(0.75)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        )
    }
}

// MARK: - Today dashboard cards

private struct TodaySkincareLogCard: View {
    @EnvironmentObject private var journal: ProgressJournalStore
    @EnvironmentObject private var session: AppSession
    @State private var showLog = false

    private var todaysEntry: ProgressJournalEntry? {
        let cal = Calendar.current
        return journal.entries.first { cal.isDateInToday($0.loggedAt) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Today's products & check-in")
                .font(.title3.weight(.semibold))
            Text("Log what you used from your shelf and how your skin felt—everything stays on this device.")
                .font(.caption)
                .foregroundStyle(.secondary)

            if let entry = todaysEntry {
                TodayEntryBrief(entry: entry)
            } else {
                Text("No entry yet for today.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Button {
                showLog = true
            } label: {
                Label(
                    todaysEntry == nil ? "Log today's use" : "Edit today's log",
                    systemImage: "square.and.pencil"
                )
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.accentColor.opacity(0.14), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
        .sheet(isPresented: $showLog) {
            LogProgressEntrySheet(gemstone: session.outcome?.profile.primary) { entry in
                replaceTodaysEntry(with: entry)
            }
            .presentationDetents([.large])
        }
    }

    private func replaceTodaysEntry(with entry: ProgressJournalEntry) {
        let cal = Calendar.current
        let ids = journal.entries.filter { cal.isDateInToday($0.loggedAt) }.map(\.id)
        for id in ids {
            journal.remove(id: id)
        }
        journal.add(entry)
    }
}

private struct TodayEntryBrief: View {
    let entry: ProgressJournalEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let s = entry.skinDayScore {
                HStack(spacing: 4) {
                    Text("Skin day")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    HStack(spacing: 2) {
                        ForEach(1 ... 5, id: \.self) { i in
                            Image(systemName: i <= s ? "circle.fill" : "circle")
                                .font(.caption2)
                                .foregroundStyle(i <= s ? Color.accentColor : Color.secondary.opacity(0.45))
                        }
                    }
                }
            }
            if let t = entry.trend {
                Text(t.label)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.accentColor.opacity(0.12), in: Capsule())
            }
            if !entry.productsInPlay.isEmpty {
                Text(entry.productsInPlay.joined(separator: " · "))
                    .font(.subheadline)
                    .foregroundStyle(.primary)
                    .lineLimit(4)
            }
            if !entry.notes.isEmpty {
                Text(entry.notes)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }
        }
    }
}

private struct TodayRecommendationsCard: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var tabRouter: GlowPathTabRouter
    @Binding var showQuiz: Bool
    @Binding var showIntake: Bool

    private var products: [BoutiqueProductRow] {
        guard let g = session.outcome?.profile.primary else { return [] }
        ProductCatalog.loadIfNeeded()
        return Array(ProductCatalog.recommendedProducts(for: g).prefix(5))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Your recommendations")
                .font(.title3.weight(.semibold))

            if let o = session.outcome {
                Text(o.resultLabel)
                    .font(.headline)
                Text(o.resultDescription)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .lineLimit(5)

                if !products.isEmpty {
                    Text("Shelf highlights")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.top, 4)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(products) { row in
                                Text(todayShortProductTitle(row.name))
                                    .font(.caption2.weight(.medium))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 8)
                                    .background(
                                        Capsule().fill(Color.accentColor.opacity(0.12))
                                    )
                            }
                        }
                    }
                }

                Button {
                    tabRouter.select(.plan)
                } label: {
                    Label("Open full routine in Plan", systemImage: "rectangle.stack.fill")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Color.accentColor.opacity(0.14), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
            } else {
                Text("Take the gemstone quiz to see your archetype, routine cards, and product strip matched to you.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Button {
                    tabRouter.requestOpenSkinQuiz()
                } label: {
                    Label("Start gemstone quiz", systemImage: "sparkles")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Color.accentColor.opacity(0.14), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
                .padding(.top, 4)

                NavigationLink {
                    TodaySetupView(showQuiz: $showQuiz, showIntake: $showIntake)
                } label: {
                    Text("Full setup checklist")
                        .font(.caption.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .padding(.top, 2)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
        .onAppear { ProductCatalog.loadIfNeeded() }
    }
}

private func todayShortProductTitle(_ name: String) -> String {
    if let pipe = name.firstIndex(of: "|") {
        return String(name[..<pipe]).trimmingCharacters(in: .whitespaces)
    }
    return name
}

// MARK: - Today (hub)

struct HomeView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var tabRouter: GlowPathTabRouter
    @Binding var showQuiz: Bool
    @Binding var showIntake: Bool

    private var hasIntake: Bool { session.skinIntake != nil }
    private var hasQuiz: Bool { session.outcome != nil }

    private var rankedProviders: [RankedProviderSite] {
        ProviderMatchEngine.rankAll(
            userLocation: nil,
            outcome: session.outcome,
            intake: session.skinIntake
        )
    }

    var body: some View {
        NavigationStack {
            ZStack {
                glowBackground
                ScrollView {
                    VStack(alignment: .leading, spacing: 28) {
                        headerBlock
                        setupIncompleteBanner
                        TodaySkincareLogCard()
                        TodayRecommendationsCard(showQuiz: $showQuiz, showIntake: $showIntake)
                        exploreDestinations
                        providerStrip
                        DisclosureGroup {
                            aboutGlowPathBody
                        } label: {
                            Label("How GlowPath fits together", systemImage: "info.circle")
                                .font(.subheadline.weight(.semibold))
                        }
                        .tint(.secondary)
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 28)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        TodaySetupView(showQuiz: $showQuiz, showIntake: $showIntake)
                    } label: {
                        Text("Setup")
                            .font(.subheadline.weight(.semibold))
                    }
                }
            }
        }
    }

    private var glowBackground: some View {
        LinearGradient(
            colors: [
                Color(red: 0.97, green: 0.94, blue: 0.99),
                Color(red: 0.93, green: 0.95, blue: 0.99),
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }

    private var todayDateLine: String {
        Date().formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
    }

    private var headerBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(todayDateLine)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            Text("Today")
                .font(.system(.largeTitle, design: .serif))
                .fontWeight(.semibold)

            Text("Log what you used, scan your recommendation summary, then jump into any tab.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder
    private var setupIncompleteBanner: some View {
        if !hasIntake || !hasQuiz {
            NavigationLink {
                TodaySetupView(showQuiz: $showQuiz, showIntake: $showIntake)
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "rectangle.stack.fill.badge.plus")
                        .font(.title2)
                        .foregroundStyle(Color.accentColor)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Finish setup for personalized picks")
                            .font(.subheadline.weight(.semibold))
                        Text("Profile + quiz—takes a few minutes. You can still log products below.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.leading)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.tertiary)
                }
                .padding(16)
                .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(Color(.secondarySystemGroupedBackground))
                )
            }
            .buttonStyle(.plain)
        }
    }

    private var providerStripFootnote: String {
        if hasQuiz {
            return "Ranked from your quiz and profile—open a card for education clips and official booking links."
        }
        return "Preview clinics now; after the quiz, the same cards show a fit % tailored to your answers."
    }

    private var providerStrip: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Providers for you")
                    .font(.title3.weight(.semibold))
                Spacer()
                Button("Map & list") {
                    tabRouter.select(.find)
                }
                .font(.subheadline.weight(.semibold))
            }

            Text(providerStripFootnote)
                .font(.caption)
                .foregroundStyle(.secondary)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 14) {
                    ForEach(rankedProviders.prefix(5)) { row in
                        NavigationLink {
                            ProviderSiteDetailView(ranked: row)
                        } label: {
                            ProviderPeekCard(ranked: row)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }

    private var exploreDestinations: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Explore")
                .font(.headline)
            Text("Dive into any area—Plan still has your full AM/PM routine, Learn, and Coach.")
                .font(.caption)
                .foregroundStyle(.secondary)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                quickTile(title: "Skin profile", subtitle: "Goals & openness", icon: "person.crop.circle") {
                    showIntake = true
                }
                quickTile(title: "Gemstone quiz", subtitle: "Archetype & picks", icon: "sparkles") {
                    tabRouter.requestOpenSkinQuiz()
                }
                quickTile(title: "Face scan", subtitle: "Samples + readout", icon: "camera.viewfinder") {
                    tabRouter.select(.scan)
                }
                quickTile(title: "Providers", subtitle: "Map & ranked list", icon: "mappin.and.ellipse") {
                    tabRouter.select(.find)
                }
                quickTile(title: "My plan", subtitle: "Routine & face map", icon: "rectangle.stack.fill") {
                    tabRouter.select(.plan)
                }
                quickTile(title: "Learn", subtitle: "Treatments library", icon: "books.vertical") {
                    tabRouter.openPlanGuide(.learn)
                }
                quickTile(title: "Coach", subtitle: "Chat-style guidance", icon: "bubble.left.and.bubble.right") {
                    tabRouter.openPlanGuide(.coach)
                }
            }
        }
    }

    private func quickTile(title: String, subtitle: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(Color.accentColor)
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(subtitle)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color(.secondarySystemGroupedBackground))
            )
        }
        .buttonStyle(.plain)
    }

    private var aboutGlowPathBody: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("GlowPath mirrors the best consumer derm flows: on-device scanning for where to focus, education with clear escalation, then a consult prep handoff so offices see goals and timeline—not a cold lead.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Text("Partner clinics use the same public links you would open on the web. The tab bar stays simple: Today, Plan (includes Learn + Coach), Scan, and Providers.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.top, 6)
    }
}

// MARK: - Provider peek card (Today tab)

private struct ProviderPeekCard: View {
    let ranked: RankedProviderSite

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            if let u = ranked.site.listingThumbnailURL {
                AsyncImage(url: u) { phase in
                    switch phase {
                    case .empty:
                        RoundedRectangle(cornerRadius: 18)
                            .fill(Color(.tertiarySystemFill))
                            .frame(width: 200, height: 150)
                            .overlay { ProgressView() }
                    case let .success(img):
                        ZStack {
                            RoundedRectangle(cornerRadius: 18)
                                .fill(Color(.secondarySystemGroupedBackground))
                            img
                                .resizable()
                                .scaledToFit()
                                .padding(
                                    ["thetreatment", "wellnestmd", "slimstudio"].contains(ranked.site.organizationId)
                                        ? 20 : 12
                                )
                        }
                        .frame(width: 200, height: 150)
                        .clipped()
                    default:
                        RoundedRectangle(cornerRadius: 18)
                            .fill(Color(.tertiarySystemFill))
                            .frame(width: 200, height: 150)
                    }
                }
            } else {
                RoundedRectangle(cornerRadius: 18)
                    .fill(Color(.tertiarySystemFill))
                    .frame(width: 200, height: 150)
            }

            LinearGradient(
                colors: [.black.opacity(0.7), .clear],
                startPoint: .bottom,
                endPoint: .center
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text("\(ranked.matchPercent)% match")
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(.ultraThinMaterial, in: Capsule())
                Text(ranked.site.displayName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
            }
            .padding(12)
        }
        .frame(width: 200, height: 150)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: .black.opacity(0.12), radius: 8, y: 4)
    }
}

// MARK: - Plan

struct MyPlanView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var tabRouter: GlowPathTabRouter
    @Binding var showQuiz: Bool
    @State private var guidePath: [PlanGuideDestination] = []

    var body: some View {
        NavigationStack(path: $guidePath) {
            Group {
                if session.outcome == nil {
                    ContentUnavailableView(
                        "No plan yet",
                        systemImage: "heart.text.square",
                        description: Text("Finish the gemstone quiz from Today, then return here—analysis, routine, glow map, and provider prep flow as one page.")
                    )
                    .toolbar {
                        ToolbarItem(placement: .primaryAction) {
                            Button("Start quiz") { showQuiz = true }
                        }
                    }
                    .safeAreaInset(edge: .bottom) {
                        Button {
                            tabRouter.select(.today)
                        } label: {
                            Label("Back to Today", systemImage: "sun.max.fill")
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(Color.accentColor.opacity(0.15), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        .padding(.horizontal, 24)
                        .padding(.bottom, 8)
                    }
                } else if let outcome = session.outcome {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 22) {
                            PlanSectionHeader(
                                title: "Your profile",
                                subtitle: "Gemstone type and goals at a glance."
                            )
                            planSummaryCard(outcome: outcome)

                            PlanSectionHeader(
                                title: "Your routine",
                                subtitle: "Order follows your shelf picks—SPF in the morning; retinoids and strong actives at night unless your clinician adjusts."
                            )
                            RoutineAmPmPlanView(
                                gemstone: outcome.profile.primary,
                                showChrome: false
                            )
                            PlanShelfDisclosureGroup(gemstone: outcome.profile.primary)

                            PlanSectionHeader(
                                title: "Quiz snapshot",
                                subtitle: "Three scores from your answers—educational, not a diagnosis."
                            )
                            AnalysisOverviewView(outcome: outcome, planCompactMode: true)

                            PlanSectionHeader(
                                title: "Progress journal",
                                subtitle: "Short check-ins stay on this device."
                            )
                            ProgressJournalSection(compactIntro: true)

                            PlanSectionHeader(
                                title: "Go deeper",
                                subtitle: "Optional reads when you want more context than this page."
                            )
                            PlanGuidePushRow(
                                destination: .learn,
                                icon: "books.vertical",
                                title: "Learn",
                                caption: "Procedure explainers and tone-aware prompts.",
                                buttonTitle: "Open"
                            )
                            PlanGuidePushRow(
                                destination: .coach,
                                icon: "bubble.left.and.bubble.right",
                                title: "Coach",
                                caption: "Ingredient guardrails and questions for your derm or aesthetician.",
                                buttonTitle: "Open"
                            )

                            PlanSectionHeader(
                                title: "Tools & next steps",
                                subtitle: "Same features live on Scan and Providers in the tab bar."
                            )
                            PlanCrossLinkCard(
                                icon: "camera.viewfinder",
                                title: "Scan",
                                caption: "Live capture and framing for follow-up photos.",
                                buttonTitle: "Open",
                                tab: .scan
                            )
                            PlanCrossLinkCard(
                                icon: "mappin.and.ellipse",
                                title: "Providers",
                                caption: "Matched med-spa pins, reels, and booking links.",
                                buttonTitle: "Open",
                                tab: .find
                            )
                            FaceMirrorView(planCompact: true)
                            ProviderReadinessView()
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 12)
                        .padding(.bottom, 28)
                    }
                    .navigationTitle("My plan")
                    .toolbar {
                        ToolbarItem(placement: .primaryAction) {
                            Button("Retake quiz") { showQuiz = true }
                        }
                    }
                }
            }
            .navigationDestination(for: PlanGuideDestination.self) { dest in
                switch dest {
                case .learn:
                    TreatmentExplorerView()
                case .coach:
                    SkinCoachView()
                }
            }
        }
        .onAppear { consumePlanGuideDeepLink() }
        .onChange(of: tabRouter.selected) { _, new in
            if new == .plan { consumePlanGuideDeepLink() }
        }
        .onChange(of: tabRouter.planGuideDestination) { _, _ in
            consumePlanGuideDeepLink()
        }
    }

    private func consumePlanGuideDeepLink() {
        guard tabRouter.selected == .plan else { return }
        guard let next = tabRouter.planGuideDestination else { return }
        if guidePath.last != next {
            guidePath.append(next)
        }
        tabRouter.planGuideDestination = nil
    }

    private func planSummaryCard(outcome: QuizOutcome) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(outcome.resultLabel)
                .font(.title2.weight(.semibold))
            Text(outcome.resultDescription)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(5)
                .fixedSize(horizontal: false, vertical: true)
            if let intake = session.skinIntake, !intake.goals.isEmpty {
                Text("Goals: \(intake.goals.map(\.displayName).joined(separator: " · "))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
    }
}

// MARK: - Plan page chrome

private struct PlanSectionHeader: View {
    let title: String
    var subtitle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.title3.weight(.semibold))
            if let subtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 4)
    }
}

private struct PlanShelfDisclosureGroup: View {
    let gemstone: GemstoneId
    @State private var isExpanded = false

    var body: some View {
        DisclosureGroup(isExpanded: $isExpanded) {
            ProductRecommendationsView(gemstone: gemstone, showChrome: false)
                .padding(.top, 4)
        } label: {
            Label("Shop links & prices", systemImage: "bag")
                .font(.subheadline.weight(.semibold))
        }
        .tint(Color.accentColor)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
    }
}

/// Pushes Learn or Coach onto the Plan `NavigationStack` (same screens as before—no extra tab).
private struct PlanGuidePushRow: View {
    let destination: PlanGuideDestination
    let icon: String
    let title: String
    let caption: String
    let buttonTitle: String

    var body: some View {
        NavigationLink(value: destination) {
            HStack(alignment: .center, spacing: 14) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(Color.accentColor)
                    .frame(width: 40, alignment: .center)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.subheadline.weight(.semibold))
                    Text(caption)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                Text(buttonTitle)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.accentColor)
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.tertiary)
            }
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Color.accentColor.opacity(0.25), lineWidth: 1)
                    .background(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(Color.accentColor.opacity(0.06))
                    )
            )
            .padding(.horizontal, 4)
        }
        .buttonStyle(.plain)
    }
}

/// Jump to Scan or Providers tab from Plan.
private struct PlanCrossLinkCard: View {
    @EnvironmentObject private var tabRouter: GlowPathTabRouter
    let icon: String
    let title: String
    let caption: String
    let buttonTitle: String
    let tab: GlowPathTab

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(Color.accentColor)
                .frame(width: 40, alignment: .center)
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(caption)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 8)
            Button(buttonTitle) {
                tabRouter.select(tab)
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.accentColor.opacity(0.25), lineWidth: 1)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Color.accentColor.opacity(0.06))
                )
        )
        .padding(.horizontal, 4)
    }
}
