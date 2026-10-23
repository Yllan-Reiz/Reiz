import ActivityKit
import SwiftUI
import WidgetKit

// Carte du duo Reiz (Activité en direct), dessinée d'après la maquette de Yllan du 23/10/2026.
// Copiée par plugins/withLiveActivityScheme.js à la place du fichier d'expo-live-activity : la mécanique
// (démarrage par notification, jetons) reste celle de la bibliothèque, seul le dessin change.
//
// La jauge avance toute seule (iOS l'anime). Sa couleur dépend du temps restant au moment où la carte est
// dessinée : vert, puis orange sous 20 minutes, puis rouge sous 5 minutes. Le serveur (live-activity-tick)
// envoie une mise à jour à chaque seuil pour que la carte se redessine dans la bonne couleur.

struct LiveActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var title: String
    var subtitle: String?
    var timerEndDateInMilliseconds: Double?
    var progress: Double?
    var imageName: String?
    var dynamicIslandImageName: String?
  }

  var name: String
  var backgroundColor: String?
  var titleColor: String?
  var subtitleColor: String?
  var progressViewTint: String?
  var progressViewLabelColor: String?
  var deepLinkUrl: String?
  var timerType: DynamicIslandTimerType?
  var padding: Int?
  var paddingDetails: PaddingDetails?
  var imagePosition: String?
  var imageWidth: Int?
  var imageHeight: Int?
  var imageWidthPercent: Double?
  var imageHeightPercent: Double?
  var imageAlign: String?
  var contentFit: String?
  // Ajouts Reiz (facultatifs : la bibliothèque les ignore).
  var startDateInMilliseconds: Double?
  var countLabel: String?
  var initials: [String]?
  var moreCount: Int?
  var timeLabel: String?

  enum DynamicIslandTimerType: String, Codable {
    case circular
    case digital
  }

  struct PaddingDetails: Codable, Hashable {
    var top: Int?
    var bottom: Int?
    var left: Int?
    var right: Int?
    var vertical: Int?
    var horizontal: Int?
  }
}

// MARK: - Couleur selon le temps restant

enum DuoPhase {
  case green, orange, red

  static func at(_ end: Date, now: Date = Date()) -> DuoPhase {
    let left = end.timeIntervalSince(now)
    if left > 20 * 60 { return .green }
    if left > 5 * 60 { return .orange }
    return .red
  }

  var colors: [Color] {
    switch self {
    case .green: return [Color(hex: "4ADE80"), Color(hex: "2DD4BF")]
    case .orange: return [Color(hex: "FFC531"), Color(hex: "FF8A1F")]
    case .red: return [Color(hex: "FF6B6B"), Color(hex: "FF3B3B")]
    }
  }

  var main: Color { colors[0] }
  var end: Color { colors[1] }
}

private struct DuoTimes {
  let start: Date
  let end: Date

  init(state: LiveActivityAttributes.ContentState, attributes: LiveActivityAttributes) {
    let end = Date(timeIntervalSince1970: (state.timerEndDateInMilliseconds ?? Date().timeIntervalSince1970 * 1000) / 1000)
    let start = attributes.startDateInMilliseconds.map { Date(timeIntervalSince1970: $0 / 1000) } ?? end.addingTimeInterval(-3600)
    self.end = end
    self.start = min(start, end.addingTimeInterval(-1))
  }

  // Le compte à rebours part de maintenant (au moment du dessin) : jamais d'intervalle à l'envers.
  var remaining: ClosedRange<Date> { let now = min(Date(), end); return now...end }
}

// MARK: - Morceaux de la carte

private struct ReizLogo: View {
  var size: CGFloat
  var body: some View {
    Image("reiz_logo")
      .resizable()
      .aspectRatio(contentMode: .fill)
      .frame(width: size, height: size)
      .clipShape(RoundedRectangle(cornerRadius: size * 0.24, style: .continuous))
      .overlay(RoundedRectangle(cornerRadius: size * 0.24, style: .continuous).strokeBorder(Color.white.opacity(0.12), lineWidth: 0.5))
  }
}

private struct AvatarStack: View {
  let initials: [String]
  let more: Int
  private let palette = ["8B5CF6", "0EA5E9", "F97316", "10B981", "EC4899"]

  var body: some View {
    HStack(spacing: -8) {
      ForEach(Array(initials.prefix(3).enumerated()), id: \.offset) { index, letter in
        Text(letter)
          .font(.system(size: 11, weight: .bold))
          .foregroundStyle(.white)
          .frame(width: 26, height: 26)
          .background(Circle().fill(LinearGradient(
            colors: [Color(hex: palette[index % palette.count]), Color(hex: palette[index % palette.count]).opacity(0.65)],
            startPoint: .topLeading, endPoint: .bottomTrailing)))
          .overlay(Circle().strokeBorder(Color.black.opacity(0.6), lineWidth: 1.5))
      }
      if more > 0 {
        Text("+\(more)")
          .font(.system(size: 11, weight: .semibold))
          .foregroundStyle(.white.opacity(0.85))
          .frame(width: 26, height: 26)
          .background(Circle().fill(Color.white.opacity(0.14)))
          .overlay(Circle().strokeBorder(Color.black.opacity(0.6), lineWidth: 1.5))
          .padding(.leading, 12)
      }
    }
  }
}

private struct DuoBar: View {
  let times: DuoTimes
  let phase: DuoPhase

