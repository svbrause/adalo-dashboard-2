import Foundation

struct BoutiqueProductRow: Codable, Identifiable, Equatable {
    var id: String { name }
    let name: String
    let productUrl: String?
    let imageUrl: String?
    let price: String?
}

/// Loads bundled boutique metadata for AM/PM routines and shelf cards.
enum ProductCatalog {
    private static var boutiqueByName: [String: BoutiqueProductRow] = [:]
    private static var recommendedOrder: [GemstoneId: [String]] = [:]
    private static var didLoad = false

    static func loadIfNeeded() {
        guard !didLoad else { return }
        didLoad = true
        let b = Bundle.main
        if let url = b.url(forResource: "boutique-for-quiz", withExtension: "json"),
           let data = try? Data(contentsOf: url),
           let rows = try? JSONDecoder().decode([BoutiqueProductRow].self, from: data)
        {
            boutiqueByName = Dictionary(uniqueKeysWithValues: rows.map { ($0.name, $0) })
        }
        if let url = b.url(forResource: "recommended-by-skin-type", withExtension: "json"),
           let data = try? Data(contentsOf: url),
           let raw = try? JSONDecoder().decode([String: [String]].self, from: data)
        {
            recommendedOrder = [:]
            for (k, v) in raw {
                if let g = GemstoneId(rawValue: k) {
                    recommendedOrder[g] = v
                }
            }
        }
    }

    static func recommendedProducts(for gemstone: GemstoneId) -> [BoutiqueProductRow] {
        loadIfNeeded()
        let names = recommendedOrder[gemstone] ?? []
        return names.compactMap { boutiqueByName[$0] ?? BoutiqueProductRow(name: $0, productUrl: nil, imageUrl: nil, price: nil) }
    }

    /// Ordered AM / PM steps derived from the same `recommended-by-skin-type.json` list (heuristic slots—not medical prescribing).
    static func amPmRoutines(for gemstone: GemstoneId) -> (am: [BoutiqueProductRow], pm: [BoutiqueProductRow]) {
        let ordered = recommendedProducts(for: gemstone)
        var am: [BoutiqueProductRow] = []
        var pm: [BoutiqueProductRow] = []
        for row in ordered {
            switch routineSlot(for: row.name) {
            case .amOnly:
                am.append(row)
            case .pmOnly:
                pm.append(row)
            case .both:
                am.append(row)
                pm.append(row)
            }
        }
        return (am, pm)
    }

    private enum RoutineSlot {
        case amOnly
        case pmOnly
        case both
    }

    private static func routineSlot(for name: String) -> RoutineSlot {
        let n = name.lowercased()

        if n.contains("spf") || n.contains("sunscreen") || (n.contains("tinted") && n.contains("spf")) {
            return .amOnly
        }
        if n.contains("retinol")
            || n.contains("glycolic 10")
            || n.contains("renew overnight")
            || (n.contains("glycolic") && n.contains("overnight"))
        {
            return .pmOnly
        }
        if n.contains("advanced rgn")
            || n.contains("age interrupter")
            || n.contains("metacell renewal")
            || n.contains("cell cycle catalyst")
            || n.contains("retexturing activator")
        {
            return .pmOnly
        }
        if n.contains("c e ferulic")
            || n.contains("phloretin cf")
            || n.contains("silymarin cf")
            || n.contains("serum 10")
        {
            return .amOnly
        }
        if n.contains("cleanser") || n.contains("clean |") {
            return .both
        }
        // Default: flexible serums / moisturizers / eye — typical AM under SPF, PM for recovery.
        return .both
    }

    static func reasonLine(for productName: String) -> String? {
        productReasons[productName]
    }

