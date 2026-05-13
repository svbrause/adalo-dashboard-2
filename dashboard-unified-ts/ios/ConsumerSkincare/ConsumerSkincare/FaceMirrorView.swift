import PhotosUI
import SwiftUI
import Vision

struct FaceMirrorView: View {
    /// Shorter chrome when embedded on the Plan tab (section header carries context).
    var planCompact: Bool = false

    @EnvironmentObject private var session: AppSession
    @State private var pickerItem: PhotosPickerItem?
    @State private var image: UIImage?
    @State private var observation: VNFaceObservation?
    @State private var runningVision = false

    private var overlayKinds: Set<FaceOverlayKind> {
        guard let profile = session.outcome?.profile else { return [.nose, .lips, .leftEye, .rightEye] }
        return FaceOverlayKind.kinds(for: profile)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Glow map")
                .font(planCompact ? .title3 : .title2)
                .fontWeight(.semibold)
                .padding(.horizontal, 20)

            Text(
                planCompact
                    ? "Landmarks on a selfie or sample—on device, tuned to your quiz results."
                    : "We lightly highlight regions that match your quiz results—similar to an annotated mirror at a visit, using on-device face landmarks."
            )
            .font(planCompact ? .caption : .footnote)
            .foregroundStyle(.secondary)
            .padding(.horizontal, 20)

            PhotosPicker(selection: $pickerItem, matching: .images) {
                Label("Choose a selfie", systemImage: "photo.on.rectangle.angled")
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(RoundedRectangle(cornerRadius: 14).fill(Color.accentColor.opacity(0.12)))
            }
            .padding(.horizontal, 20)
            .onChange(of: pickerItem) { _, new in
                Task { await loadPhoto(new) }
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Sample faces")
                    .font(.subheadline.weight(.semibold))
                Text("Tap a number to load a bundled front photo—no Photos library needed.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(1 ... ScanSampleLibrary.bundledSampleCount, id: \.self) { index in
                            Button {
                                Task { await loadBundledSample(index: index) }
                            } label: {
                                Text("\(index)")
                                    .font(.caption.weight(.semibold))
                                    .frame(width: 40, height: 40)
                                    .contentShape(Circle())
                                    .background(Circle().fill(Color.accentColor.opacity(0.18)))
                            }
                            .buttonStyle(.plain)
                            .frame(minWidth: 48, minHeight: 48)
                        }
                    }
                }
            }
            .padding(.horizontal, 20)

            Button {
                Task { await loadSample() }
            } label: {
                Text("Try web sample photo")
                    .font(.subheadline)
            }
            .padding(.horizontal, 20)

            if runningVision {
                ProgressView("Mapping your face…")
                    .frame(maxWidth: .infinity)
                    .padding()
            }

            if let image {
                FaceLandmarkOverlay(
                    image: image,
                    observation: observation,
                    kinds: overlayKinds
                )
                .frame(maxWidth: .infinity)
                .aspectRatio(image.size.width / image.size.height, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .padding(.horizontal, 16)
            } else {
                RoundedRectangle(cornerRadius: 20)
                    .fill(Color(.tertiarySystemFill))
                    .aspectRatio(3 / 4, contentMode: .fit)
                    .overlay {
                        Text("Your photo preview")
                            .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal, 16)
            }

            if session.outcome == nil {
                Text("Complete the quiz for highlights tuned to your gemstone type.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 20)
            }
        }
        .padding(.bottom, 32)
        .task {
            ProductCatalog.loadIfNeeded()
        }
    }

    private func loadPhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        runningVision = true
        defer { runningVision = false }
        guard let data = try? await item.loadTransferable(type: Data.self),
              let ui = await decodeUIImage(from: data)
        else {
            await MainActor.run {
                session.recordFaceScan(
                    sourceSummary: "Photo library — could not load",
                    landmarksFound: false,
                    faceConfidence: 0
                )
            }
            return
        }
        await MainActor.run { image = ui }
        let obs = await detectFace(ui)
        await MainActor.run {
            observation = obs
            session.recordFaceScan(
                sourceSummary: "Photo library",
                landmarksFound: obs != nil,
                faceConfidence: obs?.confidence ?? 0
            )
        }
    }

    private func loadBundledSample(index: Int) async {
        let source = "Sample \(index)"
        runningVision = true
        defer { runningVision = false }
        guard let url = ScanSampleLibrary.bundleURL(for: index) else {
            await MainActor.run {
                session.recordFaceScan(
                    sourceSummary: "\(source) — not bundled in app",
                    landmarksFound: false,
                    faceConfidence: 0
                )
            }
            return
        }
        let path = url.path
        let ui = await Task.detached(priority: .userInitiated) {
            UIImage(contentsOfFile: path)
        }.value
        guard let ui else {
            await MainActor.run {
                session.recordFaceScan(
                    sourceSummary: "\(source) — could not decode image",
                    landmarksFound: false,
                    faceConfidence: 0
                )
            }
            return
        }
        await MainActor.run { image = ui }
        let obs = await detectFace(ui)
        await MainActor.run {
            observation = obs
            session.recordFaceScan(
                sourceSummary: source,
                landmarksFound: obs != nil,
                faceConfidence: obs?.confidence ?? 0
            )
        }
    }

    private func loadSample() async {
        runningVision = true
        defer { runningVision = false }
        let url = URL(string: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=776&auto=format&fit=crop")!
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            guard let ui = await decodeUIImage(from: data) else {
                await MainActor.run {
                    session.recordFaceScan(
                        sourceSummary: "Web sample — could not decode",
                        landmarksFound: false,
                        faceConfidence: 0
                    )
                }
                return
            }
            await MainActor.run { image = ui }
            let obs = await detectFace(ui)
            await MainActor.run {
                observation = obs
                session.recordFaceScan(
                    sourceSummary: "Web sample",
                    landmarksFound: obs != nil,
                    faceConfidence: obs?.confidence ?? 0
                )
            }
        } catch {
            await MainActor.run {
                session.recordFaceScan(
                    sourceSummary: "Web sample — download failed",
                    landmarksFound: false,
                    faceConfidence: 0
                )
            }
        }
    }

    /// Decode off the main thread so the UI stays responsive while loading large JPEGs.
    private nonisolated func decodeUIImage(from data: Data) async -> UIImage? {
        await Task.detached(priority: .userInitiated) {
            UIImage(data: data)
        }.value
    }

    private func detectFace(_ ui: UIImage) async -> VNFaceObservation? {
        guard let cg = ui.cgImage else { return nil }
        let orientation = cgOrientation(ui.imageOrientation)
        return await Task.detached(priority: .userInitiated) {
            let handler = VNImageRequestHandler(
                cgImage: cg,
                orientation: orientation,
                options: [:]
            )
            let req = VNDetectFaceLandmarksRequest()
            do {
                try handler.perform([req])
            } catch {
                return nil
            }
            return (req.results as? [VNFaceObservation])?.first
        }.value
    }

    private func cgOrientation(_ o: UIImage.Orientation) -> CGImagePropertyOrientation {
        switch o {
        case .up: return .up
        case .down: return .down
        case .left: return .left
        case .right: return .right
        case .upMirrored: return .upMirrored
        case .downMirrored: return .downMirrored
        case .leftMirrored: return .leftMirrored
        case .rightMirrored: return .rightMirrored
        @unknown default: return .up
        }
    }
}

