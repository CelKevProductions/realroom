import Foundation

// Contrat portable : la capture RoomPlan et le test macOS encodent exactement ce type.
struct MetricElement: Encodable {
    let id: String
    let category: String
    let size: [Float] // Apple : largeur, hauteur, profondeur, en mètres.
    let transform: [Float] // Colonne majeure, +Y vertical.
    let confidence: String
}

struct MetricSummary {
    let walls: Int
    let doors: Int
    let windows: Int
    let openings: Int
    let objects: Int
    let uncertain: Int
}

struct MetricFile {
    let url: URL
    let summary: MetricSummary
}

enum MetricIssue: LocalizedError {
    case incomplete, invalid, tooLarge
    var errorDescription: String? {
        switch self {
        case .incomplete: return "Le contour est incomplet. Reprenez le relevé en montrant tous les murs et les angles de la pièce."
        case .invalid: return "Certaines cotes ne sont pas exploitables. Reprenez le relevé lentement, dans une pièce bien éclairée."
        case .tooLarge: return "Ce relevé contient trop d’éléments. Scannez une seule pièce à la fois."
        }
    }
}

struct MetricSurvey: Encodable {
    let version = "realroom-scan-v1"
    let source = "apple-roomplan"
    let unit = "m"
    let walls: [MetricElement]
    let openings: [MetricElement]
    let objects: [MetricElement]

    var summary: MetricSummary {
        MetricSummary(walls: walls.count, doors: openings.filter { $0.category == "door" }.count,
                      windows: openings.filter { $0.category == "window" }.count,
                      openings: openings.filter { $0.category == "opening" }.count,
                      objects: objects.count,
                      uncertain: (walls + openings + objects).filter { $0.confidence != "high" }.count)
    }

    func encoded() throws -> Data {
        guard walls.count >= 4 else { throw MetricIssue.incomplete }
        guard walls.count <= 32, openings.count <= 24, objects.count <= 80 else { throw MetricIssue.tooLarge }
        for (elements, isObject) in [(walls + openings, false), (objects, true)] {
            for e in elements {
                guard e.size.count == 3, e.transform.count == 16,
                      (e.size + e.transform).allSatisfy({ $0.isFinite }),
                      (0.05...30).contains(e.size[0]), (0.05...8).contains(e.size[1]),
                      (isObject ? (Float(0.01)...8) : (Float(0)...1)).contains(e.size[2]),
                      ["high", "medium", "low"].contains(e.confidence) else { throw MetricIssue.invalid }
                let m = e.transform
                let axes = [[m[0], m[1], m[2]], [m[4], m[5], m[6]], [m[8], m[9], m[10]]]
                func dot(_ a: [Float], _ b: [Float]) -> Float { zip(a, b).reduce(0) { $0 + $1.0 * $1.1 } }
                guard [3, 7, 11].allSatisfy({ abs(m[$0]) <= 0.001 }), abs(m[15] - 1) <= 0.001,
                      axes.allSatisfy({ abs(dot($0, $0) - 1) <= 0.03 }),
                      abs(dot(axes[0], axes[1])) <= 0.03, abs(dot(axes[0], axes[2])) <= 0.03,
                      abs(dot(axes[1], axes[2])) <= 0.03,
                      m[5] >= 0.98, abs(m[1]) <= 0.12, abs(m[9]) <= 0.12,
                      m[0] * m[10] - m[8] * m[2] >= 0.97 else { throw MetricIssue.invalid }
            }
        }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(self)
        guard data.count <= 190_000 else { throw MetricIssue.tooLarge }
        return data
    }

    func save(in directory: URL = FileManager.default.temporaryDirectory) throws -> MetricFile {
        let data = try encoded()
        let date = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
        let url = directory.appendingPathComponent("RealRoom-\(date)-\(UUID().uuidString.prefix(8)).json")
        try data.write(to: url, options: .atomic)
        return MetricFile(url: url, summary: summary)
    }
}
