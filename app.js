'use strict';

const state = {
  user: null,
  reviews: [],
  messages: {},
  activeChannel: 'general',
  ratings: { overall: 0, difficulty: 0, workload: 0 },
};

const AVATAR_COLORS = [
  '#2B6CB0','#276749','#6B46C1','#C05621','#2C7A7B',
  '#97266D','#B7791F','#2A4365','#285E61','#553C9A'
];

const channelDescs = {
  'general':      'General student discussion',
  'course-help':  'Ask for help on specific courses',
  'study-groups': 'Find and form study groups',
  'internships':  'Co-op and internship tips',
  'campus-life':  'Events, clubs and campus news',
  'textbooks':    'Buy, sell and share textbooks',
};

// ===== INIT =====
function init() {
  loadFromStorage();
  buildStarInputs();
  renderReviews();
  renderMessages();
  renderCourses();
  updateStats();
  attachEvents();
  attachAutocomplete();
  listenForInstallPrompt();
}

// ===== STORAGE =====
function loadFromStorage() {
  try {
    const r = localStorage.getItem('dal_reviews');
    const m = localStorage.getItem('dal_messages');
    const u = localStorage.getItem('dal_user');
    if (r) state.reviews  = JSON.parse(r);
    if (m) state.messages = JSON.parse(m);
    if (u) { state.user = JSON.parse(u); updateLoginUI(); }
  } catch (e) { /* silent */ }
}

function save() {
  localStorage.setItem('dal_reviews',  JSON.stringify(state.reviews));
  localStorage.setItem('dal_messages', JSON.stringify(state.messages));
}

// ===== NAVIGATION =====
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(page + '-page').classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  if (page === 'channel') renderMessages();
  if (page === 'courses') renderCourses();
}

// ===== STAR INPUTS =====
function buildStarInputs() {
  ['ratingOverall','ratingDifficulty','ratingWorkload'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const field = el.dataset.field;
    el.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const s = document.createElement('span');
      s.className = 'star';
      s.textContent = '★';
      s.dataset.val = i;
      s.addEventListener('click',      () => setRating(field, i, el));
      s.addEventListener('mouseenter', () => updateStars(i, el));
      s.addEventListener('mouseleave', () => updateStars(state.ratings[field], el));
      el.appendChild(s);
    }
  });
}

function setRating(field, val, el) {
  state.ratings[field] = val;
  updateStars(val, el);
}

function updateStars(val, el) {
  el.querySelectorAll('.star').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.val) <= val);
  });
}

// ===== RENDER REVIEWS =====
function renderReviews() {
  const search      = (document.getElementById('searchInput')?.value  || '').toLowerCase();
  const dept        =  document.getElementById('filterDept')?.value   || '';
  const ratingFilter= parseInt(document.getElementById('filterRating')?.value || '0');

  let filtered = [...state.reviews].filter(r => {
    const matchSearch = !search ||
      r.courseCode.toLowerCase().includes(search) ||
      r.courseName.toLowerCase().includes(search) ||
      r.prof?.toLowerCase().includes(search);
    const matchDept   = !dept || r.courseCode.startsWith(dept);
    const matchRating = !ratingFilter || r.overall >= ratingFilter;
    return matchSearch && matchDept && matchRating;
  }).sort((a, b) => b.id - a.id);

  const list  = document.getElementById('reviewsList');
  const empty = document.getElementById('reviewsEmpty');

  if (!filtered.length) {
    list.innerHTML = '';
    const query = search || dept || ratingFilter;
    empty.innerHTML = query
      ? `<div class="empty-icon">🔍</div>
         <h3>No reviews for "${escapeHtml(document.getElementById('searchInput').value || '')}" yet</h3>
         <p>Be the first to review this course!</p>
         <button class="btn-primary" style="margin-top:1rem;" onclick="document.getElementById('openReviewForm').click()">Write the First Review</button>`
      : `<div class="empty-icon">📝</div>
         <h3>No reviews yet</h3>
         <p>Be the first Dalhousie student to share your course experience!</p>`;
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = `<div class="reviews-list">${filtered.map(reviewCard).join('')}</div>`;

  list.querySelectorAll('.helpful-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleHelpful(parseInt(btn.dataset.id)));
  });
}

