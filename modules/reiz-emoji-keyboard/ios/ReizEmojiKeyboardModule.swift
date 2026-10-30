import ExpoModulesCore
import UIKit

// Le catalogue d'Apple pour les réactions : un champ invisible qui ouvre directement le clavier emoji du téléphone
// (recherche, couleurs de peau, récents compris). Chaque emoji touché est envoyé à l'app et le champ se vide.
public class ReizEmojiKeyboardModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReizEmojiKeyboard")

    View(ReizEmojiInputView.self) {
      Events("onEmoji", "onDismiss")
      Prop("active") { (view: ReizEmojiInputView, active: Bool) in
        view.active = active
      }
    }
  }
}

/// Sans clavier emoji activé dans les réglages de l'iPhone, on retombe sur le clavier habituel : le reste est ignoré.
final class EmojiTextField: UITextField {
  override var textInputContextIdentifier: String? { "reiz-emoji" }
  override var textInputMode: UITextInputMode? {
    UITextInputMode.activeInputModes.first { $0.primaryLanguage == "emoji" } ?? super.textInputMode
  }
}

final class ReizEmojiInputView: ExpoView {
  let onEmoji = EventDispatcher()
  let onDismiss = EventDispatcher()
  private let field = EmojiTextField()

  var active = false {
    didSet { applyFocus() }
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    field.alpha = 0
    field.autocorrectionType = .no
    field.addTarget(self, action: #selector(textChanged), for: .editingChanged)
    field.addTarget(self, action: #selector(editingEnded), for: .editingDidEnd)
    addSubview(field)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    field.frame = bounds
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    applyFocus()
  }

  private func applyFocus() {
    guard window != nil else { return }
    if active {
      if !field.isFirstResponder { field.becomeFirstResponder() }
    } else if field.isFirstResponder {
      field.resignFirstResponder()
    }
  }

  @objc private func textChanged() {
    let last = field.text?.last
    field.text = ""
    guard let last, ReizEmojiInputView.isEmoji(last) else { return }
    onEmoji(["emoji": String(last)])
  }

  @objc private func editingEnded() {
    onDismiss([:])
  }

  /// Les chiffres et « # » comptent comme emoji pour Unicode : seuls ceux qui s'affichent en emoji passent.
  /// La base refuse une réaction de plus de 8 caractères Unicode (reactions_type_len) : ces rares emojis sont ignorés.
  private static func isEmoji(_ character: Character) -> Bool {
    guard let first = character.unicodeScalars.first, character.unicodeScalars.count <= 8 else { return false }
    return first.properties.isEmojiPresentation || (first.properties.isEmoji && character.unicodeScalars.count > 1)
  }
}
