# 上线步骤

这一套东西的产物只有两类：`assets/` 里的 SVG 图片和 `README.md`。GitHub 只是把 README 渲染出来，
所有视觉都来自 SVG，所以不依赖任何第三方图片服务，也不会因为某个免费接口挂掉而变空白。

## 1. 建同名仓库

1. GitHub 右上角 **+** → **New repository**
2. 仓库名填**你的用户名，一字不差**（大小写也要一致，比如 `octocat/octocat`）
3. 选 **Public**，勾上 **Add a README file**
4. 创建后页面会出现绿框提示 *"You found a secret!"*，说明生效了

> 如果你 2020 年 7 月之前建过同名仓库，新版不会自动展示，需要进仓库点 **Share to profile**。

## 2. 填自己的信息

只需要改 `profile.config.json` 一个文件：

| 字段 | 说明 |
| --- | --- |
| `username` | GitHub 用户名，`--fetch` 拉数据用 |
| `displayName` | 横幅上的大字，中文英文都行 |
| `handle` | 横幅左上角的小字，一般是 `@用户名` |
| `tagline` | 一句话副标题 |
| `aboutLines` | 关于我的正文，数组里每个元素是一段（过长会自动断行） |
| `chips` | 技术栈标签，`tone` 可选 `mint` `cream` `sky` `blush` `lilac` `gold` |
| `links` | 右侧按钮，`icon` 可选 `globe` `mail` `code` `play`；改几项就生成几个 |
| `projects` | 项目列表 |
| `fallback` | 拉不到 API 时展示的兜底数字 |

改完执行：

```bash
node scripts/build-profile.mjs
```

不带参数就是离线出图；想用自己的真实数据：

```bash
node scripts/build-profile.mjs --fetch
```

（本地没登录也能跑，但 GitHub 匿名 API 限流 60 次/小时；有 `GH_TOKEN` 环境变量会自动带上。）

## 3. 推上去

```bash
git init
git add .
git commit -m "init profile"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<你的用户名>.git
git push -u origin main
```

刷新个人主页就能看到效果。

> 注意：`.gitignore` 已经排除了 `preview.html` 和截图，只有 README 和 assets 会被推上去。
> 如果你想让别人也能本地预览，把 `preview.html` 从 `.gitignore` 里删掉即可。

## 4. 让统计数字自动更新

`.github/workflows/profile-cards.yml` 已经写好了，推上去就自动生效：每天北京时间 10:17 重画
`github-snapshot.svg` 并提交回去，用的令牌是仓库自带的 `GITHUB_TOKEN`，不需要自己配 Secret。

想立刻看一次效果：仓库 **Actions** → **Refresh profile cards** → **Run workflow**。

## 5. 左栏（头像、名字、Bio）

这部分不在 README 里，去主页点 **Edit profile**：

- **Name / Bio**：用一句话写清"你是谁 + 做什么 + 在找什么机会"
- **Location / Website**：填了会显示成可点的链接
- **Achievements**：GitHub 自动给，不需要管
- **头像**：Settings → Profile picture → 上传 `assets/avatar.jpg`（已经裁成正方形，1141px 原图直接传也行）

## 常见问题

**图片显示不出来？**
检查 `assets/` 是否真的推上去了，以及 README 里的路径大小写是否一致。GitHub 区分大小写。

**深色模式下白底刺眼？**
所有卡片都写了 `prefers-color-scheme: dark`，会跟随系统切换成深色纸面。如果没生效，是浏览器太旧。

**想调整配色？**
改 `scripts/build-profile.mjs` 顶部的 `LIGHT` / `DARK` 两个对象，重新生成即可。

**想换草地上那只羊？**
直接替换 `assets/sheep.png`（透明背景 PNG，比例约 420×266），重新生成即可。
脚本会把它以 base64 内嵌进横幅 SVG——必须内嵌，因为 GitHub 以图片方式加载 SVG 时不允许再请求外部文件。
如果删掉这个文件，会自动退回手绘版小羊。
⚠️ 注意：如果新图头部完整、不需要补角，把 `build-profile.mjs` 里 `${horn()}` 那一行删掉；
如果需要补角，`horn()` 里的坐标是按当前这张图的角根位置（x222-268, y0-30）手写的，换图后要按新图重新定位。

**改字号、改布局？**
`banner()` / `aboutNote()` / `snapshot()` 三个函数各自控制一张卡片，坐标都在里面。
