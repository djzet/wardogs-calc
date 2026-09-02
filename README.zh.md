# WARDOGS — 迫击炮与火炮计算器 | 交互式16×16公里地图

[Русский](README.md) · [English](README.en.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Polski](README.pl.md) · [Українська](README.uk.md) · [Türkçe](README.tr.md) · [中文](README.zh.md)

**WARDOGS** 战术射击游戏的非官方交互式迫击炮与火炮计算器。在 16×16 km 地图上
两次点击即可获得距离、方位角、仰角(mils)。

**在线演示:** https://djzet.github.io/wardogs-calc/

| 桌面版 | 移动版 |
| :-: | :-: |
| ![desktop](assets/screenshots/desktop.png) | ![mobile](assets/screenshots/mobile.png) |

## 功能

- 支持瓦片缩放和平移的交互式地图
- 距离、方位角、仰角(mils)计算
- 迫击炮(700 m)与火炮(>2 km)
- 两张地图：Bakurani 和 Ozeti（16×16 km）
- 绘图工具：铅笔、直尺、标记、橡皮擦
- Bakurani 地图上的塔楼和区域
- 坐标快速传递的分享链接
- 设置和点位自动保存到 localStorage
- 深色和浅色主题
- 9 种界面语言（ru, en, de, fr, es, pl, uk, tr, zh）
- 移动设备响应式设计

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器 (http://localhost:5173)
npm run dev

# 构建生产版本 (dist/)
npm run build

# 预览构建 (http://localhost:4173)
npm run preview
```

## 项目结构

```
wardogs-calc/
├── assets/           # 图标和截图
├── config/           # 地图设置和弹道数据表
├── js/
│   ├── core/         # 数学、坐标、计算器
│   ├── features/     # 存储、分享、点位、武器、分析
│   ├── map/          # 瓦片、渲染器、交互、视角
│   ├── ui/           # 面板、输入框、上下文菜单
│   ├── locales.js    # 本地化管理器（9种语言）
│   └── index.js      # 主模块：初始化、事件绑定
├── maps/             # 地图瓦片（Bakurani、Ozeti）
├── public/           # 静态文件：语言包、robots.txt、sitemap
├── src/main.js       # Vite 入口点
├── styles/           # CSS：变量、基础、面板、地图、移动端
├── index.html        # 主标记
└── vite.config.js    # Vite 配置 + 地图插件
```

## 技术栈

- **Vite** — 构建工具和开发服务器
- **Vanilla JS** — 无框架（IIFE + window.*）
- **Canvas API** — 地图渲染和绘图工具
- **CSS Variables** — 主题切换

## 联系方式

- egor.silaev2003@yandex.ru
- [Wardogs CIS](https://discord.gg/kwxrTCJxre)
- @djzet

## 许可

MIT © Egor Silaev
