import AVKit
import CoreLocation
import MapKit
import SwiftUI

private enum ProviderEducationUI {
    /// Judge MD detail shows this many clips before "View all videos".
    static let judgemdSpotlightPreviewCount = 4
}

/// Geography-first provider discovery with heuristic match scores (seed partners in `GlowProviderDirectory`).
struct ProviderFinderView: View {
    @EnvironmentObject private var session: AppSession
    @StateObject private var location = LocationModel()
    @State private var ranked: [RankedProviderSite] = []
    @State private var mapPosition: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 36.5, longitude: -117.5),
            span: MKCoordinateSpan(latitudeDelta: 8, longitudeDelta: 8)
        )
    )

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                Color(.systemGroupedBackground).ignoresSafeArea()

                VStack(spacing: 0) {
                    mapBlock

                    List {
                        Section {
                            Text("GlowPath ranks partner clinics—including Judge MD, The Treatment, Wellnest MD, and Slim Studio—using your quiz, goals, and optional location. This is not medical triage. Review pages may show short Google review excerpts when available.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                                .listRowBackground(Color.clear)
                        }

                        Section {
                            ForEach(ranked) { row in
                                NavigationLink {
                                    ProviderSiteDetailView(ranked: row)
                                } label: {
                                    ProviderRowLabel(ranked: row, hasLocation: location.userLocation != nil)
                                }
                                .listRowBackground(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .fill(Color(.secondarySystemGroupedBackground))
                                        .padding(.vertical, 4)
                                )
                            }
                        } header: {
                            HStack {
                                Text("Ranked for you")
                                Spacer()
                                if location.userLocation != nil {
                                    Label("Sorted by fit & distance", systemImage: "location.fill")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        } footer: {
                            Text("Match scores are estimates, not medical advice. Detail screens may show short Google review excerpts when we have them.")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Providers")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        location.requestWhenInUse()
                    } label: {
                        Image(systemName: "location.circle.fill")
                    }
                    .accessibilityLabel("Update location")
                }
            }
            .onAppear {
                refreshRanked()
                location.requestWhenInUse()
            }
            .onChange(of: location.userLocation) { _, _ in
                refreshRanked()
                if let u = location.userLocation {
                    mapPosition = .region(
                        MKCoordinateRegion(
                            center: u.coordinate,
                            span: MKCoordinateSpan(latitudeDelta: 2.5, longitudeDelta: 2.5)
                        )
                    )
                }
            }
            .onChange(of: session.outcome?.completedAt) { _, _ in refreshRanked() }
            .onChange(of: session.skinIntake?.updatedAt) { _, _ in refreshRanked() }
        }
    }

    private var mapBlock: some View {
        ZStack(alignment: .topTrailing) {
            Map(position: $mapPosition) {
                if let u = location.userLocation {
                    Annotation("You", coordinate: u.coordinate) {
                        ZStack {
                            Circle().fill(.blue.opacity(0.28)).frame(width: 48, height: 48)
                            Image(systemName: "location.circle.fill")
                                .font(.title2)
                                .foregroundStyle(.blue)
                        }
                    }
                }
                ForEach(ranked) { row in
                    Annotation(row.site.displayName, coordinate: row.site.coordinate) {
                        VStack(spacing: 2) {
                            Image(systemName: "mappin.circle.fill")
                                .font(.title)
                                .foregroundStyle(Color.accentColor)
                                .shadow(color: .black.opacity(0.12), radius: 2, y: 1)
                            Text("\(row.matchPercent)%")
                                .font(.caption2)
                                .fontWeight(.bold)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(.ultraThinMaterial, in: Capsule())
                        }
                    }
                }
            }
            .mapStyle(.standard(elevation: .realistic))
            .frame(height: 260)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .padding(.horizontal, 16)
            .padding(.top, 8)

            if location.authorization == .denied || location.authorization == .restricted {
                Text("Location off")
                    .font(.caption2)
                    .fontWeight(.medium)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(24)
            }
        }
    }

    private func refreshRanked() {
        ranked = ProviderMatchEngine.rankAll(
            userLocation: location.userLocation,
            outcome: session.outcome,
            intake: session.skinIntake
        )
    }
}

