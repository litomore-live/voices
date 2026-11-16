import AVFoundation
import AppKit
import CoreAudio
import Foundation

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
}

struct Voice: Encodable {
    let identifier: String
    let name: String
    let language: String
    let quality: String
    let legacyName: String?
    let isSiri: Bool
    let shortName: String
}

func catalog() -> [Voice] {
    let modern = AVSpeechSynthesisVoice.speechVoices()
    let legacy = Dictionary(NSSpeechSynthesizer.availableVoices.map {
        ($0.rawValue, NSSpeechSynthesizer.attributes(forVoice: $0)[.name] as? String ?? "")
    }, uniquingKeysWith: { first, _ in first })
    return modern.map { voice in
        let id = voice.identifier
        let siri = id.contains("gryphon") || id.contains("siri")
        let oldName = legacy[id] ?? legacy[id.replacingOccurrences(of: ".super-compact.", with: ".compact.")]
        let suffix = id.contains(".natural.") ? ", Natural" : ""
        let name = oldName ?? (siri ? "Siri \(voice.name) (\(voice.language)\(suffix))" : "\(voice.name) (\(voice.language))")
        return Voice(identifier: id, name: name, language: voice.language,
                     quality: voice.quality == .premium ? "premium" : voice.quality == .enhanced ? "enhanced" : "standard",
                     legacyName: oldName, isSiri: siri, shortName: voice.name)
    }
}

struct Request: Decodable {
    let text: String
    let identifier: String
    let rate: Double?
    let audioDevice: String?
    let outputFile: String?
}

final class Completion: NSObject, AVSpeechSynthesizerDelegate, AVAudioPlayerDelegate {
    var done = false
    var cancelled = false
    var error: Error?
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) { done = true }
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) { cancelled = true; done = true }
    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) { cancelled = !flag; done = true }
    func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) { self.error = error; cancelled = true; done = true }
}

func waitForCompletion(_ completion: Completion, timeout: TimeInterval = 300) {
    let deadline = Date().addingTimeInterval(timeout)
    while !completion.done && Date() < deadline {
        RunLoop.current.run(until: Date().addingTimeInterval(0.02))
    }
    if let error = completion.error { fail(error.localizedDescription) }
    guard completion.done && !completion.cancelled else { fail("Speech did not complete") }
}

func deviceUID(_ selection: String) -> String? {
    var address = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDevices, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    var size: UInt32 = 0
    guard AudioObjectGetPropertyDataSize(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size) == noErr else { return nil }
    var devices = [AudioDeviceID](repeating: 0, count: Int(size) / MemoryLayout<AudioDeviceID>.size)
    let status = devices.withUnsafeMutableBytes { AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size, $0.baseAddress!) }
    guard status == noErr else { return nil }
    func property(_ device: AudioDeviceID, _ selector: AudioObjectPropertySelector) -> String? {
        var key = AudioObjectPropertyAddress(mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        var value: CFString = "" as CFString
        var bytes = UInt32(MemoryLayout<CFString>.size)
        guard AudioObjectGetPropertyData(device, &key, 0, nil, &bytes, &value) == noErr else { return nil }
        return value as String
    }
    for device in devices {
        var streams = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyStreams, mScope: kAudioDevicePropertyScopeOutput, mElement: kAudioObjectPropertyElementMain)
        var streamSize: UInt32 = 0
        guard AudioObjectGetPropertyDataSize(device, &streams, 0, nil, &streamSize) == noErr && streamSize > 0 else { continue }
        let uid = property(device, kAudioDevicePropertyDeviceUID)
        let name = property(device, kAudioObjectPropertyName) ?? ""
        if selection == String(device) || selection == uid || name.hasPrefix(selection) { return uid }
    }
    return nil
}

if CommandLine.arguments.dropFirst() == ["--voices"] {
    do {
        let data = try JSONEncoder().encode(catalog())
        FileHandle.standardOutput.write(data)
        exit(0)
    } catch { fail(error.localizedDescription) }
}
guard CommandLine.arguments.dropFirst() == ["--speak"] else { fail("Expected --voices or --speak (JSON on stdin)") }
do {
    let request = try JSONDecoder().decode(Request.self, from: FileHandle.standardInput.readDataToEndOfFile())
    guard !request.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { fail("Text must not be empty") }
    guard let voice = AVSpeechSynthesisVoice.speechVoices().first(where: { $0.identifier == request.identifier }) else { fail("Voice is not available: \(request.identifier)") }
    let utterance = AVSpeechUtterance(string: request.text)
    utterance.voice = voice
    if let rate = request.rate {
        guard rate.isFinite && rate > 0 else { fail("Rate must be positive") }
        // AVFoundation exposes a normalized rate, not words per minute.
        utterance.rate = min(AVSpeechUtteranceMaximumSpeechRate, max(AVSpeechUtteranceMinimumSpeechRate, Float(rate / 175) * AVSpeechUtteranceDefaultSpeechRate))
    }
    let synth = AVSpeechSynthesizer()
    let completion = Completion()
    synth.delegate = completion
    if request.outputFile == nil && request.audioDevice == nil {
        synth.speak(utterance)
        waitForCompletion(completion)
    } else {
        let temporary = FileManager.default.temporaryDirectory.appendingPathComponent("voices-\(UUID().uuidString).caf")
        let url = request.outputFile.map { URL(fileURLWithPath: $0) } ?? temporary
        defer { if request.outputFile == nil { try? FileManager.default.removeItem(at: temporary) } }
        var file: AVAudioFile?
        var frames: Int64 = 0
        synth.write(utterance) { buffer in
            guard let pcm = buffer as? AVAudioPCMBuffer else { return }
            if pcm.frameLength == 0 { completion.done = true; return }
            guard completion.error == nil else { return }
            do {
                if file == nil { file = try AVAudioFile(forWriting: url, settings: pcm.format.settings) }
                try file?.write(from: pcm)
                frames += Int64(pcm.frameLength)
            } catch { completion.error = error; completion.done = true }
        }
        waitForCompletion(completion)
        file = nil
        guard frames > 0 else { fail("Voice generated no audio") }
        if request.outputFile == nil {
            let player = try AVAudioPlayer(contentsOf: url)
            if let device = request.audioDevice {
                guard let uid = deviceUID(device) else { fail("Audio device not found: \(device)") }
                player.currentDevice = uid
            }
            completion.done = false
            player.delegate = completion
            guard player.play() else { fail("Could not play synthesized audio") }
            waitForCompletion(completion)
        }
    }
} catch { fail(error.localizedDescription) }
