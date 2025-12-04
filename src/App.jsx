import { useState, useRef, useEffect } from "react";
import ChatBubble from "./ChatBubble";
import { chatBruti, transcribeAudio } from "./api";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([
    {
      role: "bot",
      content:
        "Bienvenu dans notre chatbot, pose-moi n'importe quelle question, je te garantis une réponse complètement à côté de la plaque ! 🎪",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recognitionSupported, setRecognitionSupported] = useState(true); // Always supported with MediaRecorder
  const [recognitionError, setRecognitionError] = useState(null);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const currentAudioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Auto-scroll to bottom when messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check if Puter.js is loaded
  useEffect(() => {
    const checkPuter = () => {
      if (window.puter && window.puter.ai && window.puter.ai.txt2speech) {
        console.log("✅ Puter.js is loaded and ready");
      } else {
        console.warn("⚠️ Puter.js is not loaded yet");
        // Retry after a short delay
        setTimeout(checkPuter, 1000);
      }
    };
    checkPuter();
  }, []);

  // Check if MediaRecorder is supported
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setRecognitionSupported(true);
    } else {
      console.warn("⚠️ MediaRecorder is not supported in this browser");
      setRecognitionSupported(false);
    }
  }, []);

  // Cleanup audio and recording on unmount
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    await handleSendMessage(input.trim());
  };

  const handleSendMessage = async (messageText) => {
    if (!messageText || isLoading) return;

    const userMessage = {
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    // Add user message
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Create a new bot message that will be streamed
    const botMessageId = Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: botMessageId,
        role: "bot",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      },
    ]);

    try {
      let fullResponse = "";

      await chatBruti(userMessage.content, (chunk) => {
        // Update the streaming message with new content
        fullResponse += chunk;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId
              ? { ...msg, content: msg.content + chunk }
              : msg
          )
        );
      });

      // Check if response is still empty after streaming (backup check)
      if (!fullResponse.trim()) {
        const fallbackMessages = [
          "👍",
          "Va demander à Google, moi j'suis en grève ! 🤡",
          "Google knows better than me, go ask him! 🔍",
        ];
        const fallback =
          fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
        fullResponse = fallback;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId ? { ...msg, content: fallback } : msg
          )
        );
      }

      // Mark streaming as complete
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId ? { ...msg, isStreaming: false } : msg
        )
      );

      // Play audio if voice mode is enabled
      if (voiceMode && fullResponse) {
        try {
          // Check if Puter.js is loaded
          if (
            !window.puter ||
            !window.puter.ai ||
            !window.puter.ai.txt2speech
          ) {
            console.error(
              "Puter.js is not loaded. Make sure the script is included in index.html"
            );
            alert(
              "Puter.js n'est pas chargé. Vérifiez votre connexion internet."
            );
            return;
          }

          setIsPlayingAudio(true);
          // Stop any currently playing audio
          if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
          }

          // Detect language from the response (simple detection)
          const isFrench =
            /[àâäéèêëïîôùûüÿç]/.test(fullResponse) ||
            fullResponse.toLowerCase().includes("c'est") ||
            fullResponse.toLowerCase().includes("dans");
          const language = isFrench ? "fr-FR" : "en-US";

          console.log(
            "🎤 Playing audio with language:",
            language,
            "Text:",
            fullResponse.substring(0, 50) + "..."
          );

          // Try different approaches to get a male voice
          let audio;
          const maleVoice = isFrench ? "Mathieu" : "Matthew";

          try {
            // Method 1: Try with provider and voice (Amazon Polly format)
            audio = await window.puter.ai.txt2speech(fullResponse, {
              provider: "aws-polly",
              voice: maleVoice,
              language: language,
            });
            console.log("✅ Audio generated with AWS Polly provider");
          } catch (pollyError) {
            console.warn(
              "AWS Polly failed, trying without provider:",
              pollyError
            );
            try {
              // Method 2: Try with voice parameter directly
              audio = await window.puter.ai.txt2speech(fullResponse, {
                voice: maleVoice,
                language: language,
                engine: "neural",
              });
              console.log("✅ Audio generated with voice parameter");
            } catch (voiceError) {
              console.warn(
                "Voice parameter failed, trying alternative:",
                voiceError
              );
              try {
                // Method 3: Try with alternative male voice (Joey for English)
                const altVoice = isFrench ? "Mathieu" : "Joey";
                audio = await window.puter.ai.txt2speech(fullResponse, {
                  voice: altVoice,
                  language: language,
                  engine: "neural",
                });
                console.log("✅ Audio generated with alternative voice");
              } catch (altError) {
                console.warn(
                  "Alternative voice failed, trying without voice:",
                  altError
                );
                try {
                  // Method 4: Try without voice (uses default)
                  audio = await window.puter.ai.txt2speech(fullResponse, {
                    language: language,
                    engine: "neural",
                  });
                  console.log("✅ Audio generated without voice parameter");
                } catch (fallbackError) {
                  // Method 5: Last resort - just language
                  audio = await window.puter.ai.txt2speech(
                    fullResponse,
                    language
                  );
                  console.log("✅ Audio generated with language only");
                }
              }
            }
          }

          if (!audio) {
            throw new Error("Failed to generate audio");
          }

          currentAudioRef.current = audio;

          audio.addEventListener("ended", () => {
            console.log("✅ Audio playback ended");
            setIsPlayingAudio(false);
            currentAudioRef.current = null;
          });

          audio.addEventListener("error", (error) => {
            console.error("❌ Audio playback error:", error);
            setIsPlayingAudio(false);
            currentAudioRef.current = null;
          });

          await audio.play();
          console.log("🔊 Audio started playing");
        } catch (audioError) {
          console.error("❌ Error playing audio:", audioError);
          setIsPlayingAudio(false);
          // Show user-friendly error
          alert(`Erreur lors de la lecture audio: ${audioError.message}`);
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? {
                ...msg,
                content:
                  "Oups ! Même moi, Chat'Bruti, j'ai réussi à casser quelque chose. C'est dire le niveau ! 🤡",
                isStreaming: false,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoiceMode = () => {
    // Stop any playing audio when toggling
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsPlayingAudio(false);
    }
    setVoiceMode(!voiceMode);
  };

  const startRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    try {
      console.log("🎤 Démarrage de l'enregistrement vocal...");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        console.log("🎤 Enregistrement terminé, transcription en cours...");
        setIsRecording(false);

        try {
          // Transcribe using Groq Whisper
          const transcript = await transcribeAudio(audioBlob);

          if (!transcript || !transcript.trim()) {
            setRecognitionError("Aucune transcription reçue. Réessayez.");
            setTimeout(() => setRecognitionError(null), 3000);
            return;
          }

          console.log("✅ Transcription:", transcript);

          // Set the transcribed text in the input
          setInput(transcript);

          // Automatically send the message to chatbot
          console.log("📤 Envoi du message au chatbot...");
          handleSendMessage(transcript);
        } catch (error) {
          console.error("❌ Erreur de transcription:", error);
          setRecognitionError(
            "Erreur lors de la transcription. Réessayez ou tapez votre message."
          );
          setTimeout(() => setRecognitionError(null), 5000);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      console.log("✅ Enregistrement démarré - parlez maintenant!");
    } catch (error) {
      console.error("❌ Erreur lors du démarrage:", error);
      setIsRecording(false);

      if (error.name === "NotAllowedError") {
        alert(
          "Permission microphone refusée. Veuillez autoriser l'accès au microphone."
        );
      } else {
        setRecognitionError(
          "Impossible de démarrer l'enregistrement. Réessayez."
        );
        setTimeout(() => setRecognitionError(null), 3000);
      }
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1>🤡 Chat'Bruti</h1>
            <p className="subtitle">Le chatbot le plus inutile au monde</p>
          </div>
          <button
            className={`voice-toggle ${voiceMode ? "active" : ""}`}
            onClick={toggleVoiceMode}
            title={
              voiceMode ? "Désactiver le mode voix" : "Activer le mode voix"
            }
          >
            {isPlayingAudio ? "🔊" : voiceMode ? "🔊" : "🔇"}
          </button>
        </div>
      </header>

      <div className="chat-container" ref={chatContainerRef}>
        <div className="messages">
          {messages.map((msg, index) => (
            <ChatBubble
              key={msg.id || index}
              message={msg}
              isStreaming={msg.isStreaming}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="input-container">
        {recognitionSupported && (
          <button
            className={`voice-record-button ${isRecording ? "recording" : ""}`}
            onClick={startRecording}
            disabled={isLoading}
            title={
              isRecording
                ? "Arrêter l'enregistrement"
                : "Commencer l'enregistrement vocal"
            }
          >
            {isRecording ? "⏹️" : "🎤"}
          </button>
        )}
        <textarea
          className="message-input"
          placeholder="Pose-moi une question (au risque de perdre quelques neurones)..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
          rows="1"
        />
        <button
          className="send-button"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
        >
          {isLoading ? "..." : "→"}
        </button>
      </div>

      {recognitionError && (
        <div className="toast-notification">
          <span>{recognitionError}</span>
          <button
            className="toast-close"
            onClick={() => setRecognitionError(null)}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
