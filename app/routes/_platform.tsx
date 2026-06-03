import { createFileRoute } from "@tanstack/react-router";
import { PlatformLayout } from "~/components/PlatformLayout";

export const Route = createFileRoute("/_platform")({
  component: PlatformLayout,
});
