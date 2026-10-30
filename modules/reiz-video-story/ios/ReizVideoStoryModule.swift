import ExpoModulesCore
import AVFoundation
import CoreImage
import UIKit

// Story vidéo : la vidéo de la séance remplit un cadre 1080 x 1920 (recadrée au centre, comme dans l'app),
// l'habillage Reiz (une image PNG transparente de la même taille) est posé par-dessus, le son est gardé.
// Tout se fait sur le téléphone avec AVFoundation et Core Image, rien n'est envoyé.
public class ReizVideoStoryModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReizVideoStory")

    AsyncFunction("compose") { (videoUri: String, overlayUri: String, promise: Promise) in
      ReizStoryComposer.compose(videoUri: videoUri, overlayUri: overlayUri) { result in
        switch result {
        case .success(let url): promise.resolve(url.absoluteString)
        case .failure(let error): promise.reject("ERR_REIZ_STORY", error.localizedDescription)
        }
      }
    }

    // Parcours d'un objectif (1.2) : photos et extraits vidéo à la suite, chacun avec son habillage, en MP4 9:16 muet.
    AsyncFunction("composeJourney") { (segments: [JourneySegment], promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let url = try ReizJourneyComposer.compose(segments)
          promise.resolve(url.absoluteString)
        } catch {
          promise.reject("ERR_REIZ_JOURNEY", error.localizedDescription)
        }
      }
    }
  }
}

/// Une étape du parcours. `overlay` : PNG transparent 1080 x 1920 posé par-dessus (jour, progression).
struct JourneySegment: Record {
  @Field var uri: String = ""
  @Field var type: String = "image"
  @Field var seconds: Double = 1.2
  @Field var overlay: String? = nil
}

enum ReizStoryComposer {
  static let renderSize = CGSize(width: 1080, height: 1920)

  static func fileURL(_ s: String) -> URL? {
    if s.hasPrefix("file://") || s.hasPrefix("http") { return URL(string: s) }
    return URL(fileURLWithPath: s)
  }

  static func failure(_ message: String) -> NSError {
    NSError(domain: "ReizVideoStory", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }

  static func compose(videoUri: String, overlayUri: String, done: @escaping (Result<URL, Error>) -> Void) {
    guard let videoURL = fileURL(videoUri), let overlayURL = fileURL(overlayUri),
          let overlay = UIImage(contentsOfFile: overlayURL.path)?.cgImage else {
      done(.failure(failure("Fichiers introuvables"))); return
    }
    // Vidéo du fil (adresse signée) : on la télécharge d'abord, l'export a besoin d'un fichier local.
    if videoURL.scheme == "http" || videoURL.scheme == "https" {
      let ext = videoURL.pathExtension.isEmpty ? "mp4" : videoURL.pathExtension
      URLSession.shared.downloadTask(with: videoURL) { tmp, _, error in
        guard let tmp = tmp else { done(.failure(error ?? failure("Téléchargement impossible"))); return }
        let local = FileManager.default.temporaryDirectory.appendingPathComponent("reiz-story-source-\(UUID().uuidString).\(ext)")
        do {
          try FileManager.default.moveItem(at: tmp, to: local)
        } catch {
          done(.failure(error)); return
        }
        composeLocal(videoURL: local, overlay: overlay, done: done)
      }.resume()
      return
    }
    composeLocal(videoURL: videoURL, overlay: overlay, done: done)
  }

  static func composeLocal(videoURL: URL, overlay: CGImage, done: @escaping (Result<URL, Error>) -> Void) {
    let asset = AVURLAsset(url: videoURL)
    guard let source = asset.tracks(withMediaType: .video).first else {
      done(.failure(failure("La vidéo est illisible"))); return
    }

    let composition = AVMutableComposition()
    let range = CMTimeRange(start: .zero, duration: asset.duration)
    guard let videoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else {
      done(.failure(failure("Montage impossible"))); return
    }
    do {
      try videoTrack.insertTimeRange(range, of: source, at: .zero)
    } catch {
      done(.failure(error)); return
    }
    if let audio = asset.tracks(withMediaType: .audio).first,
       let audioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) {
      try? audioTrack.insertTimeRange(range, of: audio, at: .zero)
    }

    // Chaque image de la vidéo : remise droite, recadrée au centre en 1080 x 1920, puis l'habillage par-dessus.
    // Core Image plutôt que Core Animation (AVVideoCompositionCoreAnimationTool plante dans le simulateur).
    let orientation = orientationOf(source.preferredTransform)
    // La capture de l'habillage peut sortir à la résolution de l'écran (x3) : on la ramène à 1080 x 1920.
    let overlayImage = CIImage(cgImage: overlay).transformed(by: CGAffineTransform(
      scaleX: renderSize.width / CGFloat(overlay.width), y: renderSize.height / CGFloat(overlay.height)))
    let videoComposition = AVMutableVideoComposition(asset: composition) { request in
      let upright = request.sourceImage.oriented(orientation)
      let frame = upright.extent
      let scale = max(renderSize.width / frame.width, renderSize.height / frame.height)
      let filled = upright
        .transformed(by: CGAffineTransform(translationX: -frame.origin.x, y: -frame.origin.y))
        .transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        .transformed(by: CGAffineTransform(translationX: (renderSize.width - frame.width * scale) / 2,
                                           y: (renderSize.height - frame.height * scale) / 2))
        .cropped(to: CGRect(origin: .zero, size: renderSize))
      request.finish(with: overlayImage.composited(over: filled), context: nil)
    }
    videoComposition.renderSize = renderSize
    let fps = source.nominalFrameRate > 0 ? min(Int32(source.nominalFrameRate.rounded()), 60) : 30
    videoComposition.frameDuration = CMTime(value: 1, timescale: fps)

    let output = FileManager.default.temporaryDirectory.appendingPathComponent("reiz-story-\(UUID().uuidString).mp4")
    guard let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
      done(.failure(failure("Export impossible"))); return
    }
    export.outputURL = output
    export.outputFileType = .mp4
    export.videoComposition = videoComposition
    export.shouldOptimizeForNetworkUse = true
    export.exportAsynchronously {
      if export.status == .completed { done(.success(output)) }
      else { done(.failure(export.error ?? failure("Export impossible"))) }
    }
  }

  // Sens de la vidéo d'après sa matrice : une vidéo portrait de l'iPhone est enregistrée couchée, avec une rotation.
  static func orientationOf(_ t: CGAffineTransform) -> CGImagePropertyOrientation {
    switch (t.a, t.b, t.c, t.d) {
    case (0, 1, -1, 0): return .right
    case (0, -1, 1, 0): return .left
    case (-1, 0, 0, -1): return .down
    default: return .up
    }
  }
}

