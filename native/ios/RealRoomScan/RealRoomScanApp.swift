import SwiftUI
import AVFoundation
import RoomPlan

@main
struct RealRoomScanApp: App {
    var body: some Scene { WindowGroup { ScanScreen() } }
}

@MainActor
final class ScanState: ObservableObject {
    @Published var active = false
    @Published var processing = false
    @Published var file: URL?
    @Published var error: String?
    @Published var generation = 0
    @Published var readyToStop = false
    var finish: (() -> Void)?

    func start() {
        guard RoomCaptureSession.isSupported else {
            error = "Ce scan nécessite un iPhone ou iPad équipé du LiDAR. Utilisez le relevé guidé du site sur les autres appareils."
            return
        }
        AVCaptureDevice.requestAccess(for: .video) { allowed in
            Task { @MainActor in
                guard allowed else {
                    self.error = "Autorisez la caméra dans les réglages si vous souhaitez scanner votre pièce."
                    return
                }
                self.error = nil
                self.file = nil
                self.processing = false
                self.readyToStop = false
                self.generation += 1
                self.active = true
            }
        }
    }
}

struct ScanScreen: View {
    @StateObject private var state = ScanState()
    @State private var sharing = false

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                if state.active {
                    RoomCaptureHost(state: state, generation: state.generation)
                        .id(state.generation)
                        .ignoresSafeArea(edges: .bottom)
                } else {
                    VStack(spacing: 24) {
                        Image(systemName: "viewfinder").font(.system(size: 64))
                        Text("Relever votre pièce").font(.title)
                        Text("RoomPlan relève sur cet appareil les murs, ouvertures et meubles grâce au LiDAR et au machine learning Apple. Aucun film ni photo du scan n’est envoyé.")
                            .multilineTextAlignment(.center)
                        Text("Relevez une pièce à la fois. L’import RealRoom prend actuellement en charge les pièces rectangulaires. Vérifiez toujours les mesures avant de commander.")
                            .font(.footnote).multilineTextAlignment(.center)
                        Button("Scanner ma pièce", action: state.start).buttonStyle(.borderedProminent)
                    }.padding(28)
                }
                if let error = state.error {
                    Text(error).padding().background(.regularMaterial).padding().accessibilityAddTraits(.updatesFrequently)
                } else if state.processing {
                    ProgressView("Préparation du relevé métrique…").padding().background(.regularMaterial).padding()
                } else if state.file != nil {
                    Text("Enregistrez le fichier dans Fichiers, puis importez-le dans RealRoom ou Maison Corleone. Vous vérifierez le plan avant de l’utiliser.")
                        .font(.footnote).padding().background(.regularMaterial).padding()
                }
            }
            .navigationTitle("RealRoom · LiDAR")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if state.active && state.file == nil && !state.processing {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Terminer") { state.processing = true; state.finish?() }.disabled(!state.readyToStop)
                    }
                }
                if state.file != nil || (state.active && state.error != nil) {
                    ToolbarItem(placement: .navigationBarLeading) { Button("Nouveau relevé", action: state.start) }
                }
                if state.file != nil {
                    ToolbarItem(placement: .navigationBarTrailing) { Button("Partager le JSON") { sharing = true } }
                }
            }
            .sheet(isPresented: $sharing) {
                if let file = state.file { ShareFile(file: file) }
            }
        }
    }
}

struct ShareFile: UIViewControllerRepresentable {
    let file: URL
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [file], applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
