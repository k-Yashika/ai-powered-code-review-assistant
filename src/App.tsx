import { useCallback, useState } from 'react';
import './index.css'
import { motion } from "framer-motion";

function usePoll(url, interval = 10000){
  // Placeholder polling hook (no-op). Implement later if needed.
  return;
}

function App() {
  const [selectedPr, setSelectedPr] = useState<any | null>(null);
  const [diffText, setDiffText] = useState<string>("");
  const [reviewText, setReviewText] = useState<string>("");
  const [running, setRunning] = useState<boolean>(false);
  const [toast, setToast] = useState<any | null>(null);

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
          <h1 className='text-2xl font-bold'>AI Code Review Assistant - Dashboard | needs a name</h1>
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
    </div>
  )
}

export default App
