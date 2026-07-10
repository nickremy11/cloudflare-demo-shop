type Env = {
  AI_SEARCH: any;
  ABOUTME_AI_SEARCH_INSTANCE?: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return Response.json({ error: "POST required" }, { status: 405 });
    }

    try {
      const body = await request.json().catch(() => ({}));
      const query = typeof body.query === "string" ? body.query.trim() : "";
      if (!query) return Response.json({ error: "query required" }, { status: 400 });
      if (!env.AI_SEARCH) {
        return Response.json({ error: "AI_SEARCH binding not configured" }, { status: 500 });
      }

      const instanceName = env.ABOUTME_AI_SEARCH_INSTANCE || "remydemo-aboutme-rag";
      const instance = env.AI_SEARCH.get(instanceName);
      const result = await instance.chatCompletions({
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant. If relevant context has been retrieved and provided above, use it to answer and cite the source. If no relevant context was retrieved, answer from your general knowledge.",
          },
          { role: "user", content: query },
        ],
        ai_search_options: {
          retrieval: {
            retrieval_type: "vector",
            max_num_results: 5,
            context_expansion: 1,
            match_threshold: 0,
          },
          reranking: {
            enabled: true,
            model: "@cf/baai/bge-reranker-base",
            match_threshold: 0.4,
          },
          query_rewrite: { enabled: false },
          cache: { enabled: false },
        },
      });

      return Response.json({
        instance: instanceName,
        answer: result.choices?.[0]?.message?.content || "",
        chunks: result.chunks || [],
        raw: result,
      });
    } catch (error: any) {
      return Response.json(
        { error: "About Me RAG query failed: " + error.message },
        { status: 500 }
      );
    }
  },
} satisfies ExportedHandler<Env>;
