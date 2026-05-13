import CoreLocation
import Foundation

// MARK: - Models

/// Short excerpt from a public Google review (attributed; verify live listing before booking).
struct GlowReviewExcerpt: Identifiable, Hashable {
    let id: String
    let author: String
    let timeframe: String
    let body: String
}

/// Provider education: optional in-app video (`streamURL`) or topic link opened in the in-app browser (`safariURL`).
struct GlowSpotlightVideo: Identifiable, Hashable {
    let id: String
    let title: String
    let subtitle: String?
    /// Shown under each item—patient-facing context only (not medical advice).
    let whyShown: String
    let streamURL: URL?
    let posterURL: URL?
    let safariURL: URL?
}

/// One physical site for a brand (Judge MD, The Treatment, etc.).
struct GlowProviderSite: Identifiable, Hashable {
    let id: String
    /// Stable org key, e.g. `judgemd`, `thetreatment`.
    let organizationId: String
    let displayName: String
    let shortAddress: String
    let latitude: Double
    let longitude: Double
    /// Shown as the headline on provider cards and detail.
    let headlineOfferings: String
    let treatmentTags: [String]
    let beforeAfterImageURLs: [String]
    /// Curated clips / deep links surfaced on the provider detail screen.
    let spotlightVideos: [GlowSpotlightVideo]
    let galleryWebURL: URL?
    let bookingWebURL: URL?
    let reviewsWebURL: URL?
    /// When set, `googleReviewExcerpts` are summarized from the public Google listing for this address.
    let googleReviewAverage: Double?
    let googleReviewCount: Int?
    let googleReviewExcerpts: [GlowReviewExcerpt]
    /// Used when `googleReviewAverage` is nil (e.g. Treatment seed without a scraped listing).
    let reviewStarsIllustrative: Double
    let reviewBlurbIllustrative: String
    let similarBlurb: String

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    static let illustrativeRatingDisclaimer =
        "Star rating here is an illustrative composite for this demo build when no Google listing snapshot is wired. Always verify recent reviews before booking."

    static let googleExcerptsDisclaimer =
        "Excerpts are shortened from public Google reviews for this business listing and may be edited for length. GlowPath does not verify authenticity beyond what Google shows; open the live listing for the full thread, photos, and critical feedback."

    var organization: GlowProviderOrganization? {
        GlowProviderDirectory.organization(orgId: organizationId)
    }

    /// Prefer official brand logo for list/map cards; fall back to first gallery still.
    var listingThumbnailURL: URL? {
        if organizationId == "thetreatment", let bundled = GlowProviderDirectory.theTreatmentBundledLogoURL {
            return bundled
        }
        if organizationId == "wellnestmd", let bundled = GlowProviderDirectory.wellnestBundledLogoURL {
            return bundled
        }
        if organizationId == "slimstudio", let bundled = GlowProviderDirectory.slimStudioBundledLogoURL {
            return bundled
        }
        if let raw = organization?.brandLogoImageURL, let u = URL(string: raw) {
            return u
        }
        return beforeAfterImageURLs.first.flatMap { URL(string: $0) }
    }
}

/// Short headline + caption for the provider detail “vetting” block (replaces cramped multi-line pills).
struct GlowVettingSignal: Identifiable, Hashable {
    let id: String
    let headline: String
    let detail: String
}

/// Partner brands that can appear on the same GlowPath intake paths when selected at your clinic.
struct GlowDashboardSibling: Identifiable, Hashable {
    let id: String
    let name: String
    let summary: String
    let webURL: URL?
}

struct GlowProviderOrganization: Identifiable, Hashable {
    let id: String
    let legalName: String
    let credentialNote: String
    let vettingSignals: [GlowVettingSignal]
    let dashboardSiblings: [GlowDashboardSibling]
    /// Official mark for pins/cards (not product photography).
    let brandLogoImageURL: String?
}

// MARK: - Judge MD hosted clip URLs

private enum JudgeMdGCSReels {
    static let base = "https://storage.googleapis.com/test-deploy-august25/post-visit-blueprint/videos/judgemd"
    static func mp4(_ slug: String) -> URL { URL(string: "\(base)/videos/\(slug).mp4")! }
    static func poster(_ slug: String) -> URL { URL(string: "\(base)/posters/\(slug).jpg")! }

    static let howMuchBotox = "judgemd_reels_2_how_much_does_botox_cost"
    static let underEyeFiller = "judgemd_reels_2_under_eye_filler_transformation"
    static let lipFillerBA = "judgemd_reels_2_beautiful_lip_filler_before_and_after_1"
    static let howLongFillerInject = "judgemd_reels_2_how_long_does_it_take_to_get_filler_injected"
    static let liquidRhinoplasty = "judgemd_reels_2_what_is_a_liquid_rhinoplasty"
    static let botoxVsDysport = "judgemd_reels_3_botox_vs_dysport"
    static let rhinoPainful = "judgemd_reels_3_are_rhinoplasties_painful"
    static let tapeAfterRhinoplasty = "judgemd_reels_how_to_tape_your_nose_after_a_rhinoplasty"
    static let rhinoRisks = "judgemd_reels_2_rhinoplasty_risks"
    static let facialBalancingFiller = "judgemd_reels_2_facial_balancing_using_filler"
    static let masseterBotox = "judgemd_reels_3_masseter_botox"
}

// MARK: - Seed (Judge MD + The Treatment)

enum GlowProviderDirectory {
    /// Bundled Treatment Skin Boutique logo (`TheTreatmentMintGray.png` in app resources).
    static var theTreatmentBundledLogoURL: URL? {
        Bundle.main.url(forResource: "TheTreatmentMintGray", withExtension: "png")
    }

