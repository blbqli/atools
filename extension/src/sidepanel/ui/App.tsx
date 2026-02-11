import React from "react";
import { Link, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { tools } from "./toolRegistry";

const BASE_URL = "https://www.atools.live";

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";

  const title = tools.find((tool) => tool.path === location.pathname)?.title || "ATools";

  return (
    <header className="sticky top-0 z-10 border-b divider relative bg-white/60 backdrop-blur-xl dark:bg-slate-950/45">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/70 to-transparent dark:via-sky-300/60" />
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {!isHome ? (
            <button
              type="button"
              className="btn px-2 py-1"
              onClick={() => navigate(-1)}
            >
              返回
            </button>
          ) : null}
          <div className="truncate font-bold">
            {title === "ATools" ? (
              <span className="bg-gradient-to-r from-sky-600 to-violet-600 bg-clip-text text-transparent dark:from-sky-300 dark:to-violet-300">
                ATools
              </span>
            ) : (
              title
            )}
          </div>
        </div>
        <button
          type="button"
          className="btn px-3 py-1.5"
          onClick={() => chrome.tabs.create({ url: BASE_URL })}
        >
          打开工具站
        </button>
      </div>
    </header>
  );
}

function Home() {
  return (
    <div className="mx-auto grid max-w-md gap-3 p-3">
      <div className="panel p-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-sm font-extrabold">选择工具</div>
          <div className="text-[11px] muted2">跟随系统深浅色 · 侧边栏即开即用</div>
        </div>
        <div className="mt-3 grid gap-2">
          {tools.map((tool) => (
            <Link
              key={tool.id}
              to={tool.path}
              className="card block"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold">{tool.title}</div>
                  <div className="mt-1 text-xs muted">{tool.description}</div>
                </div>
                <div className="shrink-0 text-xs muted2">进入 →</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="min-h-0 flex-1 overflow-hidden">
        <React.Suspense fallback={<div className="p-3 text-xs muted">加载中…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            {tools.map((tool) => (
              <Route key={tool.id} path={tool.path} element={<tool.Component />} />
            ))}
          </Routes>
        </React.Suspense>
      </main>
    </div>
  );
}
