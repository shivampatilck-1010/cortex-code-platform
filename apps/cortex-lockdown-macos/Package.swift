// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CortexLockdown",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "CortexLockdown", targets: ["CortexLockdown"])
    ],
    targets: [
        .executableTarget(
            name: "CortexLockdown",
            path: "Sources/CortexLockdown"
        )
    ]
)
