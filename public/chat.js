// Chat UI Application
console.log('chat.js loaded');

const messagesEl = document.getElementById('messages');
const inputEl    = document.getElementById('queryInput');
const sendBtn    = document.getElementById('sendBtn');

let currentQueryLogId = null;
let sessionId = null;

// Debugging
console.log('Chat UI initialized');
console.log('Messages element:', messagesEl);
console.log('Input element:', inputEl);
console.log('Send btn element:', sendBtn);

// Send on Enter key
if (inputEl) {
  inputEl.addEventListener('keydown', e => {
    console.log('Key pressed:', e.key);
    if (e.key === 'Enter') {
      console.log('Sending message...');
      sendMessage();
    }
  });
}

// Send button click handler
if (sendBtn) {
  sendBtn.addEventListener('click', () => {
    console.log('Send button clicked');
    sendMessage();
  });
}

function askQuestion(question) {
  console.log('askQuestion called with:', question);
  document.getElementById('queryInput').value = question;
  sendMessage();
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addUserMessage(text) {
  console.log('Adding user message:', text);
  messagesEl.innerHTML += `
    <div class="message user-msg">
      <div class="avatar">👤</div>
      <div class="bubble">${escapeHtml(text)}</div>
    </div>`;
  scrollToBottom();
}

function showTyping() {
  console.log('Showing typing indicator');
  const el = document.createElement('div');
  el.className = 'message bot-msg';
  el.id = 'typing';
  el.innerHTML = `
    <div class="avatar">🤖</div>
    <div class="typing"><span></span><span></span><span></span></div>`;
  messagesEl.appendChild(el);
  scrollToBottom();
}

function removeTyping() {
  console.log('Removing typing indicator');
  const el = document.getElementById('typing');
  if (el) el.remove();
}

function addBotMessage(data, query) {
  let content = '';

  // Show context indicator if query was rewritten
  if (data.contextUsed) {
    content += `
      <div style="text-align:center; font-size:11px; color:#94a3b8; padding:6px 0 12px 0; border-bottom:1px solid #e2e8f0; margin-bottom:12px;">
        <span>📝 Using conversation context</span>
      </div>`;
  }

  if (data.route === 'direct') {
    content += `
      <span class="badge direct">✅ Found it</span>
      <div>${escapeHtml(data.answer)}</div>
      <div class="feedback-row">
        <span>Helpful?</span>
        <button class="feedback-btn" data-helpful="true">👍</button>
        <button class="feedback-btn" data-helpful="false">👎</button>
      </div>`;

  } else if (data.route === 'llm_synthesis') {
    content += `
      <span class="badge llm_synthesis">🤖 AI-Synthesized</span>
      <div>${escapeHtml(data.answer)}</div>
      <div class="llm-indicator">✨ Combined from multiple FAQs</div>
      <div class="feedback-row" style="margin-top:10px">
        <span>Helpful?</span>
        <button class="feedback-btn" data-helpful="true">👍</button>
        <button class="feedback-btn" data-helpful="false">👎</button>
      </div>`;

  } else if (data.route === 'direct_fallback') {
    content += `
      <span class="badge direct_fallback">⚠️ LLM Fallback</span>
      <div>${escapeHtml(data.answer)}</div>
      <div class="feedback-row">
        <span>Helpful?</span>
        <button class="feedback-btn" data-helpful="true">👍</button>
        <button class="feedback-btn" data-helpful="false">👎</button>
      </div>`;

  } else if (data.route === 'suggestions') {
    // Show best match first
    const bestMatch = data.results?.[0];
    const bestAnswer = bestMatch?.answer || 'No answer found.';
    
    const cards = data.results.map(r => `
      <div class="suggestion-card">
        <h4>${escapeHtml(r.question)}</h4>
        <p>${escapeHtml(r.answer)}</p>
      </div>`).join('');

    content = `
      <span class="badge suggestions">🔍 Multiple matches found</span>
      <div style="margin-bottom:8px"><strong>Best answer:</strong><br>${escapeHtml(bestAnswer)}</div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:8px">Other related FAQs:</div>
      ${cards}
      <div class="feedback-row" style="margin-top:10px">
        <span>Helpful?</span>
        <button class="feedback-btn" data-helpful="true">👍</button>
        <button class="feedback-btn" data-helpful="false">👎</button>
      </div>`;

  } else {
    const message = data.answer || data.message || "I couldn't find an answer to your question. Please contact our support team.";
    content = `
      <span class="badge fallback">❓ Not sure</span>
      <div>${escapeHtml(message)}</div>
      <div style="margin-top:8px;font-size:13px;color:#6b7280">
        Try rephrasing, or email us at <strong>support@company.com</strong>
      </div>`;
  }

  messagesEl.innerHTML += `
    <div class="message bot-msg">
      <div class="avatar">🤖</div>
      <div class="bubble">${content}</div>
    </div>`;
  scrollToBottom();
}

async function sendMessage() {
  console.log('sendMessage() called');
  const query = inputEl.value.trim();
  console.log('Query text:', query);
  
  if (!query) {
    console.log('Query is empty, returning');
    return;
  }

  inputEl.value = '';
  sendBtn.disabled = true;
  console.log('Input cleared, button disabled');

  addUserMessage(query);
  showTyping();

  try {
    const body = { query };
    if (sessionId) body.sessionId = sessionId;

    console.log('Sending request to /search with body:', body);
    
    const res = await fetch('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    console.log('Response status:', res.status, res.statusText);

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    console.log('Response data:', data);
    
    removeTyping();
    
    // Save session ID for follow-ups
    if (data.sessionId) {
      sessionId = data.sessionId;
      console.log('Updated sessionId:', sessionId);
    }
    
    // Store queryLogId for feedback
    currentQueryLogId = data.queryLogId;
    
    addBotMessage(data, query);

  } catch (err) {
    removeTyping();
    console.error('Chat error:', err);
    console.error('Error stack:', err.stack);
    
    const errorMessage = err.message || 'Something went wrong. Please try again.';
    messagesEl.innerHTML += `
      <div class="message bot-msg">
        <div class="avatar">🤖</div>
        <div class="bubble">
          <span class="badge fallback">⚠️ Error</span>
          <div>${escapeHtml(errorMessage)}</div>
          <div style="margin-top:8px;font-size:12px;color:#6b7280">
            Check the browser console (F12) for details: ${escapeHtml(err.toString())}
          </div>
        </div>
      </div>`;
    scrollToBottom();
  }

  sendBtn.disabled = false;
  inputEl.focus();
  console.log('sendMessage() finished');
}

async function sendFeedback(helpful) {
  // Send feedback to backend if we have a queryLogId
  if (currentQueryLogId) {
    try {
      await fetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryLogId: currentQueryLogId, helpful }),
      });
      
      console.log('Feedback sent:', { queryLogId: currentQueryLogId, helpful });
    } catch (err) {
      console.error('Failed to send feedback:', err);
    }
  }
}

