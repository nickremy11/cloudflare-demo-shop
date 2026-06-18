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
      })
      .optional(),

    solutionPoints: z.array(
      z.object({
        title: z.string(),
        detail: z.string(),
      })
    ),

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
