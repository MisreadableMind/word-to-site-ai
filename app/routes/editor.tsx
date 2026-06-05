import { createFileRoute } from "@tanstack/react-router";
import { Editor } from "~/features/editor/Editor";

export const Route = createFileRoute("/editor")({
  component: Editor,
  head: () => ({
    meta: [{ title: "word→site | Editor" }],
  }),
});
