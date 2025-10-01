// ==========================================
// VARIABLES.JS - Global State Management
// ==========================================

// TURN/STUN Server Configuration
const turnConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// Global State Object
const appState = {
  peer: null,
  currentCall: null,
  dataConnection: null,
  localMediaStream: null,
  remoteMediaStream: null,
  screenStream: null,
  isAudioEnabled: true,
  isVideoEnabled: true,
  isScreenSharing: false,
  roomId: '',
  username: 'Anonymous',
  isHost: false,
  messages: [],
  participants: [],
  meetingNotes: '',
  connectedUsers: new Set()
};

// DOM Elements References
const elements = {
  landingPage: null,
  meetingRoom: null,
  infoMessages: null,
  roomInput: null,
  usernameInput: null,
  localVideo: null,
  remoteVideo: null,
  chatMessages: null,
  messageInput: null,
  chatPanel: null,
  participantsPanel: null,
  momSection: null,
  momTextarea: null,
  participantCount: null,
  currentUserName: null
};

// Initialize DOM elements
function initializeElements() {
  elements.landingPage = document.getElementById('landing-page');
  elements.meetingRoom = document.getElementById('meeting-room');
  elements.infoMessages = document.getElementById('info-messages');
  elements.roomInput = document.getElementById('room-input');
  elements.usernameInput = document.getElementById('username-input');
  elements.localVideo = document.getElementById('local-video');
  elements.remoteVideo = document.getElementById('remote-video');
  elements.chatMessages = document.getElementById('chat-messages');
  elements.messageInput = document.getElementById('message-input');
  elements.chatPanel = document.getElementById('chat-panel');
  elements.participantsPanel = document.getElementById('participants-panel');
  elements.momSection = document.getElementById('mom-section');
  elements.momTextarea = document.getElementById('mom-textarea');
  elements.participantCount = document.getElementById('participant-count');
  elements.currentUserName = document.getElementById('current-user-name');
}

// Utility Functions
function showInfo(message, type = 'info') {
  if (elements.infoMessages) {
    elements.infoMessages.className = `alert alert-${type}`;
    elements.infoMessages.textContent = message;
    elements.infoMessages.classList.remove('hidden');
    
    setTimeout(() => {
      if (elements.infoMessages) {
        elements.infoMessages.classList.add('hidden');
      }
    }, 5000);
  }
}

function startMeeting() {
  if (elements.landingPage && elements.meetingRoom) {
    elements.landingPage.classList.add('hidden');
    elements.meetingRoom.classList.remove('hidden');
  }
  
  if (elements.localVideo && appState.localMediaStream) {
    elements.localVideo.srcObject = appState.localMediaStream;
  }
  
  if (elements.currentUserName) {
    elements.currentUserName.textContent = appState.username + ' (You)';
  }
  
  // Show chat by default
  toggleChat();
}

// Chat Functions
function addMessage(sender, text, type) {
  if (!elements.chatMessages) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  messageDiv.innerHTML = `
    <div class="font-weight-bold small">${sender}</div>
    <div>${escapeHtml(text)}</div>
    <div class="text-muted small">${new Date().toLocaleTimeString()}</div>
  `;
  elements.chatMessages.appendChild(messageDiv);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  
  appState.messages.push({ sender, text, type, timestamp: new Date() });
}

function addSystemMessage(text) {
  if (!elements.chatMessages) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message system';
  messageDiv.textContent = text;
  elements.chatMessages.appendChild(messageDiv);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function addFileMessage(filename, data, type) {
  if (!elements.chatMessages) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  messageDiv.innerHTML = `
    <div class="file-item">
      <div>
        <i class="fas fa-file"></i> ${escapeHtml(filename)}
      </div>
      <a href="${data}" download="${escapeHtml(filename)}" class="btn btn-sm btn-primary">
        <i class="fas fa-download"></i>
      </a>
    </div>
    <div class="text-muted small">${new Date().toLocaleTimeString()}</div>
  `;
  elements.chatMessages.appendChild(messageDiv);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function sendMessage() {
  if (!elements.messageInput) return;
  
  const text = elements.messageInput.value.trim();
  if (!text) return;
  
  addMessage('You', text, 'sent');
  
  if (appState.dataConnection && appState.dataConnection.open) {
    appState.dataConnection.send({
      type: 'message',
      username: appState.username,
      text: text,
      timestamp: new Date().toISOString()
    });
  }
  
  elements.messageInput.value = '';
}

function sendFile() {
  const fileInput = document.getElementById('file-input');
  if (!fileInput || !fileInput.files[0]) return;
  
  const file = fileInput.files[0];
  
  if (file.size > 10 * 1024 * 1024) {
    showInfo('File too large. Max 10MB', 'warning');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const data = e.target.result;
    addFileMessage(file.name, data, 'sent');
    
    if (appState.dataConnection && appState.dataConnection.open) {
      appState.dataConnection.send({
        type: 'file',
        filename: file.name,
        data: data,
        timestamp: new Date().toISOString()
      });
    }
  };
  reader.readAsDataURL(file);
  fileInput.value = '';
}

// Control Functions
function toggleChat() {
  if (elements.chatPanel && elements.participantsPanel) {
    elements.participantsPanel.classList.add('hidden');
    elements.chatPanel.classList.toggle('hidden');
  }
}

function toggleParticipants() {
  if (elements.chatPanel && elements.participantsPanel) {
    elements.chatPanel.classList.add('hidden');
    elements.participantsPanel.classList.toggle('hidden');
  }
}

function toggleMOM() {
  if (elements.momSection) {
    elements.momSection.classList.toggle('hidden');
  }
}

function toggleAudio() {
  if (!appState.localMediaStream) return;
  
  appState.isAudioEnabled = !appState.isAudioEnabled;
  const audioTrack = appState.localMediaStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = appState.isAudioEnabled;
  }
  
  const btn = document.getElementById('toggle-audio');
  if (btn) {
    btn.classList.toggle('active');
    btn.innerHTML = appState.isAudioEnabled 
      ? '<i class="fas fa-microphone"></i> <span>Mute</span>'
      : '<i class="fas fa-microphone-slash"></i> <span>Unmute</span>';
  }
}

function toggleVideo() {
  if (!appState.localMediaStream) return;
  
  appState.isVideoEnabled = !appState.isVideoEnabled;
  const videoTrack = appState.localMediaStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = appState.isVideoEnabled;
  }
  
  const btn = document.getElementById('toggle-video');
  if (btn) {
    btn.classList.toggle('active');
    btn.innerHTML = appState.isVideoEnabled 
      ? '<i class="fas fa-video"></i> <span>Stop Video</span>'
      : '<i class="fas fa-video-slash"></i> <span>Start Video</span>';
  }
}

