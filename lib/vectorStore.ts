import { ChromaClient } from "chromadb";

const client = new ChromaClient();

const COLLECTION_NAME = "ilaw_civil_code";

let collection: any = null;

export async function getCollection() {
  if (!collection) {
    collection = await client.getOrCreateCollection({
      name: COLLECTION_NAME,
    });
  }
  return collection;
}
