// ---------------- wsManager ----------------
const wsManager = {
  ws: null,
  wsUrl: 'ws://127.0.0.1:10044',
  connecting: false,
  reconnectTimer: null,

  init() {
    chrome.storage.local.get({ wsUrl: this.wsUrl }, (data) => {
      this.wsUrl = data.wsUrl;
      this.connect();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.wsUrl) {
        this.wsUrl = changes.wsUrl.newValue;
        this.reconnect(true);
      }
    });
  },

  connect() {
    if (this.ws || this.connecting) return;
    this.connecting = true;

    console.log('[wsManager] Connecting to', this.wsUrl);
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log('[wsManager] WebSocket connected', this.wsUrl);
      this.connecting = false;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received JSON:', data);
        handleOJ(data.url, data.code);
      } catch (err) {
        console.error('[wsManager] Failed to parse message:', event.data, err);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[wsManager] WebSocket error', err);
    };

    this.ws.onclose = () => {
      console.log('[wsManager] WebSocket disconnected, retrying in 1s...');
      this.ws = null;
      this.connecting = false;
      this.scheduleReconnect();
    };
  },

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 1000);
  },

  reconnect(force = false) {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.connecting = false;
    this.connect();
  },

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[wsManager] Cannot send, WebSocket not open');
    }
  },
};

// ---------------- 消息队列与发送机制 ----------------
const messageQueue = new Map(); // tabId -> [{msg, timestamp}]

function enqueueMessage(tabId, msg) {
  if (!messageQueue.has(tabId)) messageQueue.set(tabId, []);
  messageQueue.get(tabId).push({ msg, timestamp: Date.now() });
}

function flushQueue(tabId) {
  const queue = messageQueue.get(tabId);
  if (!queue || queue.length === 0) return;

  queue.forEach(item => {
    // 超过10秒的消息丢弃
    if (Date.now() - item.timestamp > 10000) return;

    chrome.scripting.executeScript(
      {
        target: { tabId: tabId },
        files: ['content_script.js'] // content script 文件
      },
      () => {
        chrome.tabs.sendMessage(tabId, item.msg, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('Message failed, will retry:', chrome.runtime.lastError.message);
          }
        });
      }
    );
  });

  // 清空队列
  messageQueue.set(tabId, []);
}

// ---------------- OJ 分发逻辑 ----------------
function handleOJ(url, code) {
  let submitInfo = [];

  if (url.includes('luogu.com.cn')) {
    submitInfo.push({ url: url + '#submit', code });
  } else if (url.includes('codeforces.com')) {
    let submitUrl = '';
    let problemId = '';
    if (url.includes('/contest/')) {
      const match = url.match(/\/contest\/(\d+)\/problem\/([A-Z])/);
      if (match) {
        const contestId = match[1];
        const problemLetter = match[2];
        submitUrl = `https://codeforces.com/contest/${contestId}/submit`;
        problemId = problemLetter;
      }
    } else if (url.includes('/problemset/')) {
      const match = url.match(/\/problemset\/problem\/(\d+)\/([A-Z])/);
      if (match) {
        const problemNumber = match[1];
        const problemLetter = match[2];
        submitUrl = `https://codeforces.com/problemset/submit`;
        problemId = problemNumber + problemLetter;
      }
    }
    if (submitUrl && problemId) submitInfo.push({ url: submitUrl, code: { code, problem: problemId } });
  } else if (url.includes('nowcoder.com')) {
    submitInfo.push({ url, code });
  } else {
    console.log('Default action:', { url, code });
  }

  submitInfo.forEach(info => openTabAndSendMessage(info.url, info.code));
}

// ---------------- 打开标签页并发送消息 ----------------
function openTabAndSendMessage(url, code) {
  chrome.tabs.create({ url }, (tab) => {
    const tabId = tab.id;

    function trySend() {
      enqueueMessage(tabId, { url, code });
      flushQueue(tabId);
    }

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        trySend();
        chrome.tabs.onUpdated.removeListener(listener);
      }
    }

    chrome.tabs.onUpdated.addListener(listener);

    // 防止 content script 延迟注入
    setTimeout(trySend, 500); // 500ms 后尝试发送一次
  });
}

// ---------------- 初始化 ----------------
wsManager.init();

