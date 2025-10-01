function createRoom() {
  // Get room ID and username
  const roomId = elements.roomInput ? elements.roomInput.value.trim() : '';
  const username = elements.usernameInput ? elements.usernameInput.value.trim() : 'Anonymous';
  
  // Validation
  if (!roomId) {
    showInfo('Please enter a Meeting ID', 'warning');
    return;
  }
  
  // Set state
  appState.roomId = roomId;
  appState.username = username || 'Anonymous';
  appState.isHost = true;
  
  showInfo('Initializing meeting room...', 'info');
  
  // Request media permissions
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(function(mediaStream) {
      appState.localMediaStream = mediaStream;
      
      // Create peer with room ID
      appState.peer = new Peer(roomId, { config: turnConfig });
      
      // Handle peer errors
      appState.peer.on('error', function(err) {
        console.error('Peer Error:', err);
        
        if (err.type === 'unavailable-id') {
          showInfo('Meeting ID already taken. Please choose another.', 'danger');
        } else if (err.type === 'peer-unavailable') {
          showInfo('Unable to connect. User may be offline.', 'warning');
        } else if (err.type === 'network') {
          showInfo('Network error. Please check your connection.', 'danger');
        } else {
          showInfo('Peer Error: ' + err.type, 'danger');
        }
      });
      
      // Handle successful peer connection
      appState.peer.on('open', function(id) {
        console.log('Peer ID:', id);
        showInfo('Meeting room created successfully! Room ID: ' + id, 'success');
        
        // Start the meeting interface
        startMeeting();
        
        addSystemMessage('Meeting started. Waiting for participants...');
      });
      
      // Handle incoming calls
      appState.peer.on('call', function(call) {
        console.log('Incoming call from:', call.peer);
        
        // Answer the call with our media stream
        call.answer(appState.localMediaStream);
        
        // Store current call
        appState.currentCall = call;
        
        addSystemMessage('Participant is connecting...');
        
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
          
          addSystemMessage('Participant connected successfully!');
          updateParticipantCount(2);
        });
        
        // Handle call close
        call.on('close', function() {
          console.log('Call closed');
          addSystemMessage('Participant disconnected');
          
          // Clear remote video
          if (elements.remoteVideo) {
            elements.remoteVideo.srcObject = null;
          }
          
          appState.remoteMediaStream = null;
          updateParticipantCount(1);
        });
        
        // Handle call errors
        call.on('error', function(err) {
          console.error('Call error:', err);
          showInfo('Call error: ' + err, 'danger');
        });
      });
      
      // Handle incoming data connections
      appState.peer.on('connection', function(conn) {
        console.log('Incoming data connection from:', conn.peer);
        setupDataConnection(conn);
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
        addSystemMessage('Meeting ended');
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

// Setup data connection for chat and file transfer
function setupDataConnection(conn) {
  appState.dataConnection = conn;
  
  // Handle connection open
  conn.on('open', function() {
    console.log('Data connection established');
    
    // Send welcome message
    conn.send({
      type: 'user-joined',
      username: appState.username,
      timestamp: new Date().toISOString()
    });
    
    addSystemMessage('Data connection established. Chat enabled!');
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
    showInfo('Chat connection error', 'warning');
  });
}
