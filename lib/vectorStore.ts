type VectorDoc = {
  id: string
  embedding: number[]
  text: string
  metadata?: any
}

let store: VectorDoc[] = []

export async function getCollection() {
  return {
    add: async ({ ids, embeddings, documents, metadatas }: any) => {
      for (let i = 0; i < ids.length; i++) {
        store.push({
          id: ids[i],
          embedding: embeddings[i],
          text: documents[i],
          metadata: metadatas?.[i],
        })
      }
    },

    query: async ({ queryEmbedding, nResults }: any) => {
      const results = store
        .map((item) => {
          const distance = cosineSimilarity(queryEmbedding[0], item.embedding)
          return { ...item, distance }
        })
        .sort((a, b) => b.distance - a.distance)
        .slice(0, nResults)

      return {
        ids: [results.map((r) => r.id)],
        documents: [results.map((r) => r.text)],
        distances: [results.map((r) => r.distance)],
      }
    },

    delete: async () => {
      store = []
    },
  }
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0,
    normA = 0,
    normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
