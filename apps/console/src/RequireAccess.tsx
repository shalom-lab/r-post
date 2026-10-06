import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LS_GH_REPO, LS_GH_TOKEN, SETTINGS_CHANGED, probeGitHubAccess } from "./lib/github";

export default function RequireAccess({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [access, setAccess] = useState({ path: "", ok: false, message: "正在验证访问权限…" });
  useEffect(() => {
    let generation = 0;
    let disposed = false;
    async function check() {
      const current = ++generation;
      setAccess({ path: pathname, ok: false, message: "正在验证访问权限…" });
      const result = await probeGitHubAccess();
      if (!disposed && current === generation) setAccess({ path: pathname, ok: result.ok, message: result.message });
    }
    function storage(event: StorageEvent) {
      if (!event.key || event.key === LS_GH_REPO || event.key === LS_GH_TOKEN) void check();
    }
    void check();
    window.addEventListener(SETTINGS_CHANGED, check);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", check);
    return () => {
      disposed = true;
      window.removeEventListener(SETTINGS_CHANGED, check);
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", check);
    };
  }, [pathname]);
  if (access.path !== pathname || !access.ok) return (
    <section className="connection-page">
      <h1>连接后阅读</h1>
      <p>{access.path === pathname ? access.message : "正在验证访问权限…"}</p>
      <Link to="/settings">填写或更新 Token</Link>
    </section>
  );
  return children;
}
