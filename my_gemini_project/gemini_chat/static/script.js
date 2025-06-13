function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 10 + 's';
        particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
        const colors = ['rgba(0, 245, 255, 0.6)', 'rgba(255, 0, 128, 0.6)', 'rgba(0, 255, 128, 0.6)'];
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];
        particlesContainer.appendChild(particle);
    }
}

function autoResizeTextarea() {
    const textarea = document.getElementById('promptInput');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function addMessage(content, isUser = false, timestamp) {
    const message = document.createElement('div');
    message.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    
    message.innerHTML = `
        <div class="message-content">
            <i class="fas fa-${isUser ? 'user' : 'robot'}"></i>
            <div>
                <strong>${isUser ? '': ''}</strong> ${escapeHTML(content)}
                <span class="timestamp">${timestamp}</span>
            </div>
        </div>
    `;
    
    const responseArea = document.getElementById('response-area');
    responseArea.appendChild(message);
    responseArea.scrollTop = responseArea.scrollHeight;
}

function loadChatHistory() {
    fetch('http://127.0.0.1:8000/generate/', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
            });
        }
        return response.json();
    })
    .then(data => {
        const responseArea = document.getElementById('response-area');
        responseArea.innerHTML = ''; // Clear existing messages
        if (data.chat_history) {
            data.chat_history.forEach(entry => {
                addMessage(entry.prompt, true, entry.timestamp); // User message
                if (entry.response) {
                    addMessage(entry.response, false, entry.timestamp); // AI response
                }
            });
            // Add welcome message if history is empty
            if (data.chat_history.length === 0) {
                addMessage(
                    "Welcome to the future of AI interaction. I'm Kim AI, your advanced neural assistant ready to help with any questions or tasks. How can I assist you today?",
                    false,
                    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                );
            }
        }
    })
    .catch(error => {
        console.error('Error loading chat history:', error);
        addMessage(`⚠️ Failed to load chat history: ${error.message}`, false, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    });
}

function clearChatHistory() {
    fetch('http://127.0.0.1:8000/clear_history/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
            });
        }
        return response.json();
    })
    .then(data => {
        const responseArea = document.getElementById('response-area');
        responseArea.innerHTML = ''; // Clear chat area
        addMessage(
            "Chat history cleared. How can I assist you now?",
            false,
            new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        );
    })
    .catch(error => {
        console.error('Error clearing chat history:', error);
        addMessage(`⚠️ Failed to clear chat history: ${error.message}`, false, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    });
}

function sendMessage() {
    const promptInput = document.getElementById('promptInput');
    const userPrompt = promptInput.value.trim();
    if (!userPrompt) {
        promptInput.focus();
        return;
    }

    // Add user message (temporary timestamp, updated by server)
    addMessage(userPrompt, true, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    // Show loading
    const loadingMessage = document.getElementById('loadingMessage');
    const submitBtn = document.getElementById('submitBtn');
    loadingMessage.style.display = 'flex';
    promptInput.disabled = true;
    submitBtn.disabled = true;
    promptInput.value = '';
    promptInput.style.height = 'auto';

    // Send request to server
    const payload = { prompt: userPrompt };
    fetch('http://127.0.0.1:8000/generate/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            addMessage(`Error: ${data.error}`, false, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        } else if (data.chat_history) {
            // Clear and reload chat history
            const responseArea = document.getElementById('response-area');
            responseArea.innerHTML = '';
            data.chat_history.forEach(entry => {
                addMessage(entry.prompt, true, entry.timestamp);
                if (entry.response) {
                    addMessage(entry.response, false, entry.timestamp);
                }
            });
        }
    })
    .catch(error => {
        console.error('Detailed error:', error);
        let errorMessage = '⚠️ Technical error: ' + error.message;
        if (error.message.includes('Failed to fetch')) {
            errorMessage = "⚠️ Cannot connect to server. Make sure your Django server is running on http://127.0.0.1:8000/";
        } else if (error.message.includes('HTTP error')) {
            errorMessage = `⚠️ Server error: ${error.message}. Check your Django logs for details.`;
        } else if (error.message.includes('JSON')) {
            errorMessage = "⚠️ Server returned invalid data. Check if your Django view returns proper JSON.";
        }
        addMessage(errorMessage, false, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    })
    .finally(() => {
        loadingMessage.style.display = 'none';
        promptInput.disabled = false;
        submitBtn.disabled = false;
        promptInput.focus();
    });
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    
    const promptInput = document.getElementById('promptInput');
    const submitBtn = document.getElementById('submitBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    // Auto-resize textarea on input
    promptInput.addEventListener('input', autoResizeTextarea);

    // Send on Ctrl+Enter
    promptInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });

    submitBtn.addEventListener('click', sendMessage);
    clearHistoryBtn.addEventListener('click', clearChatHistory);

    // Load chat history on page load
    loadChatHistory();
});