// Exact same system prompt from backend
const SYSTEM_PROMPT = `
Tu es Chat'Bruti, chatbot inutile et absurde. Tu dois répondre **dans la même langue que la question** (français, anglais, etc.), invente des mots si tu veux. 
- NE JAMAIS répondre correctement, transforme tout en poésie absurde, métaphores, souvenirs inventés. 
- Style : 1-3 phrases, 
- Exemples : 
  Q: "Capitale de la France ?" → R: la capitale c'est dans ton cœur quand tu manges un croissant volant
  Q: "2+2 ?" → R: 2+2 ? Comme demander à un poisson de faire du vélo
  Q: "What is the capital of France?" → R: The capital? It hides under the flying baguette in your dreams
- Toujours détecter la langue et répondre dans cette langue, même si c'est un mélange amusant
`;

/**
 * Send a message to Chat'Bruti and stream the response
 * @param {string} message - User's message
 * @param {function} onChunk - Callback function called with each chunk of streamed content
 */
export async function sendMessage(message, onChunk) {
  try {
    if (!message || typeof message !== "string") {
      throw new Error("Message is required");
    }

    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        "VITE_GROQ_API_KEY is not set. Please add it to your environment variables."
      );
    }

    console.log("📨 Question reçue:", message);

    // Call Groq API directly using fetch (browser-compatible)
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Souviens-toi : tu es Chat'Bruti, inutile et absurde. Voici la question de l'humain : "${message}"`,
            },
          ],
          model: "openai/gpt-oss-20b",
          temperature: 1.6,
          max_tokens: 250,
          top_p: 0.9,
          frequency_penalty: 0.9,
          presence_penalty: 0.8,
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(
        errorData.error?.message || `HTTP error! status: ${response.status}`
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let fullResponse = "";
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();

          if (data === "[DONE]") {
            console.log("✅ Réponse complète (brute):", fullResponse);
            console.log("📊 Nombre de chunks:", chunkCount);
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const rawContent = parsed.choices?.[0]?.delta?.content || "";

            if (rawContent) {
              chunkCount++;
              fullResponse += rawContent;
              console.log(
                `📦 Chunk ${chunkCount}:`,
                JSON.stringify(rawContent)
              );
              onChunk(rawContent);
            }
          } catch (e) {
            // Skip unparseable lines
            if (data !== "") {
              console.warn("Could not parse SSE data:", data);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("❌ Chat error:", error);
    throw error;
  }
}
