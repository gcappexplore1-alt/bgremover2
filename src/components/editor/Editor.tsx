import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Download,
  Layers,
  Loader2,
  Minimize2,
  Palette,
  Redo2,
  Scissors,
  Shrink,
  SlidersHorizontal,
  SunDim,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { ACCEPT_ATTR, APP_NAME } from "@/lib/config";
import { formatBytes } from "@/lib/validate";
import UploadDrop from "../UploadDrop";
import { Button, Hint, IconButton } from "../ui";
import BatchDialog from "./BatchDialog";
import { DisabledCutoutPanel, DisabledViewToolbar } from "./DisabledShell";
import { CompressPanel, ExportDialog } from "./output";
import { AdjustPanel, BackgroundPanel, CutoutPanel } from "./panels1";
import { ResizePanel } from "./ResizePanel";
import { ShadowPanel } from "./ShadowPanel";
import { EditorProvider, useEditor, useEditorStore, type Tool } from "./store";
import Viewport from "./Viewport";

const TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: "cutout", label: "Cutout", icon: <Scissors size={22} /> },
  { id: "background", label: "Background", icon: <Palette size={22} /> },
  { id: "shadow", label: "Shadow", icon: <SunDim size={22} /> },
  { id: "resize", label: "Resize", icon: <Minimize2 size={22} /> },
  { id: "adjust", label: "Adjust", icon: <SlidersHorizontal size={22} /> },
  { id: "compress", label: "Compress", icon: <Shrink size={22} /> },
];

export default function Editor({ embedded = false }: { embedded?: boolean }) {
  const store = useEditorStore();
  return (
    <EditorProvider value={store}>
      <EditorInner embedded={embedded} />
    </EditorProvider>
  );
}

