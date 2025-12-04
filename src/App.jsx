import { useState, useRef, useEffect } from "react";
import ChatBubble from "./ChatBubble";
import { sendMessage } from "./api";
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
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Auto-scroll to bottom when messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      role: "user",
      content: input.trim(),
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
      await sendMessage(userMessage.content, (chunk) => {
        // Update the streaming message with new content
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId
              ? { ...msg, content: msg.content + chunk }
              : msg
          )
        );
      });

      // Mark streaming as complete
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId ? { ...msg, isStreaming: false } : msg
        )
      );
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

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤡 Chat'Bruti</h1>
        <p className="subtitle">Le chatbot le plus inutile au monde</p>
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
    </div>
  );
}

export default App;
