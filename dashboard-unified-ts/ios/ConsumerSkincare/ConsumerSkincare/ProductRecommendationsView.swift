import SwiftUI

/// Numbered AM / PM steps from the same boutique list as the shelf cards (`ProductCatalog.amPmRoutines`).
struct RoutineAmPmPlanView: View {
    let gemstone: GemstoneId
    /// When false, the Plan tab supplies the section title and intro copy above this block.
    var showChrome: Bool = true

    @State private var webSheet: GlowWebSheetItem?

    var body: some View {
        let split = ProductCatalog.amPmRoutines(for: gemstone)

        LazyVStack(alignment: .leading, spacing: 22) {
            if showChrome {
                Text("AM & PM routine")
                    .font(.title2)
                    .fontWeight(.semibold)
                    .padding(.horizontal, 20)

                Text(
                    "Order follows your \(gemstone.rawValue.capitalized) recommended shelf. SPF stays morning; retinol and overnight glycolic stay evening—tweak with your own products or your clinician."
                )
                .font(.footnote)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 20)
            }

            routineColumn(
                title: "Morning",
                systemImage: "sun.horizon.fill",
                rows: split.am
            )

            routineColumn(
                title: "Evening",
                systemImage: "moon.stars.fill",
                rows: split.pm
            )
        }
        .padding(.top, 8)
        .onAppear { ProductCatalog.loadIfNeeded() }
        .sheet(item: $webSheet) { item in
            GlowWebShellView(initialURL: item.url, suggestedNavigationTitle: item.pageTitle)
                .presentationDragIndicator(.visible)
        }
    }

    private func routineColumn(title: String, systemImage: String, rows: [BoutiqueProductRow]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(title, systemImage: systemImage)
                .font(.headline)
                .foregroundStyle(Color.accentColor)
                .padding(.horizontal, 20)

            if rows.isEmpty {
                Text("No steps in this slot yet.")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .padding(.horizontal, 20)
            } else {
                ForEach(Array(rows.enumerated()), id: \.offset) { idx, row in
                    RoutineStepRow(stepNumber: idx + 1, row: row) { url in
                        webSheet = GlowWebSheetItem(url: url, pageTitle: shortProductTitle(row.name))
                    }
                }
            }
        }
    }
}

private struct RoutineStepRow: View {
    let stepNumber: Int
    let row: BoutiqueProductRow
    var onShopURL: (URL) -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(stepNumber)")
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 26, height: 26)
                .background(Circle().fill(Color.accentColor))

            HStack(alignment: .top, spacing: 12) {
                AsyncImage(url: row.imageUrl.flatMap { URL(string: $0) }) { phase in
                    switch phase {
                    case .empty:
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color(.tertiarySystemFill))
                            .overlay { ProgressView() }
                    case let .success(img):
                        img
                            .resizable()
                            .scaledToFill()
                    default:
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color(.tertiarySystemFill))
                    }
                }
                .frame(width: 56, height: 56)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

                VStack(alignment: .leading, spacing: 4) {
                    Text(shortTitle)
                        .font(.subheadline.weight(.semibold))
                        .fixedSize(horizontal: false, vertical: true)
                    if let reason = ProductCatalog.reasonLine(for: row.name) {
                        Text(reason)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    if let urlStr = row.productUrl, let url = URL(string: urlStr) {
                        Button("Shop") {
                            onShopURL(url)
                        }
                        .font(.caption)
                    }
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color(.secondarySystemGroupedBackground))
            )
        }
        .padding(.horizontal, 20)
    }

    private var shortTitle: String {
        shortProductTitle(row.name)
    }
}

struct ProductRecommendationsView: View {
    let gemstone: GemstoneId
    /// When false, omit the large title and intro (e.g. inside Plan’s disclosure group).
    var showChrome: Bool = true

    @State private var webSheet: GlowWebSheetItem?

    var body: some View {
        let items = ProductCatalog.recommendedProducts(for: gemstone)

        LazyVStack(alignment: .leading, spacing: 16) {
            if showChrome {
                Text("Shelf detail")
                    .font(.title2)
                    .fontWeight(.semibold)
                    .padding(.horizontal, 20)

                Text("Same products as the AM/PM flow above—larger cards with pricing. Based on your \(gemstone.rawValue.capitalized) profile and The Treatment Skin Boutique assortment.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 20)
            }

            ForEach(items) { row in
                ProductRowCard(row: row) { url in
                    webSheet = GlowWebSheetItem(url: url, pageTitle: shortProductTitle(row.name))
                }
            }
        }
        .padding(.top, 8)
        .onAppear { ProductCatalog.loadIfNeeded() }
        .sheet(item: $webSheet) { item in
            GlowWebShellView(initialURL: item.url, suggestedNavigationTitle: item.pageTitle)
                .presentationDragIndicator(.visible)
        }
    }
}

private struct ProductRowCard: View {
    let row: BoutiqueProductRow
    var onShopURL: (URL) -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            AsyncImage(url: row.imageUrl.flatMap { URL(string: $0) }) { phase in
                switch phase {
                case .empty:
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(.tertiarySystemFill))
                        .overlay { ProgressView() }
                case let .success(img):
                    img
                        .resizable()
                        .scaledToFill()
                default:
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(.tertiarySystemFill))
                        .overlay {
                            Image(systemName: "photo")
                                .foregroundStyle(.secondary)
                        }
                }
            }
            .frame(width: 88, height: 88)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            VStack(alignment: .leading, spacing: 6) {
                Text(shortTitle)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .fixedSize(horizontal: false, vertical: true)

                if let price = row.price {
                    Text(price)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(Color.accentColor)
                }

                if let reason = ProductCatalog.reasonLine(for: row.name) {
                    Text(reason)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                if let urlStr = row.productUrl, let url = URL(string: urlStr) {
                    Button("View on shop") {
                        onShopURL(url)
                    }
                    .font(.caption)
                }
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
        .padding(.horizontal, 20)
    }

    private var shortTitle: String {
        shortProductTitle(row.name)
    }
}

private func shortProductTitle(_ name: String) -> String {
    if let pipe = name.firstIndex(of: "|") {
        return String(name[..<pipe]).trimmingCharacters(in: .whitespaces)
    }
    return name
}
