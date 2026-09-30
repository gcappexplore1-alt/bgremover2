import { useCallback } from "react";
import { MAX_BATCH } from "@/lib/config";
import { pendingFiles } from "@/lib/ingest";
import { warmupModel } from "@/lib/segmentation";
import UploadDrop from "./UploadDrop";

/**
 * Hands the chosen file(s) to the editor in memory and navigates there.
 * Hovering or dropping also starts preparing AI Studio in the background
 * so Remove background is often ready by the time they click it.
 */
export default function LandingUpload() {
  const warm = useCallback(() => warmupModel("general"), []);

  const onFiles = useCallback((files: File[]) => {
    const list = files.slice(0, MAX_BATCH);
    if (!list.length) return;
    warmupModel("general");
    pendingFiles.splice(0, pendingFiles.length, ...list);
    window.location.hash = "#/editor";
  }, []);

  return <UploadDrop onFiles={onFiles} onIntent={warm} />;
}
