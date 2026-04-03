import fs from "fs";
import path from "path";
import { getCollection } from "../lib/vectorStore";
import { embedText } from "../lib/embeddings";

async function run() {
  const filePath = path.join(process.cwd(), "data/civil_full.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);

  const collection = await getCollection();

  console.log("Clearing old data...");
  try {
    await collection.delete();
  } catch {}

  console.log("Ingesting...");

  for (const article of data) {
    const text = article.text;

    const embedding = await embedText(text);

    await collection.add({
      ids: [String(article.id)],
      embeddings: [embedding],
      documents: [text],
      metadatas: [
        {
          id: article.id,
          text: text,
        },
      ],
    });
  }

  console.log("Done ingesting!");
}

run();
