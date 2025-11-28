import { useCallback, useEffect, useState } from 'react';
import './index.css'
import { motion } from "framer-motion";

function usePoll(url, interval = 10000){
  const [data, setData] = useState(null);
  useEffect(() => {
    let mounted = true;
    async function fetchOnce() {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      if (mounted) setData(j);
    } catch (e) {
      console.error("poll error", url, e);
    }
    }
    fetchOnce();
    const id = setInterval(fetchOnce, interval);
    return () => {
      mounted = false;
      clearInterval(id);
      };
    }, [url, interval]);
    return data;
  }

function App() {
  const [selectedPr, setSelectedPr] = useState<any | null>(null);
  const [diffText, setDiffText] = useState<string>("");
  const [reviewText, setReviewText] = useState<string>("");
  const [running, setRunning] = useState<boolean>(false);
  const [toast, setToast] = useState<any | null>(null);

  const prs = usePoll("/api/prs", 8000) || [];
  const reviews = usePoll("/api/reviews", 8000) || [];
  const metrics = usePoll("/api/metrics", 15000) || { total: 0, issues: 0, recent: [] };

  useEffect(() => {
    if (prs.length && !selectedPr) setSelectedPr(prs[0]);
  }, [prs]);

  const openPR = useCallback(async (pr) => {
    setSelectedPr(pr);
    setDiffText("Loading diff...")
    setReviewText("");
    try {
      const res = await fetch(`/api/prs/${encodeURIComponent(pr.id)}/diff`);
      if (!res.ok) throw new Error(`Failed to load diff: ${res.status}`);
      const j = await res.text();
      setDiffText(j || "(no diff provided)");
      } catch (e) {
      console.error(e);
      setDiffText(`Error loading diff: ${e.message}`);
      }
  }, []);

  const runReview = useCallback(async (pr: any) => {
    if (!pr) return;
    setRunning(true);
    setReviewText("Running AI review");
    try{
      const res = await fetch(`/api/prs/${encodeURIComponent(pr.id)}/review`);
      if (!res.ok) throw new Error(`Review request failed: ${res.status}`);
      const j = await res.json();
      if (j.review) setReviewText(j.review);
      else setReviewText("Review triggered. It may be processing; refresh for results.");
      setToast({ type: "success", text: "Review Complete"});
    } catch (e: any){
      console.error(e);
      setReviewText(`Error running review: ${e.message}`);
      setToast({ type: "error", text: "Review failed"});
    } finally{
      setRunning(false);
      setTimeout(() => setToast(null), 4000);
    }
  }, []);

  return (
    <div className='min-h-screen bg-gray-50 bg-gray-900 text-gray-400'>
      <header className='flex items-center gap-4 p-4 border-b border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/60 backdrop-blur'>
        <div>
          <h1 className='text-2xl font-bold'>AI Code Review Assistant - Dashboard</h1>
          <p className='text-sm text-gray-400'>Realtime pull request reviews</p>
        </div>
        <div className='ml-auto flex items-center gap-3'>
          <button className='px-3 py-1 rounded-md bg-blue-600 text-white text-sm shadow'
          onClick={() => runReview(selectedPr)}
          disabled={running || !selectedPr}>
            {running ? "Running..." : "Run Review"}
          </button>
        </div>
      </header>

      <main className='p-6 grid grid-cols-12 gap-6'>
        {/* Left Column: PR Lists */}
        <aside className='col-span-3 bg-gray-800 rounded-2xl p-4 shadow-sm h-[70vh] overflow-auto'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='font-semibold'>Open Pull Requests</h2>
            <span className='text-xs text-gray-500'>{prs.length}</span>
          </div>
          {/* TODO */}
          <ul className='space-y-2'>
            {prs.length === 0 && <li className='text-sm text-gray-500'>No open requests</li>}
            {prs.map((pr) => (
              <li key={pr.id}>
                <motion.button whileHover={{ scale: 1.02}}
                className={`w-full text-left p-3 rounded-lg ${selectedPr && selectedPr.id === pr.id ? "bg-gray-100" : "hover:bg-gray-50"}`}
                onClick={() => openPR(pr)}>
                  <div className='flex items-center gap-2'>
                    <div className='w-10 h-10 rounded-md bg-gray-200 flex items-center justify-center text-sm font-medium'>{pr.author ? pr.author[0].toUpperCase() : "G"}</div>
                    <div className='flex-1'>
                      <div className='text-sm font-medium'>{pr.title}</div>
                      <div className='text-xs text-gray-500'>#{pr.number} . {pr.repo}</div>
                    </div>
                    <div className='text-xs text-gray-500'>{pr.status || "open"}</div>
                  </div>
                </motion.button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Middle Column: Diff Viewer */}
        <section className='col-span-6 bg-gray-800 rounded-2xl p-4 shadow-sm h-[70vh] overflow-auto'>
          <div className='flex items-center justify-between mb-3'>
            <h2 className='font-semibold'>Diff</h2>
            <div className='text-xs text-black'>{selectedPr ? `PR #${selectedPr.number}` : "No PR selected"}</div>
          </div>

          <pre className='whitespace-pre-wrap text-xs text-black bg-gray-200 p-3 rounded-lg border border-gray-100 overflow-auto'>
            {diffText || "Select a PR to view the diff."}
          </pre>
        </section>

        {/* Right Column: AI Review Metrics */}
        <aside className='col-span-3 bg-gray-800 rounded-2xl p-4 shadow-sm h-[70vh] overflow-auto'>
          <div className='mb-4'>
            <h2 className='font-semibold'>AI Review</h2>
            <div className='text-xs text-gray-500'>Suggestions from the model appear here!</div>
          </div>

          <div className='flex-1 mb-4'>
            <div className='p-3 bg-gray-50 rounded-lg h-full overflow-auto text-sm font-sans'>
              {reviewText ? (
                <pre className='whitespace-pre-wrap font-sans text-sm'>{reviewText}</pre>
              ) : (
                <div className='text-sm text-gray-800'>No review yet. Click <span className='font-medium'>Run Review</span> to generate suggestions.</div>
              )}
            </div>
          </div>

          <div className='mb-4'>
            <h3 className='font-medium'>Quick Metrics</h3>
            <div className='mt-2 grid grid-cols-3 gap-2'>
              <div className='p-2 bg-gray-50 rounded text-center'>
                <div className='text-xs text-gray-500'>PRs</div>
                <div className='text-lg font-bold'>{metrics.total ?? 0}</div>
              </div>
              <div className='p-2 bg-gray-50 rounded text-center'>
                <div className='text-xs text-gray-500'>Issues</div>
                <div className='text-lg font-bold'>{metrics.issues ?? 0}</div>
              </div>
              <div className='p-2 bg-gray-50 rounded text-center'>
                <div className='text-xs text-gray-500'>Recent</div>
                <div className='text-lg font-bold'>{(metrics.recent || []).length}</div>
              </div>
            </div>
          </div>

          <div>
            <h3 className='font-medium text-gray-50'>Recent Reviews</h3>
            <ul className='mt-2 space-y-2'>
              {reviews.length === 0 && <li className='text-xs text-gray-500'>No review yet</li>}
              {reviews.slice(0,5).map(r => (
                <li key={r.id} className='p-2 bg-gray-50 rounded'>
                  <div className='text-xs font-medium'>{r.pr.title}</div>
                  <div className='text-xs text-gray-500'>{r.summary || (r.review || '').slice(0, 80)}</div>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Toast */}
        {toast && (
          <div className={`fixed right-6 bottom-6 p-3 rounded-lg shadow-lg ${toast.type === 'sucess' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{toast.text}</div>
        )}

        <footer className='p-4 text-center text-xs text-gray-500'>AI Powered Code Review Assistant</footer>
      </main>
    </div>
  )
}

export default App