    /// Raster from `public/post-visit-blueprint/videos/wellnest/nav-logo-5.svg` (embedded PNG).
    static var wellnestBundledLogoURL: URL? {
        Bundle.main.url(forResource: "WellnestNavLogo", withExtension: "png")
    }

    /// Slim Studio Face & Body mark (bundled PNG on black).
    static var slimStudioBundledLogoURL: URL? {
        Bundle.main.url(forResource: "SlimStudioLogo", withExtension: "png")
    }

    /// Treatment tiles open official pages in the in-app browser; posters use the bundled logo when available.
    private static func theTreatmentSpotlights() -> [GlowSpotlightVideo] {
        let remotePoster = URL(string: "https://getthetreatment.com/wp-content/uploads/2023/12/logo-header.png")
        guard
            let poster = theTreatmentBundledLogoURL ?? remotePoster,
            let injectables = URL(string: "https://getthetreatment.com/services/injectables/"),
            let lasers = URL(string: "https://getthetreatment.com/services/lasers-light/"),
            let facials = URL(string: "https://getthetreatment.com/services/facials-peels/")
        else { return [] }
        return [
            GlowSpotlightVideo(
                id: "tt-injectables",
                title: "Injectables",
                subtitle: "Wrinkle reducers & filler — see how The Treatment frames options.",
                whyShown:
                    "Read The Treatment’s own overview of toxins and filler before you book—always confirm details with their team.",
                streamURL: nil,
                posterURL: poster,
                safariURL: injectables
            ),
            GlowSpotlightVideo(
                id: "tt-lasers",
                title: "Lasers & light",
                subtitle: "BBL, Moxi, and sun-damage stories on their site.",
                whyShown:
                    "Skim downtime and candidacy language on their lasers page before you schedule a consult.",
                streamURL: nil,
                posterURL: poster,
                safariURL: lasers
            ),
            GlowSpotlightVideo(
                id: "tt-facials",
                title: "Facials & peels",
                subtitle: "HydraFacial-style cadence and peels — browse before you book.",
                whyShown:
                    "Helpful if you’re weighing peels, maintenance facials, or a bridge toward laser treatments.",
                streamURL: nil,
                posterURL: poster,
                safariURL: facials
            ),
        ]
    }

    /// Deep links to service pages on wellnestmd.com (verified paths from their public menu).
    private static func wellnestSpotlights() -> [GlowSpotlightVideo] {
        guard
            let home = URL(string: "https://wellnestmd.com/"),
            let bodyScan = URL(string: "https://wellnestmd.com/services/body-scan-in-sandy-springs/"),
            let peptides = URL(string: "https://wellnestmd.com/services/peptide-therapy-in-sandy-springs/"),
            let concierge = URL(string: "https://wellnestmd.com/services/primary-care-provider-in-sandy-springs/"),
            let weight = URL(string: "https://wellnestmd.com/services/weight-loss-clinic-in-sandy-springs/"),
            let cryo = URL(string: "https://wellnestmd.com/services/cryotherapy-in-sandy-springs/")
        else { return [] }
        return [
            GlowSpotlightVideo(
                id: "wn-home",
                title: "Wellnest MD — home",
                subtitle: "Sandy Springs holistic & concierge hub",
                whyShown:
                    "Use their official hub for announcements, insurance notes, and navigation into aesthetics, regenerative care, and wellness programs.",
                streamURL: nil,
                posterURL: wellnestBundledLogoURL,
                safariURL: home
            ),
            GlowSpotlightVideo(
                id: "wn-body-scan",
                title: "3D body scan",
                subtitle: "Wellness baseline & goals",
                whyShown:
                    "Their body-scan service page is a practical entry point when you want measurement-forward wellness planning before in-office visits.",
                streamURL: nil,
                posterURL: wellnestBundledLogoURL,
                safariURL: bodyScan
            ),
            GlowSpotlightVideo(
                id: "wn-peptides",
                title: "Peptide therapy",
                subtitle: "Recovery & performance angles",
                whyShown:
                    "Opens Wellnest’s peptide program framing—pair with your own clinician on candidacy, monitoring, and pharmacy sourcing.",
                streamURL: nil,
                posterURL: wellnestBundledLogoURL,
                safariURL: peptides
            ),
            GlowSpotlightVideo(
                id: "wn-concierge",
                title: "Concierge primary care",
                subtitle: "Memberships & longer visits",
                whyShown:
                    "Describes their concierge medicine model—useful context when you want continuity between aesthetics and primary care.",
                streamURL: nil,
                posterURL: wellnestBundledLogoURL,
                safariURL: concierge
            ),
            GlowSpotlightVideo(
                id: "wn-weight",
                title: "Medical weight loss",
                subtitle: "Program overview in Sandy Springs",
                whyShown:
                    "Links to their published weight-management clinic page for expectations and how they describe supervised plans.",
                streamURL: nil,
                posterURL: wellnestBundledLogoURL,
                safariURL: weight
            ),
            GlowSpotlightVideo(
                id: "wn-cryo",
                title: "Cryotherapy",
                subtitle: "Regenerative menu",
                whyShown:
                    "Entry to regenerative offerings on their site—compare with laser and IV paths before you book.",
                streamURL: nil,
                posterURL: wellnestBundledLogoURL,
                safariURL: cryo
            ),
        ]
    }

