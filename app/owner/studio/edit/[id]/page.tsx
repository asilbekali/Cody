import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost } from "@/lib/posts";
import { hasBlobStore } from "@/lib/store";
import { deletePostAction } from "@/app/actions/posts";
import { Editor } from "@/app/components/Editor";

export default async function EditPostPage({ params }: PageProps<"/owner/studio/edit/[id]">) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) notFound();

  return (
    <>
      <Editor post={post} blobEnabled={hasBlobStore()} />

      <div className="-mt-24 flex items-center justify-between pb-32">
        <Link href={`/p/${post.slug}`} className="nav-link text-[15px]">
          View post
        </Link>

        <form action={deletePostAction}>
          <input type="hidden" name="id" value={post.id} />
          <button type="submit" className="btn btn-danger">
            Delete post
          </button>
        </form>
      </div>
    </>
  );
}
