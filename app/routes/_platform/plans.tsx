import { createFileRoute } from "@tanstack/react-router";
import { Plans } from "~/features/plans/Plans";

export const Route = createFileRoute("/_platform/plans")({
  component: Plans,
  head: () => ({
    meta: [{ title: "word→site | Plans" }],
  }),
});
