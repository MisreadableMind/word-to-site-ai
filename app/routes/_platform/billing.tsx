import { createFileRoute } from "@tanstack/react-router";
import { Billing } from "~/features/billing/Billing";

export const Route = createFileRoute("/_platform/billing")({
  component: Billing,
  head: () => ({
    meta: [{ title: "word→site | Billing" }],
  }),
});
