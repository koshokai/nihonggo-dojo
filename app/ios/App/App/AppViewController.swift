import UIKit
import Capacitor

// 网页容器：关掉边缘回弹和双指缩放，页面像原生 App 一样固定，不会跟着手指晃、把底部按钮挡住
class AppViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let sv = webView?.scrollView else { return }
        sv.bounces = false
        sv.alwaysBounceVertical = false
        sv.alwaysBounceHorizontal = false
        sv.pinchGestureRecognizer?.isEnabled = false
    }
}