    /// Short “why this product” lines aligned with the skin-type quiz.
    private static let productReasons: [String: String] = [
        "SkinCeuticals Hyaluronic Acid Intensifier | Multi-Glycan Hydrating Serum for Plump & Smooth Skin": "Deep hydration & plumping",
        "SkinCeuticals Triple Lipid Restore 2:4:2 | Anti-Aging Moisturizer for Skin Barrier Repair & Hydration": "Barrier repair & hydration",
        "SkinCeuticals Blemish + Age Defense | Targeted Serum for Acne and Signs of Aging": "Acne & oil control, anti-aging",
        "SkinCeuticals Silymarin CF | Antioxidant Serum for Oily & Acne-Prone Skin": "Oil control & antioxidant protection",
        "SkinCeuticals Daily Moisture | Lightweight Hydrating Moisturizer for All Skin Types": "Lightweight hydration, all skin types",
        "SkinCeuticals Phyto Corrective Gel | Soothing Hydrating Serum for Redness & Sensitive Skin": "Soothing redness & sensitivity",
        "The Treatment On The Daily SPF 45 | Lightweight Sunscreen for Daily Protection": "Daily sun protection",
        "SkinCeuticals Simply Clean | Gentle Foaming Cleanser for All Skin Types": "Gentle cleansing",
        "SkinCeuticals P-Tiox | Glass Skin Serum for Skin Protection & Repair": "Protection & repair",
        "SkinCeuticals C E Ferulic | Antioxidant Vitamin C Serum for Brightening & Anti-Aging": "Brightening & antioxidant protection",
        "SkinCeuticals Phloretin CF | Antioxidant Serum for Environmental Damage & Uneven Skin Tone": "Even tone & environmental protection",
        "SkinCeuticals Discoloration Defense | Targeted Serum for Dark Spots & Uneven Skin Tone": "Dark spots & uneven tone",
        "SkinCeuticals Glycolic 10 Renew Overnight | Exfoliating Night Serum for Smoother, Radiant Skin": "Gentle exfoliation & radiance",
        "SkinCeuticals Advanced RGN‑6 | Regenerative Anti-Aging Cream": "Regenerative anti-aging",
        "SkinCeuticals A.G.E. Interrupter Advanced | Anti-Aging Cream for Wrinkles & Loss of Firmness": "Anti-aging & firmness",
        "SkinCeuticals A.G.E. Advanced Eye Cream | Nourishing Pre-Cleanse for Radiant, Balanced Skin Anti-Aging Treatment for Wrinkles & Puffiness": "Eye area anti-aging",
        "SkinCeuticals Retinol 0.3% | Anti-Aging Serum for Wrinkles & Skin Renewal": "Gentle retinol renewal",
        "SkinCeuticals Retinol 0.5% | Anti-Aging Serum for Wrinkles & Skin Renewal": "Retinol renewal",
        "SkinCeuticals Cell Cycle Catalyst | Resurfacing Serum for Radiance & Skin Renewal": "Resurfacing & radiance",
        "SkinCeuticals Metacell Renewal B3 | Brightening & Anti-Aging Serum with Vitamin B3": "Brightening & renewal",
        "SkinCeuticals Retexturing Activator | Exfoliating Serum for Smoother, Refined Skin Texture": "Texture refinement",
        "GM Collin Rosa Sea Gel-Cream | Soothing Moisturizer for Redness & Inflammation": "Soothing & hydration",
        "The Treatment Let's Get Physical Tinted SPF 44 | Lightweight Tinted Sunscreen with Broad Spectrum Protection": "Tinted sun protection",
        "SkinCeuticals Gentle Cleanser | Soothing Cream Cleanser for Dry & Sensitive Skin": "Gentle cream cleansing",
        "SkinCeuticals Serum 10 AOX | Antioxidant Serum with 10% Vitamin C for Brightening & Protection": "Vitamin C brightening & protection",
        "SkinCeuticals Phyto A+ Brightening Treatment | Lightweight Gel Moisturizer for Dull, Uneven Skin": "Brightening & even tone",
        "SkinCeuticals Emollience | Hydrating Moisturizer for Normal to Dry Skin": "Hydration for normal to dry",
        "SkinCeuticals Replenishing Cleanser | Hydrating Face Wash for Dry & Sensitive Skin": "Hydrating cleanse",
        "SkinCeuticals LHA Cleanser | Exfoliating Face Wash for Acne-Prone & Congested Skin": "Clarifying exfoliation",
    ]
}
