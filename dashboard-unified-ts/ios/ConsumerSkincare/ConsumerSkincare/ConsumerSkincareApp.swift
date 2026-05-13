import SwiftUI

@main
struct ConsumerSkincareApp: App {
    @StateObject private var session = AppSession()
    @StateObject private var progressJournal = ProgressJournalStore()

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .environmentObject(session)
                .environmentObject(progressJournal)
                .tint(Color(red: 0.45, green: 0.35, blue: 0.55))
        }
    }
}
