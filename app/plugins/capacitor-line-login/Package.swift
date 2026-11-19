// swift-tools-version: 5.9
// 猫先生 App 的 LINE 登录插件（只在本仓库里用）。名字要和 Capacitor 按 npm 包名生成的一致：capacitor-line-login → CapacitorLineLogin
import PackageDescription

let package = Package(
    name: "CapacitorLineLogin",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapacitorLineLogin",
            targets: ["LineLoginPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(url: "https://github.com/line/line-sdk-ios-swift.git", from: "5.8.0")
    ],
    targets: [
        .target(
            name: "LineLoginPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "LineSDK", package: "line-sdk-ios-swift")
            ],
            path: "ios/Sources/LineLoginPlugin")
    ]
)
