// Onde está o rosto no bruto (Vision nativo do macOS, local, só localização: não identifica ninguém).
//   swiftc -O rosto.swift -o _rosto && ./_rosto <pasta-com-jpgs>
// Imprime JSON com a caixa do maior rosto de cada quadro (coordenadas 0–1, origem no TOPO) e a mediana.
// O preparar.py usa a mediana para: foco do zoom (centro do rosto) e altura segura da legenda (abaixo do queixo).
import Foundation
import Vision

let dir = URL(fileURLWithPath: CommandLine.arguments[1])
let files = (try? FileManager.default.contentsOfDirectory(atPath: dir.path))?.filter { $0.hasSuffix(".jpg") }.sorted() ?? []
var caixas: [[Double]] = []
for f in files {
  let req = VNDetectFaceRectanglesRequest()
  let h = VNImageRequestHandler(url: dir.appendingPathComponent(f), options: [:])
  try? h.perform([req])
  guard let faces = req.results, !faces.isEmpty else { continue }
  let r = faces.max(by: { $0.boundingBox.width * $0.boundingBox.height < $1.boundingBox.width * $1.boundingBox.height })!.boundingBox
  // Vision tem origem embaixo; convertemos para origem no topo
  caixas.append([Double(r.minX), Double(1 - r.maxY), Double(r.maxX), Double(1 - r.minY)])
}
func med(_ i: Int) -> Double { let v = caixas.map { $0[i] }.sorted(); return v.isEmpty ? -1 : v[v.count / 2] }
let out: [String: Any] = ["quadros": files.count, "com_rosto": caixas.count,
  "mediana": ["x0": med(0), "y0": med(1), "x1": med(2), "y1": med(3)], "caixas": caixas]
let data = try JSONSerialization.data(withJSONObject: out, options: [.sortedKeys])
print(String(data: data, encoding: .utf8)!)