private struct ProviderRowLabel: View {
    let ranked: RankedProviderSite
    let hasLocation: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(ranked.site.displayName)
                    .font(.headline)
                Spacer()
                Text("\(ranked.matchPercent)%")
                    .font(.subheadline)
                    .fontWeight(.bold)
                    .foregroundStyle(Color.accentColor)
            }
            if let m = ranked.distanceMeters, hasLocation {
                Text(String(format: "%.1f mi away", m / 1609.34))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Text(ranked.site.headlineOfferings)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .padding(.vertical, 6)
    }
}

// MARK: - Provider detail (hero, reels, gallery, reviews)

private struct StreamPresentation: Identifiable {
    let id = UUID()
    let url: URL
}

struct ProviderSiteDetailView: View {
    let ranked: RankedProviderSite
    @State private var streamPresentation: StreamPresentation?
    @State private var webSheet: GlowWebSheetItem?
    @State private var gallerySelection: Int = 0

    private let heroHeight: CGFloat = 220

    private func educationSpotlightFootnote(for orgId: String) -> String {
        switch orgId {
        case "judgemd":
            return "Short clips from Judge MD to set expectations before a visit. They help you prepare questions—they don’t replace your surgeon’s advice or informed consent."
        case "thetreatment":
            return "Open each topic in the app to read how The Treatment explains injectables, lasers, and facials before you book."
        case "wellnestmd":
            return "Links open wellnestmd.com for concierge medicine, aesthetics, regenerative therapies, and wellness offerings—always confirm details with their team."
        case "slimstudio":
            return "Links open slimstudioatlanta.com for CoolSculpting Elite, EMSculpt NEO, injectables, and the Slim Studio skin-type companion—confirm before booking."
        default:
            return "Open each partner link in the in-app browser to read their own patient-facing materials before you book."
        }
    }

    private func gallerySectionFootnote(for orgId: String) -> String {
        switch orgId {
        case "judgemd":
            return "Before-and-after stills from Judge MD’s public gallery—facial, breast, and body examples. They illustrate possibilities, not a promise of your outcome."
        case "thetreatment":
            return "Product and routine photos from The Treatment’s shop—helpful retail context, not a substitute for in-office before-and-afters."
        case "wellnestmd", "slimstudio":
            return "When stills are present they come from each clinic’s public marketing—always cross-check timing, consent, and disclaimers on their live site."
        default:
            return "Imagery is illustrative context from the partner’s public channels—not a promise of your outcome."
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                hero
                VStack(alignment: .leading, spacing: 22) {
                    matchBlock
                    if !ranked.site.spotlightVideos.isEmpty {
                        spotlightSection
                    }
                    if let org = ranked.site.organization {
                        orgCard(org)
                    }
                    gallerySection
                    reviewsSection
                    similarSection
                    tagsSection
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 120)
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(ranked.site.shortAddress)
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(item: $streamPresentation) { item in
            ProviderVideoFullScreenPlayer(streamURL: item.url) {
                streamPresentation = nil
            }
        }
        .sheet(item: $webSheet) { item in
            GlowWebShellView(initialURL: item.url, suggestedNavigationTitle: item.pageTitle)
                .presentationDragIndicator(.visible)
        }
        .safeAreaInset(edge: .bottom) {
            bottomCTA
        }
    }

    private var heroImageURL: URL? {
        if heroUsesBrandLogo {
            return ranked.site.listingThumbnailURL
        }
        return ranked.site.beforeAfterImageURLs.first.flatMap { URL(string: $0) }
    }

    private var heroUsesBrandLogo: Bool {
        switch ranked.site.organizationId {
        case "thetreatment", "wellnestmd", "slimstudio":
            return true
        default:
            return false
        }
    }

    private var hero: some View {
        ZStack(alignment: .bottomLeading) {
            if let u = heroImageURL {
                AsyncImage(url: u) { phase in
                    switch phase {
                    case .empty:
                        Rectangle().fill(Color(.tertiarySystemFill)).frame(height: heroHeight)
                            .overlay { ProgressView() }
                    case let .success(img):
                        Group {
                            if heroUsesBrandLogo {
                                ZStack {
                                    LinearGradient(
                                        colors: [
                                            Color(.secondarySystemGroupedBackground),
                                            Color.accentColor.opacity(0.2),
                                        ],
                                        startPoint: .top,
                                        endPoint: .bottom
                                    )
                                    img
                                        .resizable()
                                        .scaledToFit()
                                        .padding(.horizontal, 40)
                                        .padding(.vertical, 36)
                                }
                                .frame(height: heroHeight)
                                .clipped()
                            } else {
                                img
                                    .resizable()
                                    .scaledToFill()
                                    .frame(height: heroHeight)
                                    .clipped()
                            }
                        }
                    default:
                        Rectangle().fill(Color(.tertiarySystemFill)).frame(height: heroHeight)
                    }
                }
            } else {
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [Color.accentColor.opacity(0.35), Color(.systemGroupedBackground)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(height: heroHeight)
            }

            LinearGradient(
                colors: [.black.opacity(0.55), .black.opacity(0.05), .clear],
                startPoint: .bottom,
                endPoint: .center
            )
            .frame(height: heroHeight)

            VStack(alignment: .leading, spacing: 6) {
                Text(ranked.site.displayName)
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundStyle(.white)
                    .shadow(radius: 4)
                Text(ranked.site.headlineOfferings)
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.92))
                    .lineLimit(3)
                    .shadow(radius: 2)
            }
            .padding(20)
        }
        .frame(height: heroHeight)
        .clipShape(RoundedRectangle(cornerRadius: 0))
    }

