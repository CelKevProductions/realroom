import SwiftUI
import UIKit
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
        guard !started, RoomCaptureSession.isSupported,
              state.generation == generation, state.phase == .scanning else { return }
        started = true
        capture.captureSession.run(configuration: RoomCaptureSession.Configuration())
        state.readyToStop = true
    }
    func stop() {
        guard started && !stopped else { return }
        stopped = true
        if #available(iOS 17.0, *) {
            capture.captureSession.stop(pauseARSession: true)
        } else {
            capture.captureSession.stop()
        }
    }
    func captureView(shouldPresent roomDataForProcessing: CapturedRoomData, error: Error?) -> Bool {
        guard state.generation == generation,
              state.phase == .scanning || state.phase == .processing else { return false }
        if let error = error {
            Task { @MainActor in
                guard self.state.generation == self.generation else { return }
                self.state.fail("Le scan a échoué : \(error.localizedDescription)")
            }
            return false
        }
        state.processing()
        return true // RoomCaptureView conserve le coaching et la prévisualisation Apple.
    }
    func captureView(didPresent processedResult: CapturedRoom, error: Error?) {
        Task { @MainActor in
            guard self.state.generation == self.generation, self.state.phase == .processing else { return }
            do {
                if let error = error { throw error }
                self.state.complete(try MetricExport.save(processedResult), token: self.generation)
            } catch {
                self.state.fail("Le relevé n’a pas pu être exporté : \(error.localizedDescription)")
            }
        }
    }
}
