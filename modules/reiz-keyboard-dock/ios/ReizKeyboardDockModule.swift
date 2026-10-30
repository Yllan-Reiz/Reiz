import ExpoModulesCore
import UIKit

// La barre de message des réseaux sociaux : elle reste collée au clavier à chaque image, à l'ouverture, à la fermeture
// et quand on le fait descendre au doigt. Tout se passe ici, sans passer par JavaScript ni recalculer la mise en page.
public class ReizKeyboardDockModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReizKeyboardDock")

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

  // Une vue invisible accrochée au haut du clavier : UIKit la déplace exactement comme le clavier, on la lit à chaque image.
  private let probe = UIView()
  private var link: CADisplayLink?
  private var offset: CGFloat = 0
  private var lastTop: CGFloat = 0
  private var openTop: CGFloat = .greatestFiniteMagnitude
  // Le doigt lâche le clavier en route : iOS le fait descendre depuis là, mais son repère saute (vers le haut ou tout en
  // bas selon les cas). Dans ce cas seulement, on calcule nous-mêmes la descente, sinon la barre se décolle du clavier.
  private var drop: (from: CGFloat, start: CFTimeInterval, duration: TimeInterval)?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    // Pas isHidden : la position animée d'une vue masquée n'est pas tenue à jour.
    probe.alpha = 0
    probe.isUserInteractionEnabled = false
    probe.translatesAutoresizingMaskIntoConstraints = false
    let center = NotificationCenter.default
    center.addObserver(self, selector: #selector(keyboardWillHide(_:)), name: UIResponder.keyboardWillHideNotification, object: nil)
    center.addObserver(self, selector: #selector(keyboardDidHide), name: UIResponder.keyboardDidHideNotification, object: nil)
    center.addObserver(self, selector: #selector(keyboardWillShow), name: UIResponder.keyboardWillShowNotification, object: nil)
    center.addObserver(self, selector: #selector(keyboardDidShow), name: UIResponder.keyboardDidShowNotification, object: nil)
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

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  @objc private func keyboardWillHide(_ note: Notification) {
    // Plus bas que sa position ouverte : c'est le doigt qui l'a amené là.
    guard lastTop > openTop + 1 else { return }
    let duration = (note.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? TimeInterval) ?? 0
    drop = (lastTop, CACurrentMediaTime(), max(duration, 0.2))
  }

  @objc private func keyboardDidHide() {
    openTop = .greatestFiniteMagnitude
  }

  @objc private func keyboardWillShow() {
    drop = nil
  }

  @objc private func keyboardDidShow() {
    openTop = lastTop
  }

  private func hostView() -> UIView? {
    var responder: UIResponder? = self
    while let current = responder {
      if let controller = current as? UIViewController { return controller.view }
      responder = current.next
    }
    return nil
  }

  @objc private func follow() {
    guard let window, let superview else { return }
    // `presentation` : où le clavier est vraiment à cette image, animation comprise.
    guard let host = probe.superview else { return }
    let probeFrame = (probe.layer.presentation() ?? probe.layer).frame
    guard probeFrame.maxY > 0 else { return }
    var keyboardTop = host.convert(CGPoint(x: 0, y: probeFrame.maxY), to: window).y
    if let drop {
      let progress = min(1, (CACurrentMediaTime() - drop.start) / drop.duration)
      let eased = 1 - pow(1 - progress, 3)
      keyboardTop = drop.from + (window.bounds.height - drop.from) * eased
      if progress >= 1 { self.drop = nil }
    }
    lastTop = keyboardTop
    // La place de la barre sans décalage (center et bounds ne tiennent pas compte de notre transformation).
    let restingBottom = superview.convert(CGPoint(x: 0, y: center.y + bounds.height / 2), to: window).y
    let next = -max(0, restingBottom - hiddenBottom - keyboardTop)
    guard abs(next - offset) > 0.01 else { return }
    offset = next
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    layer.transform = CATransform3DMakeTranslation(0, next, 0)
    CATransaction.commit()
  }
}
