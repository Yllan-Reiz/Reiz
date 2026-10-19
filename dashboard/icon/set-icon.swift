import AppKit
let a = CommandLine.arguments
guard let img = NSImage(contentsOfFile: a[1]) else { print("image illisible"); exit(1) }
let done = NSWorkspace.shared.setIcon(img, forFile: a[2], options: [])
print(done ? "icône appliquée" : "échec")
let check = NSWorkspace.shared.icon(forFile: a[2])
check.size = NSSize(width: 128, height: 128)
if let tiff = check.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let png = rep.representation(using: .png, properties: [:]) {
  try? png.write(to: URL(fileURLWithPath: a[3]))
}
