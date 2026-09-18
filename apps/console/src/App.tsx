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
        <nav className="nav">
          <NavLink to="/topics">选题</NavLink>
          <NavLink to="/" end>
            稿件
          </NavLink>
          <NavLink to="/prompts">提示词</NavLink>
          <NavLink to="/generate">写作</NavLink>
          <NavLink to="/settings">设置</NavLink>
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/article/:id" element={<ArticlePage />} />
          <Route path="/topics" element={<TopicsPage />} />
          <Route path="/prompts" element={<PromptsPage />} />
          <Route path="/styles" element={<PromptsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/new" element={<NewDraftPage />} />
          <Route path="/generate" element={<GeneratePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
