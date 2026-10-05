// Supereo Haptics 1.0.0 — public UIKit/Core Haptics APIs, iOS 13+.
// No audio events, network access, private preferences or gameplay persistence.
import Foundation
import CoreFoundation
import UIKit
import CoreHaptics
#if canImport(Cordova)
import Cordova
#endif

@objc(SupereoHaptics)
final class SupereoHaptics: CDVPlugin {
    private struct BridgeError: Error {
        let code: String
        let message: String
    }

    private struct CurvePoint {
        let timeMs: Int
        let value: Double
    }

    private struct PatternEvent {
        let timeMs: Int
        let continuous: Bool
        let durationMs: Int
        let intensity: Double
        let sharpness: Double
        let intensityCurve: [CurvePoint]?
        let sharpnessCurve: [CurvePoint]?
    }

    private var enabled = true
    private var overallStrength = 1.0
    private var foreground = true
    private var disposed = false
    private var engine: CHHapticEngine?
    private var engineRunning = false
    private var players: [CHHapticPatternPlayer] = []
    private var pending: [DispatchWorkItem] = []
    private var generation = 0
    // A local busy window is scheduling metadata, never a hardware completion signal.
    private var busy = false
    private var observers: [NSObjectProtocol] = []
    private let selection = UISelectionFeedbackGenerator()
    private let notification = UINotificationFeedbackGenerator()
    private var impacts: [String: UIImpactFeedbackGenerator] = [:]

    deinit {
        pending.forEach { $0.cancel() }
        observers.forEach { NotificationCenter.default.removeObserver($0) }
        players.forEach { try? $0.stop(atTime: CHHapticTimeImmediate) }
        engine?.stop(completionHandler: nil)
    }

