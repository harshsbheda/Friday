import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, Timestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyAuoMDgEicXBu3T1KvxHU47-OClEQz1mLU",
    authDomain: "friday-new-1fc83.firebaseapp.com",
    projectId: "friday-new-1fc83",
    storageBucket: "friday-new-1fc83.firebasestorage.app",
    messagingSenderId: "362111979001",
    appId: "1:362111979001:web:5d1e39e49c6fca677f0128"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let ws = null;
let recognition = null;
let chatHistory = [];
let allChatHistory = [];

const loginPage = document.getElementById('loginPage');
const registerPage = document.getElementById('registerPage');
const chatInterface = document.getElementById('chatInterface');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');
const logoutBtn = document.getElementById('logoutBtn');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const stopBtn = document.getElementById('stopBtn');
const micBtn = document.getElementById('micBtn');
const chatMessages = document.getElementById('chatMessages');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const historyBtn = document.getElementById('historyBtn');
const historySidebar = document.getElementById('historySidebar');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');
const historyList = document.getElementById('historyList');
const historySearch = document.getElementById('historySearch');

showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginPage.classList.add('hidden');
    registerPage.classList.remove('hidden');
    document.getElementById('loginError').classList.add('hidden');
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerPage.classList.add('hidden');
    loginPage.classList.remove('hidden');
    document.getElementById('registerError').classList.add('hidden');
});

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (e) => {
        chatInput.value = e.results[0][0].transcript;
        micBtn.classList.remove('recording');
    };

    recognition.onerror = () => micBtn.classList.remove('recording');
    recognition.onend = () => micBtn.classList.remove('recording');
} else {
    micBtn.disabled = true;
}

onAuthStateChanged(auth, async (user) => {
    console.log('Auth state changed:', user ? user.email : 'No user');
    
    if (user) {
        currentUser = user;
        loginPage.classList.add('hidden');
        registerPage.classList.add('hidden');
        chatInterface.style.display = 'flex';
        document.getElementById('userName').textContent = user.displayName || user.email;
        document.getElementById('userAvatar').textContent = (user.displayName || user.email).charAt(0).toUpperCase();
        
        console.log('User logged in:', user.displayName || user.email);
        
        // DON'T load chat history automatically - start fresh
        // await loadChatHistory(user.uid);  // COMMENT THIS OUT
        
        // Load history for sidebar only
        await loadAllHistory(user.uid);
        
        // Start with fresh chat
        startNewChat();
        
        connectWebSocket();
    } else {
        currentUser = null;
        chatHistory = [];
        allChatHistory = [];
        chatInterface.style.display = 'none';
        loginPage.classList.remove('hidden');
    }
});
// Function to clear current chat and start fresh
function startNewChat() {
    chatMessages.innerHTML = '<div class="welcome-message"><h3>Welcome to Friday!</h3><p>How can I assist you today?</p></div>';
    chatHistory = []; // Clear in-memory context
    console.log('Started new chat session');
}

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    if (password !== confirmPassword) {
        showError('registerError', 'Passwords do not match');
        return;
    }

    if (password.length < 6) {
        showError('registerError', 'Password must be at least 6 characters');
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        showError('registerError', 'Registration successful!', false);
        registerForm.reset();
    } catch (error) {
        let msg = 'Registration failed';
        if (error.code === 'auth/email-already-in-use') msg = 'Email already registered';
        else if (error.code === 'auth/invalid-email') msg = 'Invalid email';
        showError('registerError', msg);
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        loginForm.reset();
    } catch (error) {
        showError('loginError', 'Invalid email or password');
    }
});

logoutBtn.addEventListener('click', async () => {
    if (ws) ws.close();
    await signOut(auth);
    
    // Clear all chat data
    chatHistory = [];
    allChatHistory = [];
    chatMessages.innerHTML = '<div class="welcome-message"><h3>Welcome to Friday!</h3><p>How can I assist you today?</p></div>';
    chatInput.value = '';
    
    console.log('Logged out and cleared all chat data');
});

