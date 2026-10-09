import Foundation
import RoomPlan
import simd

enum MetricExport {
    struct Element: Encodable {
        let id: String
        let category: String
        let size: [Float] // Apple x=width, y=height, z=depth; metres
        let transform: [Float] // column-major rigid transform, +Y up
        let confidence: String
    }
    struct Survey: Encodable {
        let version = "realroom-scan-v1"
        let source = "apple-roomplan"
        let unit = "m"
        let walls: [Element]
        let openings: [Element]
        let objects: [Element]
    }
    static func matrix(_ m: simd_float4x4) -> [Float] {
        [m.columns.0, m.columns.1, m.columns.2, m.columns.3].flatMap { [$0.x, $0.y, $0.z, $0.w] }
    }
    static func confidence(_ c: CapturedRoom.Confidence) -> String {
        switch c { case .high: return "high"; case .medium: return "medium"; case .low: return "low"; @unknown default: return "low" }
    }
    static func surface(_ s: CapturedRoom.Surface, category: String) -> Element {
        Element(id: s.identifier.uuidString, category: category,
                size: [s.dimensions.x, s.dimensions.y, s.dimensions.z], transform: matrix(s.transform), confidence: confidence(s.confidence))
    }
    static func category(_ c: CapturedRoom.Object.Category) -> String {
        switch c {
        case .bed: return "bed"
        case .sofa: return "sofa"
        case .chair: return "chair"
        case .table: return "table"
        case .storage: return "storage"
        case .television: return "television"
        case .fireplace: return "fireplace"
        case .bathtub: return "bathtub"
        case .refrigerator: return "refrigerator"
        case .oven: return "oven"
        case .stove: return "stove"
        case .dishwasher: return "dishwasher"
        case .washerDryer: return "washerDryer"
        case .sink: return "sink"
        case .toilet: return "toilet"
        case .stairs: return "stairs"
        @unknown default: return "other"
        }
    }
    static func save(_ room: CapturedRoom) throws -> URL {
        let survey = Survey(walls: room.walls.map { surface($0, category: "wall") },
                            openings: room.doors.map { surface($0, category: "door") }
                                + room.windows.map { surface($0, category: "window") }
                                + room.openings.map { surface($0, category: "opening") },
                            objects: room.objects.map {
                                Element(id: $0.identifier.uuidString, category: category($0.category),
                                        size: [$0.dimensions.x, $0.dimensions.y, $0.dimensions.z],
                                        transform: matrix($0.transform), confidence: confidence($0.confidence))
                            })
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(survey)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("realroom-\(UUID().uuidString).json")
        try data.write(to: url, options: .atomic)
        return url
    }
}