    /// Slim Studio Atlanta (slimstudioatlanta.com). Skin quiz opens `/slim_studio` when that build is deployed on their domain (adjust if your hosting differs).
    private static func slimStudioSpotlights() -> [GlowSpotlightVideo] {
        guard
            let quiz = URL(string: "https://slimstudioatlanta.com/slim_studio"),
            let cool = URL(string: "https://slimstudioatlanta.com/body-contouring/coolsculpting/"),
            let neo = URL(string: "https://slimstudioatlanta.com/body-contouring/emsculpt-neo/"),
            let botox = URL(string: "https://slimstudioatlanta.com/injectables-fillers/botox/"),
            let fillers = URL(string: "https://slimstudioatlanta.com/injectables-fillers/dermal-fillers/")
        else { return [] }
        return [
            GlowSpotlightVideo(
                id: "slim-skin-quiz",
                title: "Skin-type quiz companion",
                subtitle: "Slim Studio interactive flow",
                whyShown:
                    "Opens slimstudioatlanta.com/slim_studio for the skin-type experience bundled with your web build—change the URL in seed data if you host it elsewhere.",
                streamURL: nil,
                posterURL: slimStudioBundledLogoURL,
                safariURL: quiz
            ),
            GlowSpotlightVideo(
                id: "slim-cool",
                title: "CoolSculpting Elite",
                subtitle: "Non-surgical fat reduction",
                whyShown:
                    "Their public CoolSculpting Elite overview—use it to understand applicators, areas treated, and how they describe candidacy.",
                streamURL: nil,
                posterURL: slimStudioBundledLogoURL,
                safariURL: cool
            ),
            GlowSpotlightVideo(
                id: "slim-neo",
                title: "EMSculpt NEO",
                subtitle: "Muscle + fat in one device",
                whyShown:
                    "Explains EMSculpt NEO positioning at Slim Studio before you request a body consult.",
                streamURL: nil,
                posterURL: slimStudioBundledLogoURL,
                safariURL: neo
            ),
            GlowSpotlightVideo(
                id: "slim-botox",
                title: "Botox",
                subtitle: "Injectables menu",
                whyShown:
                    "Direct link to their Botox patient page for upper-face lines and how they bundle tox with body sculpting packages.",
                streamURL: nil,
                posterURL: slimStudioBundledLogoURL,
                safariURL: botox
            ),
            GlowSpotlightVideo(
                id: "slim-fillers",
                title: "Dermal fillers",
                subtitle: "Facial sculpting add-ons",
                whyShown:
                    "Use alongside the skin quiz when you’re comparing volume, contour, and device-based treatments in one plan.",
                streamURL: nil,
                posterURL: slimStudioBundledLogoURL,
                safariURL: fillers
            ),
        ]
    }

    static let organizations: [GlowProviderOrganization] = [
        GlowProviderOrganization(
            id: "judgemd",
            legalName: "Judge MD — Dr. Tanya Judge",
            credentialNote:
                "Board-certified plastic surgeon in San Francisco (Tanya Judge, M.D.). Gallery stills and price ranges follow what Judge MD publishes for patients on judgemd.com.",
            vettingSignals: [
                GlowVettingSignal(
                    id: "gallery",
                    headline: "Verified stills",
                    detail: "Gallery frames come from Judge MD’s own before-and-after gallery—not unrelated stock art."
                ),
                GlowVettingSignal(
                    id: "pricing",
                    headline: "Price transparency",
                    detail: "Published price ranges are kept in sync with what Judge MD lists for common procedures."
                ),
                GlowVettingSignal(
                    id: "skincare",
                    headline: "Skincare-aware rows",
                    detail: "Includes SkinCeuticals-friendly hints when your interests span both skin care and injectables."
                ),
            ],
            dashboardSiblings: [
                GlowDashboardSibling(
                    id: "wellnest",
                    name: "Wellnest MD",
                    summary:
                        "Peptide and wellness education when your clinic uses a Wellnest-based plan in GlowPath—the same flows you see on the web when that provider is selected.",
                    webURL: URL(string: "https://wellnestmd.com/")
                ),
                GlowDashboardSibling(
                    id: "slim",
                    name: "Slim Studio",
                    summary:
                        "Body contouring and PHYSIQ-style options when Slim Studio is your selected provider—shown alongside Judge MD and Treatment in GlowPath.",
                    webURL: URL(string: "https://slimstudioatlanta.com/")
                ),
            ],
            brandLogoImageURL: "https://www.judgemd.com/wp-content/themes/ui_judgemd/img/footer-logo@2x.png"
        ),
        GlowProviderOrganization(
            id: "thetreatment",
            legalName: "The Treatment Skin Boutique",
            credentialNote:
                "Med spa and skin boutique with locations in San Clemente, Newport Beach, Henderson, and Claremont (CA). Booking and product imagery follow what The Treatment publishes for clients online.",
            vettingSignals: [
                GlowVettingSignal(
                    id: "boutique",
                    headline: "Catalog parity",
                    detail: "Product stills match what The Treatment shows in its online boutique."
                ),
                GlowVettingSignal(
                    id: "booking",
                    headline: "Booking continuity",
                    detail: "Booking links use the same public getthetreatment.com flow The Treatment offers online."
                ),
                GlowVettingSignal(
                    id: "mint",
                    headline: "Mint + Treatment flows",
                    detail: "Routine cards align with Treatment and Mint plan paths you may already use in GlowPath on the web."
                ),
            ],
            dashboardSiblings: [],
            /// Listing thumbnails use `theTreatmentBundledLogoURL` when `organizationId == "thetreatment"`.
            brandLogoImageURL: nil
        ),
        GlowProviderOrganization(
            id: "wellnestmd",
            legalName: "Wellnest MD",
            credentialNote:
                "Physician-led holistic wellness center in Sandy Springs, GA (1300 Altmore Ave, Building D). Public pages on wellnestmd.com describe concierge primary care, medical aesthetics, regenerative therapies, IV and peptide programs, and memberships.",
            vettingSignals: [
                GlowVettingSignal(
                    id: "integrated",
                    headline: "Integrated wellness model",
                    detail: "Their site positions concierge medicine alongside aesthetics and recovery services under one roof."
                ),
                GlowVettingSignal(
                    id: "education",
                    headline: "Patient education first",
                    detail: "Long-form explainers on services like body scan, peptides, and weight programs help you prep questions before a visit."
                ),
                GlowVettingSignal(
                    id: "booking",
                    headline: "Official booking paths",
                    detail: "GlowPath deep links to wellnestmd.com and their published scheduling widgets—always confirm availability with the practice."
                ),
            ],
            dashboardSiblings: [],
            brandLogoImageURL: nil
        ),
        GlowProviderOrganization(
            id: "slimstudio",
            legalName: "Slim Studio Med Spa",
            credentialNote:
                "Atlanta med spa (Buckhead at 56 E Andrews Dr NW) focused on CoolSculpting Elite, EMSculpt NEO, injectables, and bundled face and body packages. Copy and links follow slimstudioatlanta.com.",
            vettingSignals: [
                GlowVettingSignal(
                    id: "specialist",
                    headline: "Body sculpting depth",
                    detail: "They emphasize specialization in non-invasive fat reduction and muscle building rather than a generic spa menu."
                ),
                GlowVettingSignal(
                    id: "injectables",
                    headline: "Injectables + sculpting",
                    detail: "Public pages describe Botox, fillers, Kybella, and biostimulator packages alongside device-based body treatments."
                ),
                GlowVettingSignal(
                    id: "skinquiz",
                    headline: "Skin-type companion",
                    detail: "GlowPath can open their skin-type quiz path when hosted at slimstudioatlanta.com/slim_studio—update the seed URL if your deploy differs."
                ),
            ],
            dashboardSiblings: [],
            brandLogoImageURL: nil
        ),
    ]

