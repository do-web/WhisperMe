import Cocoa

var fnPressed = false

func eventCallback(
    proxy: CGEventTapProxy,
    type: CGEventType,
    event: CGEvent,
    refcon: UnsafeMutableRawPointer?
) -> Unmanaged<CGEvent>? {
    if type == .flagsChanged {
        let isFn = event.flags.rawValue & 0x800000 != 0 // maskSecondaryFn

        if isFn && !fnPressed {
            fnPressed = true
            print("{\"type\":\"fn-down\",\"timestamp\":\(Date().timeIntervalSince1970)}")
            fflush(stdout)
        } else if !isFn && fnPressed {
            fnPressed = false
            print("{\"type\":\"fn-up\",\"timestamp\":\(Date().timeIntervalSince1970)}")
            fflush(stdout)
        }
    }

    if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
        if let refcon = refcon {
            let tap = Unmanaged<CFMachPort>.fromOpaque(refcon).takeUnretainedValue()
            CGEvent.tapEnable(tap: tap, enable: true)
        }
    }

    return Unmanaged.passUnretained(event)
}

let eventMask = CGEventMask(1 << CGEventType.flagsChanged.rawValue)

guard let tap = CGEvent.tapCreate(
    tap: .cgSessionEventTap,
    place: .headInsertEventTap,
    options: .listenOnly,
    eventsOfInterest: eventMask,
    callback: eventCallback,
    userInfo: nil
) else {
    print("{\"type\":\"error\",\"message\":\"No event tap - need Accessibility permission\"}")
    fflush(stdout)
    exit(1)
}

let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
CGEvent.tapEnable(tap: tap, enable: true)

DispatchQueue.global().async {
    while let line = readLine() {
        if line.contains("quit") {
            exit(0)
        }
    }
}

print("{\"type\":\"ready\",\"timestamp\":\(Date().timeIntervalSince1970)}")
fflush(stdout)

CFRunLoopRun()
