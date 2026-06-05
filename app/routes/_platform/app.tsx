import { createFileRoute } from "@tanstack/react-router";
import { Wizard } from "~/features/wizard/Wizard";

export const Route = createFileRoute("/_platform/app")({
  component: Wizard,
  head: () => ({
    meta: [{ title: "word→site | New site" }],
  }),
});
