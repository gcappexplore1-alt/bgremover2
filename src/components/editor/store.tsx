import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MAX_BATCH, type ModelKey } from "@/lib/config";
import { History, type MaskReserve, type ShadowEraseSnap, type Snapshot } from "@/lib/history";
import { hasUserEdits, resampleMask, transformMaskForInput, type MaskRect } from "@/lib/imageops";
import { ingestFile, pendingFiles } from "@/lib/ingest";
import { ctx2d, Renderer } from "@/lib/render";
import { cancelSegment, segment, type SegStage } from "@/lib/segmentation";
import { getMeta, setMeta } from "@/lib/storage";
import { inputKey, newId, type InputTransform, type Project, type ProjectState } from "@/lib/types";
import { formatBytes, validateAndDecode } from "@/lib/validate";

export type Tool = "cutout" | "background" | "adjust" | "resize" | "shadow" | "compress";
export type ItemStatus = "idle" | "queued" | "processing" | "done" | "failed" | "cancelled";
export interface Item {
  project: Project;
  thumb: string | null;
  status: ItemStatus;
  error?: string;
}
export interface UploadRow {
  id: string;
  name: string;
  size: number;
  status: "reading" | "error" | "cancelled";
  error?: string;
  file: File;
  abort: AbortController;
}
export interface SegUI {
  status: "queued" | "model" | "inference" | "failed" | "cancelled" | "done";
  text: string;
  pct?: number;
  error?: string;
}
export interface Brush {
  size: number;
  hardness: number;
  opacity: number;
}

function stageText(s: SegStage, files: Map<string, [number, number]>): { text: string; pct?: number } {
  if (s.kind === "queued") return { text: "Queued" };
  if (s.kind === "inference") return { text: `Removing background${s.device ? ` (${s.device === "webgpu" ? "WebGPU" : "WebAssembly"})` : ""}…` };
  if (s.file && s.total) files.set(s.file, [s.loaded ?? 0, s.total]);
  let l = 0,
    t = 0;
  files.forEach(([a, b]) => {
    l += a;
    t += b;
  });
  if (t > 0 && l < t) return { text: `Downloading model… ${formatBytes(l)} of ${formatBytes(t)}`, pct: Math.round((l / t) * 100) };
  return { text: `Loading model${s.device ? ` (${s.device === "webgpu" ? "WebGPU" : "WebAssembly"})` : ""}…` };
}

/**
 * Editor state. Editing is session-only: images, masks and projects live in memory while the editor is open
 * and are never persisted. Only user preferences (colour swatches, saved canvas presets) use localStorage.
 */