// MARK: - Overlay kinds

enum FaceOverlayKind: Hashable {
    case forehead
    case tZone
    case leftCheek
    case rightCheek
    case leftEye
    case rightEye
    case nose
    case lips

    static func kinds(for profile: SkinProfile) -> Set<FaceOverlayKind> {
        let h = profile.sectionLetters[.hydration] ?? "O"
        let r = profile.sectionLetters[.reactivity] ?? "R"
        let p = profile.sectionLetters[.pigmentation] ?? "N"

        var set: Set<FaceOverlayKind> = [.nose, .lips, .leftEye, .rightEye]
        if h == "O" { set.formUnion([.forehead, .tZone]) }
        if h == "D" { set.formUnion([.leftCheek, .rightCheek]) }
        if p == "P" { set.formUnion([.leftCheek, .rightCheek, .forehead]) }
        if r == "S" { set.formUnion([.leftCheek, .rightCheek, .forehead]) }
        return set
    }
}

// MARK: - Drawing

private struct FaceLandmarkOverlay: View {
    let image: UIImage
    let observation: VNFaceObservation?
    let kinds: Set<FaceOverlayKind>

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(width: geo.size.width, height: geo.size.height)

                if let observation {
                    Canvas { ctx, size in
                        draw(
                            ctx: &ctx,
                            container: size,
                            imageSize: image.size,
                            observation: observation
                        )
                    }
                    .allowsHitTesting(false)
                }
            }
        }
    }

    private func draw(
        ctx: inout GraphicsContext,
        container: CGSize,
        imageSize: CGSize,
        observation: VNFaceObservation
    ) {
        let fitted = aspectFit(imageSize: imageSize, in: container)
        let box = observation.boundingBox
        let faceRect = CGRect(
            x: fitted.minX + box.minX * fitted.width,
            y: fitted.minY + (1 - box.maxY) * fitted.height,
            width: box.width * fitted.width,
            height: box.height * fitted.height
        )

        guard let lm = observation.landmarks else { return }

        func mapPoint(_ p: CGPoint) -> CGPoint {
            CGPoint(
                x: faceRect.minX + CGFloat(p.x) * faceRect.width,
                y: faceRect.minY + CGFloat(1 - p.y) * faceRect.height
            )
        }

        func fillRegion(_ region: VNFaceLandmarkRegion2D?, color: Color) {
            guard let region else { return }
            let pts = LandmarkGeometry.cgPoints(region)
            guard pts.count >= 2 else { return }
            var path = Path()
            path.move(to: mapPoint(pts[0]))
            for i in 1 ..< pts.count {
                path.addLine(to: mapPoint(pts[i]))
            }
            path.closeSubpath()
            ctx.fill(path, with: .color(color.opacity(0.35)))
        }

        if kinds.contains(.forehead), let eyebrow = lm.leftEyebrow, let rb = lm.rightEyebrow {
            drawForehead(left: eyebrow, right: rb, mapPoint: mapPoint, ctx: &ctx)
        }
        if kinds.contains(.tZone), let nose = lm.nose {
            fillRegion(nose, color: .mint)
        }
        if kinds.contains(.nose), let noseCrest = lm.noseCrest {
            fillRegion(noseCrest, color: .orange.opacity(0.5))
        }
        if kinds.contains(.lips), let outer = lm.outerLips {
            fillRegion(outer, color: .pink)
        }
        if kinds.contains(.leftEye), let le = lm.leftEye {
            fillRegion(le, color: .cyan)
        }
        if kinds.contains(.rightEye), let re = lm.rightEye {
            fillRegion(re, color: .cyan)
        }
        if kinds.contains(.leftCheek), let fc = lm.faceContour {
            drawCheekSide(faceContour: fc, mapPoint: mapPoint, ctx: &ctx, left: true)
        }
        if kinds.contains(.rightCheek), let fc = lm.faceContour {
            drawCheekSide(faceContour: fc, mapPoint: mapPoint, ctx: &ctx, left: false)
        }
    }

    private func drawForehead(
        left: VNFaceLandmarkRegion2D,
        right: VNFaceLandmarkRegion2D,
        mapPoint: (CGPoint) -> CGPoint,
        ctx: inout GraphicsContext
    ) {
        var path = Path()
        let lp = LandmarkGeometry.cgPoints(left)
        let rp = LandmarkGeometry.cgPoints(right)
        guard !lp.isEmpty, !rp.isEmpty else { return }
        path.move(to: mapPoint(lp[lp.startIndex]))
        for p in lp.dropFirst() { path.addLine(to: mapPoint(p)) }
        for p in rp.reversed() { path.addLine(to: mapPoint(p)) }
        path.closeSubpath()
        ctx.fill(path, with: .color(Color.purple.opacity(0.22)))
    }

    private func drawCheekSide(
        faceContour: VNFaceLandmarkRegion2D,
        mapPoint: (CGPoint) -> CGPoint,
        ctx: inout GraphicsContext,
        left: Bool
    ) {
        let pts = LandmarkGeometry.cgPoints(faceContour)
        guard pts.count > 16 else { return }
        let slice: ArraySlice<CGPoint>
        if left {
            let end = min(22, pts.count)
            slice = pts[4 ..< end]
        } else {
            let start = max(0, pts.count - 22)
            let end = max(start + 4, pts.count - 4)
            slice = pts[start ..< end]
        }
        var path = Path()
        guard !slice.isEmpty else { return }
        path.move(to: mapPoint(slice[slice.startIndex]))
        for p in slice.dropFirst() {
            path.addLine(to: mapPoint(p))
        }
        path.closeSubpath()
        ctx.fill(path, with: .color(Color.yellow.opacity(0.2)))
    }

    private func aspectFit(imageSize: CGSize, in box: CGSize) -> CGRect {
        let scale = min(box.width / imageSize.width, box.height / imageSize.height)
        let w = imageSize.width * scale
        let h = imageSize.height * scale
        let x = (box.width - w) / 2
        let y = (box.height - h) / 2
        return CGRect(x: x, y: y, width: w, height: h)
    }
}

private enum LandmarkGeometry {
    /// `normalizedPoints` is a non-optional `[CGPoint]` in Swift; never `guard let` it.
    static func cgPoints(_ region: VNFaceLandmarkRegion2D) -> [CGPoint] {
        let count = Int(region.pointCount)
        guard count > 0 else { return [] }
        return Array(region.normalizedPoints.prefix(count))
    }
}
