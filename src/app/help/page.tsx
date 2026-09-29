import { SiteFooter, SiteHeader } from "@/components/site";
import { MAX_DECODED_PIXELS, MAX_FILE_BYTES, MAX_OUTPUT_PIXELS, MODELS } from "@/lib/config";

const SHORTCUTS: [string, string][] = [
  ["Ctrl/⌘ + Z", "Undo"],
  ["Ctrl/⌘ + Shift + Z or Ctrl + Y", "Redo"],
  ["Ctrl/⌘ + E", "Open export"],
  ["E / R", "Erase / restore brush"],
  ["H or V", "Move (pan) mode"],
  ["[ and ]", "Smaller / larger brush"],
  ["Space + drag", "Pan while painting"],
  ["+ / − / 0", "Zoom in / out / fit"],
  ["Hold \\", "Show original"],
];

/** app/help/page.tsx — help & privacy. */
export default function HelpPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold text-ink-2">Help &amp; privacy</h1>

        <section className="mt-8" aria-labelledby="how">
          <h2 id="how" className="text-xl font-bold text-ink-2">
            How it works
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-3">
            <li>Upload JPG, PNG or WebP images (drag &amp; drop, choose, or paste).</li>
            <li>In Cutout, choose a model and press Remove background. The first run downloads the model once.</li>
            <li>Refine with the erase/restore brushes, feathering and expand/contract.</li>
            <li>Pick a background, adjust colours, resize, and add shadows.</li>
            <li>Use Export for PNG/JPG/WebP, or Compress for size-optimised files. Batch results download as a ZIP.</li>
          </ol>
        </section>

        <section className="mt-8" aria-labelledby="where">
          <h2 id="where" className="text-xl font-bold text-ink-2">
            Where your images are processed
          </h2>
          <p className="mt-3 text-ink-3">
            Everything — decoding, background removal, editing and encoding — runs on your device in the browser. Your images are not uploaded to our server or any third-party service. The only network downloads are the
            application itself, the segmentation runtime and the model weights, fetched from public CDNs / Hugging Face (or the site’s own model host if configured) and cached by your browser.
          </p>
        </section>

        <section className="mt-8" aria-labelledby="storage">
          <h2 id="storage" className="text-xl font-bold text-ink-2">
            Storage &amp; retention
          </h2>
          <p className="mt-3 text-ink-3">
            Projects (original image, masks and settings) live only in memory while this tab is open. Reloading the page or leaving the editor discards them — nothing is written to your device and nothing is uploaded.
            Only your colour swatches and saved canvas sizes are remembered in this browser. The server keeps no copies of your images, so there is nothing server-side to delete.
          </p>
        </section>

        <section className="mt-8" aria-labelledby="meta">
          <h2 id="meta" className="text-xl font-bold text-ink-2">
            Metadata
          </h2>
          <p className="mt-3 text-ink-3">
            Exports are re-encoded by the browser, which writes no EXIF, GPS/location or camera metadata. Orientation from the original EXIF is applied to the pixels on import.
          </p>
        </section>

        <section className="mt-8" aria-labelledby="models">
          <h2 id="models" className="text-xl font-bold text-ink-2">
            Models &amp; licences
          </h2>
          <ul className="mt-3 space-y-2 text-ink-3">
            {Object.values(MODELS).map((m) => (
              <li key={m.id}>
                <b>{m.label}</b> — {m.id}, {m.license} licence. {m.note}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-ink-3">Inference runtime: transformers.js / ONNX Runtime Web (Apache-2.0), WebGPU when available, otherwise WebAssembly.</p>
        </section>

        <section className="mt-8" aria-labelledby="limits">
          <h2 id="limits" className="text-xl font-bold text-ink-2">
            Limits
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-3">
            <li>
              Upload: {Math.round(MAX_FILE_BYTES / 1048576)} MB and {(MAX_DECODED_PIXELS / 1e6).toFixed(0)} MP per file.
            </li>
            <li>Output: up to {(MAX_OUTPUT_PIXELS / 1e6).toFixed(1)} MP (browser canvas limits, especially on iPhone/iPad).</li>
            <li>Enlarging uses interpolation — it does not add detail and is not “AI upscaling”.</li>
            <li>Automatic cutouts are not perfect on every photo; fine hair, glass and low-contrast edges may need brush work.</li>
            <li>Unsupported: animated images, GIF, HEIC/HEIF, AVIF input, SVG.</li>
          </ul>
        </section>

        <section className="mt-8" aria-labelledby="keys">
          <h2 id="keys" className="text-xl font-bold text-ink-2">
            Keyboard shortcuts
          </h2>
          <dl className="mt-3 divide-y divide-line-soft text-sm">
            {SHORTCUTS.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2">
                <dt>
                  <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-sans text-xs">{k}</kbd>
                </dt>
                <dd className="text-ink-3">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <a href="#/editor" className="mt-10 inline-flex h-11 items-center rounded-full bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-dark">
          Open the editor
        </a>
      </main>
      <SiteFooter />
    </>
  );
}
