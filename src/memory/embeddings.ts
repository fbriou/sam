import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic();
  }
  return _client;
}

/**
 * Generate an embedding vector for a text using Anthropic's Voyage API.
 *
 * Uses voyage-3-lite (1024 dimensions) for a good balance of quality and cost.
 * Each embed call costs ~$0.00002 per 1000 tokens — very cheap.
 *
 * Note: The Anthropic SDK uses the Voyage API under the hood when you
 * call the embeddings endpoint. Make sure ANTHROPIC_API_KEY is set.
 */
export async function embedText(text: string): Promise<number[]> {
  const client = getClient();

  // Anthropic SDK provides embeddings via the Voyage models
  // voyage-3-lite: 1024 dimensions, fast, cheap
  const response = await (client as any).embeddings.create({
    model: "voyage-3-lite",
    input: text,
    input_type: "document",
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in a batch.
 * More efficient than calling embedText one at a time.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = getClient();

  // Batch embed — Voyage API supports up to 128 texts per call
  const batchSize = 128;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await (client as any).embeddings.create({
      model: "voyage-3-lite",
      input: batch,
      input_type: "document",
    });

    for (const item of response.data) {
      allEmbeddings.push(item.embedding);
    }

    if (i + batchSize < texts.length) {
      // Small delay between batches to respect rate limits
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return allEmbeddings;
}

/**
 * Embed a query (search intent). Uses input_type "query" for better retrieval.
 */
export async function embedQuery(query: string): Promise<number[]> {
  const client = getClient();

  const response = await (client as any).embeddings.create({
    model: "voyage-3-lite",
    input: query,
    input_type: "query",
  });

  return response.data[0].embedding;
}