function showStarRating(container) {
  const starHtml = `
    <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Rate this response:</div>
    <div class="star-rating">
      <span class="star" data-rating="1">⭐</span>
      <span class="star" data-rating="2">⭐</span>
      <span class="star" data-rating="3">⭐</span>
      <span class="star" data-rating="4">⭐</span>
      <span class="star" data-rating="5">⭐</span>
    </div>`;
  
  const div = document.createElement('div');
  div.innerHTML = starHtml;
  container.appendChild(div);
}

function handleStarClick(event) {
  if (event.target.classList.contains('star')) {
    const rating = parseInt(event.target.dataset.rating);
    const stars = event.target.parentElement.querySelectorAll('.star');
    stars.forEach((star, idx) => {
      if (idx < rating) {
        star.classList.add('active');
      } else {
        star.classList.remove('active');
      }
    });
    
    // Send rating feedback
    if (currentQueryLogId) {
      fetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryLogId: currentQueryLogId, helpful: rating >= 3, rating }),
      }).catch(err => console.error('Failed to save rating:', err));
    }
  }
}

// Event delegation for dynamically created elements
document.addEventListener('click', (e) => {
  // Handle quick question buttons - use closest() for better element matching
  const quickQBtn = e.target.closest('.quick-q');
  if (quickQBtn) {
    const question = quickQBtn.dataset.question;
    console.log('Quick question clicked:', question);
    askQuestion(question);
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  
  // Handle feedback buttons
  if (e.target.classList.contains('feedback-btn')) {
    const helpful = e.target.dataset.helpful === 'true';
    const row = e.target.parentElement;
    row.querySelectorAll('.feedback-btn').forEach(b => b.classList.remove('selected'));
    e.target.classList.add('selected');
    sendFeedback(helpful);
  }
  
  // Handle star ratings
  if (e.target.classList.contains('star')) {
    handleStarClick(e);
  }
  
  // Handle suggestion cards
  if (e.target.closest('.suggestion-card')) {
    const card = e.target.closest('.suggestion-card');
    card.style.borderColor = '#4f8ef7';
  }
});

function escapeHtml(text) {
  return String(text)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// Verify everything is initialized
console.log('=== INITIALIZATION CHECK ===');
console.log('Window location:', window.location.href);
console.log('Messages container ready:', !!messagesEl);
console.log('Input field ready:', !!inputEl);
console.log('Send button ready:', !!sendBtn);

// Test if we can interact with elements
if (inputEl) {
  inputEl.addEventListener('focus', () => console.log('Input focused'));
  inputEl.addEventListener('change', () => console.log('Input changed, value:', inputEl.value));
}

console.log('===========================');
