import SwiftUI
import UIKit
import AVFoundation
import RoomPlan

@main
struct RealRoomScanApp: App {
    var body: some Scene { WindowGroup { ScanScreen() } }
}

enum ScanPhase { case idle, requesting, scanning, processing, ready, failed }

@MainActor
final class ScanState: ObservableObject {
    @Published private(set) var phase = ScanPhase.idle
    @Published private(set) var result: MetricFile?
    @Published private(set) var error: String?
    @Published private(set) var cameraDenied = false
    @Published private(set) var generation = 0
    @Published var readyToStop = false
    let supported = RoomCaptureSession.isSupported
    var finish: (() -> Void)?
    private var deadline: Task<Void, Never>?

    var hasCapture: Bool { phase == .scanning || phase == .processing || phase == .ready }
    var busy: Bool { phase == .requesting || phase == .scanning || phase == .processing }

    func start() {
        guard !busy else { return }
        guard supported else {
            fail("Ce scan nécessite un iPhone ou iPad équipé du LiDAR. Le site propose aussi un relevé par photos guidées.")
            return
        }
        reset()
        phase = .requesting
        let token = generation
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: permission(true, token: token)
        case .denied:
            cameraDenied = true
            fail("La caméra est désactivée. Autorisez-la dans Réglages, puis revenez ici pour commencer.")
        case .restricted:
            fail("L’accès à la caméra est restreint sur cet appareil. Utilisez les photos guidées du site ou un autre appareil.")
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { allowed in
                Task { @MainActor in self.permission(allowed, token: token) }
            }
        @unknown default: fail("L’accès à la caméra n’est pas disponible sur cet appareil.")
        }
    }

    private func permission(_ allowed: Bool, token: Int) {
        guard generation == token, phase == .requesting else { return }
        guard allowed else {
            cameraDenied = true
            fail("La caméra n’a pas été autorisée. Vous pouvez changer ce choix dans Réglages.")
            return
        }
        phase = .scanning
    }

    func finishScan() {
        guard phase == .scanning, readyToStop, let finish = finish else { return }
        processing()
        finish()
    }

    func processing() {
        guard phase == .scanning else { return }
        phase = .processing
        readyToStop = false
        let token = generation
        deadline = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: 45_000_000_000) } catch { return }
            guard let self = self, self.generation == token, self.phase == .processing else { return }
            self.fail("La préparation du relevé prend trop de temps. Recommencez le scan d’une seule pièce.")
        }
    }

    func complete(_ file: MetricFile, token: Int) {
        guard generation == token, phase == .processing else {
            try? FileManager.default.removeItem(at: file.url)
            return
        }
        deadline?.cancel(); deadline = nil
        result = file
        phase = .ready
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        UIAccessibility.post(notification: .announcement, argument: "Relevé prêt. Vérifiez les éléments détectés, puis enregistrez le fichier.")
    }

    func fail(_ message: String) {
        deadline?.cancel(); deadline = nil
        generation += 1 // Invalide aussi les callbacks d’un scan abandonné.
        finish?(); finish = nil
        readyToStop = false
        phase = .failed
        error = message
        UINotificationFeedbackGenerator().notificationOccurred(.error)
        UIAccessibility.post(notification: .announcement, argument: message)
    }

    func reset() {
        generation += 1
        deadline?.cancel(); deadline = nil
        finish?(); finish = nil
        if let file = result?.url { try? FileManager.default.removeItem(at: file) }
        result = nil; error = nil; cameraDenied = false; readyToStop = false
        phase = .idle
    }

    func interrupted() {
        if phase == .scanning || phase == .processing {
            fail("Le scan a été interrompu lorsque l’app a quitté l’écran. Recommencez pour obtenir un relevé complet.")
        }
    }
}

