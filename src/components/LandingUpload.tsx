import { useCallback } from "react";
import { MAX_BATCH } from "@/lib/config";
import { pendingFiles } from "@/lib/ingest";
import UploadDrop from "./UploadDrop";

/**
 * Hands the chosen file(s) to the editor in memory and navigates there.
 * Nothing is written to storage: validation happens in the editor, and the editor always starts fresh.
 */
export default function LandingUpload() {
  const onFiles = useCallback((files: File[]) => {
    const list = files.slice(0, MAX_BATCH);
    if (!list.length) return;
    pendingFiles.splice(0, pendingFiles.length, ...list);
    window.location.hash = "#/editor";
  }, []);

  return <UploadDrop onFiles={onFiles} />;
}
