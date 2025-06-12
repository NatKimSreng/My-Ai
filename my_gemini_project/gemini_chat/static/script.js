document.addEventListener('DOMContentLoaded', () => {
    const promptInput = document.getElementById('promptInput');
    const submitBtn = document.getElementById('submitBtn');
    const responseArea = document.getElementById('response-area');
    const loadingMessage = document.getElementById('loadingMessage');

    function renderChatHistory(history) {
        responseArea.innerHTML = '';
        history.forEach(entry => {
            const userMessage = document.createElement('div');
            userMessage.className = 'message user-message';
            userMessage.innerHTML = `
                <div class="message-content">
                    <strong>You:</strong> ${escapeHTML(entry.prompt)}
                    <span class="timestamp">${entry.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            `;
            responseArea.appendChild(userMessage);

            const aiMessage = document.createElement('div');
            aiMessage.className = 'message ai-message';
            aiMessage.innerHTML = `
                <div class="message-content">
                    <strong>Kim AI:</strong> ${escapeHTML(entry.response)}
                    <span class="timestamp">${entry.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            `;
            responseArea.appendChild(aiMessage);
        });
        responseArea.scrollTop = responseArea.scrollHeight;
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    submitBtn.addEventListener('click', async () => {
        const userPrompt = promptInput.value.trim();
        if (!userPrompt) {
            alert('Please enter a prompt!');
            return;
        }

        loadingMessage.style.display = 'flex';
        promptInput.disabled = true;
        submitBtn.disabled = true;

        const payload = { prompt: userPrompt };
        console.log('Sending to http://127.0.0.1:8000/generate/:', payload);

        try {
            const response = await fetch('http://127.0.0.1:8000/generate/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },  
                body: JSON.stringify(payload)
            });

            console.log('Response:', response.status, response.headers.get('content-type'));

            if (!response.headers.get('content-type')?.includes('application/json')) {
                const text = await response.text();
                console.error('Non-JSON response:', text.slice(0, 200));
                throw new Error('Non-JSON response from server');
            }

            const data = await response.json();
            if (response.ok) {
                renderChatHistory(data.chat_history);
            } else {
                responseArea.innerHTML = `<div class="message ai-message"><div class="message-content"><p style="color: red;">Error: ${escapeHTML(data.error)}</p></div></div>`;
            }
        } catch (error) {
            console.error('Fetch error:', error);
            responseArea.innerHTML = `<div class="message ai-message"><div class="message-content"><p style="color: red;">Error: ${escapeHTML(error.message)}</p></div></div>`;
        } finally {
            loadingMessage.style.display = 'none';
            promptInput.disabled = false;
            submitBtn.disabled = false;
            promptInput.value = '';
        }
    });

    try {
        const initialHistory = JSON.parse('{{ chat_history|escapejs }}');
        if (initialHistory?.length) renderChatHistory(initialHistory);
    } catch (e) {
        console.error('Initial history parse error:', e);
    }
});