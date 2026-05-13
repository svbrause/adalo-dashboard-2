import SwiftUI
import WebKit

/// Payload for `.sheet(item:)` when opening external https pages inside the app.
struct GlowWebSheetItem: Identifiable, Equatable {
    let id: UUID
    let url: URL
    var pageTitle: String?

    init(url: URL, pageTitle: String? = nil) {
        self.id = UUID()
        self.url = url
        self.pageTitle = pageTitle
    }

    static func == (lhs: GlowWebSheetItem, rhs: GlowWebSheetItem) -> Bool {
        lhs.id == rhs.id
    }
}

/// In-app browser with navigation title from the page (when available) and a Safari escape hatch.
struct GlowWebShellView: View {
    let initialURL: URL
    var suggestedNavigationTitle: String?

    @Environment(\.dismiss) private var dismiss
    @State private var pageTitle: String = ""

    var body: some View {
        NavigationStack {
            GlowWKWebView(url: initialURL, pageTitle: $pageTitle)
                .ignoresSafeArea(edges: .bottom)
                .navigationTitle(resolvedTitle)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") { dismiss() }
                    }
                    ToolbarItem(placement: .primaryAction) {
                        Menu {
                            Link("Open in Safari", destination: initialURL)
                            ShareLink(item: initialURL) {
                                Label("Share link", systemImage: "square.and.arrow.up")
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                        }
                    }
                }
        }
    }

    private var resolvedTitle: String {
        let trimmed = pageTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { return trimmed }
        if let s = suggestedNavigationTitle?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty {
            return s
        }
        return "Web"
    }
}

private struct GlowWKWebView: UIViewRepresentable {
    let url: URL
    @Binding var pageTitle: String

    func makeCoordinator() -> Coordinator {
        Coordinator(pageTitle: $pageTitle)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        let wv = WKWebView(frame: .zero, configuration: config)
        wv.navigationDelegate = context.coordinator
        wv.allowsBackForwardNavigationGestures = true
        wv.load(URLRequest(url: url))
        context.coordinator.webView = wv
        return wv
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        @Binding var pageTitle: String
        weak var webView: WKWebView?

        init(pageTitle: Binding<String>) {
            _pageTitle = pageTitle
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            let t = webView.title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            pageTitle = t
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            webView.reload()
        }
    }
}
