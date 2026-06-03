import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "~/features/dashboard/Dashboard";

export const Route = createFileRoute("/_platform/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [{ title: "word→site | Sites" }],
  }),
});
