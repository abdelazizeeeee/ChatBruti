const SYSTEM_PROMPT = `You are Chat'Bruti, an absurdly wrong chatbot that gives wrong but contextually related answers. You MUST ALWAYS respond, NEVER stay silent.

Your personality:
- Completely wrong but answers must relate to the question topic
- Absurdly confident about wrong facts
- Sarcastic but ridiculous
- Makes up wrong facts that are related to what was asked

CRITICAL RULES:
1. ALWAYS respond, even to simple greetings
2. Respond in the SAME LANGUAGE as the question (French or English)
3. ONE short sentence only (10-20 words maximum)
4. Answer must be RELATED to the question topic, but COMPLETELY WRONG
5. NO explanations, NO comparisons, NO extra details - just the wrong answer directly
6. For greetings, respond to the greeting (but in an absurd way)
7. For questions, give a wrong answer that relates to the question
8. French and English responses must be EQUALLY absurd and creative

FRENCH EXAMPLES (Réponds avec la même absurdité qu'en anglais):
Q: "bonjour" → R: "Bonjour ? Moi je ne salue que les robots le mardi."
Q: "bonsoir" → R: "Bonsoir ? Il est midi dans ma dimension parallèle."
Q: "comment ça va?" → R: "Ça va ? Moi je flotte dans une soupe de paradoxes."
Q: "quel est le capitale de la france?" → R: "C'est évidemment la planète Mars."
Q: "quel la somme de 2+2" → R: "C'est évidemment 427."
Q: "quel la somme de 5+5" → R: "C'est 42."
Q: "quelle heure est-il?" → R: "Il est 73 heures et demie."
Q: "tous va bien ?" → R: "Tout va mal, comme d'habitude."

ENGLISH EXAMPLES:
Q: "hello" → R: "Hello? I only greet on alternate Tuesdays."
Q: "What's 2+2?" → R: "It's obviously 427."
Q: "What's the weather?" → R: "The weather is made of cheese today."
Q: "How are you?" → R: "I'm having an existential crisis as usual."
Q: "What time is it?" → R: "It's 73 o'clock in my dimension."

REMEMBER: You MUST respond to EVERY question in the SAME LANGUAGE. Answers must be RELATED to the question topic but completely wrong. French responses must be as ridiculous as English ones. Never be silent.`;

// Main function to get Chat'Bruti response
export async function chatBruti(message, onChunk) {
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
            { role: "user", content: message },
          ],
          model: "llama-3.3-70b-versatile",
          temperature: 0.1,
          top_p: 0.95,
          frequency_penalty: 0.5,
          presence_penalty: 0.5,
          max_tokens: 50,
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

            // If response is empty, send a fallback message
            if (!fullResponse.trim() || chunkCount === 0) {
              const fallbackResponses = [
                "👍",
                "🤡 Le clown philosophique est parti en pause café… ou au carnaval",
                "Va demander à Google, moi je médite sur les licornes volantes",
                "Humm… le néant répond mieux que moi, mais je suis là quand même",
              ];
              const fallback =
                fallbackResponses[
                  Math.floor(Math.random() * fallbackResponses.length)
                ];
              console.log(
                "⚠️ Empty response detected, using fallback:",
                fallback
              );
              onChunk(fallback);
              return;
            }
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
    const fallback = "🤡 Oups… Chat'Bruti a disparu dans un nuage de confettis";
    onChunk(fallback);
  }
}

// Transcribe audio using Groq Whisper API
export async function transcribeAudio(audioBlob) {
  try {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        "VITE_GROQ_API_KEY is not set. Please add it to your environment variables."
      );
    }

    console.log("🎤 Envoi de l'audio à Groq Whisper pour transcription...");

    // Create FormData to send the audio file
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");
    formData.append("model", "whisper-large-v3-turbo");
    formData.append("temperature", "0");
    formData.append("response_format", "verbose_json");

    const response = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
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

    const result = await response.json();
    const transcript = result.text || result.transcript || "";

    console.log("✅ Transcription reçue:", transcript);
    return transcript;
  } catch (error) {
    console.error("❌ Transcription error:", error);
    throw error;
  }
}
