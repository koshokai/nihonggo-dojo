// 云端服务配置。填好以后「我的」页面会出现账号与同步，页脚会出现意见反馈。
// 获取方法见 docs/SUPABASE_SETUP.md：Supabase 项目的 Project URL 和 Publishable key。
// Publishable key 本来就是公开的（网页里任何人都能看到），数据安全靠数据库的行级权限（RLS），不靠保密这个 key。
const CLOUD = {
  url: 'https://tpwljbzjixdggqjsgltf.supabase.co',
  anonKey: 'sb_publishable_R4ZXdXpCjxuTg0iH7EXTbQ_tIg1HdLm',
  requireLogin: true,   // true：必须登录才能使用（上架 App Store 前建议改成 false，见 docs/SUPABASE_SETUP.md）
  google: true,         // Google 登录（需在 Supabase 后台开通 Google provider，见 docs/SUPABASE_SETUP.md 7.3）
  apple: false,         // 通过 Apple 登录（网页用；需在 Supabase 开通 Apple provider，见 docs/APP_STORE.md）。
                        // iPhone App 里不显示 Google / Apple 登录：Google 不允许在 App 内嵌网页里登录，只用邮箱登录时苹果也不要求提供 Apple 登录
  rcKey: 'appl_yufgUCyHHcmUIlTPfYPZwSpMwYU',   // RevenueCat 的公开 SDK Key（App 内购用，本来就放在 App 里，不是密码）；secret key 只放在 Supabase Secrets
  vapid: 'BKR1VmkKvuTN2w395uXjWU77XeTyjmma-ioCxqutn9cqrdp9Fsmk4-Wj5hSQYe9-3h-Uj8ROU2Owd4F1UX1cJ1c',  // 学习提醒推送的公钥（公开的，私钥只放在 Supabase 后台），见 docs/SUPABASE_SETUP.md 第 9 节；留空则不显示提醒开关
};