function reviewCard(r) {
  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
  const initials = r.author.split(' ').map(w => w[0]).join('').toUpperCase();
  const color = AVATAR_COLORS[r.id % AVATAR_COLORS.length];
  const recMap = {
    yes:   ['recommend-yes',   'Recommends'],
    maybe: ['recommend-maybe', 'Maybe recommends'],
    no:    ['recommend-no',    'Does not recommend'],
  };
  const [recClass, recText] = recMap[r.recommend] || ['recommend-maybe',''];
  const liked = (JSON.parse(localStorage.getItem('dal_liked') || '[]')).includes(r.id);

  return `
  <div class="review-card">
    <div class="review-card-header">
      <div>
        <div class="course-code-badge">${escapeHtml(r.courseCode)}</div>
        <div class="course-title">${escapeHtml(r.courseName)}</div>
        <div class="course-meta">${r.prof ? escapeHtml(r.prof) + ' &bull; ' : ''}${escapeHtml(r.term)}</div>
      </div>
      <div class="review-rating">
        <div class="stars-display">${stars(r.overall)}</div>
        <div class="rating-metrics">
          <span class="metric-tag">Difficulty: ${stars(r.difficulty)}</span>
          <span class="metric-tag">Workload: ${stars(r.workload)}</span>
        </div>
      </div>
    </div>
    <div class="review-body">${escapeHtml(r.text)}</div>
    <div class="review-footer">
      <div class="reviewer-info">
        <div class="avatar" style="background:${color}">${initials}</div>
        <span>${escapeHtml(r.author)} &bull; ${escapeHtml(r.program || 'Student')}</span>
        ${r.verified ? '<span class="verified-badge">✓ Verified Dal Student</span>' : ''}
        <span class="recommend-badge ${recClass}">${recText}</span>
      </div>
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <span style="color:var(--text-light);font-size:0.8rem;">${r.date}</span>
        <button class="helpful-btn ${liked ? 'liked' : ''}" data-id="${r.id}">
          👍 Helpful (${r.helpful})
        </button>
      </div>
    </div>
  </div>`;
}

function toggleHelpful(id) {
  const liked  = JSON.parse(localStorage.getItem('dal_liked') || '[]');
  const idx    = liked.indexOf(id);
  const review = state.reviews.find(r => r.id === id);
  if (!review) return;
  if (idx === -1) { liked.push(id); review.helpful++; showToast('Marked as helpful!', 'success'); }
  else            { liked.splice(idx, 1); review.helpful = Math.max(0, review.helpful - 1); }
  localStorage.setItem('dal_liked', JSON.stringify(liked));
  save();
  renderReviews();
}

// ===== SUBMIT REVIEW =====
function submitReview() {
  const code      = document.getElementById('courseCode').value.trim();
  const name      = document.getElementById('courseName').value.trim();
  const prof      = document.getElementById('profName').value.trim();
  const term      = document.getElementById('termSelect').value;
  const text      = document.getElementById('reviewText').value.trim();
  const recommend = document.querySelector('input[name="recommend"]:checked')?.value;

  if (!code || !name || !term || !text || !state.ratings.overall) {
    showToast('Please fill in all required fields and set an overall rating.', 'error');
    return;
  }
  if (text.length < 50) {
    showToast('Review must be at least 50 characters. Be specific to help your peers!', 'error');
    return;
  }
  if (!state.user) {
    showToast('Please sign in first to submit a review.', 'error');
    document.getElementById('loginModal').classList.add('open');
    return;
  }

  state.reviews.unshift({
    id: Date.now(),
    courseCode: code.toUpperCase(),
    courseName: name,
    prof, term,
    overall:    state.ratings.overall,
    difficulty: state.ratings.difficulty || 3,
    workload:   state.ratings.workload   || 3,
    text,
    recommend:  recommend || 'maybe',
    author:     state.user.name,
    bannerId:   state.user.bannerId,
    program:    state.user.program,
    verified:   state.user.verified || false,
    helpful:    0,
    date:       new Date().toISOString().split('T')[0],
  });

  save();
  resetReviewForm();
  document.getElementById('reviewFormWrap').style.display = 'none';
  document.getElementById('openReviewForm').style.display = '';
  renderReviews();
  updateStats();
  showToast('Your review has been posted. Thank you!', 'success');
}

