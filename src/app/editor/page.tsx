import EditorLoader from "@/components/editor/EditorLoader";

// No site header here: on clippingworld.com the WordPress theme supplies the
// header above this tool, so rendering our own would duplicate it.
export default function EditorPage() {
  return (
    <div className="h-dvh overflow-hidden">
      <EditorLoader />
    </div>
  );
}
