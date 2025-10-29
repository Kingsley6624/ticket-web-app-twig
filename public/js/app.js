// public/js/app.js
(function () {
  'use strict';

  const USERS_KEY = 'ticketapp_users';
  const SESSION_KEY = 'ticketapp_session';
  const TICKETS_KEY = 'ticketapp_tickets';

  // ======= Small toast system (non-blocking) =======
  function showToast(message, type = 'info', ttl = 3000) {
    const container = document.getElementById('toastContainer') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role','status');
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(()=> toast.remove(), 300);
    }, ttl);
  }

  function createToastContainer() {
    const c = document.createElement('div');
    c.id = 'toastContainer';
    c.setAttribute('aria-live','polite');
    c.setAttribute('aria-atomic','true');
    document.body.appendChild(c);
    return c;
  }

  // ======= Confirm modal =======
  function showConfirm(message) {
    return new Promise(resolve => {
      const modal = document.getElementById('confirmModal');
      const msgEl = document.getElementById('confirmMessage');
      const yesBtn = document.getElementById('confirmYes');
      const noBtn = document.getElementById('confirmNo');

      if (!modal || !msgEl || !yesBtn || !noBtn) {
        console.warn('Confirm modal missing in HTML');
        return resolve(false);
      }

      msgEl.textContent = message;
      modal.classList.remove('hidden');

      function cleanup(result) {
        modal.classList.add('hidden');
        yesBtn.removeEventListener('click', yesHandler);
        noBtn.removeEventListener('click', noHandler);
        resolve(result);
      }

      function yesHandler() { cleanup(true); }
      function noHandler() { cleanup(false); }

      yesBtn.addEventListener('click', yesHandler);
      noBtn.addEventListener('click', noHandler);
    });
  }

  // ======= Storage helpers =======
  const getUsers = () => JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  const saveUsers = users => localStorage.setItem(USERS_KEY, JSON.stringify(users));
  const createSession = email => localStorage.setItem(SESSION_KEY, JSON.stringify({ email, token:`${Date.now()}-${Math.random().toString(36).slice(2,9)}` }));
  const getSession = () => JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  const clearSession = () => localStorage.removeItem(SESSION_KEY);

  const getTickets = () => JSON.parse(localStorage.getItem(TICKETS_KEY) || '[]');
  const saveTickets = list => localStorage.setItem(TICKETS_KEY, JSON.stringify(list));

  // ======= Page helpers =======
  const params = new URLSearchParams(window.location.search);
  const page = params.get('page') || 'home';
  const protectedPages = ['dashboard', 'tickets'];

  if (protectedPages.includes(page) && !getSession()) {
    showToast('Your session has expired — please log in again.', 'error');
    setTimeout(()=> window.location.href = '?page=auth/login', 800);
  }

  // ======= Authentication =======
  document.addEventListener('DOMContentLoaded', () => {
    // SIGNUP
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
      signupForm.addEventListener('submit', e => {
        e.preventDefault();
        const name = (signupForm.querySelector('input[name="name"]')?.value || '').trim();
        const email = (signupForm.querySelector('input[name="email"]')?.value || '').trim().toLowerCase();
        const password = (signupForm.querySelector('input[name="password"]')?.value || '').trim();

        if (!name) return showToast('Name is required', 'error');
        if (!email) return showToast('Email is required', 'error');
        if (!/^\S+@\S+\.\S+$/.test(email)) return showToast('Please enter a valid email', 'error');
        if (!password || password.length < 6) return showToast('Password must be at least 6 characters', 'error');

        const users = getUsers();
        if (users.some(u => u.email === email)) return showToast('Email already registered. Please log in.', 'error');

        users.push({ name, email, password });
        saveUsers(users);
        showToast('Signup successful — please login', 'success');
        setTimeout(()=> window.location.href = '?page=auth/login', 800);
      });
    }

    // LOGIN
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', e => {
        e.preventDefault();
        const email = (loginForm.querySelector('input[name="email"]')?.value || '').trim().toLowerCase();
        const password = (loginForm.querySelector('input[name="password"]')?.value || '').trim();
        if (!email) return showToast('Email is required', 'error');
        if (!password) return showToast('Password is required', 'error');

        const user = getUsers().find(u => u.email === email && u.password === password);
        if (!user) return showToast('Invalid email or password', 'error');

        createSession(user.email);
        showToast('Login successful', 'success');
        setTimeout(()=> window.location.href = '?page=dashboard', 600);
      });
    }

    // LOGOUT (modal)
    const logoutBtns = document.querySelectorAll('#logoutBtn');
    logoutBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const confirmed = await showConfirm('Are you sure you want to logout?');
        if (!confirmed) return;
        clearSession();
        showToast('Logged out — redirecting', 'info');
        setTimeout(()=> window.location.href = '?page=auth/login', 600);
      });
    });

    // DASHBOARD
    if (page === 'dashboard') renderDashboard();

    // TICKETS
    if (page === 'tickets') initTicketsPage();
  });

  // ======= Dashboard =======
  function renderDashboard() {
    const tickets = getTickets();
    const totalEl = document.getElementById('totalTickets');
    const openEl = document.getElementById('openTickets');
    const closedEl = document.getElementById('closedTickets');
    if (totalEl) totalEl.textContent = tickets.length;
    if (openEl) openEl.textContent = tickets.filter(t => t.status==='open' || t.status==='in_progress').length;
    if (closedEl) closedEl.textContent = tickets.filter(t => t.status==='closed').length;
  }

  // ======= Tickets CRUD =======
  function initTicketsPage() {
    const form = document.getElementById('ticketForm');
    const ticketList = document.getElementById('ticketList');
    const submitBtn = document.getElementById('submitBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const titleInput = document.getElementById('title');
    const statusInput = document.getElementById('status');
    const priorityInput = document.getElementById('priority');
    const descriptionInput = document.getElementById('description');
    const ticketIdInput = document.getElementById('ticketId');
    const titleError = document.getElementById('titleError');
    const statusError = document.getElementById('statusError');
    const priorityError = document.getElementById('priorityError');

    const ALLOWED_STATUSES = ['open','in_progress','closed'];

    function clearErrors() {
      if (titleError) titleError.textContent = '';
      if (statusError) statusError.textContent = '';
      if (priorityError) priorityError.textContent = '';
    }

    function validateForm() {
      clearErrors();
      let ok = true;
      const title = (titleInput.value || '').trim();
      const status = (statusInput.value || '').trim();
      const priority = (priorityInput.value || '').trim();

      if (!title) { if (titleError) titleError.textContent='Title is required'; ok=false; }
      else if (title.length>200) { if(titleError) titleError.textContent='Title too long (max 200 chars)'; ok=false; }
      if (!ALLOWED_STATUSES.includes(status)) { if(statusError) statusError.textContent='Status must be one of open, in_progress, closed'; ok=false; }
      if (priority && !['low','normal','high',''].includes(priority)) { if(priorityError) priorityError.textContent='Invalid priority'; ok=false; }
      return ok;
    }

    function renderList() {
      const tickets = getTickets();
      if (!ticketList) return;
      if (tickets.length===0) { ticketList.innerHTML='<p class="muted">No tickets found. Create one above.</p>'; return; }
      ticketList.innerHTML = tickets.map((t,idx)=>{
        const statusClass = t.status==='open'?'status-open':t.status==='in_progress'?'status-in_progress':'status-closed';
        const desc = t.description?`<p class="muted small">${escapeHtml(t.description)}</p>`:'<p class="muted small">No description</p>';
        const priority = t.priority?`<div class="chip priority">${escapeHtml(t.priority)}</div>`:'';
        return `<article class="ticket-card ${statusClass}" data-idx="${idx}" role="article" aria-label="${escapeHtml(t.title)}">
          <div class="ticket-top"><h3 class="ticket-title">${escapeHtml(t.title)}</h3>${priority}</div>
          ${desc}
          <div class="ticket-meta"><strong>Status:</strong> ${escapeHtml(t.status)}</div>
          <div class="ticket-actions">
            <button class="btn-secondary edit-btn" data-idx="${idx}" aria-label="Edit ${escapeHtml(t.title)}">Edit</button>
            <button class="btn-danger delete-btn" data-idx="${idx}" aria-label="Delete ${escapeHtml(t.title)}">Delete</button>
          </div>
        </article>`;
      }).join('');
      attachListListeners();
    }

    async function attachListListeners() {
      document.querySelectorAll('.edit-btn').forEach(btn=>{
        btn.addEventListener('click',()=>startEdit(Number(btn.dataset.idx)));
      });
      document.querySelectorAll('.delete-btn').forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          const idx = Number(btn.dataset.idx);
          const confirmed = await showConfirm('Delete this ticket?');
          if (!confirmed) return;
          const tickets = getTickets();
          tickets.splice(idx,1);
          saveTickets(tickets);
          showToast('Ticket deleted', 'success');
          renderList();
          renderDashboard();
        });
      });
    }

    function startEdit(idx){
      const tickets = getTickets();
      const t = tickets[idx];
      if(!t) return;
      ticketIdInput.value = String(idx);
      titleInput.value = t.title || '';
      statusInput.value = t.status || '';
      priorityInput.value = t.priority || '';
      descriptionInput.value = t.description || '';
      submitBtn.textContent = 'Update Ticket';
      cancelBtn.hidden = false;
      titleInput.focus();
    }

    function resetForm(){
      ticketIdInput.value='';
      titleInput.value='';
      statusInput.value='';
      priorityInput.value='';
      descriptionInput.value='';
      submitBtn.textContent='Create Ticket';
      cancelBtn.hidden=true;
      clearErrors();
    }

    form.addEventListener('submit', e=>{
      e.preventDefault();
      if(!validateForm()) return;
      const tickets = getTickets();
      const idVal = ticketIdInput.value;
      const payload = {
        id: idVal ? tickets[idVal].id : Date.now(),
        title: titleInput.value.trim(),
        status: statusInput.value.trim(),
        priority: priorityInput.value || '',
        description: descriptionInput.value.trim(),
        createdAt: new Date().toISOString()
      };
      if(idVal){ tickets[idVal]=payload; showToast('Ticket updated','success'); }
      else { tickets.push(payload); showToast('Ticket created','success'); }
      saveTickets(tickets);
      resetForm();
      renderList();
      renderDashboard();
    });

    cancelBtn.addEventListener('click', ()=>resetForm());
    renderList();
  }

  function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]); }

})();
