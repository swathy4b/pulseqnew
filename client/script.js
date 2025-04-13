document.addEventListener('DOMContentLoaded', function() {
    const simulateJoinBtn = document.getElementById('simulateJoin');
    const joinModal = document.getElementById('joinModal');
    const cancelJoinBtn = document.getElementById('cancelJoin');
    const confirmJoinBtn = document.getElementById('confirmJoin');
    const userNameInput = document.getElementById('userName');
    const userPhoneInput = document.getElementById('userPhone');
    const queueItemsContainer = document.getElementById('queueItems');
    const queueStatsEl = document.getElementById('queueStats');
    const nowServingEl = document.getElementById('nowServing');
    const nextUpEl = document.getElementById('nextUp');
    const processNextBtn = document.getElementById('processNext');
    const clearQueueBtn = document.getElementById('clearQueue');
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notificationMessage');
    const qrCode = document.getElementById('qrCode');
  
    const socket = io(); // Auto-connects to the server hosting the page
  
    // Fetch and display QR code (only once)
    async function fetchQRCode() {
      try {
        const response = await fetch('/api/queue/qr');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const { qrCode: qrData } = await response.json();
        qrCode.src = qrData;
        console.log('QR Code fetched successfully');
      } catch (error) {
        console.error('Error fetching QR code:', error);
      }
    }
  
    // Update queue UI
    function updateQueueUI(queue) {
      queueItemsContainer.innerHTML = '';
      const waiting = queue.filter(item => item.status === 'waiting');
      const processing = queue.find(item => item.status === 'processing');
  
      waiting.forEach(item => renderQueueItem(item));
      if (processing) renderQueueItem(processing);
  
      queueStatsEl.textContent = `${waiting.length} ${waiting.length === 1 ? 'person' : 'people'} waiting`;
      nowServingEl.textContent = processing ? processing.queueNumber || '--' : '--';
      nextUpEl.textContent = waiting.length > 0 ? waiting[0].queueNumber || '--' : '--';
    }
  
    // Render queue item
    function renderQueueItem(item) {
      const queueItemEl = document.createElement('div');
      queueItemEl.className = `queue-item`;
      queueItemEl.dataset.id = item._id;
      queueItemEl.innerHTML = `
        <div class="queue-number">${item.queueNumber || 'N/A'}</div>
        <div class="user-info">
          <div class="user-name">${item.name}</div>
          <div class="join-time">Joined at ${formatTime(new Date(item.joinTime))}</div>
        </div>
        <div class="status-indicator ${item.status}"></div>
      `;
      queueItemsContainer.appendChild(queueItemEl);
    }
  
    // Format time
    function formatTime(date) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  
    // Join queue
    async function joinQueue(name, phone) {
      try {
        const response = await fetch('/api/queue/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const queueItem = await response.json();
        showNotification(`${queueItem.name} added to queue!`);
      } catch (error) {
        console.error('Join queue error:', error);
        showNotification('Failed to join queue');
      }
    }
  
    // Process next
    async function processNext() {
      try {
        const response = await fetch('/api/queue/process', { method: 'POST' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const next = await response.json();
        showNotification(next ? `Now serving ${next.name} (${next.queueNumber || 'N/A'})` : 'Queue is empty!');
      } catch (error) {
        console.error('Process next error:', error);
        showNotification('Failed to process next');
      }
    }
  
    // Clear queue
    async function clearQueue() {
      if (confirm('Clear the entire queue?')) {
        try {
          const response = await fetch('/api/queue/clear', { method: 'DELETE' });
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          showNotification('Queue cleared!');
        } catch (error) {
          console.error('Clear queue error:', error);
          showNotification('Failed to clear queue');
        }
      }
    }
  
    // Show notification
    function showNotification(message) {
      notificationMessage.textContent = message;
      notification.classList.add('show');
      setTimeout(() => notification.classList.remove('show'), 3000);
    }
  
    // Event listeners
    simulateJoinBtn.addEventListener('click', () => {
      joinModal.style.display = 'flex';
      userNameInput.focus();
    });
  
    cancelJoinBtn.addEventListener('click', () => {
      joinModal.style.display = 'none';
      userNameInput.value = '';
      userPhoneInput.value = '';
    });
  
    confirmJoinBtn.addEventListener('click', async () => {
      const name = userNameInput.value.trim();
      const phone = userPhoneInput.value.trim();
      if (!name) return userNameInput.focus();
      await joinQueue(name, phone);
      joinModal.style.display = 'none';
      userNameInput.value = '';
      userPhoneInput.value = '';
    });
  
    processNextBtn.addEventListener('click', processNext);
    clearQueueBtn.addEventListener('click', clearQueue);
  
    // Real-time updates
    socket.on('queueUpdate', updateQueueUI);
  
    // Initial setup
    fetchQRCode();
    fetch('/api/queue')
      .then(res => res.json())
      .then(updateQueueUI)
      .catch(err => console.error('Initial queue fetch error:', err));
  });