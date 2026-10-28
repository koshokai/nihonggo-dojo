// 云端服务配置。填好以后「我的」页面会出现账号与同步，页脚会出现意见反馈。
// 获取方法见 docs/SUPABASE_SETUP.md：Supabase 项目的 Project URL 和 Publishable key。
// Publishable key 本来就是公开的（网页里任何人都能看到），数据安全靠数据库的行级权限（RLS），不靠保密这个 key。
const CLOUD = {
  url: 'https://tpwljbzjixdggqjsgltf.supabase.co',
  anonKey: 'sb_publishable_R4ZXdXpCjxuTg0iH7EXTbQ_tIg1HdLm',
  requireLogin: true,   // true：必须登录才能使用（上架 App Store 前建议改成 false，见 docs/SUPABASE_SETUP.md）
  google: true,         // Google 登录（需在 Supabase 后台开通 Google provider，见 docs/SUPABASE_SETUP.md 7.3）
  vapid: ''             // 学习提醒推送的公钥（公开的，私钥只放在 Supabase 后台），见 docs/SUPABASE_SETUP.md 第 9 节；留空则不显示提醒开关
};
