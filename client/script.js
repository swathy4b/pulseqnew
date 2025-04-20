document.addEventListener('DOMContentLoaded', function() {
  // Original elements
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
  
  // New elements for live monitoring and crowd analysis
  const liveMonitoringBtn = document.getElementById('liveMonitoringBtn');
  const liveMonitoringModal = document.getElementById('liveMonitoringModal');
  const closeLiveMonitoringBtn = document.getElementById('closeLiveMonitoring');
  const analysisDashboardModal = document.getElementById('analysisDashboardModal');
  const showAnalysisDashboardBtn = document.getElementById('showAnalysisDashboard');
  const closeAnalysisDashboardBtn = document.getElementById('closeAnalysisDashboard');
  const liveFeedImg = document.getElementById('liveFeed');
  const detectionOverlay = document.getElementById('detectionOverlay');
  const currentCountEl = document.getElementById('currentCount');
  const crowdStatusEl = document.getElementById('crowdStatus');
  const overflowQueue = document.getElementById('overflowQueue');
  const overflowQueueItems = document.getElementById('overflowQueueItems');
  const overflowQueueStats = document.getElementById('overflowQueueStats');
  const mainContent = document.querySelector('.main-content');
  const avgWaitTimeEl = document.getElementById('avgWaitTime');
  const liveCountEl = document.getElementById('liveCount');
  
  // Notification panel elements
  const toggleNotificationsBtn = document.getElementById('toggleNotifications');
  const notificationPanel = document.getElementById('notificationPanel');
  const closeNotificationsBtn = document.getElementById('closeNotifications');
  const notificationList = document.getElementById('notificationList');
  const notificationBadge = document.getElementById('notificationBadge');
  
  // Analytics dashboard elements
  const dailyPeakEl = document.getElementById('dailyPeak');
  const peakTimeEl = document.getElementById('peakTime');
  const dailyAverageEl = document.getElementById('dailyAverage');
  const dailyMinimumEl = document.getElementById('dailyMinimum');
  const minTimeEl = document.getElementById('minTime');
  const busyHoursEl = document.getElementById('busyHours');
  const hourlyTrendChart = document.getElementById('hourlyTrendChart');
  const weeklyPatternsChart = document.getElementById('weeklyPatternsChart');
  
  // QR Scanner elements
  const scanQrBtn = document.getElementById('scanQr');
  const qrScannerModal = document.getElementById('qrScannerModal');
  const closeScannerBtn = document.getElementById('closeScanner');
  const videoElement = document.getElementById('qrVideo');
  const scanResultEl = document.getElementById('scanResult');

  // Set up socket connection
  const socket = io(); // Auto-connects to the server hosting the page
  
  // Initialize notification system
  let notificationCount = 0;
  let notifications = [];
  let queue = [];
  let crowdAnalytics = {
      currentCount: 0,
      status: 'Normal',
      avgWaitTime: 0
  };
  let charts = {};
  let scanner = null;

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

  // Update queue UI function with fixed overflow queue rendering
function updateQueueUI(queue) {
  queueItemsContainer.innerHTML = '';
  overflowQueueItems.innerHTML = ''; // Clear overflow queue items container
  
  const waiting = queue.filter(item => item.status === 'waiting');
  const processing = queue.find(item => item.status === 'processing');

  // Determine if we need to show overflow queue
  const crowdSize = getCrowdSize();
  if (crowdSize > 10 && waiting.length > 5) {
      // Split the queue into main and overflow
      const mainQueueItems = waiting.slice(0, 5);
      const overflowQueueItems = waiting.slice(5);
      
      // Update main queue
      mainQueueItems.forEach(item => renderQueueItem(item, queueItemsContainer));
      if (processing) renderQueueItem(processing, queueItemsContainer);
      
      // Update overflow queue
      overflowQueue.classList.add('show');
      mainContent.classList.add('with-overflow');
      
      // Update overflow queue items - FIX: Use the DOM element, not the variable
      document.getElementById('overflowQueueItems').innerHTML = '';
      overflowQueueItems.forEach(item => renderQueueItem(item, document.getElementById('overflowQueueItems')));
      
      // Update overflow stats
      overflowQueueStats.textContent = `Overflow: ${overflowQueueItems.length} customers`;
  } else {
      // Show all in main queue
      waiting.forEach(item => renderQueueItem(item, queueItemsContainer));
      if (processing) renderQueueItem(processing, queueItemsContainer);
      
      // Hide overflow queue
      overflowQueue.classList.remove('show');
      mainContent.classList.remove('with-overflow');
  }
  
  // Update queue stats in the format from the old code
  queueStatsEl.textContent = `${waiting.length} ${waiting.length === 1 ? 'person' : 'people'} waiting`;
  
  // Update now serving and next up (using queueNumber like in the old code)
  nowServingEl.textContent = processing ? processing.queueNumber || '--' : '--';
  
  if (waiting.length > 0) {
      nextUpEl.textContent = waiting[0].queueNumber || '--';
  } else {
      nextUpEl.textContent = '--';
  }
}
  
  // Render individual queue item (following the structure from the old code)
  function renderQueueItem(item, container) {
      const queueItemEl = document.createElement('div');
      queueItemEl.className = 'queue-item';
      queueItemEl.dataset.id = item._id;
      queueItemEl.innerHTML = `
          <div class="queue-number">${item.queueNumber || 'N/A'}</div>
          <div class="user-info">
              <div class="user-name">${item.name}</div>
              <div class="join-time">Joined at ${formatTime(new Date(item.joinTime))}</div>
          </div>
          <div class="status-indicator ${item.status}"></div>
      `;
      container.appendChild(queueItemEl);
  }
  
  // Format timestamp to readable time
  function formatTime(date) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Calculate crowd size (combined from queue and live monitoring)
  function getCrowdSize() {
      const queueSize = queue.filter(item => item.status === 'waiting').length;
      return queueSize + crowdAnalytics.currentCount;
  }
  
  // Update crowd analytics UI
  function updateCrowdAnalyticsUI() {
      currentCountEl.textContent = crowdAnalytics.currentCount;
      liveCountEl.textContent = getCrowdSize();
      crowdStatusEl.textContent = crowdAnalytics.status;
      avgWaitTimeEl.textContent = `${crowdAnalytics.avgWaitTime} min`;
      
      // Update status indicator class
      crowdStatusEl.className = 'status-indicator';
      if (crowdAnalytics.status === 'Normal') {
          crowdStatusEl.classList.add('status-normal');
      } else if (crowdAnalytics.status === 'Busy') {
          crowdStatusEl.classList.add('status-busy');
      } else if (crowdAnalytics.status === 'Crowded') {
          crowdStatusEl.classList.add('status-crowded');
      }
  }
  
  // Add notification (combine the new notification system with the old showNotification)
  function addNotification(message, type = 'info') {
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Add to notifications array
      notifications.unshift({
          id: Date.now(),
          message,
          type,
          time: timeString
      });
      
      // Keep only the last 20 notifications
      if (notifications.length > 20) {
          notifications.pop();
      }
      
      // Update notification count badge
      notificationCount++;
      notificationBadge.textContent = notificationCount;
      notificationBadge.classList.add('show');
      
      // Show popup notification (using the old method)
      showNotification(message);
      
      // Update notification panel if open
      updateNotificationList();
  }
  
  // Show notification (from the old code)
  function showNotification(message) {
      notificationMessage.textContent = message;
      notification.classList.add('show');
      setTimeout(() => notification.classList.remove('show'), 3000);
  }
  
  // Update notification list in panel
  function updateNotificationList() {
      notificationList.innerHTML = '';
      notifications.forEach(notif => {
          const notificationItem = document.createElement('div');
          notificationItem.className = `notification-item ${notif.type}`;
          notificationItem.innerHTML = `
              <div class="notification-time">${notif.time}</div>
              <div class="notification-message">${notif.message}</div>
          `;
          notificationList.appendChild(notificationItem);
      });
  }
  
  // Initialize charts
  function initCharts() {
      // Hourly trend chart
      const hourlyCtx = hourlyTrendChart.getContext('2d');
      charts.hourly = new Chart(hourlyCtx, {
          type: 'line',
          data: {
              labels: ['9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM', '5PM'],
              datasets: [{
                  label: 'Queue Size',
                  data: [5, 8, 12, 17, 15, 13, 10, 8, 6],
                  borderColor: '#4CAF50',
                  backgroundColor: 'rgba(76, 175, 80, 0.1)',
                  tension: 0.4,
                  fill: true
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                  y: {
                      beginAtZero: true,
                      title: {
                          display: true,
                          text: 'Number of People'
                      }
                  },
                  x: {
                      title: {
                          display: true,
                          text: 'Hour'
                      }
                  }
              }
          }
      });
      
      // Weekly patterns chart
      const weeklyCtx = weeklyPatternsChart.getContext('2d');
      charts.weekly = new Chart(weeklyCtx, {
          type: 'bar',
          data: {
              labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
              datasets: [{
                  label: 'Average Daily Visitors',
                  data: [45, 38, 42, 49, 70, 85, 40],
                  backgroundColor: 'rgba(33, 150, 243, 0.7)'
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                  y: {
                      beginAtZero: true,
                      title: {
                          display: true,
                          text: 'Average Visitors'
                      }
                  }
              }
          }
      });
  }
  
  // Update analytics dashboard
  function updateAnalyticsDashboard(analyticsData) {
      dailyPeakEl.textContent = analyticsData.dailyPeak || '0';
      peakTimeEl.textContent = analyticsData.peakTime || 'N/A';
      dailyAverageEl.textContent = analyticsData.dailyAverage || '0';
      dailyMinimumEl.textContent = analyticsData.dailyMinimum || '0';
      minTimeEl.textContent = analyticsData.minTime || 'N/A';
      busyHoursEl.textContent = analyticsData.busyHours || 'N/A';
      
      // Update charts if new data is provided
      if (analyticsData.hourlyData && charts.hourly) {
          charts.hourly.data.datasets[0].data = analyticsData.hourlyData;
          charts.hourly.update();
      }
      
      if (analyticsData.weeklyData && charts.weekly) {
          charts.weekly.data.datasets[0].data = analyticsData.weeklyData;
          charts.weekly.update();
      }
  }
  
  // Join queue (from the old code)
  async function joinQueue(name, phone) {
      try {
          const response = await fetch('/api/queue/join', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, phone })
          });
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const queueItem = await response.json();
          addNotification(`${queueItem.name} added to queue!`, 'success');
          return queueItem;
      } catch (error) {
          console.error('Join queue error:', error);
          addNotification('Failed to join queue', 'error');
          return null;
      }
  }
  
  // Process next (from the old code)
  async function processNext() {
      try {
          const response = await fetch('/api/queue/process', { method: 'POST' });
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const next = await response.json();
          addNotification(next ? `Now serving ${next.name} (${next.queueNumber || 'N/A'})` : 'Queue is empty!', 
              next ? 'info' : 'warning');
          return next;
      } catch (error) {
          console.error('Process next error:', error);
          addNotification('Failed to process next', 'error');
          return null;
      }
  }
  
  // Clear queue (from the old code)
  async function clearQueue() {
      if (confirm('Clear the entire queue?')) {
          try {
              const response = await fetch('/api/queue/clear', { method: 'DELETE' });
              if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
              addNotification('Queue cleared!', 'warning');
          } catch (error) {
              console.error('Clear queue error:', error);
              addNotification('Failed to clear queue', 'error');
          }
      }
  }
  
  // Initialize QR scanner
  function initQRScanner() {
      // Check if camera is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          addNotification('Camera not available on this device', 'error');
          return;
      }
      
      // Create QR scanner instance
      scanner = new QrScanner(videoElement, result => {
          try {
              // Parse the result
              const data = JSON.parse(result.data);
              
              // Display scan result
              scanResultEl.textContent = `Scanned: ${data.name || 'Unknown'}`;
              
              // Auto-join queue with scanned data
              if (data.name) {
                  joinQueue(data.name, data.phone || 'N/A');
                  
                  // Close scanner after successful scan
                  stopQRScanner();
                  qrScannerModal.style.display = 'none';
              }
          } catch (error) {
              console.error('QR scan error:', error);
              scanResultEl.textContent = 'Invalid QR code format';
          }
      }, {
          highlightScanRegion: true,
          highlightCodeOutline: true,
      });
  }
  
  // Start QR scanner
  function startQRScanner() {
      if (!scanner) {
          initQRScanner();
      }
      
      scanner.start().catch(error => {
          console.error('Scanner start error:', error);
          addNotification('Failed to start camera', 'error');
      });
  }
  
  // Stop QR scanner
  function stopQRScanner() {
      if (scanner) {
          scanner.stop();
      }
      scanResultEl.textContent = '';
  }
  
  // Update detection overlay with bounding boxes
  function updateDetectionOverlay(detections) {
      detectionOverlay.innerHTML = '';
      
      // Calculate scaling factors based on the actual size of the video feed
      const videoWidth = liveFeedImg.clientWidth;
      const videoHeight = liveFeedImg.clientHeight;
      
      detections.forEach(detection => {
          const { x, y, width, height, confidence, label } = detection;
          
          // Scale coordinates to match the displayed video size
          const scaledX = x * videoWidth;
          const scaledY = y * videoHeight;
          const scaledWidth = width * videoWidth;
          const scaledHeight = height * videoHeight;
          
          // Create bounding box
          const box = document.createElement('div');
          box.className = 'detection-box';
          box.style.left = `${scaledX}px`;
          box.style.top = `${scaledY}px`;
          box.style.width = `${scaledWidth}px`;
          box.style.height = `${scaledHeight}px`;
          
          // Add label
          const labelEl = document.createElement('div');
          labelEl.className = 'detection-label';
          labelEl.textContent = `${label} ${Math.round(confidence * 100)}%`;
          box.appendChild(labelEl);
          
          detectionOverlay.appendChild(box);
      });
  }
  
  // Event listeners
  simulateJoinBtn.addEventListener('click', () => {
      joinModal.style.display = 'flex'; // Using style.display like in old code
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
  
  // QR Scanner button event
  if (scanQrBtn) {
      scanQrBtn.addEventListener('click', () => {
          qrScannerModal.style.display = 'flex';
          startQRScanner();
      });
  }
  
  // Close QR Scanner button event
  if (closeScannerBtn) {
      closeScannerBtn.addEventListener('click', () => {
          qrScannerModal.style.display = 'none';
          stopQRScanner();
      });
  }
  
  processNextBtn.addEventListener('click', processNext);
  
  clearQueueBtn.addEventListener('click', clearQueue);
  
  liveMonitoringBtn.addEventListener('click', () => {
      liveMonitoringModal.classList.add('show');
      // Request latest feed
      socket.emit('request-live-feed');
  });
  
  closeLiveMonitoringBtn.addEventListener('click', () => {
      liveMonitoringModal.classList.remove('show');
      // Stop receiving feed updates
      socket.emit('stop-live-feed');
  });
  
  showAnalysisDashboardBtn.addEventListener('click', () => {
      analysisDashboardModal.classList.add('show');
      // Request latest analytics
      socket.emit('request-analytics');
      
      // Initialize charts if not already done
      if (!charts.hourly) {
          initCharts();
      }
  });
  
  closeAnalysisDashboardBtn.addEventListener('click', () => {
      analysisDashboardModal.classList.remove('show');
  });
  
  toggleNotificationsBtn.addEventListener('click', () => {
      notificationPanel.classList.toggle('show');
      
      // Reset notification count when panel is opened
      if (notificationPanel.classList.contains('show')) {
          notificationCount = 0;
          notificationBadge.textContent = '0';
          notificationBadge.classList.remove('show');
          updateNotificationList();
      }
  });
  
  closeNotificationsBtn.addEventListener('click', () => {
      notificationPanel.classList.remove('show');
  });
  
  // Socket event handlers
  socket.on('connect', () => {
      console.log('Connected to server');
      fetchQRCode();
  });
  
  socket.on('queueUpdate', (data) => {
      // Use the format from the old code
      queue = data;
      updateQueueUI(queue);
  });
  
  socket.on('crowd-update', (data) => {
      crowdAnalytics = { ...crowdAnalytics, ...data };
      updateCrowdAnalyticsUI();
  });
  
  socket.on('analytics-update', (data) => {
      updateAnalyticsDashboard(data);
  });
  
  socket.on('notification', (data) => {
      addNotification(data.message, data.type);
  });
  
  socket.on('live-feed-update', (data) => {
      // Update live feed image
      if (data.image) {
          liveFeedImg.src = `data:image/jpeg;base64,${data.image}`;
      }
      
      // Update detection overlay if available
      if (data.detections) {
          updateDetectionOverlay(data.detections);
      }
  });
  
  // Initialize the application
  function init() {
      // Request initial queue data (using the old code approach)
      fetch('/api/queue')
          .then(res => res.json())
          .then(updateQueueUI)
          .catch(err => console.error('Initial queue fetch error:', err));
      
      // Request initial crowd analytics
      socket.emit('request-crowd-analytics');
      
      // Add test notification
      setTimeout(() => {
          addNotification('Queue management system initialized', 'success');
      }, 1000);
  }
  
  // Initialize on load
  init();
});