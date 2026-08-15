# CoursePlanner — HKUST Personalized Course Planner

A modern, intelligent course planning system for HKUST students: browse the course catalog, build timetables manually or with the smart auto-scheduler, track prerequisites and graduation progress, and sync everything to your account.

> Built with ❤️ for the HKUST community. Open source and free to use. UI is available in English and Chinese — English by default, switchable from the header.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss)](https://tailwindcss.com/)

---

## ✨ Features

### 🗓️ Basic Mode (Manual Scheduling)
- **Course Catalog** — multi-year course data (2022-23 ~ 2026-27), search by code, title, school, or professor
- **Course Detail** — prerequisites / co-requisites / exclusions checked against your completed courses, with waiver notices for unmet requirements
- **Professor Ratings** — aggregated ratings (ustrankings) shown on each course
- **Visual Timetable** — weekly grid with real-time conflict detection

### 🧠 Smart Mode (Auto-Scheduling) ⭐
- Select courses → set constraints (day off, no evening classes, no noon back-to-back, minimum break, professor rating filter, preferred time range)
- **Constraint-satisfaction solver** enumerates all valid section combinations (L/T/LA)
- Each schedule shows stats: days on campus, earliest / latest class, and total free time (sum of gaps between consecutive classes) — save your favorites and compare them side by side

### 📊 Graduation Progress Tracker
- **Common Core** — official UCE 30-credit rules (cc22 / cc25 / cc26 cohorts), including the joint-program union rule (e.g. DSCT: Science + Technology), the 12-credit broadening floor, and CTDL/UXOP substitution by extra English/Chinese/area credits
- **School & Major Requirements** — required courses, major electives with capstone-dependent branch rules (e.g. DSCT: thesis vs. co-op/FYP options)
- **Projected totals** — selected-but-not-completed courses counted as "in progress"
- **Prerequisite tracking** — completed courses drive prereq status across the whole app

### 👤 Account & Cloud Sync (Supabase)
- Email/password login; saved timetables, favorite schedules, and your profile persist to the cloud across devices
- **Profile** — school, major, extended major, minor, admission year, track, completed courses, AP/transfer credits

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 + TypeScript, Vite, Tailwind CSS v4 |
| **State** | Zustand |
| **Data Fetching** | TanStack Query |
| **Backend** | Python FastAPI + Pydantic |
| **Solver** | Backtracking CSP (`python-constraint`) |
| **Database** | Supabase (Postgres + Auth + RLS) |
| **Data** | JSON course catalogs (`data/`), scraped from official sources |

---

## 📁 Project Structure

```
courseplanner/
├── frontend/                    # React 19 + TypeScript frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/          # Header, Sidebar, StatusBar
│   │   │   ├── timetable/       # Weekly timetable grid
│   │   │   ├── course/          # Course search, cards, detail panel
│   │   │   ├── scheduler/       # Smart mode panel & results
│   │   │   ├── constraints/     # Constraint configuration
│   │   │   ├── progress/        # Graduation progress tracker
│   │   │   ├── profile/         # Profile settings (school/major/courses)
│   │   │   ├── auth/            # Login / register modal
│   │   │   └── ui/              # Shared UI components
│   │   ├── stores/              # Zustand stores (app state + cloud sync)
│   │   ├── data/                # Program/major catalogs (curated)
│   │   ├── contexts/            # Auth context
│   │   ├── hooks/               # Custom React hooks
│   │   ├── lib/                 # API client, Supabase client
│   │   └── types/               # TypeScript type definitions
│   └── public/                  # Static assets (icon.png, ...)
├── backend/                     # Python FastAPI backend
│   ├── app/
│   │   ├── api/                 # REST routes: courses, schedule, constraints, progress, ratings
│   │   ├── core/                # Engines: solver, prereq, progress, data_loader, scraper
│   │   ├── models/              # Pydantic schemas
│   │   └── main.py              # FastAPI app entry (CORS config here)
│   └── requirements.txt
├── data/                        # Course catalogs, CC mappings, professor ratings (JSON)
├── docs/                        # Supabase SQL setup scripts
├── scripts/                     # Scrapers to regenerate data/ (optional)
└── main.py                      # Convenience launcher for the backend
```

---

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js ≥ 18
- Python ≥ 3.11
- A [Supabase](https://supabase.com) account (free)

### 1. Supabase setup (one-time)
1. Create a new Supabase project.
2. In the SQL Editor, run [`docs/supabase_setup.sql`](docs/supabase_setup.sql) (tables + RLS), then [`docs/p3_profile_migration.sql`](docs/p3_profile_migration.sql) (profile fields).
3. Project Settings → API → copy the **Project URL** and **anon public** key.
4. Create `frontend/.env` (copy from [`.env.example`](frontend/.env.example)) and fill in the two values:

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

(or `python main.py` from the project root). API docs at http://localhost:8000/docs.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — Vite proxies `/api` to the backend at :8000.

---

## 🌐 Deployment (Public Hosting)

You can host the whole app **for free** (see [Cost](#-costs)):

1. **Backend → [Render](https://render.com)** — create a Web Service, set root directory to `backend/`, build command `pip install -r requirements.txt`, start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. The `data/` directory ships with the repo, so no extra files are needed. Set the environment variable `ALLOWED_ORIGINS` to your frontend domain (e.g. `https://courseplanner.vercel.app`).
2. **Frontend → [Vercel](https://vercel.com)** — import the repo, set root directory to `frontend/`, build command `npm run build`, output `dist`. Add three environment variables in the project settings: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL` pointing at your backend (e.g. `https://your-backend.onrender.com/api`).
3. **Supabase** stays as-is — all user accounts live in your project.

Anyone can then open the URL, register with an email, and use the app without touching the code.

---

## 🔐 Security Notes

- The **anon key** is public by design: it ships inside the frontend bundle, and **Row Level Security (RLS)** is the actual security boundary — every policy is scoped to `auth.uid() = id`, so users can only read/write their own data.
- `.env` is gitignored — the anon key is never committed (it is harmless if leaked; you can rotate it in Supabase if needed).
- **Never** put the `service_role` key in code or in the frontend — it bypasses RLS entirely. It lives only in the Supabase dashboard.
- The backend is stateless (no database, no secrets) — its API is safe to expose publicly.

---

## 📊 Data Sources & Regeneration

`data/` contains scraped course catalogs, Common Core area mappings, and professor ratings. Sources: HKUST Registry (course catalog), UCE (Common Core areas — WCQ + official PDFs), ustrankings (professor ratings). To refresh, run the scripts in `scripts/`.

---

## 💰 Costs

Public deployment is free on the free tiers: **Vercel** static hosting is free (no sleep), and **Render** offers a free web service (spins down after ~15 min idle → ~30-60 s cold start). An always-on backend costs about $5-7/month. Supabase's free tier (50k MAU, 500 MB DB) is plenty for a student community.

---

## 📝 License

MIT License — feel free to use, modify, and share.

## 🙏 Acknowledgments
- **HKUST Registry** — official course data
- **UCE (Common Core Office)** — CC area mappings & credit rules
- **USTSpace** & **ust-rankings.com** — professor and course rating data

---

# CoursePlanner — 港科大个性化排课规划器

一个面向 HKUST 学生的现代化智能排课系统：浏览课程目录、手动或智能自动排课、追踪先修课与毕业进度，并把所有数据同步到你的账户。

> 为港科大社区用心打造。开源免费使用。界面支持英文与中文 —— 默认英文，可在顶栏切换。

## ✨ 功能

### 🗓️ 基础模式（手动排课）
- **课程目录** — 多年份课程数据（2022-23 ~ 2026-27），可按课程编号、名称、学院或教授搜索
- **课程详情** — 先修/共修/互斥课程会对照你已完成的课程自动检查，未满足时给出免修提醒
- **教授评分** — 每门课展示聚合评分（ustrankings）
- **可视化课表** — 周课表网格，实时冲突检测

### 🧠 智能模式（自动排课）⭐
- 选课 → 设置约束（休息日、避开晚课、避开中午连堂、最小课间休息、过滤低分教授、偏好时间段）
- **约束求解器**枚举所有合法的 L/T/LA 组合
- 每个方案展示统计信息：在校天数、最早/最晚上课时间、总空闲时间（相邻课程间隔之和）——收藏心仪方案并排对比

### 📊 毕业进度追踪
- **大学核心课程** — 官方 UCE 30 学分规则（cc22 / cc25 / cc26 届），包括合办专业并集规则（如 DSCT：理学+工学）、12 学分拓宽下限、以及用额外英语/中文/领域学分替代 CTDL/UXOP
- **学院与专业要求** — 必修课、专业选修（含取决于毕业设计方向的分支规则，如 DSCT 论文 vs 实习/FYP）
- **预计总量** — 已选未完成的课程按"进行中"计入
- **先修课追踪** — 已完成课程驱动整个应用的先修状态

### 👤 账户与云端同步（Supabase）
- 邮箱/密码登录；保存的课表、收藏方案和个人资料跨设备云端持久化
- **个人资料** — 学院、主修、延伸主修、辅修、入学年份、方向、已完成课程、AP/转学分

## 🏗️ 技术栈

| 层 | 技术 |
|---|---|
| **前端** | React 19 + TypeScript、Vite、Tailwind CSS v4 |
| **状态** | Zustand |
| **数据请求** | TanStack Query |
| **后端** | Python FastAPI + Pydantic |
| **求解器** | 回溯 CSP（`python-constraint`） |
| **数据库** | Supabase（Postgres + Auth + RLS） |
| **数据** | JSON 课程目录（`data/`），来自官方来源抓取 |

## 📁 项目结构

```
courseplanner/
├── frontend/                    # React 19 + TypeScript 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/          # 顶栏、侧栏、状态栏
│   │   │   ├── timetable/       # 周课表网格
│   │   │   ├── course/          # 课程搜索、卡片、详情面板
│   │   │   ├── scheduler/       # 智能模式面板与结果
│   │   │   ├── constraints/     # 约束配置
│   │   │   ├── progress/        # 毕业进度追踪
│   │   │   ├── profile/         # 个人资料（学院/专业/课程）
│   │   │   ├── auth/            # 登录/注册弹窗
│   │   │   └── ui/              # 通用 UI 组件
│   │   ├── stores/              # Zustand 状态（应用状态 + 云端同步）
│   │   ├── data/                # 专业目录（人工整理）
│   │   ├── contexts/            # 认证上下文
│   │   ├── hooks/               # 自定义 React hooks
│   │   ├── lib/                 # API 客户端、Supabase 客户端
│   │   └── types/               # TypeScript 类型定义
│   └── public/                  # 静态资源（icon.png 等）
├── backend/                     # Python FastAPI 后端
│   ├── app/
│   │   ├── api/                 # REST 路由：courses、schedule、constraints、progress、ratings
│   │   ├── core/                # 引擎：solver、prereq、progress、data_loader、scraper
│   │   ├── models/              # Pydantic 模型
│   │   └── main.py              # FastAPI 入口（CORS 配置在此）
│   └── requirements.txt
├── data/                        # 课程目录、CC 映射、教授评分（JSON）
├── docs/                        # Supabase SQL 初始化脚本
├── scripts/                     # 数据抓取脚本（可选，用于重新生成 data/）
└── main.py                      # 后端便捷启动脚本
```

## 🚀 快速开始（本地运行）

### 前置条件
- Node.js ≥ 18
- Python ≥ 3.11
- [Supabase](https://supabase.com) 账号（免费）

### 1. 配置 Supabase（一次性）
1. 新建一个 Supabase 项目。
2. 在 SQL Editor 中依次运行 [`docs/supabase_setup.sql`](docs/supabase_setup.sql)（建表 + RLS）和 [`docs/p3_profile_migration.sql`](docs/p3_profile_migration.sql)（个人资料字段）。
3. Project Settings → API → 复制 **Project URL** 和 **anon public** 密钥。
4. 创建 `frontend/.env`（从 [`.env.example`](frontend/.env.example) 复制），填入两个值：

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

### 2. 后端

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

（或在项目根目录运行 `python main.py`。）API 文档见 http://localhost:8000/docs。

### 3. 前端

```bash
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173 — Vite 会把 `/api` 代理到 :8000 的后端。

## 🌐 部署（公网托管）

整套应用可以**免费**部署（见[费用](#-费用)）：

1. **后端 → [Render](https://render.com)** — 创建 Web Service，根目录设为 `backend/`，构建命令 `pip install -r requirements.txt`，启动命令 `uvicorn app.main:app --host 0.0.0.0 --port $PORT`。`data/` 随仓库一起部署，无需额外文件。设置环境变量 `ALLOWED_ORIGINS` 为你的前端域名（如 `https://courseplanner.vercel.app`）。
2. **前端 → [Vercel](https://vercel.com)** — 导入仓库，根目录设为 `frontend/`，构建命令 `npm run build`、输出目录 `dist`。在项目设置中添加三个环境变量：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`，以及指向后端的 `VITE_API_URL`（如 `https://your-backend.onrender.com/api`）。
3. **Supabase** 保持不变 — 所有用户账户都在你的项目里。

之后任何人打开网址、注册邮箱即可使用，无需接触代码。

## 🔐 安全说明

- **anon key 本身就是公开设计**：它会随前端打包发布，真正的安全边界是**行级安全（RLS）**——所有策略都限定 `auth.uid() = id`，用户只能读写自己的数据。
- `.env` 已被 gitignore，anon key 不会被提交（即便泄露也无害，必要时可在 Supabase 中轮换）。
- **切勿**把 `service_role` 密钥写进代码或前端——它会完全绕过 RLS。它只应存在于 Supabase 控制台。
- 后端无状态（不连数据库、无密钥）——公开其 API 是安全的。

## 📊 数据来源与重新生成

`data/` 包含抓取的课程目录、大学核心课程领域映射和教授评分。来源：港科大教务处（课程目录）、UCE 核心课程办公室（CC 领域 — WCQ + 官方 PDF）、ustrankings（教授评分）。如需更新，运行 `scripts/` 下的脚本。

## 💰 费用

公网部署在免费额度内完全免费：**Vercel** 静态托管免费（不休眠），**Render** 提供免费 Web 服务（约 15 分钟无访问后休眠 → 冷启动约 30-60 秒）。后端常驻在线约 $5-7/月。Supabase 免费档（5 万月活、500MB 数据库）对校园社区绰绰有余。

## 📝 许可证

MIT 许可证 — 可自由使用、修改与分享。

## 🙏 致谢
- **港科大教务处** — 官方课程数据
- **UCE（核心课程办公室）** — CC 领域映射与学分规则
- **USTSpace** & **ust-rankings.com** — 教授与课程评分数据
