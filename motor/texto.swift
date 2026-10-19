// Lê o texto de um print com o Vision da Apple (local, só no Mac) e devolve cada palavra com a caixa dela.
// Uso: texto <imagem>  → JSON { "w": largura, "h": altura, "palavras": [ { "t": "texto", "l": linha, "b": [x, y, larg, alt] } ] }
// Caixas em fração da imagem, origem no canto de cima à esquerda (o mesmo "area" do print no cenas.json).
import Foundation
import Vision
import AppKit

let args = CommandLine.arguments
guard args.count > 1, let img = NSImage(contentsOfFile: args[1]),
      let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  FileHandle.standardError.write("não abri a imagem\n".data(using: .utf8)!); exit(1)
}
let req = VNRecognizeTextRequest()
req.recognitionLevel = .accurate
req.usesLanguageCorrection = true
req.recognitionLanguages = ["pt-BR", "en-US"]
try VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
var out: [[String: Any]] = []
for (li, obs) in (req.results ?? []).enumerated() {
  guard let top = obs.topCandidates(1).first else { continue }
  let s = top.string
  var i = s.startIndex
  while i < s.endIndex {
    while i < s.endIndex && s[i] == " " { i = s.index(after: i) }
    var j = i
    while j < s.endIndex && s[j] != " " { j = s.index(after: j) }
    if i < j, let bb = try? top.boundingBox(for: i..<j)?.boundingBox {
      out.append(["t": String(s[i..<j]), "l": li,
                  "b": [bb.minX, 1 - bb.maxY, bb.width, bb.height].map { (Double($0) * 10000).rounded() / 10000 }])
    }
    i = j
  }
}
let js = try JSONSerialization.data(withJSONObject: ["w": cg.width, "h": cg.height, "palavras": out])
FileHandle.standardOutput.write(js)