    private var matchBlock: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Text("\(ranked.matchPercent)% match")
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundStyle(Color.accentColor)
                Text("to your signals")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Text("Heuristic from your gemstone quiz, skin profile, and treatment openness—not a diagnosis.")
                .font(.caption)
                .foregroundStyle(.secondary)

            if !ranked.matchReasons.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(ranked.matchReasons, id: \.self) { r in
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(Color.accentColor)
                                .imageScale(.small)
                            Text(r)
                                .font(.subheadline)
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
    }

    private var spotlightSection: some View {
        let videos = ranked.site.spotlightVideos
        let isJudge = ranked.site.organizationId == "judgemd"
        let previewCount = ProviderEducationUI.judgemdSpotlightPreviewCount
        let previewVideos = isJudge ? Array(videos.prefix(previewCount)) : videos
        let showViewAll = isJudge && videos.count > previewCount

        return VStack(alignment: .leading, spacing: 16) {
            Text("Education")
                .font(.title3)
                .fontWeight(.semibold)

            Text(educationSpotlightFootnote(for: ranked.site.organizationId))
            .font(.footnote)
            .foregroundStyle(.secondary)

            VStack(spacing: 14) {
                ForEach(previewVideos) { clip in
                    EducationClipRow(
                        clip: clip,
                        onPlayInApp: {
                            if let s = clip.streamURL {
                                streamPresentation = StreamPresentation(url: s)
                            }
                        },
                        onOpenWeb: { url in
                            webSheet = GlowWebSheetItem(url: url, pageTitle: clip.title)
                        }
                    )
                }

                if showViewAll {
                    NavigationLink {
                        EducationClipsFullListView(
                            clips: videos,
                            onPlayStream: { streamPresentation = StreamPresentation(url: $0) },
                            onOpenWeb: { url, title in
                                webSheet = GlowWebSheetItem(url: url, pageTitle: title)
                            }
                        )
                    } label: {
                        HStack {
                            Text("View all \(videos.count) videos")
                                .font(.subheadline.weight(.semibold))
                            Spacer(minLength: 8)
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(.secondary)
                        }
                        .foregroundStyle(Color.accentColor)
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(Color(.secondarySystemGroupedBackground))
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func orgCard(_ org: GlowProviderOrganization) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Why we list them")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .padding(.bottom, 8)

            Text(org.legalName)
                .font(.title3.weight(.semibold))
                .fixedSize(horizontal: false, vertical: true)
                .padding(.bottom, 12)

            Divider()

            Text("How we align")
                .font(.subheadline.weight(.semibold))
                .padding(.top, 12)
                .padding(.bottom, 6)

            Text(org.credentialNote)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .lineSpacing(5)
                .fixedSize(horizontal: false, vertical: true)

            Divider()
                .padding(.vertical, 14)

            Text("Why we trust this listing")
                .font(.subheadline.weight(.semibold))
                .padding(.bottom, 8)

            VettingSignalsView(signals: org.vettingSignals)

            if !org.dashboardSiblings.isEmpty {
                Text("Related brands")
                    .font(.subheadline.weight(.semibold))
                    .padding(.top, 16)
                    .padding(.bottom, 8)

                DashboardSiblingsView(siblings: org.dashboardSiblings)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
    }

    private var gallerySection: some View {
        Group {
            if ranked.site.beforeAfterImageURLs.isEmpty {
                EmptyView()
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Gallery & stills")
                        .font(.title3)
                        .fontWeight(.semibold)
                    Text(gallerySectionFootnote(for: ranked.site.organizationId))
                    .font(.caption)
                    .foregroundStyle(.secondary)

                    TabView(selection: $gallerySelection) {
                        ForEach(Array(ranked.site.beforeAfterImageURLs.enumerated()), id: \.offset) { idx, urlStr in
                            Group {
                                if let u = URL(string: urlStr) {
                                    AsyncImage(url: u) { phase in
                                        switch phase {
                                        case .empty:
                                            RoundedRectangle(cornerRadius: 16)
                                                .fill(Color(.tertiarySystemFill))
                                                .aspectRatio(1, contentMode: .fit)
                                                .overlay { ProgressView() }
                                        case let .success(img):
                                            img
                                                .resizable()
                                                .scaledToFill()
                                                .frame(maxWidth: .infinity)
                                                .containerRelativeFrame(.horizontal)
                                                .clipped()
                                        default:
                                            RoundedRectangle(cornerRadius: 16)
                                                .fill(Color(.tertiarySystemFill))
                                                .aspectRatio(1, contentMode: .fit)
                                        }
                                    }
                                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                                } else {
                                    RoundedRectangle(cornerRadius: 16)
                                        .fill(Color(.tertiarySystemFill))
                                        .aspectRatio(1, contentMode: .fit)
                                }
                            }
                            .tag(idx)
                        }
                    }
                    .frame(height: 280)
                    .tabViewStyle(.page(indexDisplayMode: .automatic))
                }
            }
        }
    }

    private var reviewsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Reviews")
                .font(.title3)
                .fontWeight(.semibold)

            if let avg = ranked.site.googleReviewAverage, let count = ranked.site.googleReviewCount {
                StarRow(stars: avg)
                Text("\(count) public Google reviews · \(String(format: "%.1f", avg)) average (listing snapshot)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(ranked.site.reviewBlurbIllustrative)
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                if !ranked.site.googleReviewExcerpts.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        ForEach(ranked.site.googleReviewExcerpts) { ex in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text(ex.author)
                                        .font(.subheadline.weight(.semibold))
                                    Spacer()
                                    Text(ex.timeframe)
                                        .font(.caption2)
                                        .foregroundStyle(.tertiary)
                                }
                                Text(ex.body)
                                    .font(.footnote)
                                    .foregroundStyle(.primary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(Color(.tertiarySystemGroupedBackground))
                            )
                        }
                    }
                }

                Text(GlowProviderSite.googleExcerptsDisclaimer)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)

                if let u = ranked.site.reviewsWebURL {
                    Button {
                        webSheet = GlowWebSheetItem(url: u, pageTitle: "Reviews")
                    } label: {
                        Label("Open Google Maps listing", systemImage: "map")
                            .font(.subheadline.weight(.semibold))
                    }
                    .buttonStyle(.bordered)
                }
            } else {
                StarRow(stars: ranked.site.reviewStarsIllustrative)
                Text(ranked.site.reviewBlurbIllustrative)
                    .font(.footnote)
                Text(GlowProviderSite.illustrativeRatingDisclaimer)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                if let u = ranked.site.reviewsWebURL {
                    Button {
                        webSheet = GlowWebSheetItem(url: u, pageTitle: "Reviews")
                    } label: {
                        Label("Search independent reviews", systemImage: "globe")
                            .font(.subheadline.weight(.semibold))
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
    }

    private var similarSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Compare & cross-shop")
                .font(.headline)
            Text(ranked.site.similarBlurb)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private var tagsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("What they offer")
                .font(.headline)
            FlowBadges(tags: ranked.site.treatmentTags)
        }
    }

    private var bottomCTA: some View {
        HStack(spacing: 12) {
            if let u = ranked.site.bookingWebURL {
                Button {
                    webSheet = GlowWebSheetItem(url: u, pageTitle: "Book")
                } label: {
                    Label("Book", systemImage: "calendar")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.accentColor)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
            }
            if let u = ranked.site.galleryWebURL {
                Button {
                    webSheet = GlowWebSheetItem(url: u, pageTitle: "Gallery")
                } label: {
                    Label("Gallery", systemImage: "photo.on.rectangle.angled")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color(.secondarySystemGroupedBackground))
                        .foregroundStyle(.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
    }
}

// MARK: - Education clip row

private struct EducationClipsFullListView: View {
    let clips: [GlowSpotlightVideo]
    let onPlayStream: (URL) -> Void
    let onOpenWeb: (URL, String) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Short clips from Judge MD. Use them to learn common terms and questions to ask at your consultation—they aren’t medical advice.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                ForEach(clips) { clip in
                    EducationClipRow(
                        clip: clip,
                        onPlayInApp: {
                            if let u = clip.streamURL {
                                onPlayStream(u)
                            }
                        },
                        onOpenWeb: { url in
                            onOpenWeb(url, clip.title)
                        }
                    )
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 12)
            .padding(.bottom, 24)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("All videos")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct EducationClipRow: View {
    let clip: GlowSpotlightVideo
    var onPlayInApp: () -> Void
    var onOpenWeb: (URL) -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            clipThumbnail
                .frame(width: 108, height: 148)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

            VStack(alignment: .leading, spacing: 8) {
                Text(clip.title)
                    .font(.headline)
                if let sub = clip.subtitle {
                    Text(sub)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                }
                Text(clip.whyShown)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 12) {
                    if clip.streamURL != nil {
                        Button(action: onPlayInApp) {
                            Label("Play", systemImage: "play.circle.fill")
                                .font(.subheadline.weight(.semibold))
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.small)
                    }
                    if let webURL = clip.safariURL {
                        Button {
                            onOpenWeb(webURL)
                        } label: {
                            Label(clip.streamURL != nil ? "View site" : "View page", systemImage: "globe")
                                .font(.subheadline.weight(.semibold))
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                    }
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

    @ViewBuilder
    private var clipThumbnail: some View {
        ZStack {
            clipThumbnailFill

            if clip.streamURL != nil {
                Image(systemName: "play.circle.fill")
                    .font(.system(size: 36))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.35), radius: 4, y: 1)
            }

            if clip.streamURL == nil {
                VStack {
                    Spacer(minLength: 0)
                    HStack {
                        Spacer(minLength: 0)
                        Image(systemName: "safari")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 5)
                            .background(.ultraThinMaterial, in: Capsule())
                            .padding(8)
                    }
                }
            }
        }
    }

    /// Image or gradient + symbol when poster is missing or fails to load.
    @ViewBuilder
    private var clipThumbnailFill: some View {
        if let p = clip.posterURL {
            AsyncImage(url: p) { phase in
                switch phase {
                case .empty:
                    RoundedRectangle(cornerRadius: 14)
                        .fill(Color(.tertiarySystemFill))
                        .overlay { ProgressView() }
                case let .success(img):
                    img
                        .resizable()
                        .scaledToFill()
                case .failure:
                    educationThumbnailPlaceholder
                @unknown default:
                    educationThumbnailPlaceholder
                }
            }
        } else {
            educationThumbnailPlaceholder
        }
    }

    private var educationThumbnailPlaceholder: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color.accentColor.opacity(0.55),
                    Color.accentColor.opacity(0.2),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Image(systemName: Self.educationSymbol(forClipId: clip.id))
                .font(.system(size: 38, weight: .medium))
                .foregroundStyle(.white.opacity(0.92))
                .symbolRenderingMode(.hierarchical)
        }
    }

    private static func educationSymbol(forClipId id: String) -> String {
        switch id {
        case "wn-body-scan": return "figure.stand"
        case "wn-peptides": return "cross.vial.fill"
        case "wn-concierge": return "heart.text.square.fill"
        case "wn-weight": return "scalemass.fill"
        case "wn-cryo": return "snowflake"
        case "slim-cool": return "thermometer.snowflake"
        case "slim-neo": return "figure.strengthtraining.traditional"
        case "slim-botox": return "face.smiling"
        case "slim-fillers": return "sparkles"
        case let s where s.hasPrefix("tt-"): return "leaf.fill"
        case "wn-home": return "building.columns.fill"
        case "slim-skin-quiz": return "questionmark.circle.fill"
        default: return "book.pages.fill"
        }
    }
}

// MARK: - Full-screen video

private struct ProviderVideoFullScreenPlayer: View {
    let streamURL: URL
    var onClose: () -> Void
    @State private var player: AVPlayer?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                if let player {
                    VideoPlayer(player: player)
                        .tint(.white)
                } else {
                    ProgressView()
                        .tint(.white)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        player?.pause()
                        player = nil
                        onClose()
                    }
                }
            }
            .onAppear {
                let p = AVPlayer(url: streamURL)
                player = p
                p.play()
            }
            .onDisappear {
                player?.pause()
                player = nil
            }
        }
    }
}

