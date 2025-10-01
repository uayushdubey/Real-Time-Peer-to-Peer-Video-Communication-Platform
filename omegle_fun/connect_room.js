function joinRoom() {
  // Get destination peer ID (room ID) and username
  const destPeerId = elements.roomInput ? elements.roomInput.value.trim() : '';
  const username = elements.usernameInput ? elements.usernameInput.value.trim() : 'Anonymous';
  
  // Validation
  if (!destPeerId) {
    showInfo('Please enter a Meeting ID to join', 'warning');
    return;
  }
  
  // Set state
  appState.roomId = destPeerId;
  appState.username = username || 'Anonymous';
  appState.isHost = false;
  
  showInfo('Joining meeting...', 'info');
  
  // Request media permissions
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(function(mediaStream) {
      appState.localMediaStream = mediaStream;
      
      // Create a new peer (without specifying ID, PeerJS will generate one)
      appState.peer = new Peer({ config: turnConfig });
      
      // Handle peer errors
      appState.peer.on('error', function(err) {
        console.error('Peer Error:', err);
        
        if (err.type === 'peer-unavailable') {
          showInfo('Meeting not found. Please check the Meeting ID.', 'danger');
        } else if (err.type === 'network') {
          showInfo('Network error. Please check your connection.', 'danger');
        } else if (err.type === 'disconnected') {
          showInfo('Connection lost. Please try again.', 'warning');
        } else {
          showInfo('Connection error: ' + err.type, 'danger');
        }
      });
      
      // Handle successful peer connection
      appState.peer.on('open', function(id) {
        console.log('My Peer ID:', id);
        console.log('Connecting to:', destPeerId);
        
        // Establish data connection for chat
        const dataConn = appState.peer.connect(destPeerId, {
          reliable: true
        });
        
        // Setup data connection handlers
        setupJoinDataConnection(dataConn);
        
        // Make video call
        const call = appState.peer.call(destPeerId, appState.localMediaStream);
        
        if (!call) {
          showInfo('Unable to call. Meeting may not exist.', 'danger');
          return;
        }
        
        appState.currentCall = call;
        
        // Handle incoming stream
        call.on('stream', function(remoteStream) {
          console.log('Received remote stream');
          appState.remoteMediaStream = remoteStream;
          
          // Display remote video
          if (elements.remoteVideo) {
            elements.remoteVideo.srcObject = remoteStream;
            elements.remoteVideo.play().catch(err => {
              console.error('Error playing remote video:', err);
            });
          }
          
          showInfo('Connected successfully!', 'success');
          addSystemMessage('Successfully joined the meeting!');
          updateParticipantCount(2);
        });
        
        // Handle call close
        call.on('close', function() {
          console.log('Call closed');
          addSystemMessage('Call ended by host');
          
          // Clear remote video
          if (elements.remoteVideo) {
            elements.remoteVideo.srcObject = null;
          }
          
          appState.remoteMediaStream = null;
          updateParticipantCount(1);
          
          setTimeout(() => {
            if (confirm('The meeting has ended. Return to home?')) {
              location.reload();
            }
          }, 1000);
        });
        
        // Handle call errors
        call.on('error', function(err) {
          console.error('Call error:', err);
          showInfo('Call connection error', 'danger');
        });
        
        // Start meeting interface
        startMeeting();
      });
      
      // Handle incoming calls (for multi-user scenarios)
      appState.peer.on('call', function(call) {
        console.log('Incoming call from:', call.peer);
        
        // Answer with our stream
        call.answer(appState.localMediaStream);
        
        // Handle the stream
        call.on('stream', function(remoteStream) {
          console.log('Received additional stream');
          // Handle additional participants if needed
        });
      });
      
      // Handle incoming data connections
      appState.peer.on('connection', function(conn) {
        console.log('Incoming data connection from:', conn.peer);
        setupJoinDataConnection(conn);
      });
      
      // Handle peer disconnection
      appState.peer.on('disconnected', function() {
        console.log('Peer disconnected');
        showInfo('Connection lost. Attempting to reconnect...', 'warning');
        
        // Try to reconnect
        if (appState.peer && !appState.peer.destroyed) {
          appState.peer.reconnect();
        }
      });
      
      // Handle peer close
      appState.peer.on('close', function() {
        console.log('Peer connection closed');
        addSystemMessage('Disconnected from meeting');
      });
      
    })
    .catch(function(err) {
      console.error('Media error:', err);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        showInfo('Camera/microphone permission denied. Please allow access.', 'danger');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        showInfo('No camera/microphone found. Please connect a device.', 'danger');
      } else {
        showInfo('Unable to access camera/microphone: ' + err.message, 'danger');
      }
    });
}

// Setup data connection when joining
function setupJoinDataConnection(conn) {
  appState.dataConnection = conn;
  
  // Handle connection open
  conn.on('open', function() {
    console.log('Data connection established');
    
    // Send join notification
    conn.send({
      type: 'user-joined',
      username: appState.username,
      timestamp: new Date().toISOString()
    });
    
    addSystemMessage('Chat connection established!');
  });
  
  // Handle incoming data
  conn.on('data', function(data) {
    console.log('Received data:', data);
    handleIncomingData(data);
  });
  
  // Handle connection close
  conn.on('close', function() {
    console.log('Data connection closed');
    addSystemMessage('Chat connection closed');
    appState.dataConnection = null;
  });
  
  // Handle connection errors
  conn.on('error', function(err) {
    console.error('Data connection error:', err);
    
    if (err.type === 'peer-unavailable') {
      showInfo('Host is not available for chat', 'warning');
    } else {
      showInfo('Chat connection error', 'warning');
    }
  });
}

// Alternative function to reconnect if disconnected
function reconnectToRoom() {
  if (!appState.roomId) {
    showInfo('No room to reconnect to', 'warning');
    return;
  }
  
  showInfo('Reconnecting to meeting...', 'info');
  
  // Try to join again
  joinRoom();
}

// Function to send message when connection is ready
function sendMessageWhenReady(message) {
  const maxAttempts = 10;
  let attempts = 0;
  
  const interval = setInterval(() => {
    attempts++;
    
    if (appState.dataConnection && appState.dataConnection.open) {
      appState.dataConnection.send(message);
      clearInterval(interval);
    } else if (attempts >= maxAttempts) {
      console.warn('Could not send message: connection not ready');
      clearInterval(interval);
    }
  }, 500);
}