export function useEditorStore() {
  const [renderer] = useState(() => new Renderer());
  const [history] = useState(() => new History());
  const [items, setItems] = useState<Item[]>([]);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [state, setStateRaw] = useState<ProjectState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [maskTick, setMaskTick] = useState(0);
  const [bgTick, setBgTick] = useState(0);
  const [histTick, setHistTick] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [seg, setSeg] = useState<SegUI | null>(null);
  const [announce, setAnnounce] = useState("");
  const [tool, setTool] = useState<Tool>("cutout");
  const [brush, setBrush] = useState<Brush>({ size: 40, hardness: 0.6, opacity: 1 });
  const [brushMode, setBrushMode] = useState<"erase" | "restore" | null>(null);
  const [shadowBrush, setShadowBrush] = useState<"erase" | "restore" | null>(null);
  const [shadowTick, setShadowTick] = useState(0);
  const [overlay, setOverlay] = useState(false);
  const [swatches, setSwatches] = useState<string[]>(["#ffffff", "#000000", "#f8f6fa", "#0733eb", "#156de3", "#2e44a7"]);
  const [model, setModel] = useState<ModelKey>("general");

  const stateRef = useRef<ProjectState | null>(null);
  const projectRef = useRef<Project | null>(null);
  const autoMask = useRef<Uint8Array | null>(null);
  const maskReserve = useRef<MaskReserve | null>(null);
  const pending = useRef<Snapshot | null>(null);
  const blobs = useRef(new Map<string, Blob>());
  const segJob = useRef<string | null>(null);
  const openSeq = useRef(0);

  const setState = useCallback((s: ProjectState) => {
    stateRef.current = s;
    setStateRaw(s);
  }, []);
  const setProj = useCallback((p: Project | null) => {
    projectRef.current = p;
    setProject(p);
  }, []);
  const say = useCallback((m: string) => {
    setAnnounce("");
    setTimeout(() => setAnnounce(m), 30);
  }, []);

  /** Image bytes are held in memory for this session only. */
  const blobFor = useCallback(async (id: string) => blobs.current.get(id), []);

  // ---------- history ----------
  const currentShadowErase = useCallback(
    (): ShadowEraseSnap | null => (renderer.shadowErase ? { data: renderer.shadowErase, w: renderer.shadowEraseW, h: renderer.shadowEraseH } : null),
    [renderer],
  );
  const snapshot = useCallback(
    (): Snapshot => ({
      state: stateRef.current!,
      mask: renderer.mask,
      autoMask: autoMask.current,
      maskInputKey: projectRef.current?.maskInputKey ?? null,
      maskReserve: maskReserve.current,
      shadowErase: currentShadowErase(),
      label: "",
    }),
    [renderer, currentShadowErase],
  );
  const begin = useCallback(() => {
    if (!pending.current && stateRef.current) pending.current = snapshot();
  }, [snapshot]);
  const update = useCallback(
    (fn: (s: ProjectState) => ProjectState) => {
      if (!stateRef.current) return;
      setState(fn(stateRef.current));
    },
    [setState],
  );
  const end = useCallback(
    (label: string) => {
      if (pending.current) {
        history.push({ ...pending.current, label });
        pending.current = null;
        setHistTick((t) => t + 1);
      }
    },
    [history],
  );
  const commit = useCallback(
    (fn: (s: ProjectState) => ProjectState, label: string) => {
      begin();
      update(fn);
      end(label);
    },
    [begin, update, end],
  );
  const pushMaskHistory = useCallback(
    (before: Uint8Array | null, label: string, beforeAuto = autoMask.current, beforeReserve = maskReserve.current) => {
      history.push({
        state: stateRef.current!,
        mask: before,
        autoMask: beforeAuto,
        maskInputKey: projectRef.current?.maskInputKey ?? null,
        maskReserve: beforeReserve,
        shadowErase: currentShadowErase(),
        label,
      });
      setHistTick((t) => t + 1);
      setMaskTick((t) => t + 1);
    },
    [history, currentShadowErase],
  );
  const pushShadowHistory = useCallback(
    (before: ShadowEraseSnap | null, label: string) => {
      history.push({
        state: stateRef.current!,
        mask: renderer.mask,
        autoMask: autoMask.current,
        maskInputKey: projectRef.current?.maskInputKey ?? null,
        maskReserve: maskReserve.current,
        shadowErase: before,
        label,
      });
      setHistTick((t) => t + 1);
      setShadowTick((t) => t + 1);
    },
    [history, renderer],
  );

  const restore = useCallback(
    (s: Snapshot) => {
      if (!stateRef.current) return;
      if (inputKey(s.state.input) !== inputKey(stateRef.current.input)) renderer.setInput(s.state.input);
      if (s.mask !== renderer.mask) renderer.setMask(s.mask);
      autoMask.current = s.autoMask;
      maskReserve.current = s.maskReserve;
      const cur = currentShadowErase();
      if ((s.shadowErase?.data ?? null) !== (cur?.data ?? null)) {
        if (!s.shadowErase) renderer.setShadowErase(null, 0, 0);
        else {
          const cw = s.state.canvas.width,
            ch = s.state.canvas.height;
          const buf =
            s.shadowErase.w === cw && s.shadowErase.h === ch ? s.shadowErase.data : resampleMask(s.shadowErase.data, s.shadowErase.w, s.shadowErase.h, cw, ch);
          renderer.setShadowErase(buf, cw, ch);
        }
      }
      if (projectRef.current) setProj({ ...projectRef.current, maskInputKey: s.maskInputKey });
      setState(s.state);
      setMaskTick((t) => t + 1);
      setShadowTick((t) => t + 1);
      setHistTick((t) => t + 1);
    },
    [renderer, setProj, setState, currentShadowErase],
  );
  const undo = useCallback(() => {
    const s = history.undo(snapshot());
    if (s) {
      restore(s);
      say(`Undid ${s.label}`);
    }
  }, [history, snapshot, restore, say]);
  const redo = useCallback(() => {
    const s = history.redo(snapshot());
    if (s) {
      restore(s);
      say(`Redid ${s.label}`);
    }
  }, [history, snapshot, restore, say]);

  // ---------- items / open ----------
  const patchItem = useCallback((id: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.project.id === id ? { ...x, ...p } : x))), []);

  const open = useCallback(
    async (p: Project, bitmap?: ImageBitmap) => {
      const seq = ++openSeq.current;
      if (segJob.current) {
        cancelSegment(segJob.current);
        segJob.current = null;
        setSeg(null);
      }
      try {
        let bm = bitmap;
        if (!bm) {
          const blob = await blobFor(p.originalAssetId);
          if (!blob) throw new Error("The original image for this project is no longer in memory. Please upload it again.");
          bm = await createImageBitmap(blob, { imageOrientation: "from-image" });
        }
        if (seq !== openSeq.current) return;
        renderer.original?.close?.();
        renderer.setOriginal(bm);
        renderer.setInput(p.state.input);
        // Session-only editing: a freshly opened image always starts without a cutout.
        autoMask.current = null;
        maskReserve.current = null;
        renderer.setMask(null);
        renderer.setShadowErase(null, 0, 0);
        renderer.bgImage = null;
        history.clear();
        pending.current = null;
        setProj({ ...p, maskInputKey: null });
        setState(p.state);
        setLoadError(null);
        setSeg(null);
        setMaskTick((t) => t + 1);
        setHistTick((t) => t + 1);
        say(`Opened ${p.original.name}`);
      } catch (e) {
        say(e instanceof Error ? e.message : "Could not open image");
        setLoadError(e instanceof Error ? e.message : String(e));
      }
    },
    [blobFor, renderer, history, setProj, setState, say],
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      const room = MAX_BATCH - items.length;
      const list = files.slice(0, Math.max(0, room));
      if (files.length > list.length) say(`Only ${MAX_BATCH} images can be open at once; ${files.length - list.length} file(s) were skipped.`);
      let first = true;
      for (const f of list) {
        const row: UploadRow = { id: newId(), name: f.name, size: f.size, status: "reading", file: f, abort: new AbortController() };
        setUploads((u) => [...u, row]);
        try {
          const { project: p, bitmap, blob } = await ingestFile(f, row.abort.signal);
          blobs.current.set(p.originalAssetId, blob);
          setUploads((u) => u.filter((x) => x.id !== row.id));
          setItems((xs) => [{ project: p, thumb: URL.createObjectURL(blob), status: "idle" }, ...xs]);
          if (first) {
            first = false;
            await open(p, bitmap);
          } else bitmap.close();
        } catch (e) {
          const cancelled = e instanceof DOMException && e.name === "AbortError";
          setUploads((u) =>
            u.map((x) => (x.id === row.id ? { ...x, status: cancelled ? "cancelled" : "error", error: cancelled ? "Cancelled" : e instanceof Error ? e.message : String(e) } : x)),
          );
          say(cancelled ? `${f.name} cancelled` : `${f.name}: upload failed`);
        }
      }
    },
    [items.length, open, say],
  );

  const retryUpload = useCallback(
    (id: string) => {
      const row = uploads.find((u) => u.id === id);
      if (!row) return;
      setUploads((u) => u.filter((x) => x.id !== id));
      addFiles([row.file]);
    },
    [uploads, addFiles],
  );
  const dismissUpload = useCallback((id: string) => {
    setUploads((u) => {
      const r = u.find((x) => x.id === id);
      r?.abort.abort();
      return u.filter((x) => x.id !== id);
    });
  }, []);

  const removeItem = useCallback(
    async (id: string) => {
      const it = items.find((x) => x.project.id === id);
      if (!it) return;
      if (it.thumb) URL.revokeObjectURL(it.thumb);
      blobs.current.delete(it.project.originalAssetId);
      const bgId = it.project.state.background.image.assetId;
      if (bgId) blobs.current.delete(bgId);
      const rest = items.filter((x) => x.project.id !== id);
      setItems(rest);
      if (projectRef.current?.id === id) {
        if (rest[0]) await open(rest[0].project);
        else {
          setProj(null);
          stateRef.current = null;
          setStateRaw(null);
          autoMask.current = null;
          maskReserve.current = null;
          renderer.setMask(null);
          renderer.setShadowErase(null, 0, 0);
          renderer.working = null;
          history.clear();
        }
      }
      say("Image removed");
    },
    [items, open, setProj, renderer, history, say],
  );

  // Warn before reload/close with unexported work. Nothing is saved, so
  // leaving discards the image and all edits — export first.
  const hasWorkRef = useRef(false);
  hasWorkRef.current = items.length > 0 || uploads.length > 0;
  useEffect(() => {
    const h = (ev: BeforeUnloadEvent) => {
      if (!hasWorkRef.current) return;
      ev.preventDefault();
      ev.returnValue = "Your image and edits are not saved. Export your image before leaving, or it will be lost.";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  // Leaving the editor discards everything: release thumbnail URLs.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(
    () => () => {
      for (const it of itemsRef.current) if (it.thumb) URL.revokeObjectURL(it.thumb);
    },
    [],
  );

  // Initial load: always start empty. Files handed over from the landing page (in memory) are consumed here.
  // The microtask + `alive` guard keeps this correct under React StrictMode's mount/unmount/mount cycle.
  const addFilesRef = useRef(addFiles);
  useEffect(() => {
    addFilesRef.current = addFiles;
  }, [addFiles]);
  useEffect(() => {
    let alive = true;
    getMeta<string[]>("swatches")
      .then((sw) => {
        if (alive && sw?.length) setSwatches(sw);
      })
      .catch(() => {});
    Promise.resolve().then(() => {
      if (!alive) return;
      setLoaded(true);
      const files = pendingFiles.splice(0);
      if (files.length) addFilesRef.current(files);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Keep the tray copy of the project in sync with live edits.
  useEffect(() => {
    if (!project || !state) return;
    setItems((xs) => xs.map((x) => (x.project.id === project.id ? { ...x, project: { ...project, state } } : x)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // ---------- background image asset ----------
  const bgAssetId = state?.background.image.assetId ?? null;
  useEffect(() => {
    let alive = true;
    if (!bgAssetId) {
      renderer.bgImage = null;
      setBgTick((t) => t + 1);
      return;
    }
    blobFor(bgAssetId)
      .then(async (b) => {
        if (!b || !alive) return;
        const bm = await createImageBitmap(b, { imageOrientation: "from-image" });
        if (alive) {
          renderer.bgImage = bm;
          setBgTick((t) => t + 1);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [bgAssetId, blobFor, renderer]);

  const setBackgroundImage = useCallback(
    async (file: File) => {
      const dec = await validateAndDecode(file);
      dec.bitmap.close();
      const id = newId();
      const blob = file.slice(0, file.size, dec.type);
      blobs.current.set(id, blob);
      commit(
        (s) => ({
          ...s,
          background: {
            ...s.background,
            type: "image",
            image: { ...s.background.image, assetId: id, name: file.name, crop: { x: 0, y: 0, w: 1, h: 1 }, x: 0, y: 0, scale: 1, rotation: 0 },
          },
        }),
        "background image",
      );
    },
    [commit],
  );

  // ---------- segmentation ----------
  const runRemoval = useCallback(async () => {
    const p = projectRef.current,
      s = stateRef.current;
    if (!p || !s || !renderer.working) return;
    if (segJob.current) cancelSegment(segJob.current);
    const jobId = newId();
    segJob.current = jobId;
    const key = inputKey(s.input);
    const files = new Map<string, [number, number]>();
    const img = ctx2d(renderer.working).getImageData(0, 0, renderer.ww, renderer.wh);
    patchItem(p.id, { status: "processing", error: undefined });
    say("Background removal started");
    try {
      const mask = await segment(jobId, img, model, (st) => {
        if (segJob.current !== jobId) return;
        const { text, pct } = stageText(st, files);
        setSeg({ status: st.kind, text, pct });
      });
      if (segJob.current !== jobId || projectRef.current?.id !== p.id || inputKey(stateRef.current!.input) !== key) return; // stale
      segJob.current = null;
      const before = renderer.mask,
        beforeAuto = autoMask.current,
        beforeReserve = maskReserve.current;
      const original = renderer.original;
      if (beforeReserve && original) {
        const now = s.input.crop,
          base = beforeReserve.input.crop;
        const coversArchive =
          now.x <= base.x + 0.00001 && now.y <= base.y + 0.00001 && now.x + now.w >= base.x + base.w - 0.00001 && now.y + now.h >= base.y + base.h - 0.00001;
        if (coversArchive) {
          // A fresh model result now covers the whole archived region (possibly more).
          // Promote it, so subsequent trims remain reversible across the larger area.
          maskReserve.current = { input: structuredClone(s.input), current: mask, auto: mask };
        } else {
          const map = (fallback: Uint8Array) =>
            transformMaskForInput(mask, s.input.width, s.input.height, s.input, beforeReserve.input, original.width, original.height, { fallback });
          maskReserve.current = { ...beforeReserve, current: map(beforeReserve.current), auto: map(beforeReserve.auto ?? beforeReserve.current) };
        }
      }
      autoMask.current = mask;
      renderer.setMask(mask.slice());
      setProj({ ...projectRef.current!, maskInputKey: key, model });
      pushMaskHistory(before, "background removal", beforeAuto, beforeReserve);
      setSeg({ status: "done", text: "Background removed. Refine edges with the brushes if needed." });
      patchItem(p.id, { status: "done" });
      say("Background removed");
    } catch (e) {
      if (segJob.current !== jobId && !(e instanceof DOMException)) return;
      const cancelled = e instanceof DOMException && e.name === "AbortError";
      if (segJob.current === jobId) segJob.current = null;
      const msg = cancelled ? "Cancelled. No changes were made." : e instanceof Error ? e.message : String(e);
      setSeg({ status: cancelled ? "cancelled" : "failed", text: msg, error: cancelled ? undefined : msg });
      patchItem(p.id, { status: cancelled ? "cancelled" : "failed", error: msg });
      say(cancelled ? "Background removal cancelled" : "Background removal failed");
    }
  }, [renderer, model, patchItem, say, setProj, pushMaskHistory]);

  const cancelRemoval = useCallback(() => {
    if (segJob.current) cancelSegment(segJob.current);
  }, []);

  const resetMask = useCallback(() => {
    if (!autoMask.current) return;
    const before = renderer.mask,
      beforeReserve = maskReserve.current;
    if (beforeReserve) {
      const orig = renderer.original;
      const base =
        beforeReserve.auto ??
        (orig && stateRef.current
          ? transformMaskForInput(autoMask.current, renderer.ww, renderer.wh, stateRef.current.input, beforeReserve.input, orig.width, orig.height, {
              fallback: beforeReserve.current,
            })
          : beforeReserve.current);
      maskReserve.current = { ...beforeReserve, current: base };
    }
    renderer.setMask(autoMask.current.slice());
    pushMaskHistory(before, "reset mask", autoMask.current, beforeReserve);
    update((st) => ({ ...st, refine: { feather: 0, expand: 0 } }));
  }, [renderer, pushMaskHistory, update]);

  const completeMaskStroke = useCallback(
    (before: Uint8Array | null, label: string, region: MaskRect | null) => {
      const oldReserve = maskReserve.current,
        input = stateRef.current?.input,
        original = renderer.original;
      if (oldReserve && input && original && renderer.mask) {
        const current =
          inputKey(input) === inputKey(oldReserve.input)
            ? renderer.mask
            : transformMaskForInput(renderer.mask, renderer.ww, renderer.wh, input, oldReserve.input, original.width, original.height, {
                fallback: oldReserve.current,
                ...(region ? { region } : {}),
              });
        maskReserve.current = { ...oldReserve, current };
      }
      pushMaskHistory(before, label, autoMask.current, oldReserve);
    },
    [renderer, pushMaskHistory],
  );

  /** Remove all shadow brush edits (full shadow back). */
  const clearShadowErase = useCallback(() => {
    if (!renderer.shadowErase) return;
    const before = currentShadowErase();
    renderer.setShadowErase(null, 0, 0);
    pushShadowHistory(before, "restore all shadow");
    say("Shadow brush edits cleared");
  }, [renderer, currentShadowErase, pushShadowHistory, say]);

  /** Erase the entire shadow at once (undoable; shadows stay enabled). */
  const eraseAllShadow = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    const { width: w, height: h } = s.canvas;
    const before = currentShadowErase();
    if (before && before.data.every((v) => v === 0)) return;
    renderer.setShadowErase(new Uint8Array(w * h), w, h);
    pushShadowHistory(before, "erase all shadow");
    say("Entire shadow erased");
  }, [renderer, currentShadowErase, pushShadowHistory, say]);

  /** Apply a new input transform. Rotate/flip/crop/resize remap the existing mask so the cut-out is kept. */
  const applyInput = useCallback(
    (next: InputTransform, label = "resize input", continuous = false) => {
      const s = stateRef.current,
        p = projectRef.current;
      if (!s || !p) return;
      const prev = s.input;
      if (inputKey(prev) === inputKey(next)) return;
      const geomSame =
        prev.rotate === next.rotate && prev.flipH === next.flipH && prev.flipV === next.flipV && JSON.stringify(prev.crop) === JSON.stringify(next.crop);
      begin();
      const oldMask = renderer.mask,
        oldAuto = autoMask.current;
      const ow = renderer.original?.width ?? 0,
        oh = renderer.original?.height ?? 0;
      // Keep the largest available mask before cropping; a later slider move can
      // render from it again, including pixels outside the current crop.
      if (oldMask && !maskReserve.current && ow && oh && JSON.stringify(prev.crop) !== JSON.stringify(next.crop)) {
        maskReserve.current = { input: structuredClone(prev), current: oldMask, auto: oldAuto };
      }
      renderer.setInput(next);
      let newKey: string | null = null;
      if (oldMask) {
        const source = maskReserve.current;
        if (source && ow && oh) {
          renderer.setMask(transformMaskForInput(source.current, source.input.width, source.input.height, source.input, next, ow, oh));
          autoMask.current = source.auto ? transformMaskForInput(source.auto, source.input.width, source.input.height, source.input, next, ow, oh) : null;
        } else if (geomSame) {
          if (prev.width !== next.width || prev.height !== next.height) {
            renderer.setMask(resampleMask(oldMask, prev.width, prev.height, next.width, next.height));
            if (oldAuto) autoMask.current = resampleMask(oldAuto, prev.width, prev.height, next.width, next.height);
          }
        } else if (ow && oh) {
          renderer.setMask(transformMaskForInput(oldMask, prev.width, prev.height, prev, next, ow, oh));
          if (oldAuto) autoMask.current = transformMaskForInput(oldAuto, prev.width, prev.height, prev, next, ow, oh);
        } else {
          renderer.setMask(resampleMask(oldMask, prev.width, prev.height, next.width, next.height));
          if (oldAuto) autoMask.current = resampleMask(oldAuto, prev.width, prev.height, next.width, next.height);
        }
        newKey = inputKey(next);
      } else {
        renderer.setMask(null);
        autoMask.current = null;
        maskReserve.current = null;
      }
      setProj({ ...p, maskInputKey: newKey });
      const canvasFollows = s.canvas.width === prev.width && s.canvas.height === prev.height;
      update((st) => ({
        ...st,
        input: next,
        canvas: canvasFollows ? { width: next.width, height: next.height } : st.canvas,
        export: canvasFollows ? { ...st.export, width: next.width, height: next.height } : st.export,
      }));
      if (!continuous) end(label);
      setMaskTick((t) => t + 1);
      patchItem(p.id, { status: newKey ? "done" : "idle" });
    },
    [renderer, begin, update, end, setProj, patchItem],
  );

  const rename = useCallback(
    (name: string) => {
      const p = projectRef.current;
      if (!p) return;
      const np = { ...p, name: name.slice(0, 100) };
      setProj(np);
      setItems((xs) => xs.map((x) => (x.project.id === p.id ? { ...x, project: np } : x)));
    },
    [setProj],
  );

  const saveSwatch = useCallback((c: string) => {
    setSwatches((sw) => {
      const n = [c, ...sw.filter((x) => x.toLowerCase() !== c.toLowerCase())].slice(0, 16);
      setMeta("swatches", n).catch(() => {});
      return n;
    });
  }, []);

  const hasMask = !!renderer.mask;
  // Before/after comparison is only meaningful once the background has been
  // removed or the user has changed something (background, colours, subject,
  // shadow, edges, canvas size).
  const canCompare = hasMask || (state ? hasUserEdits(state) : false);

  return {
    renderer,
    history,
    items,
    setItems,
    uploads,
    project,
    state,
    loaded,
    maskTick,
    setMaskTick,
    bgTick,
    histTick,
    loadError,
    seg,
    announce,
    say,
    canCompare,
    tool,
    setTool,
    brush,
    setBrush,
    brushMode,
    setBrushMode,
    shadowBrush,
    setShadowBrush,
    shadowTick,
    overlay,
    setOverlay,
    swatches,
    saveSwatch,
    model,
    setModel,
    begin,
    update,
    end,
    commit,
    pushMaskHistory,
    completeMaskStroke,
    pushShadowHistory,
    clearShadowErase,
    eraseAllShadow,
    undo,
    redo,
    open,
    addFiles,
    retryUpload,
    dismissUpload,
    removeItem,
    patchItem,
    runRemoval,
    cancelRemoval,
    resetMask,
    applyInput,
    setBackgroundImage,
    hasMask,
    hasMaskReserve: !!maskReserve.current,
    reserveInput: maskReserve.current?.input ?? null,
    autoMask,
    blobFor,
    rename,
  };
}

export type EditorStore = ReturnType<typeof useEditorStore>;
const Ctx = createContext<EditorStore | null>(null);
export function EditorProvider({ value, children }: { value: EditorStore; children: React.ReactNode }) {
  const v = useMemo(() => value, [value]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}
export function useEditor(): EditorStore {
  const c = useContext(Ctx);
  if (!c) throw new Error("useEditor outside provider");
  return c;
}
export function useEditorState(): { s: ProjectState; e: EditorStore } {
  const e = useEditor();
  return { s: e.state!, e };
}
