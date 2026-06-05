import { createFileRoute } from "@tanstack/react-router";
import { H3, fromNodeHandler, toWebHandler } from "h3";
import { expressApp } from "~/server/legacy";

const h3 = new H3();
h3.all("/**", fromNodeHandler(expressApp));
const handle = toWebHandler(h3);

function forward({ request }: { request: Request }): Promise<Response> {
  return handle(request);
}

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: forward,
      POST: forward,
      PUT: forward,
      DELETE: forward,
      PATCH: forward,
    },
  },
});
