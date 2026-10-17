// Máscara da pessoa quadro a quadro com o Vision do macOS (local, sem modelo externo, sem GPU NVIDIA).
//   swiftc -O mascara.swift -o _bin/mascara && _bin/mascara <pasta-quadros-jpg> <pasta-saida> [largura=1080] [altura=largura×16/9]
// Grava NNNNN.png em RGBA: branco com alfa = pessoa. Pula o que já existe (cache).
// Esta é a máscara BRUTA, na resolução cheia (o Vision entrega 1512×2016). A borda é refinada no mascaras.py.
// Uso no compositor: a máscara apaga o texto onde a pessoa está ("texto atrás da pessoa").
import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
let src = URL(fileURLWithPath: args[1]), dst = URL(fileURLWithPath: args[2])
let W = args.count > 3 ? Int(args[3])! : 1080
try? FileManager.default.createDirectory(at: dst, withIntermediateDirectories: true)
let files = try FileManager.default.contentsOfDirectory(atPath: src.path).filter { $0.hasSuffix(".jpg") }.sorted()
let ctx = CIContext(options: [.useSoftwareRenderer: false])
let H = args.count > 4 ? Int(args[4])! : W * 16 / 9   // 17/Out: 16:9 passa a altura (antes só servia para 1080×1920)
let rgb = CGColorSpaceCreateDeviceRGB()
let req = VNGeneratePersonSegmentationRequest()
req.qualityLevel = .accurate
req.outputPixelFormat = kCVPixelFormatType_OneComponent8
var feitos = 0
for f in files {
  let out = dst.appendingPathComponent(f.replacingOccurrences(of: ".jpg", with: ".png"))
  // cache: só refaz se o quadro for mais novo que a máscara (o base.py regrava os quadros a cada corte)
  let fm = FileManager.default
  if let mo = try? fm.attributesOfItem(atPath: out.path)[.modificationDate] as? Date,
     let fo = try? fm.attributesOfItem(atPath: src.appendingPathComponent(f).path)[.modificationDate] as? Date, mo >= fo { continue }
  let h = VNImageRequestHandler(url: src.appendingPathComponent(f), options: [:])
  try h.perform([req])
  guard let buf = req.results?.first?.pixelBuffer else { print("sem máscara", f); continue }
  var m = CIImage(cvPixelBuffer: buf)
  m = m.transformed(by: CGAffineTransform(scaleX: CGFloat(W) / m.extent.width, y: CGFloat(H) / m.extent.height))
  // branco com a máscara no alfa
  let branco = CIImage(color: .white).cropped(to: CGRect(x: 0, y: 0, width: W, height: H))
  let vazio = CIImage(color: .clear).cropped(to: CGRect(x: 0, y: 0, width: W, height: H))
  let blend = CIFilter(name: "CIBlendWithMask", parameters: [kCIInputImageKey: branco, kCIInputBackgroundImageKey: vazio, kCIInputMaskImageKey: m])!.outputImage!
  guard let cg = ctx.createCGImage(blend, from: CGRect(x: 0, y: 0, width: W, height: H), format: .RGBA8, colorSpace: rgb) else { continue }
  let d = CGImageDestinationCreateWithURL(out as CFURL, UTType.png.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(d, cg, nil); CGImageDestinationFinalize(d)
  feitos += 1
  if feitos % 150 == 0 { print("  máscaras: \(feitos)") }
}
print("  máscaras prontas: \(feitos) novas")