    static let sites: [GlowProviderSite] = [
        GlowProviderSite(
            id: "judgemd-sf",
            organizationId: "judgemd",
            displayName: "Judge MD — San Francisco",
            shortAddress: "San Francisco, CA",
            latitude: 37.7869,
            longitude: -122.4034,
            headlineOfferings: "Surgical & non-surgical plan builder (breast, body, facial surgery, rhinoplasty, neurotoxin, filler, biostimulants) with curated judgemd.com before/after galleries.",
            treatmentTags: [
                "surgical", "breast", "body", "rhinoplasty", "facial surgery", "injectables",
                "fillers", "neurotoxin", "biostimulants", "skin", "scarring", "aging",
            ],
            beforeAfterImageURLs: [
                "https://www.judgemd.com/wp-content/uploads/2019/04/face_55_ba.jpg",
                "https://www.judgemd.com/wp-content/uploads/2019/04/face_56_ba.jpg",
                "https://www.judgemd.com/wp-content/uploads/2019/04/Rhini.jpg",
                "https://www.judgemd.com/wp-content/uploads/2019/04/Rhino.jpg",
                "https://www.judgemd.com/wp-content/uploads/2019/04/breast_23ab-1.jpg",
                "https://www.judgemd.com/wp-content/uploads/2019/04/breast_23ab-2-1.jpg",
                "https://www.judgemd.com/wp-content/uploads/2019/03/tummy_tuck.jpg",
                "https://www.judgemd.com/wp-content/uploads/2019/04/body_13ab.jpg",
                "https://www.judgemd.com/wp-content/uploads/2019/04/Blepharoplasty.jpg",
                "https://www.judgemd.com/wp-content/uploads/2019/04/face_40_ba.jpg",
            ],
            spotlightVideos: [
                GlowSpotlightVideo(
                    id: "jd-botox-cost",
                    title: "How much does Botox cost?",
                    subtitle: "Neurotoxin pricing literacy",
                    whyShown:
                        "Helps you understand what drives toxin pricing before you ask for a quote in person.",
                    streamURL: JudgeMdGCSReels.mp4(JudgeMdGCSReels.howMuchBotox),
                    posterURL: JudgeMdGCSReels.poster(JudgeMdGCSReels.howMuchBotox),
                    safariURL: URL(string: "https://www.judgemd.com/")
                ),
                GlowSpotlightVideo(
                    id: "jd-botox-dysport",
                    title: "Botox vs Dysport",
                    subtitle: "Product comparison",
                    whyShown:
                        "Compares two common brands so you can discuss preferences with your injector.",
                    streamURL: JudgeMdGCSReels.mp4(JudgeMdGCSReels.botoxVsDysport),
                    posterURL: JudgeMdGCSReels.poster(JudgeMdGCSReels.botoxVsDysport),
                    safariURL: URL(string: "https://www.judgemd.com/")
                ),
                GlowSpotlightVideo(
                    id: "jd-masseter",
                    title: "Masseter Botox",
                    subtitle: "Jaw slimming / grinding",
                    whyShown:
                        "Useful if you’re curious about jaw slimming or teeth-grinding–related toxin options.",
                    streamURL: JudgeMdGCSReels.mp4(JudgeMdGCSReels.masseterBotox),
                    posterURL: JudgeMdGCSReels.poster(JudgeMdGCSReels.masseterBotox),
                    safariURL: URL(string: "https://www.judgemd.com/")
                ),
                GlowSpotlightVideo(
                    id: "jd-under-eye",
                    title: "Under-eye filler transformation",
                    subtitle: "Before/after education",
                    whyShown:
                        "Shows swelling patterns and realistic timelines—not a prediction of your result.",
                    streamURL: JudgeMdGCSReels.mp4(JudgeMdGCSReels.underEyeFiller),
                    posterURL: JudgeMdGCSReels.poster(JudgeMdGCSReels.underEyeFiller),
                    safariURL: URL(string: "https://www.judgemd.com/")
                ),
                GlowSpotlightVideo(
                    id: "jd-lip-filler",
                    title: "Lip filler before & after",
                    subtitle: "Technique & volume",
                    whyShown:
                        "Explains how volume and technique affect lip shape—bring questions to your visit.",
                    streamURL: JudgeMdGCSReels.mp4(JudgeMdGCSReels.lipFillerBA),
                    posterURL: JudgeMdGCSReels.poster(JudgeMdGCSReels.lipFillerBA),
                    safariURL: URL(string: "https://www.judgemd.com/gallery/")
                ),
                GlowSpotlightVideo(
                    id: "jd-filler-time",
                    title: "How long does filler take?",
                    subtitle: "Chair time expectations",
                    whyShown:
                        "Sets expectations for how long a filler appointment usually takes.",
                    streamURL: JudgeMdGCSReels.mp4(JudgeMdGCSReels.howLongFillerInject),
                    posterURL: JudgeMdGCSReels.poster(JudgeMdGCSReels.howLongFillerInject),
                    safariURL: URL(string: "https://www.judgemd.com/")
                ),
                GlowSpotlightVideo(
                    id: "jd-liquid-rhino",
                    title: "What is a liquid rhinoplasty?",
                    subtitle: "Non-surgical bridge",
                    whyShown:
                        "Introduces non-surgical nose tweaks when you’re still learning the category.",
                    streamURL: JudgeMdGCSReels.mp4(JudgeMdGCSReels.liquidRhinoplasty),
                    posterURL: JudgeMdGCSReels.poster(JudgeMdGCSReels.liquidRhinoplasty),
                    safariURL: URL(string: "https://www.judgemd.com/gallery/")
                ),
                GlowSpotlightVideo(
                    id: "jd-facial-balance",
                    title: "Facial balancing using filler",
                    subtitle: "Global facial approach",
                    whyShown:
                        "Broad overview of how injectors think about facial balance—conversation starter only.",
                    streamURL: JudgeMdGCSReels.mp4(JudgeMdGCSReels.facialBalancingFiller),
                    posterURL: JudgeMdGCSReels.poster(JudgeMdGCSReels.facialBalancingFiller),
                    safariURL: URL(string: "https://www.judgemd.com/")
                ),
                GlowSpotlightVideo(
                    id: "jd-rhino-pain",
                    title: "Are rhinoplasties painful?",
                    subtitle: "Expectation setting",
                    whyShown:
                        "Addresses a very common anxiety before surgical rhinoplasty consults.",
                    streamURL: JudgeMdGCSReels.mp4(JudgeMdGCSReels.rhinoPainful),
                    posterURL: JudgeMdGCSReels.poster(JudgeMdGCSReels.rhinoPainful),
                    safariURL: URL(string: "https://www.judgemd.com/gallery/")
                ),
                GlowSpotlightVideo(
                    id: "jd-rhino-risks",
                    title: "Rhinoplasty risks",
                    subtitle: "Informed consent primer",
                    whyShown:
                        "Encourages you to review risks with your surgeon—it doesn’t replace consent materials.",
                    streamURL: JudgeMdGCSReels.mp4(JudgeMdGCSReels.rhinoRisks),
                    posterURL: JudgeMdGCSReels.poster(JudgeMdGCSReels.rhinoRisks),
                    safariURL: URL(string: "https://www.judgemd.com/gallery/")
                ),
                GlowSpotlightVideo(
                    id: "jd-tape-nose",
                    title: "Tape after rhinoplasty",
                    subtitle: "After-care mechanics",
                    whyShown:
                        "Practical after-care visuals if you’re preparing for surgery or supporting someone post-op.",
                    streamURL: JudgeMdGCSReels.mp4(JudgeMdGCSReels.tapeAfterRhinoplasty),
                    posterURL: JudgeMdGCSReels.poster(JudgeMdGCSReels.tapeAfterRhinoplasty),
                    safariURL: URL(string: "https://www.judgemd.com/")
                ),
            ],
            galleryWebURL: URL(string: "https://www.judgemd.com/gallery/"),
            bookingWebURL: URL(string: "https://www.judgemd.com/"),
            reviewsWebURL: URL(
                string: "https://www.google.com/maps/search/?api=1&query=Judge%20MD%201199%20Bush%20St%20%23490%20San%20Francisco%20CA%2094109"
            ),
            googleReviewAverage: 4.7,
            googleReviewCount: 74,
            googleReviewExcerpts: [
                GlowReviewExcerpt(
                    id: "g-jennifer-creelman",
                    author: "Jennifer Creelman",
                    timeframe: "4 months ago",
                    body:
                        "After one consultation I would schedule a procedure… one week post-op… I look quite refreshed. I liked that her surgery center is her own design… front office staff for quick responses."
                ),
                GlowReviewExcerpt(
                    id: "g-thao-pham",
                    author: "Thao Pham",
                    timeframe: "2 months ago",
                    body:
                        "An incredibly talented artist… I shared that I was hoping for natural-looking results, and she delivered exactly that… genuine compassion throughout the process."
                ),
                GlowReviewExcerpt(
                    id: "g-nichole-allen",
                    author: "Nichole Allen",
                    timeframe: "3 months ago",
                    body:
                        "Consultations with five different surgeons… my experience with Dr. Judge was the best… She genuinely cares about the why… breast reduction… she exceeded my expectations."
                ),
                GlowReviewExcerpt(
                    id: "g-n-m-septo",
                    author: "N M",
                    timeframe: "1 year ago",
                    body:
                        "Septorhinoplasty… wonderful experience… 3D mockups of before/after… office staff friendly and responsive… surgery center staff made surgery day as easy as possible."
                ),
                GlowReviewExcerpt(
                    id: "g-elsa-horciza",
                    author: "Elsa Horciza",
                    timeframe: "1 year ago",
                    body:
                        "Spectacular job perfecting exactly what I asked for in a rhinoplasty… stress free… highly recommend Dr. Judge if you are looking to get your dream nose."
                ),
                GlowReviewExcerpt(
                    id: "g-gabi-wisnovsky",
                    author: "gabi wisnovsky",
                    timeframe: "4 months ago",
                    body:
                        "Incredibly kind, patient, and thorough… office staff welcoming and responsive… the entire process feel seamless… couldn’t be happier with my experience."
                ),
            ],
            reviewStarsIllustrative: 4.7,
            reviewBlurbIllustrative:
                "Google listing snapshot: 4.7 average across dozens of public reviews for Judge MD at 1199 Bush St #490—tap through for nuance, owner replies, and any critical threads.",
            similarBlurb: "If you are Bay Area–based and also want med-spa cadence, compare with The Treatment’s OC, Henderson, or Claremont locations for laser + skincare-forward visits."
        ),
        GlowProviderSite(
            id: "thetreatment-san-clemente",
            organizationId: "thetreatment",
            displayName: "The Treatment — San Clemente",
            shortAddress: "San Clemente, CA",
            latitude: 33.4269,
            longitude: -117.6119,
            headlineOfferings: "Med spa energy devices, HydraFacial-style maintenance, injectables, and Skin Boutique retail aligned with your quiz recommendations.",
            treatmentTags: [
                "medspa", "skincare", "laser", "hydrafacial", "facials", "peels",
                "injectables", "pigmentation", "acne", "glow", "sunscreen", "aging",
            ],
            beforeAfterImageURLs: [
                "https://cdn.shopify.com/s/files/1/2640/6190/files/tinted-sunscreen.png?v=1762992852",
                "https://cdn.shopify.com/s/files/1/2640/6190/files/lightweight-sunscreen-1.jpg?v=1762993050",
                "https://cdn.shopify.com/s/files/1/2640/6190/files/anti-wrinkle-eye-cream.png?v=1767813879",
                "https://cdn.shopify.com/s/files/1/2640/6190/files/salicylic-acid-serum.png?v=1762466887",
            ],
            spotlightVideos: theTreatmentSpotlights(),
            galleryWebURL: URL(string: "https://shop.getthetreatment.com/"),
            bookingWebURL: URL(string: "https://getthetreatment.com/#book-now"),
            reviewsWebURL: URL(string: "https://www.google.com/search?q=The+Treatment+San+Clemente+reviews"),
            googleReviewAverage: nil,
            googleReviewCount: nil,
            googleReviewExcerpts: [],
            reviewStarsIllustrative: 4.7,
            reviewBlurbIllustrative: "Guests frequently mention concierge retail + in-office treatment pairing—confirm availability and injector credentials directly.",
            similarBlurb: "Also see Newport Beach and Henderson pins for sister-site booking options."
        ),
        GlowProviderSite(
            id: "thetreatment-newport",
            organizationId: "thetreatment",
            displayName: "The Treatment — Newport Beach",
            shortAddress: "Newport Beach, CA",
            latitude: 33.6189,
            longitude: -117.9298,
            headlineOfferings: "Same Treatment playbook: lasers, facials, injectables, and Skin Boutique lines used in your GlowPath routine cards.",
            treatmentTags: [
                "medspa", "skincare", "laser", "hydrafacial", "facials", "peels",
                "injectables", "pigmentation", "acne", "glow", "sunscreen", "aging",
            ],
            beforeAfterImageURLs: [
                "https://cdn.shopify.com/s/files/1/2640/6190/files/anti-wrinkle-cream.png?v=1767814020",
                "https://cdn.shopify.com/s/files/1/2640/6190/files/lip-treatment.png?v=1762466886",
                "https://cdn.shopify.com/s/files/1/2640/6190/files/exfoliating-face-pads.jpg?v=1762541166",
            ],
            spotlightVideos: theTreatmentSpotlights(),
            galleryWebURL: URL(string: "https://shop.getthetreatment.com/"),
            bookingWebURL: URL(string: "https://getthetreatment.com/#book-now"),
            reviewsWebURL: URL(string: "https://www.google.com/search?q=The+Treatment+Newport+Beach+reviews"),
            googleReviewAverage: nil,
            googleReviewCount: nil,
            googleReviewExcerpts: [],
            reviewStarsIllustrative: 4.7,
            reviewBlurbIllustrative: "Coastal OC patients often compare packages across laser + skincare bundles—double-check promos on the official site.",
            similarBlurb: "Pair with San Clemente or Henderson if you split time between coast and Vegas."
        ),
        GlowProviderSite(
            id: "thetreatment-henderson",
            organizationId: "thetreatment",
            displayName: "The Treatment — Henderson",
            shortAddress: "Henderson, NV",
            latitude: 36.0395,
            longitude: -114.9817,
            headlineOfferings: "Henderson / Las Vegas metro access to the same Treatment treatment menu and boutique catalog referenced in-app.",
            treatmentTags: [
                "medspa", "skincare", "laser", "hydrafacial", "facials", "peels",
                "injectables", "pigmentation", "acne", "glow", "sunscreen", "aging",
            ],
            beforeAfterImageURLs: [
                "https://cdn.shopify.com/s/files/1/2640/6190/files/best-cleansing-oil.jpg?v=1762542533",
                "https://cdn.shopify.com/s/files/1/2640/6190/files/morning-defense-skincare-bundle.jpg?v=1772641216",
                "https://cdn.shopify.com/s/files/1/2640/6190/files/oily-skin-routine.jpg?v=1763054332",
            ],
            spotlightVideos: theTreatmentSpotlights(),
            galleryWebURL: URL(string: "https://shop.getthetreatment.com/"),
            bookingWebURL: URL(string: "https://getthetreatment.com/#book-now"),
            reviewsWebURL: URL(string: "https://www.google.com/search?q=The+Treatment+Henderson+NV+reviews"),
            googleReviewAverage: nil,
            googleReviewCount: nil,
            googleReviewExcerpts: [],
            reviewStarsIllustrative: 4.6,
            reviewBlurbIllustrative: "Desert-climate skincare + laser maintenance come up often—ask about sun recovery protocols.",
            similarBlurb: "If you need surgical depth, consider Judge MD in SF for consult cross-checks."
        ),
        GlowProviderSite(
            id: "thetreatment-claremont",
            organizationId: "thetreatment",
            displayName: "The Treatment — Claremont",
            shortAddress: "Claremont, CA",
            latitude: 34.0967,
            longitude: -117.7198,
            headlineOfferings: "Same Treatment menu and Skin Boutique alignment as other California studios—lasers, facials, injectables, and retail tied to your GlowPath routine cards.",
            treatmentTags: [
                "medspa", "skincare", "laser", "hydrafacial", "facials", "peels",
                "injectables", "pigmentation", "acne", "glow", "sunscreen", "aging",
            ],
            beforeAfterImageURLs: [
                "https://cdn.shopify.com/s/files/1/2640/6190/files/tinted-sunscreen.png?v=1762992852",
                "https://cdn.shopify.com/s/files/1/2640/6190/files/lightweight-sunscreen-1.jpg?v=1762993050",
            ],
            spotlightVideos: theTreatmentSpotlights(),
            galleryWebURL: URL(string: "https://shop.getthetreatment.com/"),
            bookingWebURL: URL(string: "https://getthetreatment.com/#book-now"),
            reviewsWebURL: URL(string: "https://www.google.com/search?q=The+Treatment+Claremont+CA+reviews"),
            googleReviewAverage: nil,
            googleReviewCount: nil,
            googleReviewExcerpts: [],
            reviewStarsIllustrative: 4.7,
            reviewBlurbIllustrative: "Inland Empire / Claremont Village access to the same Treatment treatment vocabulary used elsewhere in GlowPath.",
            similarBlurb: "Compare with San Clemente or Newport Beach if you split time between Claremont and coastal OC."
        ),
        GlowProviderSite(
            id: "wellnest-sandy-springs",
            organizationId: "wellnestmd",
            displayName: "Wellnest MD — Sandy Springs",
            shortAddress: "Sandy Springs, GA",
            latitude: 33.9172,
            longitude: -84.3440,
            headlineOfferings:
                "Concierge primary care, medical aesthetics, regenerative therapies (cryo, IV, peptides, body scan), weight programs, and memberships—per wellnestmd.com.",
            treatmentTags: [
                "medspa", "laser", "facials", "peels", "injectables", "skin", "aging",
                "wellness", "weight", "body", "cryotherapy", "peptide", "iv", "hydrating",
                "primary", "concierge", "pigmentation", "acne", "dry", "sensitive", "recovery",
            ],
            beforeAfterImageURLs: [],
            spotlightVideos: wellnestSpotlights(),
            galleryWebURL: nil,
            bookingWebURL: URL(string: "https://wellnestmd.com/"),
            reviewsWebURL: URL(
                string: "https://www.google.com/maps/search/?api=1&query=Wellnest%20MD%201300%20Altmore%20Ave%20Sandy%20Springs%20GA%2030342"
            ),
            googleReviewAverage: nil,
            googleReviewCount: nil,
            googleReviewExcerpts: [],
            reviewStarsIllustrative: 4.8,
            reviewBlurbIllustrative:
                "Illustrative composite for this build—Wellnest publishes extensive testimonials on wellnestmd.com; verify the live Google listing before booking.",
            similarBlurb: "In Atlanta, compare with Slim Studio Buckhead for device-heavy body sculpting, or Judge MD in SF if you want surgical consult cross-checks."
        ),
        GlowProviderSite(
            id: "slim-buckhead",
            organizationId: "slimstudio",
            displayName: "Slim Studio — Buckhead",
            shortAddress: "Atlanta, GA",
            latitude: 33.8427,
            longitude: -84.3811,
            headlineOfferings:
                "CoolSculpting Elite, EMSculpt NEO, injectables (Botox, fillers, Kybella, biostimulators), Morpheus8, and packaged face + body programs—per slimstudioatlanta.com.",
            treatmentTags: [
                "medspa", "injectables", "fillers", "neurotoxin", "laser", "body", "aging",
                "skin", "facials", "weight", "peels", "scarring", "acne", "glow", "hydrafacial",
            ],
            beforeAfterImageURLs: [],
            spotlightVideos: slimStudioSpotlights(),
            galleryWebURL: URL(string: "https://slimstudioatlanta.com/"),
            bookingWebURL: URL(string: "https://slimstudioatl.zenoti.com/webstoreNew/services"),
            reviewsWebURL: URL(string: "https://slimstudioatlanta.com/reviews/"),
            googleReviewAverage: nil,
            googleReviewCount: nil,
            googleReviewExcerpts: [],
            reviewStarsIllustrative: 5.0,
            reviewBlurbIllustrative:
                "Slim Studio highlights 5.0 from 210+ reviews on their public reviews hub—open the live page for recency and detail.",
            similarBlurb: "Pair with Wellnest MD in Sandy Springs for holistic primary + recovery programs, or The Treatment in CA for boutique skincare cadence."
        ),
    ]

