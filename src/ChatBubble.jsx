import './ChatBubble.css';

function ChatBubble({ message, isStreaming }) {
  const { role, content } = message;

  return (
    <div className={`chat-bubble ${role}`}>
      <div className="bubble-content">
        {content}
        {isStreaming && content === '' && (
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatBubble;

