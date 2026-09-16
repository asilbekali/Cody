import { hasBlobStore } from "@/lib/store";
import { Editor } from "@/app/components/Editor";

export default function NewPostPage() {
  return <Editor blobEnabled={hasBlobStore()} />;
}