    static func organization(orgId: String) -> GlowProviderOrganization? {
        organizations.first { $0.id == orgId }
    }
}

// MARK: - Match scoring (quiz + intake → provider treatment tags)

struct RankedProviderSite: Identifiable {
    var id: String { site.id }
    let site: GlowProviderSite
    /// 0–100 heuristic (not a clinical suitability score).
    let matchPercent: Int
    let matchReasons: [String]
    let distanceMeters: Double?
}

enum ProviderMatchEngine {
    /// Derive coarse “need tags” from gemstone profile + optional intake.
    static func userNeedTags(outcome: QuizOutcome?, intake: SkinIntake?) -> Set<String> {
        var needTags = Set<String>()
        if let primary = outcome?.profile.primary {
            switch primary {
            case .opal:
                needTags.formUnion(["oil", "sensitive", "pigment", "acne", "medspa", "peels", "skin"])
            case .pearl:
                needTags.formUnion(["oil", "sensitive", "acne", "medspa", "skin"])
            case .jade:
                needTags.formUnion(["oil", "pigment", "acne", "laser", "peels", "injectables"])
            case .quartz:
                needTags.formUnion(["oil", "aging", "injectables", "laser", "medspa"])
            case .amber:
                needTags.formUnion(["dry", "sensitive", "pigment", "skin", "medspa", "laser"])
            case .moonstone:
                needTags.formUnion(["dry", "sensitive", "skin", "medspa"])
            case .turquoise:
                needTags.formUnion(["dry", "pigment", "laser", "medspa", "peels"])
            case .diamond:
                needTags.formUnion(["dry", "aging", "injectables", "laser", "skin"])
            }
        }
        if let intake {
            for g in intake.goals {
                needTags.formUnion(tags(for: g))
            }
            switch intake.openness {
            case .atHomeFirst: break
            case .openToFacials:
                needTags.formUnion(["facials", "peels", "medspa"])
            case .openToLasers:
                needTags.formUnion(["laser", "medspa", "facials", "peels"])
            case .openToInjectables:
                needTags.formUnion(["injectables", "fillers", "neurotoxin", "medspa"])
            }
        }
        return needTags
    }

