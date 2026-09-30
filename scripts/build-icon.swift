import AppKit

// Lucide Git Compare, ISC licensed. See desktop/assets/LUCIDE-LICENSE.
// Draw vectors at each native icon size so the small Dock icons stay sharp.
let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let assets = root.appendingPathComponent("desktop/assets")
let development = CommandLine.arguments.contains("--dev")
let iconName = development ? "icon-dev" : "icon"
let iconset = root.appendingPathComponent("build/\(iconName).iconset")
try FileManager.default.createDirectory(at: assets, withIntermediateDirectories: true)
try FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)

func render(_ pixels: Int) -> Data {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    let context = NSGraphicsContext.current!.cgContext
    context.scaleBy(x: CGFloat(pixels) / 1024, y: CGFloat(pixels) / 1024)
    context.translateBy(x: 0, y: 1024)
    context.scaleBy(x: 1, y: -1)
    NSColor(srgbRed: 43/255, green: 43/255, blue: 43/255, alpha: 1).setFill()
    NSBezierPath(roundedRect: NSRect(x: 64, y: 64, width: 896, height: 896), xRadius: 200, yRadius: 200).fill()
    context.translateBy(x: 200, y: 200)
    context.scaleBy(x: 26, y: 26)
    (development
        ? NSColor(srgbRed: 248/255, green: 113/255, blue: 113/255, alpha: 1)
        : NSColor(srgbRed: 245/255, green: 245/255, blue: 245/255, alpha: 1)).setStroke()
    for (x, y) in [(18.0, 18.0), (6.0, 6.0)] {
        let circle = NSBezierPath(ovalIn: NSRect(x: x - 3, y: y - 3, width: 6, height: 6))
        circle.lineWidth = 2
        circle.stroke()
    }
    let path = NSBezierPath()
    path.lineWidth = 2
    path.lineCapStyle = .round
    path.lineJoinStyle = .round
    path.move(to: NSPoint(x: 13, y: 6))
    path.line(to: NSPoint(x: 16, y: 6))
    path.curve(to: NSPoint(x: 18, y: 8), controlPoint1: NSPoint(x: 17.10457, y: 6), controlPoint2: NSPoint(x: 18, y: 6.89543))
    path.line(to: NSPoint(x: 18, y: 15))
    path.move(to: NSPoint(x: 11, y: 18))
    path.line(to: NSPoint(x: 8, y: 18))
    path.curve(to: NSPoint(x: 6, y: 16), controlPoint1: NSPoint(x: 6.89543, y: 18), controlPoint2: NSPoint(x: 6, y: 17.10457))
    path.line(to: NSPoint(x: 6, y: 9))
    path.stroke()
    NSGraphicsContext.restoreGraphicsState()
    return bitmap.representation(using: .png, properties: [:])!
}

for size in [16, 32, 128, 256, 512] {
    try render(size).write(to: iconset.appendingPathComponent("icon_\(size)x\(size).png"))
    try render(size * 2).write(to: iconset.appendingPathComponent("icon_\(size)x\(size)@2x.png"))
}
try render(1024).write(to: assets.appendingPathComponent("\(iconName).png"))
let process = Process()
process.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
process.arguments = ["-c", "icns", iconset.path, "-o", assets.appendingPathComponent("\(iconName).icns").path]
try process.run()
process.waitUntilExit()
if process.terminationStatus != 0 { exit(process.terminationStatus) }