// Le parcours d'un objectif en vidéo : chaque photo reste un peu plus d'une seconde avec un léger zoom, chaque
// vidéo passe ses premières secondes, l'habillage de l'étape est posé par-dessus, et la carte récap finit le film.
// Écrit image par image (AVAssetWriter, 30 images/s, sans son) : photos et vidéos se mélangent sans montage
// AVComposition. Une étape illisible (fichier manquant, vidéo cassée) est sautée plutôt que de tout faire échouer.
enum ReizJourneyComposer {
  static let size = ReizStoryComposer.renderSize
  static let fps = 30.0

  static func compose(_ segments: [JourneySegment]) throws -> URL {
    let output = FileManager.default.temporaryDirectory.appendingPathComponent("reiz-parcours-\(UUID().uuidString).mp4")
    let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: Int(size.width),
      AVVideoHeightKey: Int(size.height),
      AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 8_000_000],
    ])
    input.expectsMediaDataInRealTime = false
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
      kCVPixelBufferWidthKey as String: Int(size.width),
      kCVPixelBufferHeightKey as String: Int(size.height),
    ])
    guard writer.canAdd(input) else { throw ReizStoryComposer.failure("Montage impossible") }
    writer.add(input)
    guard writer.startWriting() else { throw writer.error ?? ReizStoryComposer.failure("Montage impossible") }
    writer.startSession(atSourceTime: .zero)

    let context = CIContext(options: [.cacheIntermediates: false])
    let canvas = CGRect(origin: .zero, size: size)
    let black = CIImage(color: .black).cropped(to: canvas)
    let rgb = CGColorSpaceCreateDeviceRGB()

    func append(_ image: CIImage, at seconds: Double) throws {
      while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.005) }
      guard let pool = adaptor.pixelBufferPool else { throw ReizStoryComposer.failure("Montage impossible") }
      var buffer: CVPixelBuffer?
      CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer)
      guard let pb = buffer else { throw ReizStoryComposer.failure("Mémoire insuffisante") }
      context.render(image.composited(over: black), to: pb, bounds: canvas, colorSpace: rgb)
      if !adaptor.append(pb, withPresentationTime: CMTime(seconds: seconds, preferredTimescale: 600)) {
        throw writer.error ?? ReizStoryComposer.failure("Montage impossible")
      }
    }

    var t = 0.0
    for seg in segments {
      let seconds = max(0.4, min(seg.seconds, 6))
      let overlay = seg.overlay.flatMap(loadOverlay)
      do {
        let url = try localURL(seg.uri)
        if seg.type == "video" {
          t += try appendVideo(url, seconds: seconds, overlay: overlay, from: t, append: append)
        } else {
          guard let still = loadImage(url) else { continue }
          let frames = Int((seconds * fps).rounded())
          for i in 0..<frames {
            // Zoom lent (1 à 1,06) : une photo fixe ne fige pas le film.
            let z = 1 + 0.06 * CGFloat(i) / CGFloat(max(frames, 1))
            let frame = zoom(fill(still), by: z)
            try append(overlay.map { $0.composited(over: frame) } ?? frame, at: t + Double(i) / fps)
          }
          t += Double(frames) / fps
        }
      } catch {
        continue
      }
    }
    if t == 0 {
      writer.cancelWriting()
      throw ReizStoryComposer.failure("Aucune photo lisible")
    }
    input.markAsFinished()
    let done = DispatchSemaphore(value: 0)
    writer.finishWriting { done.signal() }
    done.wait()
    if writer.status != .completed { throw writer.error ?? ReizStoryComposer.failure("Export impossible") }
    return output
  }

  /// Les premières secondes d'une vidéo, au plus 30 images/s. Renvoie la durée écrite.
  static func appendVideo(_ url: URL, seconds: Double, overlay: CIImage?, from t: Double, append: (CIImage, Double) throws -> Void) throws -> Double {
    let asset = AVURLAsset(url: url)
    guard let track = asset.tracks(withMediaType: .video).first else { throw ReizStoryComposer.failure("Vidéo illisible") }
    let reader = try AVAssetReader(asset: asset)
    reader.timeRange = CMTimeRange(start: .zero, duration: CMTime(seconds: seconds, preferredTimescale: 600))
    let output = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
    output.alwaysCopiesSampleData = false
    guard reader.canAdd(output) else { throw ReizStoryComposer.failure("Vidéo illisible") }
    reader.add(output)
    guard reader.startReading() else { throw reader.error ?? ReizStoryComposer.failure("Vidéo illisible") }
    defer { reader.cancelReading() }
    let orientation = ReizStoryComposer.orientationOf(track.preferredTransform)
    var first: Double?
    var last = -1.0
    while let sample = output.copyNextSampleBuffer() {
      guard let pb = CMSampleBufferGetImageBuffer(sample) else { continue }
      let pts = CMSampleBufferGetPresentationTimeStamp(sample).seconds
      if first == nil { first = pts }
      let rel = pts - (first ?? 0)
      if rel >= seconds { break }
      if last >= 0 && rel - last < 1 / fps - 0.002 { continue }
      let frame = fill(CIImage(cvPixelBuffer: pb).oriented(orientation))
      try append(overlay.map { $0.composited(over: frame) } ?? frame, t + rel)
      last = rel
    }
    if last < 0 { throw ReizStoryComposer.failure("Vidéo illisible") }
    return last + 1 / fps
  }

  /// Image recadrée au centre pour remplir 1080 x 1920.
  static func fill(_ image: CIImage) -> CIImage {
    let f = image.extent
    let scale = max(size.width / f.width, size.height / f.height)
    return image
      .transformed(by: CGAffineTransform(translationX: -f.origin.x, y: -f.origin.y))
      .transformed(by: CGAffineTransform(scaleX: scale, y: scale))
      .transformed(by: CGAffineTransform(translationX: (size.width - f.width * scale) / 2, y: (size.height - f.height * scale) / 2))
      .cropped(to: CGRect(origin: .zero, size: size))
  }

  static func zoom(_ image: CIImage, by z: CGFloat) -> CIImage {
    let c = CGPoint(x: size.width / 2, y: size.height / 2)
    return image
      .transformed(by: CGAffineTransform(translationX: -c.x, y: -c.y).concatenating(CGAffineTransform(scaleX: z, y: z)).concatenating(CGAffineTransform(translationX: c.x, y: c.y)))
      .cropped(to: CGRect(origin: .zero, size: size))
  }

  /// Photo remise droite d'après ses métadonnées (une photo d'iPhone est souvent enregistrée couchée).
  static func loadImage(_ url: URL) -> CIImage? {
    if let ci = CIImage(contentsOf: url, options: [.applyOrientationProperty: true]) { return ci }
    guard let ui = UIImage(contentsOfFile: url.path), let cg = ui.cgImage else { return nil }
    return CIImage(cgImage: cg)
  }

  static func loadOverlay(_ uri: String) -> CIImage? {
    guard let url = ReizStoryComposer.fileURL(uri), let cg = UIImage(contentsOfFile: url.path)?.cgImage else { return nil }
    // Capture à la résolution de l'écran (x3) possible : ramenée à 1080 x 1920.
    return CIImage(cgImage: cg).transformed(by: CGAffineTransform(scaleX: size.width / CGFloat(cg.width), y: size.height / CGFloat(cg.height)))
  }

  /// Fichier local ; une adresse signée du stockage est d'abord téléchargée (on est déjà hors du fil principal).
  static func localURL(_ s: String) throws -> URL {
    guard let url = ReizStoryComposer.fileURL(s) else { throw ReizStoryComposer.failure("Fichier introuvable") }
    guard url.scheme == "http" || url.scheme == "https" else { return url }
    let done = DispatchSemaphore(value: 0)
    var local: URL?
    var failure: Error?
    URLSession.shared.downloadTask(with: url) { tmp, _, error in
      if let tmp = tmp {
        let ext = url.pathExtension.isEmpty ? "bin" : url.pathExtension
        let dest = FileManager.default.temporaryDirectory.appendingPathComponent("reiz-parcours-source-\(UUID().uuidString).\(ext)")
        do { try FileManager.default.moveItem(at: tmp, to: dest); local = dest } catch { failure = error }
      } else {
        failure = error
      }
      done.signal()
    }.resume()
    done.wait()
    if let local = local { return local }
    throw failure ?? ReizStoryComposer.failure("Téléchargement impossible")
  }
}