private struct StarRow: View {
    let stars: Double

    var body: some View {
        HStack(spacing: 2) {
            ForEach(0 ..< 5, id: \.self) { i in
                Image(systemName: starName(index: i))
                    .foregroundStyle(.yellow)
            }
            Text(String(format: "%.1f", stars))
                .font(.subheadline)
                .padding(.leading, 4)
        }
    }

    private func starName(index: Int) -> String {
        let t = stars - Double(index)
        if t >= 1 { return "star.fill" }
        if t >= 0.5 { return "star.leadinghalf.filled" }
        return "star"
    }
}

private struct VettingSignalsView: View {
    let signals: [GlowVettingSignal]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(signals) { signal in
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.body)
                        .foregroundStyle(Color.accentColor)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(signal.headline)
                            .font(.subheadline.weight(.semibold))
                        Text(signal.detail)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(.tertiarySystemGroupedBackground))
        )
    }
}

private struct DashboardSiblingsView: View {
    let siblings: [GlowDashboardSibling]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(siblings.enumerated()), id: \.element.id) { index, sibling in
                HStack(alignment: .top, spacing: 12) {
                    RoundedRectangle(cornerRadius: 2, style: .continuous)
                        .fill(Color.accentColor.opacity(0.45))
                        .frame(width: 3, height: 40)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(sibling.name)
                            .font(.subheadline.weight(.semibold))
                        Text(sibling.summary)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.vertical, 10)
                if index < siblings.count - 1 {
                    Divider()
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color.secondary.opacity(0.2), lineWidth: 1)
        )
    }
}

private struct FlowBadges: View {
    let tags: [String]

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 72), spacing: 6)], spacing: 6) {
            ForEach(tags, id: \.self) { t in
                Text(t)
                    .font(.caption2)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .frame(maxWidth: .infinity)
                    .background(Capsule().fill(Color.accentColor.opacity(0.15)))
            }
        }
    }
}

// MARK: - Location

final class LocationModel: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    @Published var userLocation: CLLocation?
    @Published var authorization: CLAuthorizationStatus = .notDetermined

    override init() {
        super.init()
        manager.delegate = self
        authorization = manager.authorizationStatus
    }

    func requestWhenInUse() {
        manager.requestWhenInUseAuthorization()
        manager.startUpdatingLocation()
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorization = manager.authorizationStatus
        if authorization == .authorizedWhenInUse || authorization == .authorizedAlways {
            manager.startUpdatingLocation()
        }
    }

    func locationManager(_: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        userLocation = loc
        manager.stopUpdatingLocation()
    }

    func locationManager(_: CLLocationManager, didFailWithError _: Error) {}
}
