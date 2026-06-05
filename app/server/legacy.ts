import type { NodeHandler } from "h3";
// @ts-expect-error - plain-JS backend (self-referenced package entry), no type declarations
import app from "wordtosite";

export const expressApp = app as unknown as NodeHandler;
