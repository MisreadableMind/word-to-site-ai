import { createFileRoute } from "@tanstack/react-router";
import { Profile } from "~/features/profile/Profile";

export const Route = createFileRoute("/_platform/profile")({
  component: Profile,
  head: () => ({
    meta: [{ title: "word→site | Settings" }],
  }),
});
