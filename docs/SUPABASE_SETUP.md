# 开通账号、云同步和意见反馈（Supabase 免费版）

日语道场的账号、学习进度同步和意见反馈用 [Supabase](https://supabase.com) 做后端。免费版就够用：
每月 5 万活跃用户、500 MB 数据库，可以选东京机房，不需要信用卡。整个过程大约 10 分钟，只需要做一次。

> 不做这一步，网站照常能用，只是看不到「账号与同步」和「意见反馈」。

## 1. 注册 Supabase

1. 打开 <https://supabase.com>，点右上角 **Start your project**。
2. 选 **Continue with GitHub**，用你的 GitHub 账号（koshokai）登录即可。

## 2. 新建项目

1. 点 **New project**。
2. 填写：
   - **Name**：`nihongo-dojo`（随意）
   - **Database Password**：点 **Generate a password**，然后把密码存好（以后基本用不到，但丢了很麻烦）
   - **Region**：选 **Northeast Asia (Tokyo)**——日本用户访问最快
   - **Plan**：Free
3. 点 **Create new project**，等 1–2 分钟，直到页面不再显示 "Setting up project"。

## 3. 建表（复制粘贴一段 SQL）

1. 左侧菜单点 **SQL Editor**，再点 **New query**。
2. 把下面整段复制进去，点右下角 **Run**。看到 `Success. No rows returned` 就对了。

```sql
-- 学习进度：每个用户一行，整份进度存成 JSON
create table public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  xp int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.progress enable row level security;
create policy "read own progress"   on public.progress for select using (auth.uid() = user_id);
create policy "insert own progress" on public.progress for insert with check (auth.uid() = user_id);
create policy "update own progress" on public.progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 意见反馈：任何人都能提交（不用登录），但只有你在后台能看到
create table public.feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('bug', 'idea', 'content', 'other')),
  message text not null check (char_length(message) between 1 and 4000),
  contact text check (char_length(contact) <= 200),
  page text check (char_length(page) <= 200),
  app_version text check (char_length(app_version) <= 40)
);
alter table public.feedback enable row level security;
create policy "anyone can send feedback" on public.feedback for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- 删除账号（App Store 要求 App 内能删除账号）：只能删自己
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.users where id = auth.uid();
end; $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
```

## 4. 设置登录方式和跳转地址

1. 左侧 **Authentication** → **Sign In / Providers**：确认 **Email** 是开启的。
   - **Confirm email**（注册后要点邮件里的链接）：建议保持开启，防止乱填别人的邮箱。
2. 左侧 **Authentication** → **URL Configuration**：
   - **Site URL** 填 `https://koshokai.github.io/nihonggo-dojo/`
   - **Redirect URLs** 点 **Add URL**，加上 `https://koshokai.github.io/nihonggo-dojo/**`
3. （可选）**Authentication → Emails**：可以把确认邮件、重置密码邮件的标题和正文改成中文或日文。

> 免费版自带的邮件服务每小时只能发几封，适合起步。用户多了以后，在 **Authentication → Emails → SMTP Settings** 接入
> 免费的邮件服务（例如 Resend 每月 3000 封免费）。

## 5. 把两个值告诉网站

1. 左侧 **Project Settings**（齿轮）→ **Data API**（或 **API**），复制：
   - **Project URL**，形如 `https://abcdefghijkl.supabase.co`
   - **Project API keys** 里的 **anon public**（一长串以 `eyJ` 开头）
2. 把这两个值发给我，或者自己填进仓库里的 `config.js`：

```js
const CLOUD = {
  url: 'https://abcdefghijkl.supabase.co',
  anonKey: 'eyJhbGciOi...'
};
```

**anon key 可以公开**：它本来就会出现在网页里，数据安全由第 3 步的行级权限保证——每个人只能读写自己的进度，
反馈只能提交、不能读取。**绝对不要**把 **service_role** key 填进网站或发给任何人。

## 6. 看用户反馈

左侧 **Table Editor** → **feedback**，按 `created_at` 倒序就是最新的反馈。`kind` 的含义：
`bug` 出错了、`content` 内容有误、`idea` 建议、`other` 其他。`contact` 是用户自愿留的联系方式。

## 免费版的限制

- 项目 **一周没有任何访问会被暂停**，在 Supabase 后台点一下就能恢复，数据不会丢。网站有人用就不会暂停。
- 500 MB 数据库：一个用户的进度大约 50–200 KB，几千个活跃用户没问题；超出后再考虑付费版（每月 25 美元）。
