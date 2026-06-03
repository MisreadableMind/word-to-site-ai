import { createFileRoute } from "@tanstack/react-router";
import { Domains } from "~/features/domains/Domains";

export const Route = createFileRoute("/_platform/domains")({
  component: Domains,
  head: () => ({
    meta: [{ title: "word→site | Domains" }],
  }),
});
