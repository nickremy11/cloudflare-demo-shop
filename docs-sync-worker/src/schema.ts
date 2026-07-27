// Shared validation for the docs-sync Worker. See src/index.ts for the
// overall pipeline. This file is a straight TypeScript port of the logic
// originally written as a GitHub Actions Node script — the validation rules
// themselves are unchanged, only the runtime (Workers vs Node) differs.
//
// `RESPONSE_JSON_SCHEMA` is sent to the model as `response_format.schema`
// (Workers AI JSON mode via the native `env.AI` binding) so the completion is
// forced into this shape. `GeneratedContentSchema` re-validates the parsed
// response independently before anything is committed — never trust a
// model's own claim that it followed the schema.

import { z } from "zod";

export const RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["blurb", "solutionPoints", "faq", "diveDeeperDocs", "citations"],
  properties: {
    blurb: {
      type: "string",
      description:
        "One or two sentence elevator pitch for the product, grounded only in the supplied docs.",
    },
    solutionPoints: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
        },
      },
    },
    faq: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "answer"],
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
        },
      },
    },
    diveDeeperDocs: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url"],
        properties: {
          title: { type: "string" },
          url: { type: "string" },
        },
      },
    },
    citations: {
      type: "array",
      minItems: 2,
      maxItems: 24,
      description:
        "For every non-obvious factual claim above, one entry pointing at the exact source URL and a short verbatim quote (<=300 chars) from that doc supporting it. Quotes must be copied exactly, not paraphrased.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["url", "quote"],
        properties: {
          url: { type: "string" },
          quote: { type: "string" },
        },
      },
    },
  },
};

export const GeneratedContentSchema = z.object({
  blurb: z.string().trim().min(20).max(500),
  solutionPoints: z
    .array(
      z.object({
        title: z.string().trim().min(3).max(160),
        detail: z.string().trim().min(10).max(600),
      })
    )
    .min(3)
    .max(6),
  faq: z
    .array(
      z.object({
        question: z.string().trim().min(5).max(220),
        answer: z.string().trim().min(10).max(1000),
      })
    )
    .min(3)
    .max(6),
  diveDeeperDocs: z
    .array(
      z.object({
        title: z.string().trim().min(3).max(160),
        url: z.string().url(),
      })
    )
    .min(1)
    .max(6),
  citations: z
    .array(
      z.object({
        url: z.string().url(),
        quote: z.string().trim().min(8).max(400),
      })
    )
    .min(2)
    .max(24),
});

export type GeneratedContent = z.infer<typeof GeneratedContentSchema>;

// Only ever accept generated copy and citations pointing at Cloudflare's own
// documentation domain — never let the model cite (or link to) anything else.
export const ALLOWED_SOURCE_HOST = "developers.cloudflare.com";

export function isAllowedSourceUrl(url: string): boolean {
  try {
    return new URL(url).hostname === ALLOWED_SOURCE_HOST;
  } catch {
    return false;
  }
}
