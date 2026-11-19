import Foundation
import UIKit
import Capacitor
import LineSDK

// LINE 登录（LINE SDK for iOS）：手机上装了 LINE 就直接打开 LINE App 授权（不用输入账号密码），没装时 SDK 自己用网页登录。
// 授权后 LINE 通过 URL scheme line3rdp.<bundle id> 回到 App（Info.plist 里登记），这里把那个地址交给 SDK。
// 返回 LINE 的 ID token，网页（native.js）再交给服务器 line-auth 换成本站的登录。
@objc(LineLoginPlugin)
public class LineLoginPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LineLoginPlugin"
    public let jsName = "LineLogin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "login", returnType: CAPPluginReturnPromise)
    ]
    private var configured = false

    override public func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(self.urlOpened(notification:)), name: Notification.Name.capacitorOpenURL, object: nil)
    }

    @objc func urlOpened(notification: NSNotification) {
        guard let info = notification.object as? [String: Any?], let url = info["url"] as? URL else { return }
        Task { @MainActor in
            _ = LoginManager.shared.application(UIApplication.shared, open: url, options: [:])
        }
    }

    @objc func login(_ call: CAPPluginCall) {
        guard let channelID = call.getString("channelId"), !channelID.isEmpty else {
            call.reject("channelId is required")
            return
        }
        Task { @MainActor in   // LINE SDK 的 login / application 都要在主线程（@MainActor）调用
            if !self.configured {
                LoginManager.shared.setup(channelID: channelID, universalLinkURL: nil)
                self.configured = true
            }
            guard let vc = self.bridge?.viewController else {
                call.reject("no view controller")
                return
            }
            LoginManager.shared.login(permissions: [.profile, .openID], in: vc) { result in
                switch result {
                case .success(let r):
                    guard let idToken = r.accessToken.IDTokenRaw else {
                        call.reject("LINE did not return an ID token", "NO_ID_TOKEN")
                        return
                    }
                    call.resolve(["idToken": idToken])
                case .failure(let error):
                    call.reject(error.localizedDescription, error.isUserCancelled ? "CANCELLED" : "FAILED")
                }
            }
        }
    }
}
