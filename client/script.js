document.addEventListener('DOMContentLoaded', function() {
  // Existing elements
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
  const toggleNotificationsBtn = document.getElementById('toggleNotifications');
  const notificationPanel = document.getElementById('notificationPanel');
  const closeNotificationsBtn = document.getElementById('closeNotifications');
  const notificationList = document.getElementById('notificationList');
  const notificationBadge = document.getElementById('notificationBadge');
  const dailyPeakEl = document.getElementById('dailyPeak');
  const peakTimeEl = document.getElementById('peakTime');
  const dailyAverageEl = document.getElementById('dailyAverage');
  const dailyMinimumEl = document.getElementById('dailyMinimum');
  const minTimeEl = document.getElementById('minTime');
  const busyHoursEl = document.getElementById('busyHours');
  const hourlyTrendChart = document.getElementById('hourlyTrendChart');
  const weeklyPatternsChart = document.getElementById('weeklyPatternsChart');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');

  // Use Node.js proxy for detection API
  const BACKEND_URL = '/detection';

  // Socket connections
  const queueSocket = io(); // For queue management
  const detectionSocket = io(BACKEND_URL); // For face detection

  // State
  let notificationCount = 0;
  let notifications = [];
  let queue = [];
  let crowdAnalytics = {
    currentCount: 0,
    status: 'Normal',
    avgWaitTime: 0
  };
  let charts = {};
  let detectionRunning = false;

  // Periodic refresh for live feed
  let liveFeedInterval = null;
  let dashboardInterval = null;

  // At the top, after other element queries:
  const simulateCrimeBtn = document.getElementById('simulateCrime');

  function startLiveFeedRefresh() {
    if (liveFeedInterval) clearInterval(liveFeedInterval);
    // Set initial feed immediately
    liveFeedImg.src = `${BACKEND_URL}/feed?t=${Date.now()}`;
    liveFeedInterval = setInterval(async () => {
      if (liveMonitoringModal.style.display === 'flex' && detectionRunning) {
        liveFeedImg.src = `${BACKEND_URL}/feed?t=${Date.now()}`;
        // Fetch current count and status from backend and update UI
        try {
          const response = await fetch(`${BACKEND_URL}/status`);
          if (response.ok) {
            const data = await response.json();
            crowdAnalytics.currentCount = data.count;
            currentCountEl.textContent = data.count;
            // Update crowd status
            let status = 'Normal';
            let statusClass = 'status-normal';
            if (data.count > 15) {
              status = 'Crowded';
              statusClass = 'status-crowded';
            } else if (data.count > 8) {
              status = 'Busy';
              statusClass = 'status-busy';
            }
            crowdStatusEl.textContent = status;
            crowdStatusEl.className = `status-indicator ${statusClass}`;
            // Update average wait time
            crowdAnalytics.avgWaitTime = data.avg_wait || 0;
            avgWaitTimeEl.textContent = `Avg Wait: ${crowdAnalytics.avgWaitTime} min`;
            // Update live count
            const totalCount = getCrowdSize();
            liveCountEl.textContent = `Live Count: ${totalCount} people`;
          }
        } catch (e) {
          // Ignore errors for now
        }
      }
    }, 500); // Refresh every 500ms
  }

  function stopLiveFeedRefresh() {
    if (liveFeedInterval) {
      clearInterval(liveFeedInterval);
      liveFeedInterval = null;
    }
    // Only clear the feed when stopping detection
    if (!detectionRunning) {
      liveFeedImg.src = '';
    }
  }

  function startDashboardRefresh() {
    if (dashboardInterval) clearInterval(dashboardInterval);
    dashboardInterval = setInterval(async () => {
      if (analysisDashboardModal && analysisDashboardModal.style.display === 'flex') {
        // Fetch live status for real-time metrics
        try {
          const response = await fetch(`${BACKEND_URL}/status`);
          if (response.ok) {
            const data = await response.json();
            // Update dashboard metrics with live data
            dailyPeakEl.textContent = data.count || '0';
            peakTimeEl.textContent = `at ${data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '--:--'}`;
            dailyAverageEl.textContent = data.count || '0';
            dailyMinimumEl.textContent = data.count || '0';
            minTimeEl.textContent = `at ${data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '--:--'}`;
            busyHoursEl.textContent = data.count > 8 ? 'Now' : 'N/A';
          }
        } catch (e) {
          // Ignore errors for now
        }
      }
    }, 500);
  }

  function stopDashboardRefresh() {
    if (dashboardInterval) {
      clearInterval(dashboardInterval);
      dashboardInterval = null;
    }
  }

  // Fetch QR Code
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

  // Update Queue UI
  function updateQueueUI(queue) {
    queueItemsContainer.innerHTML = '';
    overflowQueueItems.innerHTML = '';
    const waiting = queue.filter(item => item.status === 'waiting');
    const processing = queue.find(item => item.status === 'processing');

    const crowdSize = getCrowdSize();
    if (crowdSize > 10 && waiting.length > 5) {
      const mainQueueItems = waiting.slice(0, 5);
      const overflowQueueItems = waiting.slice(5);
      mainQueueItems.forEach(item => renderQueueItem(item, queueItemsContainer));
      if (processing) renderQueueItem(processing, queueItemsContainer);
      overflowQueue.classList.add('show');
      mainContent.classList.add('with-overflow');
      overflowQueueItems.forEach(item => renderQueueItem(item, overflowQueueItems));
      overflowQueueStats.textContent = `Overflow: ${overflowQueueItems.length} customers`;
    } else {
      waiting.forEach(item => renderQueueItem(item, queueItemsContainer));
      if (processing) renderQueueItem(processing, queueItemsContainer);
      overflowQueue.classList.remove('show');
      mainContent.classList.remove('with-overflow');
    }

    queueStatsEl.textContent = `${waiting.length} ${waiting.length === 1 ? 'person' : 'people'} waiting`;
    nowServingEl.textContent = processing ? processing.queueNumber || '--' : '--';
    nextUpEl.textContent = waiting.length > 0 ? waiting[0].queueNumber || '--' : '--';
  }

  // Render Queue Item
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

  // Format Time
  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Get Crowd Size
  function getCrowdSize() {
    const queueSize = queue.filter(item => item.status === 'waiting').length;
    return queueSize + crowdAnalytics.currentCount;
  }

  // Update Crowd Analytics UI
  function updateCrowdAnalyticsUI() {
    currentCountEl.textContent = crowdAnalytics.currentCount;
    const totalCount = getCrowdSize();
    liveCountEl.textContent = `Live Count: ${totalCount} people`;
    
    // Update status based on count
    let status = 'Normal';
    let statusClass = 'status-normal';
    
    if (totalCount > 15) {
      status = 'Crowded';
      statusClass = 'status-crowded';
    } else if (totalCount > 8) {
      status = 'Busy';
      statusClass = 'status-busy';
    }
    
    crowdStatusEl.textContent = status;
    crowdStatusEl.className = `status-indicator ${statusClass}`;
    
    // Update average wait time
    avgWaitTimeEl.textContent = `Avg Wait: ${crowdAnalytics.avgWaitTime} min`;
  }

  // Add Notification
  function addNotification(message, type = 'info') {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    notifications.unshift({ id: Date.now(), message, type, time: timeString });
    if (notifications.length > 20) notifications.pop();
    notificationCount++;
    notificationBadge.textContent = notificationCount;
    notificationBadge.classList.add('show');
    showNotification(message);
    updateNotificationList();
  }

  // Show Notification
  function showNotification(message) {
    notificationMessage.textContent = message;
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 3000);
  }

  // Update Notification List
  function updateNotificationList() {
    notificationList.innerHTML = '';
    notifications.forEach(notif => {
      const notificationItem = document.createElement('div');
      notificationItem.className = `notification-item ${notif.type}`;
      notificationItem.innerHTML = `
        <div class="notification-time">${notif.time}</div>
        <div class="notification-message">${notif.message}</div>
        <button class="alert-action" onclick="markFalseAlarm(${notif.id})">False Alarm</button>
        <button class="alert-action" onclick="notifyAuthorities(${notif.id})">Notify Authorities</button>
      `;
      notificationList.appendChild(notificationItem);
    });
  }

  // Initialize Charts
  function initCharts() {
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
            title: { display: true, text: 'Number of People' } 
          }, 
          x: { 
            title: { display: true, text: 'Hour' } 
          } 
        } 
      }
    });

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
            title: { display: true, text: 'Average Visitors' } 
          } 
        } 
      }
    });
  }

  // Update Analytics Dashboard
  function updateAnalyticsDashboard(analyticsData) {
    dailyPeakEl.textContent = analyticsData.dailyPeak || '0';
    peakTimeEl.textContent = `at ${analyticsData.peakTime || 'N/A'}`;
    dailyAverageEl.textContent = analyticsData.dailyAverage || '0';
    dailyMinimumEl.textContent = analyticsData.dailyMinimum || '0';
    minTimeEl.textContent = `at ${analyticsData.minTime || 'N/A'}`;
    busyHoursEl.textContent = analyticsData.busyHours || 'N/A';
    
    if (analyticsData.hourlyData && charts.hourly) { 
      charts.hourly.data.datasets[0].data = analyticsData.hourlyData; 
      charts.hourly.update(); 
    }
    
    if (analyticsData.weeklyData && charts.weekly) { 
      charts.weekly.data.datasets[0].data = analyticsData.weeklyData; 
      charts.weekly.update(); 
    }
  }

  // Join Queue
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

  // Process Next
  async function processNext() {
    try {
      const response = await fetch('/api/queue/process-next', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      
      if (data.success) {
        addNotification(`Now serving ${data.data.name} (${data.data.queueNumber || 'N/A'})`, 'info');
        return data.data;
      } else {
        addNotification(data.error || 'Queue is empty!', 'warning');
        return null;
      }
    } catch (error) {
      console.error('Process next error:', error);
      addNotification(error.message || 'Failed to process next', 'error');
      return null;
    }
  }

  // Clear Queue
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

  // Check Detection Status
  async function checkDetectionStatus() {
    try {
      const response = await fetch(`${BACKEND_URL}/status`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      // Update UI based on status
      detectionRunning = data.running;
      startBtn.disabled = detectionRunning;
      stopBtn.disabled = !detectionRunning;
      
      if (detectionRunning) {
        addNotification('Crowd detection is active', 'info');
      }
      
      // Update crowd count if available
      if (data.count !== undefined) {
        crowdAnalytics.currentCount = data.count;
        updateCrowdAnalyticsUI();
      }
    } catch (error) {
      console.error('Status check error:', error);
      // Assume system is not running if we can't check
      detectionRunning = false;
      startBtn.disabled = false;
      stopBtn.disabled = true;
    }
  }

  // Start Detection
  async function startDetection() {
    try {
      const response = await fetch(`${BACKEND_URL}/start`, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      if (data.status === 'started') {
        detectionRunning = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        addNotification('Crowd detection started', 'success');
        startLiveFeedRefresh(); // Start refreshing live feed
      }
    } catch (error) {
      console.error('Start error:', error);
      addNotification('Failed to start detection', 'error');
    }
  }

  // Stop Detection
  async function stopDetection() {
    try {
      const response = await fetch(`${BACKEND_URL}/stop`, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      if (data.status === 'stopped') {
        detectionRunning = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        stopLiveFeedRefresh(); // Stop refreshing live feed
        // Reset crowd analytics
        crowdAnalytics.currentCount = 0;
        crowdAnalytics.status = 'Normal';
        crowdAnalytics.avgWaitTime = 0;
        // Update UI
        currentCountEl.textContent = '0';
        crowdStatusEl.textContent = 'Normal';
        crowdStatusEl.className = 'status-indicator status-normal';
        avgWaitTimeEl.textContent = 'Avg Wait: 0 min';
        liveCountEl.textContent = 'Live Count: 0 people';
        // Add notification
        addNotification('Crowd detection stopped', 'info');
      } else {
        throw new Error('Failed to stop detection');
      }
    } catch (error) {
      console.error('Stop error:', error);
      addNotification('Failed to stop detection', 'error');
    }
  }

  // Update Detection Overlay
  function updateDetectionOverlay(detections) {
    if (!detections || !Array.isArray(detections) || detections.length === 0) {
      detectionOverlay.innerHTML = '';
      return;
    }
    
    const videoWidth = liveFeedImg.clientWidth;
    const videoHeight = liveFeedImg.clientHeight;
    
    detectionOverlay.innerHTML = '';
    
    detections.forEach(detection => {
      const { x, y, width, height, confidence, label } = detection;
      const scaledX = x * videoWidth;
      const scaledY = y * videoHeight;
      const scaledWidth = width * videoWidth;
      const scaledHeight = height * videoHeight;
      
      const box = document.createElement('div');
      box.className = 'detection-box';
      box.style.left = `${scaledX}px`;
      box.style.top = `${scaledY}px`;
      box.style.width = `${scaledWidth}px`;
      box.style.height = `${scaledHeight}px`;
      
      const labelEl = document.createElement('div');
      labelEl.className = 'detection-label';
      labelEl.textContent = `${label || 'Person'} ${Math.round((confidence || 0.9) * 100)}%`;
      
      box.appendChild(labelEl);
      detectionOverlay.appendChild(box);
    });
  }

  // Event Listeners
  simulateJoinBtn.addEventListener('click', () => { 
    joinModal.style.display = 'flex'; 
    userNameInput.focus(); 
  });
  
  cancelJoinBtn.addEventListener('click', () => { 
    joinModal.style.display = 'none'; 
    userNameInput.value = ''; 
    userPhoneInput.value = ''; 
  });
  
  document.getElementById('joinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = userNameInput.value.trim();
    const phone = userPhoneInput.value.trim();
    
    if (!name) {
      userNameInput.focus();
      return;
    }
    
    await joinQueue(name, phone);
    joinModal.style.display = 'none';
    userNameInput.value = '';
    userPhoneInput.value = '';
  });
  
  processNextBtn.addEventListener('click', async () => {
    const result = await processNext();
    // Always refresh the queue after processing next
    try {
      const response = await fetch('/api/queue');
      if (response.ok) {
        queue = await response.json();
        updateQueueUI(queue);
      }
    } catch (error) {
      console.error('Error refreshing queue after processNext:', error);
    }
  });
  clearQueueBtn.addEventListener('click', clearQueue);
  
  liveMonitoringBtn.addEventListener('click', () => {
    liveMonitoringModal.style.display = 'flex';
    checkDetectionStatus();
    startLiveFeedRefresh(); // Start refreshing live feed
  });
  
  closeLiveMonitoringBtn.addEventListener('click', () => {
    liveMonitoringModal.style.display = 'none';
    stopLiveFeedRefresh(); // Stop refreshing live feed
    // Always stop detection when closing modal
    stopDetection();
    stopDashboardRefresh(); // Also stop dashboard refresh if open
  });
  
  // --- Dashboard Modal Logic Fix ---
  function showDashboardLoading() {
    dailyPeakEl.textContent = '...';
    peakTimeEl.textContent = 'Loading...';
    dailyAverageEl.textContent = '...';
    dailyMinimumEl.textContent = '...';
    minTimeEl.textContent = 'Loading...';
    busyHoursEl.textContent = '...';
  }

  showAnalysisDashboardBtn.addEventListener('click', () => {
    analysisDashboardModal.style.display = 'flex';
    stopDashboardRefresh(); // Always clear interval first
    showDashboardLoading();
    if (!charts.hourly || !charts.weekly) {
      initCharts();
    }
    // Fetch analytics data ONCE for historical charts
    fetch('/analytics')
      .then(response => response.json())
      .then(data => {
        updateAnalyticsDashboard(data);
        startDashboardRefresh(); // Start dynamic refresh for live metrics
      })
      .catch(error => {
        // Fallback to live data if analytics fails
        fetch(`${BACKEND_URL}/status`).then(r => r.json()).then(status => {
          updateAnalyticsDashboard({
            dailyPeak: status.count || '0',
            peakTime: status.timestamp ? `at ${new Date(status.timestamp).toLocaleTimeString()}` : 'N/A',
            dailyAverage: status.count || '0',
            dailyMinimum: status.count || '0',
            minTime: status.timestamp ? `at ${new Date(status.timestamp).toLocaleTimeString()}` : 'N/A',
            busyHours: status.count > 8 ? 'Now' : 'N/A',
            hourlyData: [],
            weeklyData: []
          });
          startDashboardRefresh();
        });
      });
  });

  closeAnalysisDashboardBtn.addEventListener('click', () => {
    analysisDashboardModal.style.display = 'none';
    stopDashboardRefresh(); // Stop dynamic refresh
  });
  
  toggleNotificationsBtn.addEventListener('click', () => {
    notificationPanel.classList.toggle('show');
    if (notificationPanel.classList.contains('show')) {
      notificationCount = 0;
      notificationBadge.textContent = '0';
      notificationBadge.classList.remove('show');
    }
  });
  
  closeNotificationsBtn.addEventListener('click', () => {
    notificationPanel.classList.remove('show');
  });
  
  startBtn.addEventListener('click', async () => {
    await startDetection();
    // After starting, update the live feed
    liveFeedImg.src = `${BACKEND_URL}/feed?t=${Date.now()}`;
  });
  
  stopBtn.addEventListener('click', async () => {
    stopBtn.disabled = true;
    stopBtn.classList.add('stopping');
    stopBtn.innerHTML = '<i class="fas fa-stop"></i> Stop <span class="spinner"></span>';
    await stopDetection();
    // After stopping, clear the live feed and reset button
    liveFeedImg.src = '';
    stopBtn.classList.remove('stopping');
    stopBtn.innerHTML = '<i class="fas fa-stop"></i> Stop';
    stopBtn.disabled = false;
  });

  // Detection socket event listeners
  detectionSocket.on('connect', () => {
    console.log('Connected to detection server');
    checkDetectionStatus();
  });

  detectionSocket.on('video_frame', (data) => {
    if (liveMonitoringModal.style.display === 'flex') {
      // Update live feed
      liveFeedImg.src = `data:image/jpeg;base64,${data.frame}`;
      
      // Update crowd count
      crowdAnalytics.currentCount = data.count;
      currentCountEl.textContent = data.count;
      
      // Update crowd status
      const status = data.metrics.status;
      crowdStatusEl.textContent = status;
      crowdStatusEl.className = `status-indicator status-${status.toLowerCase()}`;
      
      // Update average wait time
      crowdAnalytics.avgWaitTime = data.avg_wait;
      avgWaitTimeEl.textContent = `Avg Wait: ${data.avg_wait} min`;
      
      // Update live count
      const totalCount = getCrowdSize();
      liveCountEl.textContent = `Live Count: ${totalCount} people`;
      
      // Update analytics dashboard if visible
      if (analysisDashboardModal.style.display === 'flex') {
        updateAnalyticsDashboard({
          dailyPeak: data.metrics.peak,
          peakTime: new Date(data.timestamp).toLocaleTimeString(),
          dailyAverage: Math.round(data.metrics.peak * 0.7), // Example calculation
          dailyMinimum: Math.max(0, data.metrics.peak - 5), // Example calculation
          minTime: new Date(data.timestamp).toLocaleTimeString(),
          busyHours: '9AM - 5PM', // Example data
          hourlyData: generateHourlyData(data.metrics.peak),
          weeklyData: generateWeeklyData(data.metrics.peak)
        });
      }
      
      // Real-time crowd alert
      if (data.count > 15) {
        addNotification('⚠️ Crowd limit exceeded! Please manage the flow.', 'warning');
      }
      
      // Simulate face/iris recognition match (1% chance per frame)
      if (Math.random() < 0.01) {
        addNotification('🚨 Suspect matched: John Doe (ID: 12345)', 'error');
        showFaceMatchModal();
      }
      // Update risk bar
      updateRiskBar(data.count);
    }
  });

  // Helper functions for analytics data
  function generateHourlyData(peak) {
    const data = [];
    for (let i = 0; i < 9; i++) {
      data.push(Math.round(peak * (0.5 + Math.random() * 0.5)));
    }
    return data;
  }

  function generateWeeklyData(peak) {
    const data = [];
    for (let i = 0; i < 7; i++) {
      data.push(Math.round(peak * (0.6 + Math.random() * 0.4)));
    }
    return data;
  }

  // Queue socket event listeners
  queueSocket.on('queue_update', (updatedQueue) => {
    queue = updatedQueue;
    updateQueueUI(queue);
    const waiting = queue.filter(item => item.status === 'waiting').length;
    updateCrowdAnalyticsUI();
  });

  // Simulate Suspicious Activity Button
  if (simulateCrimeBtn) {
    simulateCrimeBtn.addEventListener('click', showSuspiciousOverlay);
  }

  // Initialize application
  async function initialize() {
    // Fetch QR code
    await fetchQRCode();
    
    // Fetch initial queue
    try {
      const response = await fetch('/api/queue');
      if (response.ok) {
        queue = await response.json();
        updateQueueUI(queue);
      }
    } catch (error) {
      console.error('Initial queue fetch error:', error);
    }
    
    // Check detection status
    await checkDetectionStatus();
  }

  // Start the application
  initialize();

  // 1. Risk Bar update
  function updateRiskBar(count) {
    const bar = document.getElementById('riskBar');
    if (!bar) return;
    if (count > 15) bar.style.background = 'red';
    else if (count > 8) bar.style.background = 'orange';
    else bar.style.background = 'green';
  }

  // 2. Face Match Modal logic
  function showFaceMatchModal() {
    document.getElementById('faceMatchModal').style.display = 'flex';
  }
  document.getElementById('closeFaceMatchModal').onclick = function() {
    document.getElementById('faceMatchModal').style.display = 'none';
  };

  // 3. Evacuate button logic
  const evacuateBtn = document.getElementById('evacuateBtn');
  if (evacuateBtn) {
    evacuateBtn.addEventListener('click', () => {
      const banner = document.createElement('div');
      banner.textContent = '🚨 EMERGENCY EVACUATION! Please leave the area immediately!';
      banner.style.position = 'fixed';
      banner.style.top = '40%';
      banner.style.left = '50%';
      banner.style.transform = 'translate(-50%, -50%)';
      banner.style.background = 'red';
      banner.style.color = '#fff';
      banner.style.fontSize = '2rem';
      banner.style.padding = '30px 60px';
      banner.style.borderRadius = '20px';
      banner.style.zIndex = '9999';
      document.body.appendChild(banner);
      // Play beep
      const beep = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
      beep.play();
      setTimeout(() => banner.remove(), 5000);
    });
  }

  // 4. Notification panel action buttons
  function updateNotificationList() {
    notificationList.innerHTML = '';
    notifications.forEach(notif => {
      const notificationItem = document.createElement('div');
      notificationItem.className = `notification-item ${notif.type}`;
      notificationItem.innerHTML = `
        <div class="notification-time">${notif.time}</div>
        <div class="notification-message">${notif.message}</div>
        <button class="alert-action" onclick="markFalseAlarm(${notif.id})">False Alarm</button>
        <button class="alert-action" onclick="notifyAuthorities(${notif.id})">Notify Authorities</button>
      `;
      notificationList.appendChild(notificationItem);
    });
  }
  window.markFalseAlarm = function(id) {
    addNotification('Alert marked as false alarm.', 'info');
  };
  window.notifyAuthorities = function(id) {
    addNotification('Authorities notified!', 'success');
  };

  // 5. Suspicious overlay logic
  function showSuspiciousOverlay() {
    detectionOverlay.innerHTML = '';
    const box = document.createElement('div');
    box.style.position = 'absolute';
    box.style.left = '30%';
    box.style.top = '30%';
    box.style.width = '40%';
    box.style.height = '40%';
    box.style.border = '4px solid red';
    box.style.zIndex = '10';
    detectionOverlay.appendChild(box);
    const banner = document.createElement('div');
    banner.textContent = `🚨 Suspicious Behavior Detected (${new Date().toLocaleTimeString()})`;
    banner.style.position = 'absolute';
    banner.style.top = '10px';
    banner.style.left = '50%';
    banner.style.transform = 'translateX(-50%)';
    banner.style.background = 'rgba(255,0,0,0.8)';
    banner.style.color = '#fff';
    banner.style.padding = '8px 20px';
    banner.style.borderRadius = '8px';
    banner.style.fontWeight = 'bold';
    banner.style.zIndex = '20';
    detectionOverlay.appendChild(banner);
  }

  // 1. Tab switching logic
  const tabBtns = document.querySelectorAll('.tab-btn');
  const sections = ['mainSection', 'heatmapSection', 'trackingSection', 'reportsSection', 'predictionSection'];
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sections.forEach(sec => document.getElementById(sec).style.display = 'none');
      document.getElementById(btn.dataset.tab).style.display = '';
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  document.querySelector('.tab-btn[data-tab="mainSection"]').classList.add('active');

  // 2. Simulate heatmap drawing
  function drawHeatmap() {
    const canvas = document.getElementById('heatmapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Simulate 6 zones
    const zones = [
      {x:0, y:0, w:200, h:100, level:'green'},
      {x:200, y:0, w:200, h:100, level:'orange'},
      {x:400, y:0, w:200, h:100, level:'red'},
      {x:0, y:100, w:200, h:100, level:'green'},
      {x:200, y:100, w:200, h:100, level:'orange'},
      {x:400, y:100, w:200, h:100, level:'red'}
    ];
    zones.forEach(z => {
      ctx.fillStyle = z.level;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(z.x, z.y, z.w, z.h);
    });
  }
  drawHeatmap();

  // 3. Tracking path is already in SVG, just show section

  // 4. Reports charts
  let barChart, pieChart;
  function drawReportsCharts() {
    const barCtx = document.getElementById('reportBarChart').getContext('2d');
    const pieCtx = document.getElementById('reportPieChart').getContext('2d');
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
        datasets: [{
          label: 'Faces Detected',
          data: [12, 15, 10, 18, 20, 25, 14],
          backgroundColor: 'rgba(0,212,255,0.7)'
        }]
      },
      options: {responsive:true, plugins:{legend:{display:false}}}
    });
    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: ['Normal','Threat','Overcrowd'],
        datasets: [{
          data: [80, 10, 10],
          backgroundColor: ['#00cc66','#ff3860','#ffcc00']
        }]
      },
      options: {responsive:true}
    });
  }
  drawReportsCharts();

  // 5. Prediction chart
  let predictionChart;
  function drawPredictionChart() {
    const ctx = document.getElementById('predictionChart').getContext('2d');
    predictionChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Now','+1hr','+3hr','+6hr'],
        datasets: [{
          label: 'Predicted Crowd',
          data: [10, 20, 30, 25],
          borderColor: '#6b48ff',
          backgroundColor: 'rgba(107,72,255,0.1)',
          fill: true
        }]
      },
      options: {responsive:true}
    });
  }
  drawPredictionChart();
  document.getElementById('predictionLocation').addEventListener('change', function() {
    // Simulate new prediction data
    const vals = [
      [10, 20, 30, 25],
      [5, 15, 25, 20],
      [8, 18, 28, 22],
      [12, 22, 32, 28]
    ];
    const idx = this.selectedIndex;
    predictionChart.data.datasets[0].data = vals[idx];
    predictionChart.update();
  });

  // 6. Show detected face in faceSnapshotPanel (demo: random image on face match)
  function showDetectedFace() {
    const img = document.getElementById('faceSnapshotImg');
    img.src = 'https://randomuser.me/api/portraits/men/' + (Math.floor(Math.random()*90)+10) + '.jpg';
    document.getElementById('faceMatchInfo').innerHTML = '<b>Name:</b> John Doe<br><b>ID:</b> 12345<br><span style="color:red;font-weight:bold;">Suspect Matched!</span>';
  }
  // Call showDetectedFace() when a face match is simulated

  // 7. Evacuate Now button logic
  const evacuateNowBtn = document.getElementById('evacuateNowBtn');
  evacuateNowBtn.addEventListener('click', () => {
    const banner = document.createElement('div');
    banner.textContent = '🚨 EMERGENCY EVACUATION! Please leave the area immediately!';
    banner.style.position = 'fixed';
    banner.style.top = '40%';
    banner.style.left = '50%';
    banner.style.transform = 'translate(-50%, -50%)';
    banner.style.background = 'red';
    banner.style.color = '#fff';
    banner.style.fontSize = '2rem';
    banner.style.padding = '30px 60px';
    banner.style.borderRadius = '20px';
    banner.style.zIndex = '9999';
    document.body.appendChild(banner);
    // Play beep
    const beep = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
    beep.play();
    setTimeout(() => banner.remove(), 5000);
  });

  // 8. Integrate with detectionSocket for demo realism
  // (Show detected face and update risk bar on real detection)
  detectionSocket.on('video_frame', (data) => {
    if (liveMonitoringModal.style.display === 'flex') {
      liveFeedImg.src = `data:image/jpeg;base64,${data.frame}`;
      crowdAnalytics.currentCount = data.count;
      currentCountEl.textContent = data.count;
      if (data.count > 15) {
        addNotification('⚠️ Crowd limit exceeded! Please manage the flow.', 'warning');
      }
      if (Math.random() < 0.01) {
        addNotification('🚨 Suspect matched: John Doe (ID: 12345)', 'error');
        showFaceMatchModal();
        showDetectedFace();
      }
      updateRiskBar(data.count);
    }
  });
});