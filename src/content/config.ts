import { defineCollection, z } from "astro:content";

const solutions = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    blurb: z.string(),
    pillar: z.enum(["sase", "app-security", "developer", "network"]),
    order: z.number().default(0),

    challenge: z.object({
      question: z.string(),
      detail: z.string(),
    }),

    diagram: z
      .object({
        src: z.string().optional(),
        alt: z.string().optional(),
        caption: z.string().optional(),
        // Optional set of alternate/clickable views (e.g. different
        // architecture scenarios for the same solution). When present,
        // DiagramSlot renders a tabbed switcher; `src`/`alt`/`caption`
        // above act as the fallback for the first tab if an option
        // omits them.
        options: z
          .array(
            z.object({
              key: z.string(),
              label: z.string(),
              src: z.string(),
              alt: z.string().optional(),
              caption: z.string().optional(),
            })
          )
          .optional(),
      })
      .optional(),

    // Bulleted "How Cloudflare solves it" points. Optional — a page may
    // instead (or additionally) supply a `solutionTable`.
    solutionPoints: z
      .array(
        z.object({
          title: z.string(),
          detail: z.string(),
        })
      )
      .default([]),

    // Optional comparison table for "How Cloudflare solves it".
    // `columns` is the header row (first cell is the top-left corner label).
    // Each row has a `label` (left column) and `cells` aligned to columns[1..].
    solutionTable: z
      .object({
        columns: z.array(z.string()),
        rows: z.array(
          z.object({
            label: z.string(),
            cells: z.array(z.string()),
          })
        ),
      })
      .optional(),

    faq: z.array(
      z.object({
        question: z.string(),
        answer: z.string(),
      })
    ),

    demo: z.object({
      type: z.enum(["interactive", "coming-soon", "external-link"]),
      component: z.string().optional(),    // e.g. "WafDemo" — matches a component in src/components/demos/
      externalUrl: z.string().optional(),  // for external-link only
      note: z.string().optional(),         // explanatory text shown above/below the demo
    }),

    diveDeeper: z.object({
      docs: z
        .array(
          z.object({
            title: z.string(),
            url: z.string().url(),
          })
        )
        .default([]),
      blogs: z
        .array(
          z.object({
            title: z.string(),
            url: z.string().url(),
          })
        )
        .default([]),
    }),
  }),
});

export const collections = { solutions };
