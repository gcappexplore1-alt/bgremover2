import { useMemo } from "react";
import { Brush, Eraser, Hand } from "lucide-react";
import { padCanvas } from "@/lib/layout";
import { Button, ColorField, Hint, NumberField, Section, Segmented, Slider, Toggle } from "../ui";
import { useBind } from "./panels1";

export function ShadowPanel() {
  const { s, e, slide, set } = useBind();
  const d = s.shadow.drop,
    c = s.shadow.contact;
  const dsl = (k: keyof typeof d, label: string, min: number, max: number, def: number, unit = "") => (
    <Slider
      label={label}
      min={min}
      max={max}
      unit={unit}
      defaultValue={def}
      disabled={!d.enabled}
      {...slide(
        `shadow ${label.toLowerCase()}`,
        (x) => x.shadow.drop[k] as number,
        (x, v) => ({ ...x, shadow: { ...x.shadow, drop: { ...x.shadow.drop, [k]: v } } }),
      )}
    />
  );
  const csl = (k: keyof typeof c, label: string, min: number, max: number, def: number, unit = "") => (
    <Slider
      label={label}
      min={min}
      max={max}
      unit={unit}
      defaultValue={def}
      disabled={!c.enabled}
      {...slide(
        `contact ${label.toLowerCase()}`,
        (x) => x.shadow.contact[k] as number,
        (x, v) => ({ ...x, shadow: { ...x.shadow, contact: { ...x.shadow.contact, [k]: v } } }),
      )}
    />
  );
  const ox = Math.round(Math.cos((d.angle * Math.PI) / 180) * d.distance),
    oy = Math.round(Math.sin((d.angle * Math.PI) / 180) * d.distance);
  const setXY = (nx: number, ny: number) => ({
    angle: Math.round(((Math.atan2(ny, nx) * 180) / Math.PI + 360) % 360),
    distance: Math.round(Math.hypot(nx, ny)),
  });
  const anyShadow = d.enabled || c.enabled;
  const erasedPct = useMemo(() => {
    const se = e.renderer.shadowErase;
    if (!se) return null;
    let n = 0;
    for (let i = 0; i < se.length; i++) if (se[i] < 128) n++;
    return Math.round((n / se.length) * 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.shadowTick]);

  return (
    <>
      {!e.hasMask && <Hint tone="warn">Shadows follow the cutout’s silhouette. Remove the background first.</Hint>}
      <Section title="Refine shadow">
        <Segmented
          label="Shadow brush"
          value={e.shadowBrush ?? "pan"}
          onChange={(v) => e.setShadowBrush(v === "pan" ? null : v)}
          options={[
            { value: "pan", label: "Move", icon: <Hand size={14} /> },
            { value: "erase", label: "Erase shadow", icon: <Eraser size={14} /> },
            { value: "restore", label: "Bring back", icon: <Brush size={14} /> },
          ]}
        />
        {!anyShadow && <Hint tone="warn">Turn on a shadow below first — the brush edits the shadow only, never your photo.</Hint>}
        {!e.shadowBrush ? (
          <Hint>Move lets you drag the canvas. Choose Erase shadow or Bring back to paint.</Hint>
        ) : (
          <>
            <Slider label="Brush size" min={2} max={300} value={e.brush.size} unit="px" defaultValue={40} onChange={(v) => e.setBrush({ ...e.brush, size: v })} />
            <Slider label="Hardness" min={0} max={100} value={Math.round(e.brush.hardness * 100)} unit="%" defaultValue={60} onChange={(v) => e.setBrush({ ...e.brush, hardness: v / 100 })} />
            <Slider label="Opacity" min={1} max={100} value={Math.round(e.brush.opacity * 100)} unit="%" defaultValue={100} onChange={(v) => e.setBrush({ ...e.brush, opacity: v / 100 })} />
          </>
        )}
        {erasedPct !== null && erasedPct > 0 && <p className="text-xs text-muted">{erasedPct}% of the shadow area is brushed away.</p>}
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" disabled={!anyShadow || erasedPct === 100} onClick={e.eraseAllShadow}>
            Erase entire shadow
          </Button>
          <Button size="sm" className="flex-1" disabled={erasedPct === null || erasedPct === 0} onClick={e.clearShadowErase}>
            Bring all back
          </Button>
        </div>
      </Section>
      <Section
        title="Drop shadow"
        right={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => set((x) => ({ ...x, shadow: { ...x.shadow, drop: { enabled: x.shadow.drop.enabled, color: "#000000", opacity: 45, blur: 18, angle: 90, distance: 16, spread: 100 } } }), "reset shadow")}
          >
            Reset
          </Button>
        }
      >
        <Toggle label="Show drop shadow" description="Follows the subject’s alpha silhouette" checked={d.enabled} onChange={(v) => set((x) => ({ ...x, shadow: { ...x.shadow, drop: { ...x.shadow.drop, enabled: v } } }), "shadow visibility")} />
        <ColorField label="Shadow colour" value={d.color} onChange={(v) => set((x) => ({ ...x, shadow: { ...x.shadow, drop: { ...x.shadow.drop, color: v } } }), "shadow colour")} />
        {dsl("opacity", "Opacity", 0, 100, 45, "%")}
        {dsl("blur", "Blur", 0, 100, 18, "px")}
        {dsl("angle", "Angle", 0, 360, 90, "°")}
        {dsl("distance", "Distance", 0, 300, 16, "px")}
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Offset X" suffix="px" value={ox} disabled={!d.enabled} onChange={(v) => set((x) => ({ ...x, shadow: { ...x.shadow, drop: { ...x.shadow.drop, ...setXY(v, oy) } } }), "shadow offset")} />
          <NumberField label="Offset Y" suffix="px" value={oy} disabled={!d.enabled} onChange={(v) => set((x) => ({ ...x, shadow: { ...x.shadow, drop: { ...x.shadow.drop, ...setXY(ox, v) } } }), "shadow offset")} />
        </div>
        {dsl("spread", "Scale", 50, 150, 100, "%")}
      </Section>
      <Section
        title="Ground / contact shadow"
        right={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => set((x) => ({ ...x, shadow: { ...x.shadow, contact: { enabled: x.shadow.contact.enabled, color: "#000000", opacity: 55, blur: 14, width: 80, height: 8, offsetY: 0 } } }), "reset contact shadow")}
          >
            Reset
          </Button>
        }
      >
        <Toggle label="Show ground shadow" description="Soft ellipse under the subject’s lowest point" checked={c.enabled} onChange={(v) => set((x) => ({ ...x, shadow: { ...x.shadow, contact: { ...x.shadow.contact, enabled: v } } }), "contact visibility")} />
        <ColorField label="Ground shadow colour" value={c.color} onChange={(v) => set((x) => ({ ...x, shadow: { ...x.shadow, contact: { ...x.shadow.contact, color: v } } }), "contact colour")} />
        {csl("opacity", "Opacity", 0, 100, 55, "%")}
        {csl("blur", "Softness", 0, 100, 14, "%")}
        {csl("width", "Width", 10, 200, 80, "%")}
        {csl("height", "Height", 2, 60, 8, "%")}
        {csl("offsetY", "Vertical offset", -200, 200, 0, "px")}
      </Section>
      <Section title="Avoid clipping">
        <p className="text-xs leading-relaxed text-muted">Add empty space around the canvas so shadows are not cut off at the edges.</p>
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {[40, 100, 200].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => set((x) => padCanvas(x, p), "add padding")}
              className="flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border border-[#d7e4ff] bg-white px-2 py-2.5 text-center transition-colors hover:border-[#0733eb] hover:bg-[#eef4ff] focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span className="text-[13px] font-semibold leading-none text-[#2e44a7]">+{p}px</span>
              <span className="text-[11px] leading-none text-muted">padding</span>
            </button>
          ))}
        </div>
      </Section>
    </>
  );
}
