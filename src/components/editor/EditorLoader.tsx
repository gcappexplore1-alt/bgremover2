"use client";
import dynamic from "next/dynamic";

// The editor is client-only (canvas, IndexedDB, workers) and lazy-loaded to keep the landing page light.
const Editor = dynamic(() => import("./Editor"), {
  ssr: false,
  loading: () => <div className="grid h-dvh place-items-center text-sm text-muted">Loading editor…</div>,
});

export default function EditorLoader({ embedded = false }: { embedded?: boolean }) {
  return <Editor embedded={embedded} />;
}
