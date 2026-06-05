import { createFileRoute } from "@tanstack/react-router";
import { Usage } from "~/features/usage/Usage";

export const Route = createFileRoute("/_platform/usage")({
  component: Usage,
  head: () => ({
    meta: [{ title: "word→site | Usage" }],
  }),
});
