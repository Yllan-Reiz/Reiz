import ExpoModulesCore
import UIKit

// La barre de message des réseaux sociaux : elle reste collée au clavier, à l'ouverture, à la fermeture et quand on le
// fait descendre au doigt. Tout se passe ici, sans passer par JavaScript ni recalculer la mise en page.
//
// Version 2 (31/10/2026). La version 1 ne lisait que le repère `keyboardLayoutGuide` : sur l'iPhone de Yllan (build 18),
// la barre restait sous le clavier, alors que le simulateur la suivait. Maintenant, les notifications du clavier
// (UIKeyboardWillChangeFrame) font foi, animées avec la courbe même du clavier : elles marchent partout. Le repère ne
// sert plus qu'au glissement au doigt, et seulement quand il donne une position plausible (entre le clavier et le bas).
public class ReizKeyboardDockModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReizKeyboardDock")
    Constants(["version": 2])

    View(ReizKeyboardDockView.self) {
      Prop("hiddenBottom") { (view: ReizKeyboardDockView, value: Double) in
        view.hiddenBottom = CGFloat(value)
      }
    }
  }
}

final class ReizKeyboardDockView: ExpoView {
  /// Le bas de la barre qui peut passer sous le clavier (la marge du bas de l'écran, inutile quand le clavier est ouvert).
  var hiddenBottom: CGFloat = 0

  // Une vue invisible accrochée au haut du clavier : UIKit la déplace avec le doigt pendant un glissement.
  private let probe = UIView()
  private var link: CADisplayLink?
  /// Haut du clavier d'après la dernière notification (coordonnées de la fenêtre), nil = clavier fermé.
  private var keyboardTop: CGFloat?
  private var animating = false

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    // Pas isHidden : la position animée d'une vue masquée n'est pas tenue à jour.
    probe.alpha = 0
    probe.isUserInteractionEnabled = false
    probe.translatesAutoresizingMaskIntoConstraints = false
    let center = NotificationCenter.default
    center.addObserver(self, selector: #selector(keyboardWillChange(_:)), name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
    center.addObserver(self, selector: #selector(keyboardWillChange(_:)), name: UIResponder.keyboardWillHideNotification, object: nil)
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
    link?.invalidate()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    link?.invalidate()
    link = nil
    probe.removeFromSuperview()
    guard let window else { return }

    // Le repère du clavier se lit sur l'écran qui nous contient (une feuille est un écran à part), pas sur la fenêtre.
    let host = hostView() ?? window
    host.addSubview(probe)
    if #available(iOS 17.0, *) { host.keyboardLayoutGuide.usesBottomSafeArea = false }
    NSLayoutConstraint.activate([
      probe.leadingAnchor.constraint(equalTo: host.leadingAnchor),
      probe.widthAnchor.constraint(equalToConstant: 1),
      probe.heightAnchor.constraint(equalToConstant: 1),
      probe.bottomAnchor.constraint(equalTo: host.keyboardLayoutGuide.topAnchor),
    ])
    host.layoutIfNeeded()
    let displayLink = CADisplayLink(target: self, selector: #selector(follow))
    displayLink.add(to: .main, forMode: .common)
    link = displayLink
  }

  private func hostView() -> UIView? {
    var responder: UIResponder? = self
    while let current = responder {
      if let controller = current as? UIViewController { return controller.view }
      responder = current.next
    }
    return nil
  }

  /// Décalage à appliquer pour que le bas de la barre (moins sa marge cachée) touche le haut du clavier.
  private func offset(forKeyboardTop top: CGFloat) -> CGFloat {
    guard let window, let superview else { return 0 }
    // La place de la barre sans décalage : `center` et `bounds` ignorent la transformation (contrairement à `frame`).
    // PIÈGE (31/10/2026) : retirer `transform.ty` ici fait fuir la barre hors de l'écran, image après image.
    let restingBottom = superview.convert(CGPoint(x: 0, y: center.y + bounds.height / 2), to: window).y
    return -max(0, restingBottom - hiddenBottom - top)
  }

  @objc private func keyboardWillChange(_ note: Notification) {
    guard let window else { return }
    let end = (note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue ?? .zero
    let duration = (note.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? TimeInterval) ?? 0.25
    let curve = (note.userInfo?[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt) ?? 7
    let endInWindow = window.convert(end, from: nil)
    let hidden = note.name == UIResponder.keyboardWillHideNotification || end.height == 0 || endInWindow.minY >= window.bounds.height - 1
    let top = hidden ? window.bounds.height : endInWindow.minY
    keyboardTop = hidden ? nil : top
    let target = offset(forKeyboardTop: top)
    animating = true
    UIView.animate(withDuration: duration, delay: 0, options: [UIView.AnimationOptions(rawValue: curve << 16), .beginFromCurrentState, .allowUserInteraction], animations: {
      self.transform = CGAffineTransform(translationX: 0, y: target)
    }, completion: { _ in self.animating = false })
  }

  /// À chaque image, pendant un glissement au doigt seulement : le clavier est entre sa place connue et le bas.
  @objc private func follow() {
    guard !animating, let known = keyboardTop, let window, let host = probe.superview else { return }
    let probeFrame = (probe.layer.presentation() ?? probe.layer).frame
    let top = host.convert(CGPoint(x: 0, y: probeFrame.maxY), to: window).y
    let next: CGFloat
    if top > known + 0.5 && top < window.bounds.height - 0.5 {
      next = offset(forKeyboardTop: top)
    } else if top <= known + 0.5 {
      next = offset(forKeyboardTop: known)
    } else {
      return
    }
    guard abs(next - transform.ty) > 0.01 else { return }
    transform = CGAffineTransform(translationX: 0, y: next)
  }
}
