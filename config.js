// 云端服务配置。填好以后「我的」页面会出现账号与同步，页脚会出现意见反馈。
// 获取方法见 docs/SUPABASE_SETUP.md：Supabase 项目的 Project URL 和 Publishable key。
// Publishable key 本来就是公开的（网页里任何人都能看到），数据安全靠数据库的行级权限（RLS），不靠保密这个 key。
const CLOUD = {
  url: 'https://tpwljbzjixdggqjsgltf.supabase.co',
  anonKey: 'sb_publishable_R4ZXdXpCjxuTg0iH7EXTbQ_tIg1HdLm',
  requireLogin: true,   // true：必须登录才能使用（上架 App Store 前建议改成 false，见 docs/SUPABASE_SETUP.md）
  google: true,         // Google 登录（需在 Supabase 后台开通 Google provider，见 docs/SUPABASE_SETUP.md 7.3）
  apple: false,         // 通过 Apple 登录（网页用；需在 Supabase 开通 Apple provider 并填 Secret Key，见 docs/SUPABASE_SETUP.md 第 22 节）
  appleApp: true,       // App 里原生的「通过 Apple 登录」（需在 Supabase 的 Apple provider 里加上 Client ID com.koshokai.omnisphere，App 打包时带上 Sign in with Apple 权限）
                        // App 里有第三方登录时苹果要求同时有 Apple 登录，所以这个打开后，App 里才显示 Google / LINE / Facebook（在系统浏览器里登录再跳回 App）
  line: true,           // LINE 登录（需在 LINE Developers 建 LINE Login 频道、部署 Edge Function line-auth，见第 22 节）
  lineChannelId: '2012706004',   // LINE Login 频道的 Channel ID（公开的，每个 LINE 登录链接里都有）：App 里用 LINE SDK 直接打开 LINE App 授权时要用
  facebook: false,      // Facebook 登录（需在 Meta for Developers 建应用、在 Supabase 开通 Facebook provider，见第 22 节）
  rcKey: 'appl_yufgUCyHHcmUIlTPfYPZwSpMwYU',   // RevenueCat 的公开 SDK Key（App 内购用，本来就放在 App 里，不是密码）；secret key 只放在 Supabase Secrets
  vapid: 'BKR1VmkKvuTN2w395uXjWU77XeTyjmma-ioCxqutn9cqrdp9Fsmk4-Wj5hSQYe9-3h-Uj8ROU2Owd4F1UX1cJ1c',  // 学习提醒推送的公钥（公开的，私钥只放在 Supabase 后台），见 docs/SUPABASE_SETUP.md 第 9 节；留空则不显示提醒开关
};