if (historyBtn) {
    historyBtn.addEventListener('click', () => {
        historySidebar.classList.remove('hidden');
        displayHistory(allChatHistory);
    });
}

if (closeHistoryBtn) {
    closeHistoryBtn.addEventListener('click', () => {
        historySidebar.classList.add('hidden');
    });
}

if (historySearch) {
    historySearch.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = allChatHistory.filter(chat => 
            chat.message.toLowerCase().includes(searchTerm) || 
            chat.response.toLowerCase().includes(searchTerm)
        );
        displayHistory(filtered);
    });
}

function showError(elementId, message, isError = true) {
    const errorEl = document.getElementById(elementId);
    errorEl.textContent = message;
    errorEl.style.background = isError ? 'linear-gradient(135deg, #ff4757 0%, #ff6348 100%)' : 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)';
    errorEl.classList.remove('hidden');
    setTimeout(() => errorEl.classList.add('hidden'), 3000);
}

function connectWebSocket() {
    ws = new WebSocket('ws://localhost:8765');

    ws.onopen = () => {
        console.log('WebSocket connected');
        statusIndicator.classList.remove('disconnected');
        statusIndicator.classList.add('connected');
        statusText.textContent = 'Connected';
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected');
        statusIndicator.classList.remove('connected');
        statusIndicator.classList.add('disconnected');
        statusText.textContent = 'Disconnected';
        if (currentUser) setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'response') {
            addMessage(data.text, 'assistant');
            
            const lastUserMsg = chatHistory[chatHistory.length - 1];
            if (lastUserMsg && currentUser) {
                chatHistory.push({
                    role: 'assistant',
                    message: data.text,
                    timestamp: new Date()
                });
                
                await saveChatToFirebase(lastUserMsg.message, data.text);
                await loadAllHistory(currentUser.uid);
            }
            
            sendBtn.disabled = false;
            stopBtn.classList.add('hidden');
            sendBtn.classList.remove('hidden');
        }
    };
}

async function saveChatToFirebase(message, response) {
    try {
        await addDoc(collection(db, 'chats'), {
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email,
            message: message,
            response: response,
            timestamp: Timestamp.now()
        });
        console.log('Chat saved to Firebase');
    } catch (error) {
        console.error('Error saving chat:', error);
    }
}

async function loadChatHistory(userId) {
    try {
        console.log('Loading recent chat history for userId:', userId);
        
        chatMessages.innerHTML = '<div class="loading">Loading your conversations...</div>';
        
        const q = query(
            collection(db, 'chats'), 
            where('userId', '==', userId), 
            orderBy('timestamp', 'desc'), 
            limit(50)
        );
        
        const querySnapshot = await getDocs(q);
        console.log('Query returned', querySnapshot.size, 'documents');
        
        chatHistory = [];
        const history = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            console.log('Chat document:', data);
            history.push(data);
            
            chatHistory.push({
                role: 'user',
                message: data.message,
                timestamp: data.timestamp.toDate()
            });
            chatHistory.push({
                role: 'assistant',
                message: data.response,
                timestamp: data.timestamp.toDate()
            });
        });
        
        history.reverse();
        
        chatMessages.innerHTML = '';
        
        if (history.length === 0) {
            chatMessages.innerHTML = '<div class="welcome-message"><h3>Welcome to Friday!</h3><p>How can I assist you today?</p></div>';
        } else {
            history.forEach(chat => {
                addMessage(chat.message, 'user', false);
                addMessage(chat.response, 'assistant', false);
            });
        }
        
        console.log('Successfully loaded', history.length, 'chat exchanges');
    } catch (error) {
        console.error('Error loading history:', error);
        console.error('Error details:', error.message);
        chatMessages.innerHTML = '<div class="welcome-message"><h3>Welcome to Friday!</h3><p>How can I assist you today?</p></div>';
    }
}

