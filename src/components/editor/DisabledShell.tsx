import { ArrowLeftRight, Brush, Columns2, Eraser, Hand, Maximize, Minus, Plus } from "lucide-react";
import { MODELS, STUDIO_PRIVACY_LINE } from "@/lib/config";
import { Button, Hint, Section, Slider, Toggle } from "../ui";
import { BeforeIcon } from "./Viewport";

/**
 * Non-interactive replicas of the view toolbar and Cutout panel shown when no
 * image is loaded. The full editor shell stays visible behind the upload
 * dropzone, but every control is disabled until an image is uploaded.
 */
export function DisabledViewToolbar() {
  return (
    <div
      role="toolbar"
      aria-label="View controls (disabled — upload an image to enable)"
      aria-disabled="true"
      className="flex w-max max-w-full flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar rounded-2xl border border-white/70 bg-[#e9efff]/90 px-3 py-2 shadow-[0_12px_32px_rgba(7,51,235,0.16)] backdrop-blur-xl"
    >
      <div className="flex shrink-0 items-center gap-1 rounded-xl border border-[#d7e4ff] bg-white p-1 shadow-sm" role="group" aria-label="Before and after">
        <button
          type="button"
          aria-pressed={false}
          disabled
          className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-[#2e44a7] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <BeforeIcon filled={false} /> Before
        </button>
        <button
          type="button"
          aria-pressed={false}
          disabled
          className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-[#2e44a7] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <BeforeIcon filled={false} /> After
        </button>
      </div>

      <span className="h-8 w-px shrink-0 bg-[#d3ddf7]" aria-hidden />

      <button
        type="button"
        aria-pressed={false}
        disabled
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[#d7e4ff] bg-white px-4 text-[13px] font-semibold text-[#2e44a7] shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Columns2 size={16} /> Compare
      </button>

      <span className="h-8 w-px shrink-0 bg-[#d3ddf7]" aria-hidden />

      <div className="flex h-9 shrink-0 items-center rounded-xl border border-[#d7e4ff] bg-white px-1 shadow-sm" role="group" aria-label="Zoom">
        <span className="pl-2 pr-1 text-[13px] font-medium text-[#2e44a7]">Zoom</span>
        <button type="button" aria-label="Zoom out (-)" disabled className="grid h-7 w-7 place-items-center rounded-lg text-[#2e44a7] disabled:cursor-not-allowed disabled:opacity-40">
          <Minus size={15} />
        </button>
        <span className="min-w-12 px-1 text-center text-[13px] font-semibold tabular-nums text-[#2e44a7]" aria-hidden="true">
          —
        </span>
        <button type="button" aria-label="Zoom in (+)" disabled className="grid h-7 w-7 place-items-center rounded-lg text-[#2e44a7] disabled:cursor-not-allowed disabled:opacity-40">
          <Plus size={15} />
        </button>
      </div>

      <span className="h-8 w-px shrink-0 bg-[#d3ddf7]" aria-hidden />

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          aria-label="Fit to screen (0)"
          disabled
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[#d7e4ff] bg-white px-3 text-[13px] font-medium text-[#2e44a7] shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Maximize size={16} /> Fit
        </button>
        <button
          type="button"
          aria-pressed={false}
          disabled
          className="flex h-9 items-center gap-1.5 rounded-xl border border-[#d7e4ff] bg-white px-3 text-[13px] font-medium text-[#2e44a7] shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeftRight size={14} className="text-[#2e44a7]" /> Comparison slider
        </button>
      </div>
    </div>
  );
}

export function DisabledCutoutPanel() {
  return (
    <div className="space-y-3">
      <Hint>Upload an image to enable these editing tools.</Hint>
      <Section title="Automatic removal">
        <label className="block text-xs text-ink-3">
          Quality
          <select
            disabled
            aria-label="Quality (disabled — upload an image to enable)"
            className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-sm text-ink-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {Object.entries(MODELS).map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted">{MODELS.general.note}</p>
        <Button variant="accent" size="lg" className="w-full" disabled>
          Remove background
        </Button>
        <p className="text-xs leading-relaxed text-muted">{STUDIO_PRIVACY_LINE}</p>
      </Section>
      <Section title="Manual refinement">
        <div role="radiogroup" aria-label="Brush mode" className="flex flex-wrap gap-1 rounded-xl border border-[#e3e9ff] bg-[#eef2ff] p-1">
          {[
            { value: "pan", label: "Move", icon: <Hand size={14} />, active: true },
            { value: "erase", label: "Erase", icon: <Eraser size={14} />, active: false },
            { value: "restore", label: "Restore", icon: <Brush size={14} />, active: false },
          ].map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={o.active}
              disabled
              className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                o.active ? "bg-gradient-to-b from-[#0733eb] to-[#156de3] text-white shadow-sm" : "text-ink-3"
              }`}
            >
              {o.icon}
              {o.label}
            </button>
          ))}
        </div>
        <Slider label="Brush size" min={2} max={300} value={40} unit="px" defaultValue={40} disabled onChange={() => {}} />
        <Slider label="Hardness" min={0} max={100} value={60} unit="%" defaultValue={60} disabled onChange={() => {}} />
        <Slider label="Opacity" min={1} max={100} value={100} unit="%" defaultValue={100} disabled onChange={() => {}} />
        <Toggle label="Show mask overlay" description="Removed areas shown in red" checked={false} disabled onChange={() => {}} />
      </Section>
      <Section title="Edges">
        <Slider label="Feather" min={0} max={30} step={0.5} unit="px" defaultValue={0} value={0} disabled onChange={() => {}} />
        <Slider label="Expand / contract" min={-20} max={20} unit="px" defaultValue={0} value={0} disabled onChange={() => {}} />
        <Button className="w-full" disabled>
          Reset mask to automatic result
        </Button>
      </Section>
    </div>
  );
}
