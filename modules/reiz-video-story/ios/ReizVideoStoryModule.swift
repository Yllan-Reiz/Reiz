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
  }
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