  var body: some View {
    ProgressView(timerInterval: times.start...times.end, countsDown: false, label: { EmptyView() }, currentValueLabel: { EmptyView() })
      .progressViewStyle(.linear)
      .tint(phase.main)
      .scaleEffect(x: 1, y: 3.0, anchor: .center)
      .shadow(color: phase.main.opacity(0.9), radius: 5)
      .shadow(color: phase.end.opacity(0.5), radius: 10)
  }
}

private struct RemainingText: View {
  let times: DuoTimes
  let phase: DuoPhase
  var size: CGFloat = 14

  var body: some View {
    HStack(spacing: 4) {
      Text(timerInterval: times.remaining, countsDown: true)
        .monospacedDigit()
        .lineLimit(1)
        .frame(width: size * 3.25, alignment: .leading)
      Text("restant")
    }
    .font(.system(size: size, weight: .semibold))
    .foregroundStyle(phase.main)
  }
}

// MARK: - Écran verrouillé

struct DuoLockScreenView: View {
  let state: LiveActivityAttributes.ContentState
  let attributes: LiveActivityAttributes

  var body: some View {
    let times = DuoTimes(state: state, attributes: attributes)
    let phase = DuoPhase.at(times.end)
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .top, spacing: 12) {
        ReizLogo(size: 48)
        VStack(alignment: .leading, spacing: 4) {
          Text(state.title)
            .font(.system(size: 17, weight: .bold))
            .foregroundStyle(.white)
            .lineLimit(1)
          if let subtitle = state.subtitle {
            Text(subtitle)
              .font(.system(size: 15))
              .foregroundStyle(.white.opacity(0.72))
              .lineLimit(1)
          }
        }
        Spacer(minLength: 6)
        VStack(alignment: .trailing, spacing: 8) {
          if let time = attributes.timeLabel {
            Text(time)
              .font(.system(size: 13, weight: .medium))
              .foregroundStyle(.white.opacity(0.55))
          }
          if let initials = attributes.initials, !initials.isEmpty {
            AvatarStack(initials: initials, more: attributes.moreCount ?? 0)
          }
        }
      }
      HStack(spacing: 14) {
        DuoBar(times: times, phase: phase)
        if let count = attributes.countLabel {
          Text(count)
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(.white.opacity(0.75))
        }
      }
      RemainingText(times: times, phase: phase)
    }
    .padding(.horizontal, 18)
    .padding(.vertical, 16)
    .background(
      LinearGradient(colors: [phase.main.opacity(0.14), .clear, phase.end.opacity(0.06)],
                     startPoint: .topLeading, endPoint: .bottomTrailing)
    )
    .overlay(
      RoundedRectangle(cornerRadius: 24, style: .continuous)
        .strokeBorder(LinearGradient(colors: [phase.main.opacity(0.75), phase.end.opacity(0.25), phase.main.opacity(0.55)],
                                     startPoint: .topLeading, endPoint: .bottomTrailing), lineWidth: 1.2)
        .shadow(color: phase.main.opacity(0.55), radius: 8)
    )
  }
}

// MARK: - Activité en direct

struct LiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LiveActivityAttributes.self) { context in
      DuoLockScreenView(state: context.state, attributes: context.attributes)
        .activityBackgroundTint(Color(hex: "0E0F12").opacity(0.82))
        .activitySystemActionForegroundColor(Color.white)
        .applyWidgetURL(from: context.attributes.deepLinkUrl)
    } dynamicIsland: { context in
      let times = DuoTimes(state: context.state, attributes: context.attributes)
      let phase = DuoPhase.at(times.end)
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          ReizLogo(size: 44)
            .padding(.leading, 4)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
        DynamicIslandExpandedRegion(.trailing) {
          VStack(alignment: .trailing, spacing: 6) {
            if let initials = context.attributes.initials, !initials.isEmpty {
              AvatarStack(initials: initials, more: context.attributes.moreCount ?? 0)
            }
            if let count = context.attributes.countLabel {
              Text(count).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white.opacity(0.75))
            }
          }
          .padding(.trailing, 4)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
        DynamicIslandExpandedRegion(.center) {
          VStack(alignment: .leading, spacing: 2) {
            Text(context.state.title)
              .font(.system(size: 16, weight: .bold))
              .foregroundStyle(.white)
              .lineLimit(1)
            if let subtitle = context.state.subtitle {
              Text(subtitle)
                .font(.system(size: 13))
                .foregroundStyle(.white.opacity(0.7))
                .lineLimit(1)
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 8) {
            DuoBar(times: times, phase: phase)
            RemainingText(times: times, phase: phase, size: 13)
          }
          .padding(.horizontal, 6)
          .padding(.top, 4)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
      } compactLeading: {
        ReizLogo(size: 22)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
      } compactTrailing: {
        Text(timerInterval: times.remaining, countsDown: true)
          .monospacedDigit()
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(phase.main)
          .frame(maxWidth: 46)
          .multilineTextAlignment(.trailing)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
      } minimal: {
        ProgressView(timerInterval: times.start...times.end, countsDown: true, label: { EmptyView() }, currentValueLabel: { EmptyView() })
          .progressViewStyle(.circular)
          .tint(phase.main)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
      }
      .keylineTint(phase.main)
      .widgetURL(URL(string: "reiz://" + (context.attributes.deepLinkUrl ?? "")))
    }
  }
}
