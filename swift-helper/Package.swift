// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FnKeyMonitor",
    platforms: [.macOS(.v12)],
    targets: [
        .executableTarget(
            name: "FnKeyMonitor",
            path: "Sources/FnKeyMonitor"
        )
    ]
)
