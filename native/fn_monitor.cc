#include <napi.h>
#include <ApplicationServices/ApplicationServices.h>
#include <thread>
#include <string>
#include <cstring>

static Napi::ThreadSafeFunction tsfn;
static CFMachPortRef eventTap = nullptr;
static CFRunLoopSourceRef runLoopSource = nullptr;
static CFRunLoopRef tapRunLoop = nullptr;
static bool keyActive = false;

// Target hotkey config
static bool useFnMode = true;
static int64_t targetKeyCode = -1;
static CGEventFlags targetModifiers = 0;

static void emitEvent(const char* event) {
    std::string eventStr(event);
    tsfn.NonBlockingCall([eventStr](Napi::Env env, Napi::Function callback) {
        callback.Call({Napi::String::New(env, eventStr)});
    });
}

static bool hasRequiredModifiers(CGEventFlags flags) {
    if (targetModifiers == 0) return true;
    return (flags & targetModifiers) == targetModifiers;
}

CGEventRef eventCallback(CGEventTapProxy proxy, CGEventType type, CGEventRef event, void *refcon) {
    if (type == kCGEventTapDisabledByTimeout || type == kCGEventTapDisabledByUserInput) {
        if (eventTap) CGEventTapEnable(eventTap, true);
        return event;
    }

    if (useFnMode) {
        // FN key: detect via flags
        if (type == kCGEventFlagsChanged) {
            CGEventFlags flags = CGEventGetFlags(event);
            bool isFn = (flags & 0x800000) != 0;
            if (isFn && !keyActive) {
                keyActive = true;
                emitEvent("key-down");
            } else if (!isFn && keyActive) {
                keyActive = false;
                emitEvent("key-up");
            }
        }
    } else if (targetKeyCode >= 54 && targetKeyCode <= 63 && targetModifiers == 0) {
        // Single modifier key as hotkey (no combo) — uses FlagsChanged
        if (type == kCGEventFlagsChanged) {
            int64_t code = CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode);
            if (code == targetKeyCode) {
                if (!keyActive) {
                    keyActive = true;
                    emitEvent("key-down");
                } else {
                    keyActive = false;
                    emitEvent("key-up");
                }
            }
        }
    } else {
        // Regular key (optionally with modifiers)
        CGEventFlags flags = CGEventGetFlags(event);

        if (type == kCGEventKeyDown && !keyActive) {
            int64_t code = CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode);
            if (code == targetKeyCode && hasRequiredModifiers(flags)) {
                keyActive = true;
                emitEvent("key-down");
            }
        } else if (type == kCGEventKeyUp && keyActive) {
            int64_t code = CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode);
            if (code == targetKeyCode) {
                keyActive = false;
                emitEvent("key-up");
            }
        } else if (type == kCGEventFlagsChanged && keyActive && targetModifiers != 0) {
            // Modifier released while key combo active → key-up
            if (!hasRequiredModifiers(flags)) {
                keyActive = false;
                emitEvent("key-up");
            }
        }
    }

    return event;
}

// Parse a modifier name and return the CGEventFlag
static CGEventFlags parseModifier(const char* name, size_t len) {
    if (len == 4 && strncmp(name, "CTRL", 4) == 0) return kCGEventFlagMaskControl;
    if (len == 3 && strncmp(name, "CMD", 3) == 0) return kCGEventFlagMaskCommand;
    if (len == 5 && strncmp(name, "SHIFT", 5) == 0) return kCGEventFlagMaskShift;
    if (len == 3 && strncmp(name, "ALT", 3) == 0) return kCGEventFlagMaskAlternate;
    return 0;
}

// start(callback, mode)
// mode format: "FN", "49" (keyCode), "CTRL+49", "CMD+SHIFT+49"
Napi::Value Start(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsFunction()) {
        Napi::TypeError::New(env, "Callback function required").ThrowAsJavaScriptException();
        return env.Null();
    }

    tsfn = Napi::ThreadSafeFunction::New(env, info[0].As<Napi::Function>(), "KeyMonitor", 0, 1);

    // Parse mode
    useFnMode = true;
    targetKeyCode = -1;
    targetModifiers = 0;
    keyActive = false;

    if (info.Length() >= 2 && info[1].IsString()) {
        std::string mode = info[1].As<Napi::String>().Utf8Value();

        if (mode != "FN") {
            useFnMode = false;

            // Parse "MODIFIER+MODIFIER+KEYCODE" format
            size_t pos = 0;
            while (true) {
                size_t plus = mode.find('+', pos);
                if (plus == std::string::npos) {
                    // Last segment = keyCode
                    const char* segment = mode.c_str() + pos;
                    char* end = nullptr;
                    long val = strtol(segment, &end, 10);
                    if (end != segment && *end == '\0') {
                        targetKeyCode = val;
                    } else {
                        // Invalid, fallback to FN
                        useFnMode = true;
                    }
                    break;
                } else {
                    // Modifier segment
                    CGEventFlags mod = parseModifier(mode.c_str() + pos, plus - pos);
                    targetModifiers |= mod;
                    pos = plus + 1;
                }
            }
        }
    }

    // Build event mask
    CGEventMask mask = CGEventMaskBit(kCGEventFlagsChanged);
    if (!useFnMode) {
        mask |= CGEventMaskBit(kCGEventKeyDown) | CGEventMaskBit(kCGEventKeyUp);
    }

    eventTap = CGEventTapCreate(
        kCGSessionEventTap,
        kCGHeadInsertEventTap,
        kCGEventTapOptionListenOnly,
        mask,
        eventCallback,
        nullptr
    );

    if (!eventTap) {
        Napi::Error::New(env, "Failed to create event tap. Need Accessibility permission.").ThrowAsJavaScriptException();
        return env.Null();
    }

    runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0);

    std::thread([]() {
        tapRunLoop = CFRunLoopGetCurrent();
        CFRunLoopAddSource(tapRunLoop, runLoopSource, kCFRunLoopCommonModes);
        CGEventTapEnable(eventTap, true);
        CFRunLoopRun();
    }).detach();

    return Napi::Boolean::New(env, true);
}

Napi::Value Stop(const Napi::CallbackInfo& info) {
    if (tapRunLoop) {
        CFRunLoopStop(tapRunLoop);
        tapRunLoop = nullptr;
    }
    if (eventTap) {
        CGEventTapEnable(eventTap, false);
        CFRelease(eventTap);
        eventTap = nullptr;
    }
    if (runLoopSource) {
        CFRelease(runLoopSource);
        runLoopSource = nullptr;
    }
    keyActive = false;
    tsfn.Release();
    return info.Env().Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("start", Napi::Function::New(env, Start));
    exports.Set("stop", Napi::Function::New(env, Stop));
    return exports;
}

NODE_API_MODULE(fn_monitor, Init)