/** True at the md breakpoint (≥768px). Used so the tool panel is mounted exactly once. */
function useIsDesktop() {
  const [d, setD] = useState(() => typeof window === "undefined" || window.matchMedia("(min-width: 768px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const h = () => setD(mq.matches);
    h();
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return d;
}

function EditorInner({ embedded }: { embedded: boolean }) {
  const e = useEditor();
  const isDesktop = useIsDesktop();
  const [exportOpen, setExportOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Clipboard paste while an image is open (the empty state's drop zone handles its own paste).
  const hasState = !!e.state;
  const addFiles = e.addFiles;
  useEffect(() => {
    if (!hasState) return;
    const h = (ev: ClipboardEvent) => {
      if ((ev.target as HTMLElement | null)?.closest("input,textarea,[contenteditable]")) return;
      const files = [...(ev.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (files.length) {
        ev.preventDefault();
        addFiles(files.map((f, i) => new File([f], `pasted-image-${Date.now()}${i ? `-${i}` : ""}.png`, { type: f.type })));
      }
    };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  }, [hasState, addFiles]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement;
      const input = t.closest("input") as HTMLInputElement | null;
      const typing = !!t.closest("textarea,select,[contenteditable]") || (!!input && !["range", "checkbox", "radio", "color"].includes(input.type));
      const mod = ev.metaKey || ev.ctrlKey;
      if (mod && ev.key.toLowerCase() === "z" && !typing) {
        ev.preventDefault();
        if (ev.shiftKey) e.redo();
        else e.undo();
        return;
      }
      if (mod && ev.key.toLowerCase() === "y" && !typing) {
        ev.preventDefault();
        e.redo();
        return;
      }
      if (mod && ev.key.toLowerCase() === "e" && e.state) {
        ev.preventDefault();
        setExportOpen(true);
        return;
      }
      if (typing || mod || !e.state || document.querySelector("dialog[open]")) return;
      if (ev.key === "e") {
        if (e.tool === "shadow") e.setShadowBrush("erase");
        else {
          e.setTool("cutout");
          e.setBrushMode("erase");
        }
      }
      if (ev.key === "r") {
        if (e.tool === "shadow") e.setShadowBrush("restore");
        else {
          e.setTool("cutout");
          e.setBrushMode("restore");
        }
      }
      if (ev.key === "h" || ev.key === "v") {
        e.setBrushMode(null);
        e.setShadowBrush(null);
      }
      if (ev.key === "[") e.setBrush({ ...e.brush, size: Math.max(2, Math.round(e.brush.size / 1.15)) });
      if (ev.key === "]") e.setBrush({ ...e.brush, size: Math.min(300, Math.round(e.brush.size * 1.15)) });
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [e]);

  const panel =
    e.state && e.project
      ? {
          cutout: <CutoutPanel />,
          background: <BackgroundPanel />,
          adjust: <AdjustPanel />,
          resize: <ResizePanel />,
          shadow: <ShadowPanel />,
          compress: <CompressPanel />,
        }[e.tool]
      : null;
  const toolLabel = TOOLS.find((t) => t.id === e.tool)!.label;
  const hasProject = !!(e.state && e.project);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="sr-only" role="status" aria-live="polite">
        {e.announce}
      </div>
      {/* Top bar */}
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-line-soft px-2 py-1 sm:px-3">
        {embedded && <span className="hidden text-sm font-bold text-brand sm:inline">{APP_NAME}</span>}
        {hasProject ? (
          <input
            aria-label="Project name"
            value={e.project!.name}
            className="h-9 min-w-0 max-w-[40vw] rounded-md border border-transparent px-2 text-sm font-medium hover:border-line focus:border-brand sm:max-w-xs"
            onChange={(ev) => e.rename(ev.target.value)}
            title={`Original file: ${e.project!.original.name} (${e.project!.original.width}×${e.project!.original.height}, ${formatBytes(e.project!.original.size)})`}
          />
        ) : (
          <span className="text-sm text-muted">Upload an image to start editing</span>
        )}
        <div id="viewport-toolbar-slot" className="no-scrollbar order-3 flex w-full min-w-0 flex-1 items-center justify-center overflow-x-auto md:order-2 md:w-auto">
          {!hasProject && <DisabledViewToolbar />}
        </div>
        <div className="order-2 ml-auto flex items-center gap-1 md:order-3">
          <IconButton label="Undo (Ctrl+Z)" disabled={!e.history.canUndo} onClick={e.undo}>
            <Undo2 size={18} />
          </IconButton>
          <IconButton label="Redo (Ctrl+Shift+Z)" disabled={!e.history.canRedo} onClick={e.redo}>
            <Redo2 size={18} />
          </IconButton>
          <Button size="sm" className="hidden sm:inline-flex" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Upload
          </Button>
          <IconButton label="Upload another image" className="sm:hidden" onClick={() => fileRef.current?.click()}>
            <Upload size={18} />
          </IconButton>
          {hasProject && e.items.length > 1 && (
            <Button size="sm" onClick={() => setBatchOpen(true)}>
              <Layers size={15} />
              <span className="hidden sm:inline">Batch</span>
            </Button>
          )}
          <Button variant="accent" size="sm" disabled={!hasProject} onClick={() => setExportOpen(true)}>
            <Download size={15} /> Export
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          aria-label="Upload images"
          onChange={(ev) => {
            const f = [...(ev.target.files ?? [])];
            ev.target.value = "";
            if (f.length) e.addFiles(f);
          }}
        />
      </header>

      {e.loadError && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-3 py-1.5 text-xs text-danger" role="alert">
          <AlertCircle size={14} /> {e.loadError}
        </div>
      )}
      {e.uploads.length > 0 && (
        <ul className="space-y-1 border-b border-line-soft bg-surface px-3 py-2" aria-live="polite">
          {e.uploads.map((u) => (
            <li key={u.id} className="flex items-center gap-2 text-xs">
              {u.status === "reading" ? <Loader2 size={13} className="animate-spin text-brand" /> : <AlertCircle size={13} className="text-danger" />}
              <span className="truncate font-medium">{u.name}</span>
              <span className="text-muted">{formatBytes(u.size)}</span>
              <span className={u.status === "error" ? "truncate text-danger" : "text-muted"}>{u.status === "reading" ? "Reading & validating…" : u.error}</span>
              <span className="ml-auto flex gap-1">
                {u.status !== "reading" && (
                  <Button size="sm" onClick={() => e.retryUpload(u.id)}>
                    Retry
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => e.dismissUpload(u.id)}>
                  {u.status === "reading" ? "Cancel" : "Dismiss"}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Left rail (desktop/tablet) — full-height flush column, square bottom */}
        <div className="hidden w-[128px] shrink-0 flex-col rounded-tr-2xl bg-[#152a63] md:flex">
          <nav aria-label="Tools" aria-disabled={!hasProject} className="flex flex-1 flex-col gap-1 p-2">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={hasProject && e.tool === t.id}
                title={hasProject ? t.label : `${t.label} (upload an image to enable)`}
                disabled={!hasProject}
                onClick={() => {
                  if (hasProject) e.setTool(t.id);
                }}
                className={`flex w-full min-w-0 flex-col items-center gap-1 rounded-xl px-2 py-3 text-center text-xs font-medium leading-tight transition-colors disabled:cursor-not-allowed ${hasProject && e.tool === t.id ? "bg-gradient-to-b from-[#156de3] to-[#0733eb] text-white shadow-md" : "text-white/75 hover:bg-white/10 hover:text-white disabled:opacity-60"}`}
              >
                {t.icon}
                <span className="w-full break-words">{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <main className="flex min-w-0 flex-1 flex-col">
          {hasProject ? (
            <div className="min-h-0 flex-1">
              <Viewport />
            </div>
          ) : (
            <EmptyCanvas />
          )}
          {e.items.length > 0 && <Tray />}
        </main>
        {/* Context panel (desktop/tablet) */}
        {isDesktop && (
          <aside aria-label={`${hasProject ? toolLabel : "Cutout"} settings`} aria-disabled={!hasProject} className="w-[380px] shrink-0 overflow-y-auto border-l border-line-soft bg-[#eef2ff] xl:w-[440px]">
            <h2 className="sticky top-0 z-10 border-b border-[#e3e9ff] bg-[#eef2ff]/95 px-5 py-3 text-base font-bold text-[#2e44a7] backdrop-blur">{hasProject ? toolLabel : "Cutout"}</h2>
            <div className="space-y-4 p-4">{hasProject ? panel : <DisabledCutoutPanel />}</div>
          </aside>
        )}
      </div>

      {/* Mobile bottom navigation + sheet */}
      {!isDesktop && (
        <>
          <nav aria-label="Tools" aria-disabled={!hasProject} className="order-2 flex shrink-0 overflow-x-auto border-t border-line-soft bg-white no-scrollbar">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={hasProject && e.tool === t.id && sheet}
                title={hasProject ? t.label : `${t.label} (upload an image to enable)`}
                disabled={!hasProject}
                onClick={() => {
                  if (!hasProject) return;
                  if (e.tool === t.id) setSheet(!sheet);
                  else {
                    e.setTool(t.id);
                    setSheet(true);
                  }
                }}
                className={`flex min-w-[68px] flex-1 flex-col items-center gap-0.5 px-1 py-2 text-center text-[10px] font-medium leading-tight disabled:cursor-not-allowed disabled:opacity-50 ${hasProject && e.tool === t.id && sheet ? "text-brand" : "text-ink-3"}`}
              >
                {t.icon}
                <span className="w-full break-words">{t.label}</span>
              </button>
            ))}
          </nav>
          {hasProject && sheet && (
            <div role="dialog" aria-label={`${toolLabel} settings`} className="order-1 max-h-[45dvh] shrink-0 overflow-y-auto rounded-t-2xl border-t border-line-soft bg-[#eef2ff] shadow-[0_-8px_30px_rgba(15,23,42,.15)]">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e3e9ff] bg-[#eef2ff] px-4 py-2">
                <span className="absolute left-1/2 top-1 mx-auto h-1 w-10 -translate-x-1/2 rounded-full bg-slate-300" aria-hidden />
                <h2 className="text-base font-semibold text-[#2e44a7]">{toolLabel}</h2>
                <IconButton label="Close settings" onClick={() => setSheet(false)}>
                  <X size={18} />
                </IconButton>
              </div>
              <div className="space-y-4 p-4">{panel}</div>
            </div>
          )}
        </>
      )}

      {e.state && <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />}
      <BatchDialog open={batchOpen} onClose={() => setBatchOpen(false)} />
    </div>
  );
}

function EmptyCanvas() {
  const e = useEditor();
  const incoming = e.uploads.length > 0;
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-surface-2 p-4">
      <div className="w-full max-w-2xl">
        {!e.loaded || incoming ? (
          <div className="text-center" role="status" aria-live="polite">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-brand" />
            <h1 className="mb-3 text-center text-3xl font-bold tracking-tight text-ink-2">{!e.loaded ? "Loading editor…" : "Preparing your image…"}</h1>
            <p className="mx-auto max-w-lg text-center text-[15px] leading-relaxed text-ink-3">
              {!e.loaded ? "Getting the workspace ready." : "Checking the file and opening the editor. The upload option will appear if anything needs your attention."}
            </p>
          </div>
        ) : (
          <>
            <h1 className="mb-3 text-center text-3xl font-bold tracking-tight text-ink-2">Start with your own image</h1>
            <p className="mx-auto mb-8 max-w-lg text-center text-[15px] leading-relaxed text-ink-3">Nothing is loaded yet. Your images are processed on this device.</p>
            <UploadDrop onFiles={e.addFiles} />
          </>
        )}
      </div>
    </div>
  );
}

function Tray() {
  const e = useEditor();
  const badge: Record<string, string> = { done: "bg-green-600", processing: "bg-brand", queued: "bg-slate-400", failed: "bg-danger", cancelled: "bg-slate-500", idle: "" };
  return (
    <div className="shrink-0 space-y-1 border-t border-line-soft bg-white px-2 py-1.5">
      <ul className="flex gap-2 overflow-x-auto pb-1 pt-1.5 no-scrollbar">
        {e.items.map((it) => {
          const active = e.project?.id === it.project.id;
          return (
            <li key={it.project.id} className="relative shrink-0">
              <button
                type="button"
                onClick={() => !active && e.open(it.project)}
                aria-current={active}
                aria-label={`Open ${it.project.original.name}, ${it.status}`}
                className={`checker block h-14 w-14 overflow-hidden rounded-lg border-2 ${active ? "border-brand" : "border-line-soft"}`}
              >
                {it.thumb && <img src={it.thumb} alt="" className="h-full w-full object-cover" />}
              </button>
              {badge[it.status] && <span className={`absolute left-1 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${badge[it.status]}`} title={it.status} />}
              <button
                type="button"
                aria-label={`Delete ${it.project.original.name}`}
                title={`Delete ${it.project.original.name}`}
                onClick={() => e.removeItem(it.project.id)}
                className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border border-line bg-white text-muted shadow-sm hover:text-danger"
              >
                <Trash2 size={11} />
              </button>
            </li>
          );
        })}
      </ul>
      {e.items.some((i) => i.status === "failed") && <Hint tone="error">Some images failed. Open them to see details and retry.</Hint>}
    </div>
  );
}