    private static func tags(for goal: SkinGoal) -> Set<String> {
        switch goal {
        case .acne: return ["acne", "peels", "medspa", "skin", "laser"]
        case .texture: return ["peels", "laser", "medspa"]
        case .pores: return ["medspa", "laser", "facials"]
        case .redness: return ["laser", "medspa", "skin"]
        case .pigmentation: return ["pigment", "laser", "peels", "medspa"]
        case .scarring: return ["laser", "surgical", "medspa", "peels"]
        case .aging: return ["aging", "injectables", "laser", "surgical", "skin"]
        case .glow: return ["facials", "medspa", "skin", "hydrafacial"]
        case .dryness: return ["dry", "skin", "medspa"]
        case .sensitivity: return ["sensitive", "skin", "medspa"]
        }
    }

    static func rankAll(
        userLocation: CLLocation?,
        outcome: QuizOutcome?,
        intake: SkinIntake?
    ) -> [RankedProviderSite] {
        let needs = userNeedTags(outcome: outcome, intake: intake)
        let ranked = GlowProviderDirectory.sites.map { site in
            let (pct, reasons) = score(site: site, needs: needs, outcome: outcome, intake: intake)
            let dist: Double? = userLocation.map { loc in
                loc.distance(from: CLLocation(latitude: site.latitude, longitude: site.longitude))
            }
            return RankedProviderSite(site: site, matchPercent: pct, matchReasons: reasons, distanceMeters: dist)
        }
        return ranked.sorted { a, b in
            if a.matchPercent != b.matchPercent { return a.matchPercent > b.matchPercent }
            let da = a.distanceMeters ?? .greatestFiniteMagnitude
            let db = b.distanceMeters ?? .greatestFiniteMagnitude
            return da < db
        }
    }

