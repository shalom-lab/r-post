import { NavLink, Route, Routes } from "react-router-dom";
import ArticlePage from "./pages/ArticlePage";
import CategoriesPage from "./pages/CategoriesPage";
import GeneratePage from "./pages/GeneratePage";
import HomePage from "./pages/HomePage";
import NewDraftPage from "./pages/NewDraftPage";
import PromptsPage from "./pages/PromptsPage";
import SettingsPage from "./pages/SettingsPage";
import TopicsPage from "./pages/TopicsPage";

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">R</span>
          <div>
            <strong>RPost</strong>
            <p>选题 ∥ 写作</p>
          </div>
        </div>
        <div className="topbar-right">
          <nav className="nav">
            <NavLink to="/topics">选题</NavLink>
            <NavLink to="/" end>
              稿件
            </NavLink>
            <NavLink to="/prompts">提示词</NavLink>
            <NavLink to="/generate">写作</NavLink>
            <NavLink to="/settings">设置</NavLink>
          </nav>
          <a
            className="github-link"
            href="https://github.com/shalom-lab/r-post"
            target="_blank"
            rel="noreferrer"
            title="GitHub 仓库"
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span>GitHub</span>
          </a>
        </div>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/article/:id" element={<ArticlePage />} />
          <Route path="/topics" element={<TopicsPage />} />
          <Route path="/prompts" element={<PromptsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/new" element={<NewDraftPage />} />
          <Route path="/generate" element={<GeneratePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
