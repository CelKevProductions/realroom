import SwiftUI
import RoomPlan

struct RoomCaptureHost: UIViewControllerRepresentable {
    let state: ScanState
    let generation: Int
    func makeUIViewController(context: Context) -> CaptureController { CaptureController(state: state, generation: generation) }
    func updateUIViewController(_ controller: CaptureController, context: Context) {}
    static func dismantleUIViewController(_ controller: CaptureController, coordinator: ()) { controller.stop() }
}

// UIViewController supplies NSCoding conformance required by RoomCaptureViewDelegate.
final class CaptureController: UIViewController, RoomCaptureViewDelegate {
    private let capture = RoomCaptureView(frame: .zero)
    private let state: ScanState
    private let generation: Int
    private var started = false
    private var stopped = false

    init(state: ScanState, generation: Int) {
        self.state = state
        self.generation = generation
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { return nil }

    override func loadView() { view = capture }
    override func viewDidLoad() {
        super.viewDidLoad()
        capture.delegate = self
        state.finish = { [weak self] in self?.stop() }
    }
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !started, RoomCaptureSession.isSupported else { return }
        started = true
        capture.captureSession.run(configuration: RoomCaptureSession.Configuration())
        state.readyToStop = true
    }
    func stop() {
        guard started && !stopped else { return }
        stopped = true
        capture.captureSession.stop(pauseARSession: true)
    }
    func captureView(shouldPresent roomDataForProcessing: CapturedRoomData, error: Error?) -> Bool {
        if let error = error {
            Task { @MainActor in
                guard self.state.generation == self.generation else { return }
                self.state.processing = false
                self.state.error = "Le scan a échoué : \(error.localizedDescription)"
            }
        }
        return error == nil
    }
    func captureView(didPresent processedResult: CapturedRoom, error: Error?) {
        Task { @MainActor in
            guard self.state.generation == self.generation else { return }
            self.state.processing = false
            do {
                if let error = error { throw error }
                self.state.file = try MetricExport.save(processedResult)
            } catch {
                self.state.error = "Le relevé n’a pas pu être exporté : \(error.localizedDescription)"
            }
        }
    }
}