function resetReviewForm() {
  ['courseCode','courseName','profName','reviewText'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('termSelect').value = '';
  document.querySelectorAll('input[name="recommend"]').forEach(r => r.checked = false);
  state.ratings = { overall: 0, difficulty: 0, workload: 0 };
  buildStarInputs();
}

// ===== CHANNEL =====
function renderMessages() {
  const area = document.getElementById('messagesArea');
  if (!area) return;
  const msgs = state.messages[state.activeChannel] || [];
  area.innerHTML = msgs.length
    ? msgs.map(messageEl).join('')
    : `<div class="empty-state"><div class="empty-icon">💬</div><h3>No messages yet</h3><p>Be the first to say something in #${state.activeChannel}!</p></div>`;
  area.scrollTop = area.scrollHeight;

  const input = document.getElementById('messageInput');
  if (input) input.placeholder = `Message #${state.activeChannel}...`;
  document.getElementById('currentChannelName').textContent = `# ${state.activeChannel}`;
  document.getElementById('currentChannelDesc').textContent = channelDescs[state.activeChannel] || '';
}

function messageEl(m) {
  const initials = m.author.split(' ').map(w => w[0]).join('').toUpperCase();
  return `
  <div class="message">
    <div class="msg-avatar" style="background:${m.color}">${initials}</div>
    <div class="msg-body">
      <div class="msg-header">
        <span class="msg-name">${escapeHtml(m.author)}</span>
        ${m.verified ? '<span class="verified-badge-sm">✓</span>' : ''}
        <span class="msg-time">${m.time}</span>
      </div>
      <div class="msg-text">${escapeHtml(m.text)}</div>
    </div>
  </div>`;
}

function sendMessage() {
  const input = document.getElementById('messageInput');
  const text  = input.value.trim();
  if (!text) return;
  if (!state.user) {
    showToast('Please sign in to send messages.', 'error');
    document.getElementById('loginModal').classList.add('open');
    return;
  }
  if (!state.messages[state.activeChannel]) state.messages[state.activeChannel] = [];
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const time  = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  state.messages[state.activeChannel].push({ id: Date.now(), author: state.user.name, text, time, color, verified: state.user.verified || false });
  save();
  input.value = '';
  renderMessages();
  updateStats();
}

// ===== COURSES =====
function renderCourses() {
  const grouped = {};
  state.reviews.forEach(r => {
    if (!grouped[r.courseCode]) grouped[r.courseCode] = { code: r.courseCode, name: r.courseName, reviews: [] };
    grouped[r.courseCode].reviews.push(r);
  });

  const grid   = document.getElementById('coursesGrid');
  const empty  = document.getElementById('coursesEmpty');
  const courses = Object.values(grouped);

  if (!courses.length) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  grid.innerHTML = courses.map(c => {
    const avg   = (c.reviews.reduce((s, r) => s + r.overall, 0) / c.reviews.length).toFixed(1);
    const stars = '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg));
    return `
    <div class="course-card" onclick="filterByCourse('${escapeAttr(c.code)}')">
      <div class="course-card-code">${escapeHtml(c.code)}</div>
      <div class="course-card-name">${escapeHtml(c.name)}</div>
      <div class="course-card-avg">${stars} ${avg}/5</div>
      <div class="course-card-count">${c.reviews.length} review${c.reviews.length !== 1 ? 's' : ''}</div>
    </div>`;
  }).join('');
}

function filterByCourse(code) {
  navigateTo('reviews');
  document.getElementById('searchInput').value = code;
  renderReviews();
}

// ===== STATS =====
function updateStats() {
  document.getElementById('statReviews').textContent  = state.reviews.length;
  document.getElementById('statCourses').textContent  = new Set(state.reviews.map(r => r.courseCode)).size;
  document.getElementById('statMessages').textContent = Object.values(state.messages).reduce((s, a) => s + a.length, 0);
}

// ===== LOGIN =====
function goToStep2() {
  const name    = document.getElementById('loginName').value.trim();
  const email   = document.getElementById('loginEmail').value.trim();
  const banner  = document.getElementById('loginBanner').value.trim();
  const program = document.getElementById('loginProgram').value.trim();

  if (!name)    { showToast('Please enter your full name.', 'error'); return; }
  if (!email.toLowerCase().endsWith('@dal.ca')) {
    showToast('Please use your official @dal.ca email address.', 'error'); return;
  }
  if (!/^B\d{8}$/i.test(banner)) {
    showToast('Banner ID must be in format B00123456 (B + 8 digits).', 'error'); return;
  }
  if (!program) { showToast('Please enter your program.', 'error'); return; }

  document.getElementById('stepContent1').style.display = 'none';
  document.getElementById('stepContent2').style.display = 'block';
  document.getElementById('step1').classList.remove('active');
  document.getElementById('step2').classList.add('active');
}

function goToStep1() {
  document.getElementById('stepContent2').style.display = 'none';
  document.getElementById('stepContent1').style.display = 'block';
  document.getElementById('step2').classList.remove('active');
  document.getElementById('step1').classList.add('active');
}

function submitLogin() {
  const idFile = document.getElementById('idFileInput').files[0];
  if (!idFile) {
    showToast('Please upload your Dal student ID to verify your enrolment.', 'error');
    return;
  }

  const name    = document.getElementById('loginName').value.trim();
  const email   = document.getElementById('loginEmail').value.trim();
  const banner  = document.getElementById('loginBanner').value.trim();
  const program = document.getElementById('loginProgram').value.trim();

  // Read the ID image and store a flag (not the raw image) confirming upload
  const reader = new FileReader();
  reader.onload = () => {
    state.user = { name, email, bannerId: banner.toUpperCase(), program, verified: true };
    localStorage.setItem('dal_user', JSON.stringify(state.user));
    document.getElementById('loginModal').classList.remove('open');
    resetLoginModal();
    updateLoginUI();
    showToast(`Welcome, ${name}! Your Dal ID has been verified.`, 'success');
  };
  reader.readAsDataURL(idFile);
}

function resetLoginModal() {
  document.getElementById('stepContent1').style.display = 'block';
  document.getElementById('stepContent2').style.display = 'none';
  document.getElementById('step1').classList.add('active');
  document.getElementById('step2').classList.remove('active');
  document.getElementById('idPreview').style.display = 'none';
  document.getElementById('idPreview').innerHTML = '';
  document.getElementById('idFileInput').value = '';
}

function updateLoginUI() {
  const btn = document.getElementById('loginBtn');
  if (state.user) {
    btn.innerHTML = `${escapeHtml(state.user.name.split(' ')[0])} ${state.user.verified ? '<span style="font-size:0.8em;">✓</span>' : ''}`;
    btn.style.background = AVATAR_COLORS[0];
    btn.style.color      = '#fff';
  }
}

// ===== INSTALL PROMPT (PWA) =====
let deferredInstallPrompt = null;

function listenForInstallPrompt() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById('installBtn');
    if (btn) btn.style.display = 'flex';
  });
  window.addEventListener('appinstalled', () => {
    const btn = document.getElementById('installBtn');
    if (btn) btn.style.display = 'none';
    showToast('App installed successfully!', 'success');
  });
}