struct ScanScreen: View {
    @StateObject private var state = ScanState()
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.openURL) private var openURL
    @State private var sharing = false
    @State private var confirmReset = false

    var body: some View {
        NavigationStack {
            Group {
                if state.hasCapture {
                    RoomCaptureHost(state: state, generation: state.generation)
                        .id(state.generation)
                        .safeAreaInset(edge: .bottom) {
                            if state.phase == .processing {
                                VStack(spacing: 10) {
                                    ProgressView("Préparation du relevé…")
                                    Text("Gardez cette app ouverte. Aucun fichier n’est envoyé.").font(.footnote)
                                }.padding().frame(maxWidth: .infinity).background(.regularMaterial)
                            } else if let result = state.result {
                                review(result.summary)
                            }
                        }
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 20) {
                            Image(systemName: state.supported ? "viewfinder" : "iphone.slash")
                                .font(.system(size: 56)).accessibilityHidden(true)
                            Text(state.supported ? "Relever votre pièce" : "Un appareil LiDAR est nécessaire")
                                .font(.largeTitle.bold()).accessibilityAddTraits(.isHeader)
                            Text(state.supported
                                 ? "Les murs, ouvertures et meubles sont relevés sur cet appareil par RoomPlan. Le plan sera vérifiable dans RealRoom et Maison Corleone."
                                 : "RoomPlan nécessite un iPhone ou iPad équipé du LiDAR, avec iOS ou iPadOS 16 minimum. Sur les autres appareils, utilisez les photos guidées du site.")
                            if let error = state.error {
                                Text(error).foregroundStyle(.red)
                                if state.cameraDenied {
                                    Button("Ouvrir Réglages") {
                                        if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                                    }.buttonStyle(.bordered)
                                }
                            }
                            if state.supported {
                                Label("Une seule pièce, contour complet", systemImage: "square.dashed").font(.headline)
                                Text("Éclairez la pièce et dégagez la vue des angles. Montrez lentement les murs, les portes et les fenêtres ; suivez les indications à l’écran.")
                                Text("Les miroirs, vitres et objets masqués peuvent être mal détectés. Vous corrigerez leurs cotes et les éléments manquants dans le plan.").font(.footnote)
                                Button(action: state.start) {
                                    if state.phase == .requesting { ProgressView("Autorisation de la caméra…") }
                                    else { Text(state.error == nil ? "Scanner ma pièce" : "Réessayer") }
                                }.buttonStyle(.borderedProminent).disabled(state.busy)
                            }
                            Label("La capture reste sur cet appareil", systemImage: "lock")
                            Text("Seul le fichier des cotes et des éléments détectés est partagé si vous le choisissez. Aucune photo, vidéo ni maillage n’est envoyé par cette app.")
                                .font(.footnote)
                        }.padding(24).frame(maxWidth: 620)
                    }.frame(maxWidth: .infinity)
                }
            }
            .navigationTitle(state.phase == .ready ? "Relevé prêt" : "RealRoom · LiDAR")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if state.hasCapture {
                    ToolbarItem(placement: .navigationBarLeading) {
                        Button(state.phase == .ready ? "Nouveau relevé" : "Annuler") { confirmReset = true }
                            .disabled(sharing)
                    }
                }
                if state.phase == .scanning {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Terminer", action: state.finishScan).disabled(!state.readyToStop)
                    }
                }
            }
            .confirmationDialog("Recommencer le relevé ?", isPresented: $confirmReset, titleVisibility: .visible) {
                Button("Recommencer", role: .destructive) { state.reset() }
                Button("Continuer ce relevé", role: .cancel) {}
            } message: {
                Text("Le relevé ouvert sera abandonné. Les fichiers déjà enregistrés dans Fichiers restent disponibles.")
            }
            .sheet(isPresented: $sharing) {
                if let file = state.result?.url { ShareFile(file: file) }
            }
            .onChange(of: scenePhase) { phase in
                if phase == .background { state.interrupted() }
            }
        }
    }

    private func review(_ summary: MetricSummary) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text("Éléments détectés").font(.headline).accessibilityAddTraits(.isHeader)
                Text("\(summary.walls) murs · \(summary.doors) portes · \(summary.windows) fenêtres · \(summary.openings) passages · \(summary.objects) meubles")
                if summary.uncertain > 0 {
                    Label("\(summary.uncertain) éléments à vérifier avec attention", systemImage: "exclamationmark.triangle")
                        .font(.footnote)
                }
                Text("Enregistrez dans Fichiers, puis choisissez « Importer un relevé métrique » sur le site. Vous vérifierez le plan et les mesures avant d’aménager.")
                    .font(.footnote)
                Button("Enregistrer ou partager le relevé") { sharing = true }
                    .buttonStyle(.borderedProminent)
            }.padding().frame(maxWidth: .infinity, alignment: .leading)
        }.frame(maxHeight: 240).background(.regularMaterial)
    }
}

struct ShareFile: UIViewControllerRepresentable {
    let file: URL
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [file], applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
