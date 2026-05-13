import Foundation

/// Bundled front photos under `Resources/ScanSamples/` for the glow map / scan flow (no Photos library required).
enum ScanSampleLibrary {
    static let bundledSampleCount = 12

    static func bundleURL(for index: Int) -> URL? {
        guard index >= 1, index <= bundledSampleCount else { return nil }
        let name = String(format: "scan_sample_%02d", index)
        if let u = Bundle.main.url(forResource: name, withExtension: "jpg", subdirectory: "ScanSamples") {
            return u
        }
        return Bundle.main.url(forResource: name, withExtension: "jpg")
    }
}
