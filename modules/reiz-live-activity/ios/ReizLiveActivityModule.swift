import ExpoModulesCore
import ActivityKit

// Même forme que la carte d'expo-live-activity : ActivityKit retrouve les Activités par le nom du type
// (« LiveActivityAttributes ») et leur contenu, pas par le module qui les a déclarées.
@available(iOS 16.2, *)
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
  var deepLinkUrl: String?
}

// La carte du duo se ferme toute seule quand la séance est postée, ou quand l'heure du duo est passée.
public class ReizLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReizLiveActivity")

    // Toutes les cartes Reiz en cours (une séance vient d'être postée).
    AsyncFunction("endAll") { () -> Int in
      guard #available(iOS 16.2, *) else { return 0 }
      let all = Activity<LiveActivityAttributes>.activities
      for activity in all { await activity.end(nil, dismissalPolicy: .immediate) }
      return all.count
    }

    // Seulement celles dont le compte à rebours est fini (à l'ouverture de l'app).
    AsyncFunction("endExpired") { () -> Int in
      guard #available(iOS 16.2, *) else { return 0 }
      let now = Date().timeIntervalSince1970 * 1000
      var ended = 0
      for activity in Activity<LiveActivityAttributes>.activities {
        if let end = activity.content.state.timerEndDateInMilliseconds, end < now {
          await activity.end(nil, dismissalPolicy: .immediate)
          ended += 1
        }
      }
      return ended
    }
  }
}