async function loadAllHistory(userId) {
    try {
        const q = query(
            collection(db, 'chats'), 
            where('userId', '==', userId), 
            orderBy('timestamp', 'desc'),
            limit(100)
        );
        
        const querySnapshot = await getDocs(q);
        allChatHistory = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            allChatHistory.push({
                ...data,
                timestamp: data.timestamp.toDate()
            });
        });
        
        console.log('Loaded', allChatHistory.length, 'total conversations for sidebar');
    } catch (error) {
        console.error('Error loading all history:', error);
    }
}

function displayHistory(history) {
    if (!historyList) return;
    
    if (history.length === 0) {
        historyList.innerHTML = '<div class="no-history"><p>No chat history found</p></div>';
        return;
    }
    
    historyList.innerHTML = '';
    history.forEach((chat) => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <div class="history-item-date">${formatDate(chat.timestamp)}</div>
            <div class="history-item-preview">${chat.message}</div>
            <div class="history-item-response">${chat.response}</div>
        `;
        item.addEventListener('click', () => {
            showHistoryDetail(chat);
        });
        historyList.appendChild(item);
    });
}

function formatDate(date) {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Yesterday ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (days < 7) return date.toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function showHistoryDetail(chat) {
    // Clear current chat
    chatMessages.innerHTML = '';
    
    // Clear current context so AI doesn't mix old and new
    chatHistory = [];
    
    // Show this specific conversation
    addMessage(chat.message, 'user', false);
    addMessage(chat.response, 'assistant', false);
    
    // Add these to context for reference
    chatHistory.push({
        role: 'user',
        message: chat.message,
        timestamp: chat.timestamp
    });
    chatHistory.push({
        role: 'assistant',
        message: chat.response,
        timestamp: chat.timestamp
    });
    
    // Close sidebar
    historySidebar.classList.add('hidden');
    
    // Scroll to top
    chatMessages.scrollTop = 0;
}

function addMessage(text, sender, scroll = true) {
    const welcomeMsg = chatMessages.querySelector('.welcome-message');
    if (welcomeMsg) welcomeMsg.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = sender === 'user' ? (currentUser?.displayName || 'U').charAt(0).toUpperCase() : 'F';
    
    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = text;
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    chatMessages.appendChild(messageDiv);
    
    if (scroll) chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage() {
    const message = chatInput.value.trim();
    
    console.log('sendMessage called, message:', message);
    console.log('WebSocket state:', ws ? ws.readyState : 'null');
    
    if (!message) {
        console.log('Empty message');
        return;
    }
    
    if (!ws) {
        alert('WebSocket not connected. Please refresh the page.');
        return;
    }
    
    if (ws.readyState !== WebSocket.OPEN) {
        alert('Not connected to server. Make sure Python backend is running:\npython main.py');
        return;
    }

    chatHistory.push({
        role: 'user',
        message: message,
        timestamp: new Date()
    });

    addMessage(message, 'user');
    
    const recentHistory = chatHistory.slice(-10).map(h => ({
        role: h.role,
        content: h.message
    }));
    
    console.log('Sending to backend:', { type: 'command', text: message });
    ws.send(JSON.stringify({ 
        type: 'command', 
        text: message,
        history: recentHistory
    }));
    
    chatInput.value = '';
    sendBtn.disabled = true;
    sendBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
}

sendBtn.addEventListener('click', () => {
    console.log('Send button clicked');
    sendMessage();
});

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        console.log('Enter key pressed');
        sendMessage();
    }
});

stopBtn.addEventListener('click', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'stop' }));
        sendBtn.disabled = false;
        stopBtn.classList.add('hidden');
        sendBtn.classList.remove('hidden');
    }
});

micBtn.addEventListener('click', () => {
    if (!recognition) return;
    if (micBtn.classList.contains('recording')) {
        recognition.stop();
    } else {
        micBtn.classList.add('recording');
        recognition.start();
    }
});

// Add with other event listeners
const newChatBtn = document.getElementById('newChatBtn');

if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
        startNewChat();
        historySidebar.classList.add('hidden'); // Close history if open
    });
}

console.log('Script loaded successfully');