async function toggleScreenShare() {
  if (!appState.isScreenSharing) {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { mediaSource: 'screen' }
      });
      
      appState.screenStream = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];
      
      if (appState.currentCall && appState.currentCall.peerConnection) {
        const sender = appState.currentCall.peerConnection
          .getSenders()
          .find(s => s.track && s.track.kind === 'video');
        
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      }
      
      appState.isScreenSharing = true;
      
      const btn = document.getElementById('toggle-screen');
      if (btn) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fas fa-desktop"></i> <span>Stop Sharing</span>';
      }
      
      screenTrack.onended = function() {
        toggleScreenShare();
      };
    } catch (err) {
      showInfo('Screen sharing not supported or denied', 'warning');
    }
  } else {
    const videoTrack = appState.localMediaStream.getVideoTracks()[0];
    
    if (appState.currentCall && appState.currentCall.peerConnection) {
      const sender = appState.currentCall.peerConnection
        .getSenders()
        .find(s => s.track && s.track.kind === 'video');
      
      if (sender && videoTrack) {
        sender.replaceTrack(videoTrack);
      }
    }
    
    if (appState.screenStream) {
      appState.screenStream.getTracks().forEach(track => track.stop());
      appState.screenStream = null;
    }
    
    appState.isScreenSharing = false;
    
    const btn = document.getElementById('toggle-screen');
    if (btn) {
      btn.classList.remove('active');
      btn.innerHTML = '<i class="fas fa-desktop"></i> <span>Share Screen</span>';
    }
  }
}

// MOM Functions
function saveMOM() {
  if (elements.momTextarea) {
    appState.meetingNotes = elements.momTextarea.value;
    const savedDiv = document.getElementById('mom-saved');
    if (savedDiv) {
      savedDiv.classList.remove('hidden');
      setTimeout(() => savedDiv.classList.add('hidden'), 3000);
    }
  }
}

function downloadMOM() {
  const content = elements.momTextarea ? elements.momTextarea.value : 'No notes taken';
  
  const blob = new Blob([
    `Meeting Notes\n`,
    `================\n`,
    `Meeting ID: ${appState.roomId}\n`,
    `Date: ${new Date().toLocaleString()}\n`,
    `Participant: ${appState.username}\n\n`,
    `Notes:\n`,
    `${content}\n\n`,
    `Messages:\n`,
    `${appState.messages.map(m => `[${m.timestamp.toLocaleTimeString()}] ${m.sender}: ${m.text}`).join('\n')}`
  ], { type: 'text/plain' });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `meeting-notes-${appState.roomId}-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function endCall() {
  if (!confirm('Are you sure you want to leave the meeting?')) {
    return;
  }
  
  // Stop all tracks
  if (appState.localMediaStream) {
    appState.localMediaStream.getTracks().forEach(track => track.stop());
  }
  
  if (appState.screenStream) {
    appState.screenStream.getTracks().forEach(track => track.stop());
  }
  
  // Close connections
  if (appState.currentCall) {
    appState.currentCall.close();
  }
  
  if (appState.dataConnection) {
    appState.dataConnection.close();
  }
  
  if (appState.peer) {
    appState.peer.destroy();
  }
  
  // Reload page
  location.reload();
}

function updateParticipantCount(count) {
  if (elements.participantCount) {
    elements.participantCount.textContent = count;
  }
}

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Handle incoming data
function handleIncomingData(data) {
  if (!data || !data.type) return;
  
  switch (data.type) {
    case 'message':
      addMessage(data.username || 'Anonymous', data.text, 'received');
      break;
      
    case 'file':
      addFileMessage(data.filename, data.data, 'received');
      break;
      
    case 'user-joined':
      addSystemMessage(`${data.username || 'User'} joined the meeting`);
      updateParticipantCount(2);
      break;
      
    case 'user-left':
      addSystemMessage(`${data.username || 'User'} left the meeting`);
      updateParticipantCount(1);
      break;
      
    default:
      console.log('Unknown data type:', data.type);
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  initializeElements();
  
  // Handle Enter key for message input
  if (elements.messageInput) {
    elements.messageInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  }
});
