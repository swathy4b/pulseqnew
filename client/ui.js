document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const joinForm = document.getElementById('joinForm');
    const userName = document.getElementById('userName');
    const userPhone = document.getElementById('userPhone');
    const notJoinedSection = document.getElementById('notJoined');
    const inQueueSection = document.getElementById('inQueue');
    const beingServedSection = document.getElementById('beingServed');
    const userPosition = document.getElementById('userPosition');
    const estimatedWait = document.getElementById('estimatedWait');
    const peopleAhead = document.getElementById('peopleAhead');
    const progressBar = document.getElementById('progressBar');
    const statusMessage = document.getElementById('statusMessage');
    const leaveQueueBtn = document.getElementById('leaveQueue');
    const nowServingEl = document.getElementById('nowServing');
    const totalWaitingEl = document.getElementById('totalWaiting');
    const avgWaitTimeEl = document.getElementById('avgWaitTime');
    const serveTimer = document.getElementById('serveTimer');
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notificationMessage');
  
    // Variables
    const socket = io();
    let userId = localStorage.getItem('queueUserId');
    let userQueueData = null;
    let serveStartTime = null;
    let serveTimerInterval = null;
    let notificationSound = new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3');
    
    // Check if browser supports notifications
    let notificationsEnabled = false;
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        notificationsEnabled = true;
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          notificationsEnabled = permission === 'granted';
        });
      }
    }
  
    // Check if user is already in queue
    function checkExistingQueueStatus() {
      if (!userId) return;
      
      fetch('/api/queue')
        .then(res => res.json())
        .then(queue => {
          const userInQueue = queue.find(item => item._id === userId);
          if (userInQueue) {
            userQueueData = userInQueue;
            updateUserInterface(queue);
          } else {
            // User is not in queue anymore
            resetUserInterface();
          }
        })
        .catch(err => console.error('Queue fetch error:', err));
    }
  
    // Show appropriate sections based on queue status
    function updateUserInterface(queue) {
      if (!userQueueData) {
        notJoinedSection.classList.remove('hidden');
        inQueueSection.classList.add('hidden');
        beingServedSection.classList.add('hidden');
        return;
      }
      
      // Update now serving info
      const nowServing = queue.find(item => item.status === 'processing');
      nowServingEl.textContent = nowServing ? nowServing.queueNumber || nowServing.name : '--';
      
      // Update queue stats
      const waiting = queue.filter(item => item.status === 'waiting');
      totalWaitingEl.textContent = `${waiting.length} waiting`;
      
      // Calculate average wait time
      if (queue.length > 0) {
        const now = new Date();
        const waitTimes = queue.map(item => {
          const joinTime = new Date(item.joinTime);
          return (now - joinTime) / (1000 * 60); // in minutes
        });
        const avgWait = waitTimes.reduce((acc, time) => acc + time, 0) / waitTimes.length;
        avgWaitTimeEl.textContent = `Avg. Wait: ${Math.round(avgWait)} min`;
      }
  
      if (userQueueData.status === 'processing') {
        // User is being served
        notJoinedSection.classList.add('hidden');
        inQueueSection.classList.add('hidden');
        beingServedSection.classList.remove('hidden');
        
        // Play notification if this is the first time we're showing this
        if (!serveStartTime) {
          serveStartTime = new Date();
          showBrowserNotification("It's your turn! Please proceed to the counter.");
          notificationSound.play();
          startServeTimer();
        }
      } 
      else if (userQueueData.status === 'waiting') {
        // User is in queue waiting
        notJoinedSection.classList.add('hidden');
        inQueueSection.classList.remove('hidden');
        beingServedSection.classList.add('hidden');
        
        // Find position in waiting queue
        const position = waiting.findIndex(item => item._id === userId) + 1;
        userPosition.textContent = position;
        
        // Update people ahead text
        const ahead = position - 1;
        peopleAhead.textContent = ahead === 1 ? 
          '1 person ahead of you' : 
          `${ahead} people ahead of you`;
        
        // Update progress bar (position out of total queue length)
        const progress = (waiting.length > 0) ? 
          ((waiting.length - position + 1) / waiting.length) * 100 : 0;
        progressBar.style.width = `${progress}%`;
        
        // Update estimated wait time (assuming 5 minutes per person ahead)
        const waitEstimate = ahead * 5;
        estimatedWait.textContent = `Est. Wait: ${waitEstimate} min`;
        
        // Update status message based on position
        if (ahead === 0) {
          statusMessage.innerHTML = '<p class="alert">You are next! Please get ready.</p>';
        } else if (ahead <= 2) {
          statusMessage.innerHTML = '<p>Almost there! Your turn is coming up soon.</p>';
        } else {
          statusMessage.innerHTML = '<p>Please wait for your turn...</p>';
        }
      }
    }
  
    // Reset user interface when user leaves queue
    function resetUserInterface() {
      userId = null;
      userQueueData = null;
      localStorage.removeItem('queueUserId');
      notJoinedSection.classList.remove('hidden');
      inQueueSection.classList.add('hidden');
      beingServedSection.classList.add('hidden');
      clearInterval(serveTimerInterval);
      serveStartTime = null;
    }
  
    // Start timer for how long user has been served
    function startServeTimer() {
      serveTimerInterval = setInterval(() => {
        if (!serveStartTime) return;
        
        const now = new Date();
        const elapsed = now - serveStartTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        serveTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }, 1000);
    }
  
    // Show notification in browser
    function showBrowserNotification(message) {
      if (notificationsEnabled) {
        const notification = new Notification('I-SmartQueue', {
          body: message,
          icon: 'https://placehold.co/64x64?text=Q'
        });
        
        notification.onclick = function() {
          window.focus();
          this.close();
        };
      }
      
      // Also show in-app notification
      showNotification(message);
    }
  
    // Show in-app notification
    function showNotification(message) {
      notificationMessage.textContent = message;
      notification.classList.add('show');
      setTimeout(() => notification.classList.remove('show'), 5000);
    }
  
    // Join queue
    function joinQueue(name, phone) {
      fetch('/api/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone })
      })
      .then(res => res.json())
      .then(data => {
        userId = data._id;
        localStorage.setItem('queueUserId', userId);
        showNotification(`Welcome, ${name}! You've been added to the queue.`);
        
        // Fetch latest queue to get user's position
        return fetch('/api/queue');
      })
      .then(res => res.json())
      .then(queue => {
        userQueueData = queue.find(item => item._id === userId);
        updateUserInterface(queue);
      })
      .catch(error => {
        console.error('Join queue error:', error);
        showNotification('Failed to join queue. Please try again.');
      });
    }
  
    // Leave queue
    function leaveQueue() {
      if (!userId) return;
      
      if (confirm('Are you sure you want to leave the queue?')) {
        fetch(`/api/queue/leave/${userId}`, {
          method: 'DELETE'
        })
        .then(res => {
          if (res.ok) {
            showNotification('You have left the queue.');
            resetUserInterface();
          }
        })
        .catch(error => {
          console.error('Leave queue error:', error);
          showNotification('Failed to leave queue. Please try again.');
        });
      }
    }
  
    // Event listeners
    joinForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const name = userName.value.trim();
      const phone = userPhone.value.trim();
      
      if (!name) {
        userName.focus();
        return;
      }
      
      joinQueue(name, phone);
    });
  
    leaveQueueBtn.addEventListener('click', leaveQueue);
  
    // Socket.IO event handlers
    socket.on('queueUpdate', function(queue) {
      if (userId) {
        userQueueData = queue.find(item => item._id === userId);
        if (!userQueueData) {
          // User has been removed from queue
          showNotification('You are no longer in the queue.');
          resetUserInterface();
        } else {
          updateUserInterface(queue);
        }
      } else {
        // Just update now serving info
        const nowServing = queue.find(item => item.status === 'processing');
        nowServingEl.textContent = nowServing ? nowServing.queueNumber || nowServing.name : '--';
        
        const waiting = queue.filter(item => item.status === 'waiting');
        totalWaitingEl.textContent = `${waiting.length} waiting`;
      }
    });
  
    // Initialize interface
    checkExistingQueueStatus();
  });