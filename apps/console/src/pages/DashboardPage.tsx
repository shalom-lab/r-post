import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchIndex, fetchTopics, type Article, type TopicItem } from "../lib/content";

export default function DashboardPage() {
  const [topics,setTopics]=useState<TopicItem[]>([]);
  const [posts,setPosts]=useState<Article[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{Promise.all([fetchTopics(),fetchIndex()]).then(([t,p])=>{
    setTopics(t.items);setPosts([...p.articles].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));
  }).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
  const candidates=topics.filter(t=>!t.articleId);
  return <div className="editorial-home">
    <section className="home-intro"><span className="eyebrow">RPOST · 编辑工作室</span><h1>一个好问题，<br/>一篇讲明白的 R 教程。</h1>
    <p>挑选题目，理清大纲，再把代码和结果写成读者用得上的文章。</p><div className="row"><Link className="btn primary" to="/topics">开始选题 →</Link><Link className="btn" to="/articles">查看稿件</Link></div></section>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="overview-metrics"><Link to="/topics"><b>{loading?"—":candidates.length}</b><span>候选选题</span></Link><Link to="/topics"><b>{loading?"—":topics.filter(t=>t.articleId).length}</b><span>已撰写</span></Link><Link to="/articles"><b>{loading?"—":posts.length}</b><span>稿件</span></Link></div>
    <div className="home-columns">
      <section className="panel"><div className="panel-head"><h2>候选选题</h2><Link to="/topics">查看全部 →</Link></div>
      {candidates.slice(0,5).map((t,i)=><Link className="overview-row" to="/topics" key={t.id}><span className="rank">{String(i+1).padStart(2,"0")}</span><div><strong>{t.title}</strong><p className="muted">{t.blurb}</p></div></Link>)}
      {!candidates.length&&<p className="empty-state">{loading?"正在加载…":"还没有候选选题，可以先生成一批。"}</p>}</section>
      <section className="panel"><div className="panel-head"><h2>最近稿件</h2><Link to="/articles">全部稿件 →</Link></div>
      {posts.slice(0,5).map(p=><Link className="overview-row" to={`/article/${p.id}`} key={p.id}><div><strong>{p.title}</strong><p className="muted">{p.updatedAt.slice(0,10)} · {p.md?"已渲染":"QMD 草稿"}</p></div></Link>)}
      {!posts.length&&<p className="empty-state">{loading?"正在加载…":"第一篇稿件将在这里出现。"}</p>}</section>
    </div>
  </div>;
}
