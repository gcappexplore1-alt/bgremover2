import { useEffect, useRef, useState } from "react";
import { ImageUp } from "lucide-react";
import { ACCEPT_ATTR, MAX_BATCH, MAX_DECODED_PIXELS, MAX_FILE_BYTES } from "@/lib/config";
import { formatBytes } from "@/lib/validate";

/** Drag-and-drop + file picker + clipboard paste. Content is validated later from decoded bytes. */
export default function UploadDrop({
  onFiles,
  compact = false,
  listenPaste = true,
}: {
  onFiles: (f: File[]) => void;
  compact?: boolean;
  listenPaste?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [pasteMsg, setPasteMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!listenPaste) return;
    const h = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input,textarea,[contenteditable]")) return;
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (files.length) {
        e.preventDefault();
        onFiles(
          files.map(
            (f, i) =>
              new File([f], f.name && f.name !== "image.png" ? f.name : `pasted-image-${Date.now()}${i ? `-${i}` : ""}.png`, {
                type: f.type,
              }),
          ),
        );
      } else setPasteMsg("The clipboard doesn’t contain an image file.");
    };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  }, [onFiles, listenPaste]);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = [...e.dataTransfer.files];
        if (f.length) onFiles(f);
      }}
      className={`rounded-3xl border-[3px] border-dashed bg-white text-center transition-all ${over ? "scale-[1.01] border-[#0733eb] bg-[#eef4ff] shadow-lg" : "border-brand/30 shadow-sm"} ${compact ? "p-6" : "px-6 py-10 sm:px-12 sm:py-14"}`}
    >
      <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand" aria-hidden>
        <ImageUp size={28} />
      </span>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="inline-flex h-[52px] items-center justify-center rounded-full bg-gradient-to-b from-[#0733eb] to-[#156de3] px-9 text-[17px] font-semibold text-white shadow-md hover:from-[#2e44a7] hover:to-[#0733eb]"
      >
        Choose image
      </button>
      <p className="mt-4 text-[15px] text-ink-3">
        or drag &amp; drop files here, or paste with{" "}
        <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-sans text-xs">Ctrl</kbd> +{" "}
        <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-sans text-xs">V</kbd>
      </p>
      <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-muted">
        JPG, PNG or WebP · up to {formatBytes(MAX_FILE_BYTES)} and {(MAX_DECODED_PIXELS / 1e6).toFixed(0)} megapixels each · up to {MAX_BATCH} images
      </p>
      {pasteMsg && (
        <p role="status" className="mt-2 text-xs text-danger">
          {pasteMsg}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        className="hidden"
        aria-label="Choose images to upload"
        onChange={(e) => {
          const f = [...(e.target.files ?? [])];
          e.target.value = "";
          if (f.length) onFiles(f);
        }}
      />
    </div>
  );
}
