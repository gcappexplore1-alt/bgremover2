import { Suspense, lazy } from "react";

// The editor is client-only (canvas, workers, model downloads) and lazy-loaded to keep the landing page light.
// (Next.js original: `dynamic(() => import("./Editor"), { ssr: false, loading: … })`.)
const Editor = lazy(() => import("./Editor"));

export default function EditorLoader({ embedded = false }: { embedded?: boolean }) {
  return (
    <Suspense fallback={<p className="p-8 text-center text-muted">Loading editor…</p>}>
      <Editor embedded={embedded} />
    </Suspense>
  );
}