    private static func score(
        site: GlowProviderSite,
        needs: Set<String>,
        outcome: QuizOutcome?,
        intake: SkinIntake?
    ) -> (Int, [String]) {
        let offer = Set(site.treatmentTags.map { $0.lowercased() })
        let needLower = Set(needs.map { $0.lowercased() })
        let hits = needLower.intersection(offer)
        var reasons: [String] = []
        for h in hits.sorted() {
            reasons.append("Matches your \(h) signals")
        }
        var score = 38 + min(52, hits.count * 9)
        if let intake, intake.fitzpatrick != nil,
           ["judgemd", "thetreatment", "wellnestmd", "slimstudio"].contains(site.organizationId)
        {
            score += 6
            reasons.append("Fitzpatrick on file—ask about pigment-safe protocols in consult")
        }
        if let intake, intake.openness == .openToInjectables, offer.contains("injectables") {
            score += 4
        }
        if outcome != nil, site.organizationId == "thetreatment", offer.contains("skincare") {
            score += 5
            reasons.append("Boutique skincare lines align with your quiz routine cards")
        }
        if outcome != nil, site.organizationId == "judgemd", offer.contains("surgical") {
            score += 4
            reasons.append("Surgical + injectable depth if you outgrow med-spa maintenance")
        }
        if outcome != nil, site.organizationId == "wellnestmd" {
            score += 5
            reasons.append("Holistic primary + aesthetics + recovery menu when you want longevity-forward planning")
        }
        if outcome != nil, site.organizationId == "slimstudio", offer.contains("body") {
            score += 5
            reasons.append("Device-heavy body sculpting menu when contour and fat reduction are priorities")
        }
        if outcome != nil, site.organizationId == "slimstudio", offer.contains("injectables") {
            score += 3
            reasons.append("Injectables bundles pair with their body devices on one plan")
        }
        return (min(100, score), reasons)
    }
}

