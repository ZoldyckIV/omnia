/**
 * Simple Engagement Congratulation Page Logic
 * Reads and writes directly to wishes.json via relative endpoint (works in subfolders like /omnia/)
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'omnia_real_wishes';
  const ADMIN_PASSCODE = '1234'; // كلمة المرور السرية للإدارة
  
  // Relative API endpoint so it works inside any subfolder (e.g. /omnia/)
  const API_ENDPOINT = 'api.php';
  const JSON_FILE = 'wishes.json';

  const form = document.getElementById('congratsForm');
  const senderNameInput = document.getElementById('senderName');
  const senderMessageInput = document.getElementById('senderMessage');
  const messagesList = document.getElementById('messagesList');
  const msgCount = document.getElementById('msgCount');
  const waxSeal = document.querySelector('.wax-seal-wrapper');

  let currentMessages = [];
  let isAdmin = sessionStorage.getItem('omnia_admin_mode') === 'true';

  // Check URL for ?admin=1234
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('admin') === ADMIN_PASSCODE || urlParams.get('admin') === 'true') {
    isAdmin = true;
    sessionStorage.setItem('omnia_admin_mode', 'true');
  }

  // Load messages from server (reads wishes.json)
  async function loadMessages() {
    // 1. Try reading via api.php
    try {
      const res = await fetch(`${API_ENDPOINT}?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          currentMessages = data;
          saveLocalBackup(data);
          renderMessages();
          return;
        }
      }
    } catch (e) {
      console.warn('api.php unavailable, trying direct wishes.json', e);
    }

    // 2. Try direct wishes.json fetch
    try {
      const res = await fetch(`${JSON_FILE}?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          currentMessages = data;
          saveLocalBackup(data);
          renderMessages();
          return;
        }
      }
    } catch (e) {
      console.warn('Direct wishes.json fetch failed', e);
    }

    // 3. Fallback to localStorage backup
    currentMessages = getLocalBackup();
    renderMessages();
  }

  // Local storage helpers
  function getLocalBackup() {
    try {
      const d = localStorage.getItem(STORAGE_KEY);
      return d ? JSON.parse(d) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocalBackup(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  // Save new message to wishes.json via api.php
  async function saveMessageToServer(entry) {
    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      if (res.ok) {
        const result = await res.json();
        if (result.list && Array.isArray(result.list)) {
          currentMessages = result.list;
          saveLocalBackup(currentMessages);
          renderMessages();
          return true;
        }
      }
    } catch (e) {
      console.warn('Could not post to api.php', e);
    }

    // Local fallback
    currentMessages.unshift(entry);
    saveLocalBackup(currentMessages);
    renderMessages();
    return false;
  }

  // Delete message from wishes.json via api.php
  async function deleteMessageFromServer(id) {
    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: id })
      });
      if (res.ok) {
        const result = await res.json();
        if (result.list && Array.isArray(result.list)) {
          currentMessages = result.list;
          saveLocalBackup(currentMessages);
          renderMessages();
          return;
        }
      }
    } catch (e) {
      console.warn('Could not delete via api.php', e);
    }

    // Local fallback delete
    currentMessages = currentMessages.filter(item => String(item.id) !== String(id));
    saveLocalBackup(currentMessages);
    renderMessages();
  }

  // Render messages
  function renderMessages() {
    msgCount.textContent = currentMessages.length;

    updateAdminUI();

    if (currentMessages.length === 0) {
      messagesList.innerHTML = `
        <div class="empty-msg">
          لا توجد تهاني مسجلة بعد، كُن أول من يكتب تهنئة للعروس 🤍
        </div>
      `;
      return;
    }

    messagesList.innerHTML = currentMessages.map(item => `
      <div class="message-card" data-id="${item.id}">
        <div class="message-header">
          <div class="sender-info">
            <strong class="sender-name">${escapeHtml(item.name)}</strong>
            <span class="message-time">${escapeHtml(item.time)}</span>
          </div>
          ${isAdmin ? `
            <button type="button" class="delete-msg-btn" data-id="${item.id}" title="اضغط لحذف هذه التهنئة">
              🗑️ حذف
            </button>
          ` : ''}
        </div>
        <div class="message-body">${escapeHtml(item.message)}</div>
      </div>
    `).join('');
  }

  // Escape HTML
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Format date and time
  function formatDateTime() {
    const now = new Date();
    return now.toLocaleDateString('ar-EG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Form submission handler
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const name = senderNameInput.value.trim();
    const message = senderMessageInput.value.trim();

    if (!name || !message) return;

    const newEntry = {
      id: 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: name,
      message: message,
      time: formatDateTime()
    };

    senderNameInput.value = '';
    senderMessageInput.value = '';

    await saveMessageToServer(newEntry);
    senderNameInput.focus();
  });

  // Handle comment deletion (Only available in Admin Mode)
  messagesList.addEventListener('click', async function (e) {
    const deleteBtn = e.target.closest('.delete-msg-btn');
    if (!deleteBtn) return;

    e.preventDefault();
    e.stopPropagation();

    const targetId = String(deleteBtn.getAttribute('data-id'));

    // Second click: Confirm and delete!
    if (deleteBtn.classList.contains('confirming')) {
      deleteBtn.textContent = '⏳ جاري الحذف...';
      await deleteMessageFromServer(targetId);
      return;
    }

    // First click: Request confirmation inline
    deleteBtn.classList.add('confirming');
    deleteBtn.innerHTML = '⚠️ تأكيد الحذف؟';
    deleteBtn.style.background = '#c53030';
    deleteBtn.style.color = '#ffffff';
    deleteBtn.style.borderColor = '#c53030';

    // Auto revert after 4 seconds
    setTimeout(() => {
      if (deleteBtn && deleteBtn.isConnected) {
        deleteBtn.classList.remove('confirming');
        deleteBtn.innerHTML = '🗑️ حذف';
        deleteBtn.style.background = '';
        deleteBtn.style.color = '';
        deleteBtn.style.borderColor = '';
      }
    }, 4000);
  });

  // Secret Admin Activation Trigger
  let clickCount = 0;
  let clickTimer = null;

  if (waxSeal) {
    waxSeal.style.cursor = 'pointer';
    waxSeal.addEventListener('click', function () {
      clickCount++;

      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        clickCount = 0;
      }, 1200);

      if (clickCount >= 3) {
        clickCount = 0;
        toggleAdminMode();
      }
    });
  }

  function toggleAdminMode() {
    if (isAdmin) {
      const exit = confirm('أنت الآن في وضع الإدارة 🔓\nهل تريد الخروج وإخفاء أزرار الحذف؟');
      if (exit) {
        isAdmin = false;
        sessionStorage.removeItem('omnia_admin_mode');
        renderMessages();
        alert('تم إغلاق وضع الإدارة.');
      }
    } else {
      const pass = prompt('🔐 وضع الإدارة المخفي:\nيرجى إدخال كلمة المرور السرية لمسح التعليقات:');
      if (pass === ADMIN_PASSCODE) {
        isAdmin = true;
        sessionStorage.setItem('omnia_admin_mode', 'true');
        renderMessages();
        alert('تم تفعيل وضع الإدارة بنجاح! 🔓\nيمكنك الآن مسح أي تعليق بالضغط على زر الحذف.');
      } else if (pass !== null) {
        alert('كلمة المرور غير صحيحة!');
      }
    }
  }

  function updateAdminUI() {
    let adminBar = document.getElementById('adminModeBanner');
    if (isAdmin) {
      if (!adminBar) {
        adminBar = document.createElement('div');
        adminBar.id = 'adminModeBanner';
        adminBar.className = 'admin-badge-banner';
        adminBar.innerHTML = `
          <span>🔓 وضع الإدارة مفعل (أنت فقط ترى هذا)</span>
          <button id="exitAdminBtn" class="exit-admin-btn">إخفاء أزرار الحذف 🔒</button>
        `;
        document.body.prepend(adminBar);
        document.getElementById('exitAdminBtn').addEventListener('click', () => {
          isAdmin = false;
          sessionStorage.removeItem('omnia_admin_mode');
          adminBar.remove();
          renderMessages();
        });
      }
    } else {
      if (adminBar) adminBar.remove();
    }
  }

  // Initial load
  loadMessages();

})();
