// 云端服务配置。填好以后「我的」页面会出现账号与同步，页脚会出现意见反馈。
// 获取方法见 docs/SUPABASE_SETUP.md：Supabase 项目的 Project URL 和 Publishable key。
// Publishable key 本来就是公开的（网页里任何人都能看到），数据安全靠数据库的行级权限（RLS），不靠保密这个 key。
const CLOUD = {
  url: 'https://tpwljbzjixdggqjsgltf.supabase.co',
  anonKey: ''     // Publishable key（sb_publishable_…）或旧版 anon public key（eyJ…）
};
