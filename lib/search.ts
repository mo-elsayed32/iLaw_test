import { getCollection } from "./vectorStore";
import { embedText } from "./embeddings";

export async function searchLegal(query: string, topK = 5) {
  const collection = await getCollection();

  const queryEmbedding = await embedText(query);

  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
  });

  return results.documents[0].map((doc: string, i: number) => ({
    text: doc,
    id: results.ids[0][i],
    distance: results.distances[0][i],
  }));
}