function triggerInstall() {
  if (!deferredInstallPrompt) {
    showToast('Open this site in Chrome or Edge on Android to install the app.', '');
    return;
  }
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then(() => { deferredInstallPrompt = null; });
}

// ===== TOAST =====
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3500);
}

// ===== HELPERS =====
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escapeAttr(str) {
  return String(str).replace(/'/g, "\\'");
}

// ===== AUTOCOMPLETE =====
function attachAutocomplete() {
  // Search bar on reviews page
  setupAutocomplete(
    document.getElementById('searchInput'),
    (course) => {
      document.getElementById('searchInput').value = course.code;
      renderReviews();
    }
  );

  // Course code field in review form
  setupAutocomplete(
    document.getElementById('courseCode'),
    (course) => {
      document.getElementById('courseCode').value = course.code;
      document.getElementById('courseName').value = course.name;
    }
  );
}

function setupAutocomplete(inputEl, onSelect) {
  if (!inputEl) return;

  // Wrap input in a positioned container, inheriting flex properties
  const wrap = document.createElement('div');
  const cs   = window.getComputedStyle(inputEl);
  wrap.style.position = 'relative';
  wrap.style.flex     = cs.flex !== 'none' ? cs.flex : '0 1 auto';
  wrap.style.minWidth = cs.minWidth;
  wrap.style.width    = cs.width === 'auto' ? '' : cs.width;
  inputEl.style.width = '100%';
  inputEl.parentNode.insertBefore(wrap, inputEl);
  wrap.appendChild(inputEl);

  const dropdown = document.createElement('ul');
  dropdown.className = 'autocomplete-list';
  wrap.appendChild(dropdown);

  let currentMatches = [];
  let clickingDropdown = false;

  function showSuggestions(query) {
    if (!query) { close(); return; }
    const q = query.toLowerCase();
    currentMatches = DAL_COURSES.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q)
    ).slice(0, 8);

    if (!currentMatches.length) { close(); return; }

    dropdown.innerHTML = currentMatches.map((c, i) => `
      <li class="autocomplete-item" data-idx="${i}">
        <span class="ac-code">${highlight(c.code, q)}</span>
        <span class="ac-name">${highlight(c.name, q)}</span>
      </li>`).join('');
    dropdown.style.display = 'block';
  }

  function close() {
    dropdown.style.display = 'none';
    dropdown.querySelectorAll('.ac-active').forEach(el => el.classList.remove('ac-active'));
  }

  function selectIndex(i) {
    if (currentMatches[i]) {
      onSelect(currentMatches[i]);
      close();
    }
  }

  // Use pointerdown flag so blur doesn't close dropdown before click fires
  dropdown.addEventListener('pointerdown', () => { clickingDropdown = true; });

  dropdown.addEventListener('click', e => {
    const li = e.target.closest('.autocomplete-item');
    if (li) selectIndex(parseInt(li.dataset.idx));
    clickingDropdown = false;
  });

  inputEl.addEventListener('input', () => showSuggestions(inputEl.value));
  inputEl.addEventListener('focus', () => { if (inputEl.value) showSuggestions(inputEl.value); });
  inputEl.addEventListener('blur',  () => {
    if (clickingDropdown) { clickingDropdown = false; return; }
    close();
  });

  inputEl.addEventListener('keydown', e => {
    if (dropdown.style.display === 'none') return;
    const items  = dropdown.querySelectorAll('.autocomplete-item');
    const active = dropdown.querySelector('.ac-active');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = active ? active.nextElementSibling : items[0];
      active?.classList.remove('ac-active');
      next?.classList.add('ac-active');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = active ? active.previousElementSibling : items[items.length - 1];
      active?.classList.remove('ac-active');
      prev?.classList.add('ac-active');
    } else if (e.key === 'Enter') {
      const idx = active ? parseInt(active.dataset.idx) : 0;
      if (currentMatches[idx]) { e.preventDefault(); selectIndex(idx); }
    } else if (e.key === 'Escape') {
      close();
    }
  });
}

