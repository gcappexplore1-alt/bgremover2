import EditorLoader from "@/components/editor/EditorLoader";

/** Chrome-less editor for embedding inside the WordPress page via the Cutout Studio plugin iframe. */
export default function EmbedPage() {
  return (
    <div className="h-dvh overflow-hidden">
      <EditorLoader embedded />
    </div>
  );
}
