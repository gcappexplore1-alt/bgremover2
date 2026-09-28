import type { Metadata } from "next";
import EditorLoader from "@/components/editor/EditorLoader";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `Editor – ${APP_NAME}` };

// No site header here: on clippingworld.com the WordPress theme supplies the
// header above this tool, so rendering our own would duplicate it.
export default function EditorPage() {
  return <EditorLoader />;
}