function highlight(text, query) {
  const safe = escapeHtml(text);
  const safeQ = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(`(${safeQ})`, 'gi'), '<mark>$1</mark>');
}

// ===== EVENTS =====
function attachEvents() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  document.getElementById('heroReviewBtn').addEventListener('click', () => {
    navigateTo('reviews');
    document.getElementById('reviewFormWrap').style.display = 'block';
    document.getElementById('openReviewForm').style.display = 'none';
    document.getElementById('reviewFormWrap').scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('heroChatBtn').addEventListener('click', () => navigateTo('channel'));

  document.getElementById('openReviewForm').addEventListener('click', () => {
    document.getElementById('reviewFormWrap').style.display = 'block';
    document.getElementById('openReviewForm').style.display = 'none';
    document.getElementById('reviewFormWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('cancelReview').addEventListener('click', () => {
    document.getElementById('reviewFormWrap').style.display = 'none';
    document.getElementById('openReviewForm').style.display = '';
    resetReviewForm();
  });
  document.getElementById('submitReview').addEventListener('click', submitReview);

  document.getElementById('searchInput').addEventListener('input', renderReviews);
  document.getElementById('filterDept').addEventListener('change', renderReviews);
  document.getElementById('filterRating').addEventListener('change', renderReviews);

  document.querySelectorAll('.channel-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.channel-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      state.activeChannel = item.dataset.channel;
      renderMessages();
    });
  });

  document.getElementById('sendMessage').addEventListener('click', sendMessage);
  document.getElementById('messageInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  document.getElementById('loginBtn').addEventListener('click', () => {
    if (!state.user) document.getElementById('loginModal').classList.add('open');
  });
  document.getElementById('closeLogin').addEventListener('click', () => {
    document.getElementById('loginModal').classList.remove('open');
    resetLoginModal();
  });
  document.getElementById('nextStep').addEventListener('click', goToStep2);
  document.getElementById('backStep').addEventListener('click', goToStep1);
  document.getElementById('submitLogin').addEventListener('click', submitLogin);
  document.getElementById('loginModal').addEventListener('click', e => {
    if (e.target === document.getElementById('loginModal')) {
      document.getElementById('loginModal').classList.remove('open');
      resetLoginModal();
    }
  });

  // ID file preview
  document.getElementById('idFileInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = document.getElementById('idPreview');
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => {
        preview.innerHTML = `<img src="${ev.target.result}" alt="ID preview" />`;
        preview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    } else {
      preview.innerHTML = `<div class="id-file-name">📄 ${escapeHtml(file.name)}</div>`;
      preview.style.display = 'block';
    }
    document.getElementById('idUploadArea').classList.add('uploaded');
  });

  const installBtn = document.getElementById('installBtn');
  if (installBtn) installBtn.addEventListener('click', triggerInstall);
}

document.addEventListener('DOMContentLoaded', init);
