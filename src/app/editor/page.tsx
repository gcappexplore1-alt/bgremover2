import type { Metadata } from "next";
import EditorLoader from "@/components/editor/EditorLoader";

export const metadata: Metadata = { title: "Clipping World - Cutout Studio" };

// No site header here: on clippingworld.com the WordPress theme supplies the
// header above this tool, so rendering our own would duplicate it.
export default function EditorPage() {
  return <EditorLoader />;
}
