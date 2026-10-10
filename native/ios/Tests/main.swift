import Foundation

// Fixture métrique synthétique encodée par le vrai export Swift, sans capteur LiDAR.
func matrix(_ x: Float, _ y: Float, _ z: Float, angle: Float = 0) -> [Float] {
    let world = Float.pi / 2, a = angle + world, c = cos(a), s = sin(a)
    return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0,
            10 + cos(world) * x + sin(world) * z, y,
            -2 - sin(world) * x + cos(world) * z, 1]
}
func element(_ id: String, _ category: String, _ size: [Float], _ transform: [Float], confidence: String = "high") -> MetricElement {
    MetricElement(id: id, category: category, size: size, transform: transform, confidence: confidence)
}
let walls = [
    element("w1", "wall", [4, 2.6, 0], matrix(0, 1.3, 2.5)),
    element("w2", "wall", [4, 2.6, 0], matrix(0, 1.3, -2.5)),
    element("w3", "wall", [5, 2.6, 0], matrix(-2, 1.3, 0, angle: .pi / 2)),
    element("w4", "wall", [5, 2.6, 0], matrix(2, 1.3, 0, angle: .pi / 2))
]
let openings = [
    element("d1", "door", [0.9, 2.04, 0], matrix(0.4, 1.02, 2.5)),
    element("f1", "window", [1.3, 1.2, 0], matrix(-0.3, 1.5, -2.5), confidence: "medium")
]
let bed = element("bed1", "bed", [1.4, 1, 1.6], matrix(0, 0.5, -1.2))
let survey = MetricSurvey(walls: walls, openings: openings, objects: [bed])

func refuses(_ survey: MetricSurvey, _ expected: MetricIssue) throws {
    do { _ = try survey.encoded(); fatalError("Un export invalide a été accepté") }
    catch let error as MetricIssue {
        guard String(describing: error) == String(describing: expected) else { fatalError("Mauvaise erreur d’export : \(error)") }
    }
}
try refuses(MetricSurvey(walls: Array(walls.prefix(2)), openings: [], objects: []), .incomplete)
var scaled = walls[0].transform; scaled[0] = 1.2
try refuses(MetricSurvey(walls: [element("bad", "wall", [4, 2.6, 0], scaled)] + Array(walls.dropFirst()), openings: [], objects: []), .invalid)
try refuses(MetricSurvey(walls: walls, openings: [], objects: [element("bad", "bed", [.nan, 1, 1.6], matrix(0, 0.5, 0))]), .invalid)
try refuses(MetricSurvey(walls: walls, openings: [], objects: Array(repeating: bed, count: 81)), .tooLarge)
let huge = element(String(repeating: "x", count: 200_000), "wall", walls[0].size, walls[0].transform)
try refuses(MetricSurvey(walls: [huge] + Array(walls.dropFirst()), openings: [], objects: []), .tooLarge)

guard CommandLine.arguments.count == 2 else { fatalError("Indiquer le chemin de la fixture JSON") }
let destination = URL(fileURLWithPath: CommandLine.arguments[1])
let file = try survey.save(in: destination.deletingLastPathComponent())
defer { try? FileManager.default.removeItem(at: file.url) }
guard file.summary.walls == 4, file.summary.doors == 1, file.summary.windows == 1,
      file.summary.objects == 1, file.summary.uncertain == 1 else { fatalError("Récapitulatif incohérent") }
try Data(contentsOf: file.url).write(to: destination, options: .atomic)
print("Export Swift : cinq rejets invalides, récapitulatif et fichier métrique vérifiés.")