    override func pluginInitialize() {
        super.pluginInitialize()
        foreground = UIApplication.shared.applicationState == .active
        let center = NotificationCenter.default
        for name in [UIApplication.willResignActiveNotification,
                     UIApplication.didEnterBackgroundNotification] {
            observers.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                guard let self = self else { return }
                self.foreground = false
                self.cancelPending(stopEngine: true)
            })
        }
        observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification,
                                            object: nil, queue: .main) { [weak self] _ in
            // Never replay effects discarded on interruption/backgrounding.
            self?.foreground = true
        })
    }

    override func onReset() {
        onMain { [weak self] in
            self?.cancelPending(stopEngine: true)
            self?.enabled = true
            self?.overallStrength = 1
        }
        super.onReset()
    }

    override func dispose() {
        onMain { [weak self] in
            guard let self = self else { return }
            self.disposed = true
            self.cancelPending(stopEngine: true)
            self.observers.forEach { NotificationCenter.default.removeObserver($0) }
            self.observers.removeAll()
            self.impacts.removeAll()
        }
        super.dispose()
    }

    @objc(getCapabilities:)
    func getCapabilities(_ command: CDVInvokedUrlCommand) {
        onMain { [weak self] in
            guard let self = self else { return }
            let advanced = CHHapticEngine.capabilitiesForHardware().supportsHaptics
            // UIKit provides no public hardware probe; do not infer it from model names.
            let info = advanced
                ? "Core Haptics hardware confirmed. UIKit strength is system-defined for selection/notification. Dispatch is not physical-output confirmation."
                : "Core Haptics unavailable. UIKit hardware support cannot be queried publicly; semantic feedback may be a system no-op. Custom effects are approximated with native UIKit taps."
            self.success(command, [
                "backend": "ios-native", "bridgeAvailable": true,
                "hardwareAvailable": advanced, "hardwareDetection": "core-haptics",
                "semanticHardwareStatus": advanced ? "confirmed" : "unknown",
                "intensityControl": advanced, "advancedPatterns": advanced,
                "amplitudeControl": advanced, "sharpnessControl": advanced,
                "intensityCurves": advanced, "sharpnessCurves": advanced,
                "primitives": false, "envelopes": false,
                "fallbackInfo": info, "completion": "not-observable"
            ])
        }
    }

    @objc(setState:)
    func setState(_ command: CDVInvokedUrlCommand) {
        onMain { [weak self] in
            guard let self = self else { return }
            do {
                let state = try self.arguments(command)
                try self.allowedKeys(state, ["enabled", "strength"], "state")
                var nextEnabled = self.enabled
                var nextStrength = self.overallStrength
                if let raw = state["enabled"] {
                    guard let number = raw as? NSNumber,
                          CFGetTypeID(number) == CFBooleanGetTypeID() else {
                        throw self.invalid("state.enabled must be a boolean")
                    }
                    nextEnabled = number.boolValue
                }
                if let raw = state["strength"] {
                    nextStrength = try self.normalized(raw, "state.strength")
                }
                // Validate the entire update before mutating state.
                self.enabled = nextEnabled
                self.overallStrength = nextStrength
                if !self.enabled || self.overallStrength == 0 {
                    self.cancelPending(stopEngine: false)
                }
                self.success(command, ["accepted": true, "backend": "ios-native",
                                       "enabled": self.enabled, "strength": self.overallStrength,
                                       "completion": "not-observable"])
            } catch { self.failure(command, error) }
        }
    }

    @objc(stop:)
    func stop(_ command: CDVInvokedUrlCommand) {
        onMain { [weak self] in
            guard let self = self else { return }
            self.cancelPending(stopEngine: false)
            self.success(command, ["accepted": true, "backend": "ios-native",
                                   "approximated": false, "fallback": [], "durationMs": 0,
                                   "completion": "not-observable"])
        }
    }

    @objc(play:)
    func play(_ command: CDVInvokedUrlCommand) {
        onMain { [weak self] in
            guard let self = self else { return }
            var requestID = ""
            var dispatchStarted = false
            do {
                let request = try self.arguments(command)
                try self.allowedKeys(request, ["kind", "style", "notification", "pattern",
                                               "strength", "overlap", "requestId"], "request")
                if let raw = request["requestId"] {
                    guard let value = raw as? String, value.utf16.count <= 128 else {
                        throw self.invalid("requestId must be a string of at most 128 UTF-16 code units")
                    }
                    requestID = value
                }
                guard let kind = request["kind"] as? String,
                      ["selection", "impact", "notification", "pattern"].contains(kind) else {
                    throw self.invalid("kind must be selection, impact, notification or pattern")
                }
                let multiplier = try request["strength"].map { try self.normalized($0, "strength") } ?? 1
                let strength = self.overallStrength * multiplier
                let overlap = request["overlap"] as? String ?? "replace"
                guard ["replace", "ignore"].contains(overlap),
                      request["overlap"] == nil || request["overlap"] is String else {
                    throw self.invalid("overlap must be replace or ignore")
                }
                let style = request["style"] as? String ?? "medium"
                let notificationName = request["notification"] as? String ?? "success"
                if kind == "impact" {
                    guard ["light", "medium", "heavy", "soft", "rigid"].contains(style),
                          request["style"] == nil || request["style"] is String else {
                        throw self.invalid("impact style must be light, medium, heavy, soft or rigid")
                    }
                }
                if kind == "notification" {
                    guard ["success", "warning", "error"].contains(notificationName),
                          request["notification"] == nil || request["notification"] is String else {
                        throw self.invalid("notification must be success, warning or error")
                    }
                }
                let pattern: ([PatternEvent], Int)? = kind == "pattern" ? try self.validatePattern(request["pattern"]) : nil
                if self.disposed { throw BridgeError(code: "RELEASED", message: "Native bridge was released") }
                if !self.foreground || UIApplication.shared.applicationState != .active {
                    self.success(command, self.result(false, requestID, reason: "background"))
                    return
                }
                if !self.enabled || strength == 0 {
                    self.success(command, self.result(false, requestID, reason: "disabled-or-zero-strength"))
                    return
                }
                if overlap == "ignore" && self.busy {
                    self.success(command, self.result(false, requestID, reason: "busy"))
                    return
                }
                // Construct's configurable DOM guard owns duplicate suppression. Raw native
                // bridge clients may intentionally schedule identical neighboring requests.
                dispatchStarted = true
                self.cancelPending(stopEngine: false)
                var fallback: [String] = []
                var approximated = false
                var durationMs = kind == "notification" ? 500 : 60
                if let (events, duration) = pattern {
                    durationMs = duration
                    if CHHapticEngine.capabilitiesForHardware().supportsHaptics {
                        try self.playCorePattern(events, strength: strength)
                    } else {
                        self.scheduleUIKitPattern(events, strength: strength)
                        approximated = true
                        fallback.append("Core Haptics unavailable: each event becomes a native UIKit impact at its start time; continuous duration and curves are omitted; sharpness chooses a broad impact style.")
                    }
                } else if kind == "selection" {
                    self.selection.prepare()
                    self.selection.selectionChanged()
                    if strength != 1 {
                        approximated = true
                        fallback.append("UIKit selection feedback has no intensity parameter; positive strength keeps system-defined selection feedback.")
                    }
                } else if kind == "impact" {
                    let generator = self.impact(style)
                    generator.prepare()
                    generator.impactOccurred(intensity: CGFloat(strength))
                } else {
                    self.notification.prepare()
                    let type: UINotificationFeedbackGenerator.FeedbackType = notificationName == "warning" ? .warning
                        : notificationName == "error" ? .error : .success
                    self.notification.notificationOccurred(type)
                    if strength != 1 {
                        approximated = true
                        fallback.append("UIKit notification feedback has no intensity parameter; positive strength keeps system-defined notification feedback.")
                    }
                }
                if !CHHapticEngine.capabilitiesForHardware().supportsHaptics {
                    fallback.append("UIKit exposes no public hardware-support probe; dispatch acceptance does not confirm a physical effect.")
                }
                self.holdBusy(durationMs)
                var result = self.result(true, requestID)
                result["durationMs"] = durationMs
                result["approximated"] = approximated
                result["fallback"] = fallback
                self.success(command, result)
            } catch {
                if dispatchStarted { self.cancelPending(stopEngine: false) }
                self.failure(command, error, requestID: requestID)
            }
        }
    }

    private func playCorePattern(_ events: [PatternEvent], strength: Double) throws {
        let currentEngine = try ensureEngine()
        var nextPlayers: [CHHapticPatternPlayer] = []
        // Separate native players isolate each event's absolute curves from overlapping events.
        for event in events {
            let hasIntensityCurve = event.intensityCurve != nil
            let hasSharpnessCurve = event.sharpnessCurve != nil
            let intensity = hasIntensityCurve ? 1 : event.intensity * strength
            let sharpness = hasSharpnessCurve ? 0 : event.sharpness
            let parameters = [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: Float(intensity)),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: Float(sharpness))
            ]
            let nativeEvent: CHHapticEvent
            if event.continuous {
                nativeEvent = CHHapticEvent(eventType: .hapticContinuous, parameters: parameters,
                                           relativeTime: 0, duration: Double(event.durationMs) / 1000)
            } else {
                nativeEvent = CHHapticEvent(eventType: .hapticTransient, parameters: parameters, relativeTime: 0)
            }
            var curves: [CHHapticParameterCurve] = []
            if let points = event.intensityCurve {
                curves += nativeCurves(.hapticIntensityControl, points, duration: event.durationMs,
                                       initial: event.intensity, scale: strength)
            }
            if let points = event.sharpnessCurve {
                // hapticSharpnessControl is an offset; base sharpness 0 makes values absolute.
                curves += nativeCurves(.hapticSharpnessControl, points, duration: event.durationMs,
                                       initial: event.sharpness, scale: 1)
            }
            let pattern = try CHHapticPattern(events: [nativeEvent], parameterCurves: curves)
            nextPlayers.append(try currentEngine.makePlayer(with: pattern))
        }
        players = nextPlayers
        // One engine epoch, after all players were built. No JavaScript pulse timers.
        let epoch = currentEngine.currentTime + 0.015
        do {
            for (index, player) in nextPlayers.enumerated() {
                try player.start(atTime: epoch + Double(events[index].timeMs) / 1000)
            }
        } catch {
            nextPlayers.forEach { try? $0.stop(atTime: CHHapticTimeImmediate) }
            players.removeAll()
            throw error
        }
    }

    private func nativeCurves(_ parameter: CHHapticDynamicParameter.ID, _ points: [CurvePoint],
                              duration: Int, initial: Double, scale: Double) -> [CHHapticParameterCurve] {
        var expanded = points
        if expanded.first?.timeMs != 0 {
            expanded.insert(CurvePoint(timeMs: 0, value: initial), at: 0)
        }
        if expanded.count == 1 {
            expanded.append(CurvePoint(timeMs: duration, value: expanded[0].value))
        }
        // Small adjacent curves preserve every point and interpolation without oversized curves.
        // Share each boundary point so there is no gap or discontinuity between segments.
        var curves: [CHHapticParameterCurve] = []
        var start = 0
        while start < expanded.count - 1 {
            let end = min(start + 15, expanded.count - 1)
            let offset = expanded[start].timeMs
            let controls = expanded[start...end].map {
                CHHapticParameterCurve.ControlPoint(relativeTime: Double($0.timeMs - offset) / 1000,
                                                    value: Float($0.value * scale))
            }
            curves.append(CHHapticParameterCurve(parameterID: parameter, controlPoints: controls,
                                                  relativeTime: Double(offset) / 1000))
            start = end
        }
        return curves
    }

    private func ensureEngine() throws -> CHHapticEngine {
        if let current = engine {
            if !engineRunning { try current.start(); engineRunning = true }
            return current
        }
        let created = try CHHapticEngine()
        created.playsHapticsOnly = true
        created.isAutoShutdownEnabled = true
        created.resetHandler = { [weak self, weak created] in
            self?.onMain {
                guard let self = self, let created = created, self.engine === created else { return }
                self.cancelPending(stopEngine: false)
                self.engineRunning = false
                // A later foreground request restarts the engine; no pending pattern replay.
            }
        }
        created.stoppedHandler = { [weak self, weak created] _ in
            self?.onMain {
                guard let self = self, let created = created, self.engine === created else { return }
                self.cancelPending(stopEngine: false)
                self.engineRunning = false
            }
        }
        engine = created
        do { try created.start(); engineRunning = true }
        catch { engine = nil; engineRunning = false; throw error }
        return created
    }

    private func scheduleUIKitPattern(_ events: [PatternEvent], strength: Double) {
        let token = generation
        for event in events {
            let work = DispatchWorkItem { [weak self] in
                guard let self = self, token == self.generation, self.enabled, self.foreground,
                      !self.disposed, UIApplication.shared.applicationState == .active else { return }
                let intensity = event.intensity * strength
                guard intensity > 0 else { return }
                let style = event.sharpness < 0.34 ? "soft" : event.sharpness > 0.66 ? "rigid" : "medium"
                let generator = self.impact(style)
                generator.prepare()
                generator.impactOccurred(intensity: CGFloat(intensity))
            }
            pending.append(work)
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(event.timeMs) / 1000, execute: work)
        }
    }

    private func holdBusy(_ durationMs: Int) {
        busy = true
        let token = generation
        let cleanup = DispatchWorkItem { [weak self] in
            guard let self = self, token == self.generation else { return }
            self.busy = false
            self.players.removeAll()
            self.pending.removeAll()
        }
        pending.append(cleanup)
        // Include the small Core Haptics scheduling lead; this is not an OnCompleted event.
        DispatchQueue.main.asyncAfter(deadline: .now() + Double(durationMs) / 1000 + 0.02, execute: cleanup)
    }

    private func cancelPending(stopEngine: Bool) {
        generation += 1
        pending.forEach { $0.cancel() }
        pending.removeAll()
        players.forEach { try? $0.stop(atTime: CHHapticTimeImmediate) }
        players.removeAll()
        busy = false
        if stopEngine {
            let previous = engine
            engine = nil // Ignore callbacks from an engine discarded during backgrounding.
            engineRunning = false
            previous?.stop(completionHandler: nil)
        }
        // UIKit has no cancellation method for a semantic effect already dispatched.
    }

    private func impact(_ style: String) -> UIImpactFeedbackGenerator {
        if let generator = impacts[style] { return generator }
        let nativeStyle: UIImpactFeedbackGenerator.FeedbackStyle
        switch style {
        case "light": nativeStyle = .light
        case "heavy": nativeStyle = .heavy
        case "soft": nativeStyle = .soft
        case "rigid": nativeStyle = .rigid
        default: nativeStyle = .medium
        }
        let generator = UIImpactFeedbackGenerator(style: nativeStyle)
        impacts[style] = generator
        return generator
    }

    private func validatePattern(_ raw: Any?) throws -> ([PatternEvent], Int) {
        guard let pattern = raw as? [String: Any] else { throw invalid("pattern must be an object") }
        try allowedKeys(pattern, ["version", "events"], "pattern")
        guard try integer(pattern["version"], "pattern.version", minimum: 1, maximum: 1) == 1,
              let eventObjects = pattern["events"] as? [[String: Any]],
              !eventObjects.isEmpty, eventObjects.count <= 64 else {
            throw invalid("pattern version must be 1 with 1–64 events")
        }
        var events: [PatternEvent] = []
        var total = 0
        for (index, object) in eventObjects.enumerated() {
            let location = "events[\(index)]"
            try allowedKeys(object, ["timeMs", "type", "durationMs", "intensity", "sharpness", "curves"], location)
            let time = try integer(object["timeMs"], "\(location).timeMs", minimum: 0, maximum: 10000)
            guard let type = object["type"] as? String, ["transient", "continuous"].contains(type) else {
                throw invalid("\(location).type must be transient or continuous")
            }
            let continuous = type == "continuous"
            let duration: Int
            if continuous {
                duration = try integer(object["durationMs"], "\(location).durationMs", minimum: 1, maximum: 10000)
            } else {
                guard object["durationMs"] == nil, object["curves"] == nil else {
                    throw invalid("Transient events cannot have durationMs or curves")
                }
                duration = 12 // Portable scheduling estimate only; native transient is instantaneous.
            }
            guard time + duration <= 10000 else { throw invalid("Pattern duration exceeds 10000 ms") }
            let intensity = try normalized(object["intensity"], "\(location).intensity")
            let sharpness = try object["sharpness"].map { try normalized($0, "\(location).sharpness") } ?? 0.5
            var intensityCurve: [CurvePoint]?
            var sharpnessCurve: [CurvePoint]?
            if let rawCurves = object["curves"] {
                guard let curves = rawCurves as? [String: Any], !curves.isEmpty else {
                    throw invalid("\(location).curves must be a non-empty object")
                }
                try allowedKeys(curves, ["intensity", "sharpness"], "\(location).curves")
                if let rawPoints = curves["intensity"] {
                    intensityCurve = try validateCurve(rawPoints, duration, "\(location).curves.intensity")
                }
                if let rawPoints = curves["sharpness"] {
                    sharpnessCurve = try validateCurve(rawPoints, duration, "\(location).curves.sharpness")
                }
            }
            events.append(PatternEvent(timeMs: time, continuous: continuous, durationMs: duration,
                                       intensity: intensity, sharpness: sharpness,
                                       intensityCurve: intensityCurve, sharpnessCurve: sharpnessCurve))
            total = max(total, time + duration)
        }
        return (events.sorted { $0.timeMs < $1.timeMs }, total)
    }

    private func validateCurve(_ raw: Any, _ duration: Int, _ location: String) throws -> [CurvePoint] {
        guard let points = raw as? [[String: Any]], !points.isEmpty, points.count <= 32 else {
            throw invalid("\(location) must contain 1–32 points")
        }
        var previous = -1
        return try points.map { point in
            try allowedKeys(point, ["timeMs", "value"], location)
            let time = try integer(point["timeMs"], "\(location).timeMs", minimum: 0, maximum: duration)
            guard time > previous else { throw invalid("\(location) times must be strictly increasing") }
            previous = time
            return CurvePoint(timeMs: time, value: try normalized(point["value"], "\(location).value"))
        }
    }

    private func allowedKeys(_ object: [String: Any], _ allowed: Set<String>, _ location: String) throws {
        guard object.keys.allSatisfy({ allowed.contains($0) }) else {
            throw invalid("\(location) contains unsupported fields")
        }
    }

    private func normalized(_ raw: Any?, _ location: String) throws -> Double {
        guard let number = raw as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(),
              number.doubleValue.isFinite, number.doubleValue >= 0, number.doubleValue <= 1 else {
            throw invalid("\(location) must be a finite number from 0 to 1")
        }
        return number.doubleValue
    }

    private func integer(_ raw: Any?, _ location: String, minimum: Int, maximum: Int) throws -> Int {
        guard let number = raw as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(),
              number.doubleValue.isFinite, number.doubleValue.rounded() == number.doubleValue,
              number.doubleValue >= Double(minimum), number.doubleValue <= Double(maximum) else {
            throw invalid("\(location) must be an integer from \(minimum) to \(maximum)")
        }
        return number.intValue
    }

    private func arguments(_ command: CDVInvokedUrlCommand) throws -> [String: Any] {
        guard command.arguments.count == 1, let object = command.arguments[0] as? [String: Any] else {
            throw invalid("Expected one JSON object")
        }
        return object
    }

    private func invalid(_ message: String) -> BridgeError { BridgeError(code: "INVALID_REQUEST", message: message) }

    private func result(_ accepted: Bool, _ requestID: String, reason: String? = nil) -> [String: Any] {
        var response: [String: Any] = ["accepted": accepted, "requestId": requestID,
                                       "backend": "ios-native", "approximated": false,
                                       "fallback": [], "durationMs": 0,
                                       "completion": "not-observable"]
        if let reason = reason { response["reason"] = reason }
        return response
    }

    private func success(_ command: CDVInvokedUrlCommand, _ result: [String: Any]) {
        commandDelegate.send(CDVPluginResult(status: .ok, messageAs: result), callbackId: command.callbackId)
    }

    private func failure(_ command: CDVInvokedUrlCommand, _ error: Error, requestID: String = "") {
        let known = error as? BridgeError
        let payload: [String: Any] = ["code": known?.code ?? "NATIVE_ERROR",
                                      "message": known?.message ?? error.localizedDescription,
                                      "requestId": requestID, "backend": "ios-native", "accepted": false]
        commandDelegate.send(CDVPluginResult(status: .error, messageAs: payload), callbackId: command.callbackId)
    }

    private func onMain(_ action: @escaping () -> Void) {
        if Thread.isMainThread { action() } else { DispatchQueue.main.async(execute: action) }
    }
}
