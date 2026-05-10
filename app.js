'use strict';

const state = {
  user: null,
  reviews: [],
  profRatings: [],
  ratings:     { overall: 0, difficulty: 0, workload: 0 },
  profRatingsForm: { profOverall: 0, profTeaching: 0, profClarity: 0, profHelp: 0, profGrading: 0 },
};

const AVATAR_COLORS = [
  '#2B6CB0','#276749','#6B46C1','#C05621','#2C7A7B',
  '#97266D','#B7791F','#2A4365','#285E61','#553C9A'
];

// ===== INIT =====
function init() {
  loadFromStorage();
  buildStarInputs();
  renderReviews();
  renderProfRatings();
  updateStats();
  attachEvents();
  attachAutocomplete();
  listenForInstallPrompt();
}

// ===== STORAGE =====
function loadFromStorage() {
  try {
    const r  = localStorage.getItem('dal_reviews');
    const pr = localStorage.getItem('dal_prof_ratings');
    const u  = localStorage.getItem('dal_user');
    if (r)  state.reviews     = JSON.parse(r);
    if (pr) state.profRatings = JSON.parse(pr);
    if (u)  { state.user = JSON.parse(u); updateLoginUI(); }
  } catch(e) { /* silent */ }
}

function save() {
  localStorage.setItem('dal_reviews',      JSON.stringify(state.reviews));
  localStorage.setItem('dal_prof_ratings', JSON.stringify(state.profRatings));
}

// ===== NAVIGATION =====
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(page + '-page').classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  if (page === 'professors') renderProfRatings();
}

// ===== STAR INPUTS =====
function buildStarInputs() {
  const allFields = [
    { id: 'ratingOverall',     field: 'overall',      group: 'ratings' },
    { id: 'ratingDifficulty',  field: 'difficulty',   group: 'ratings' },
    { id: 'ratingWorkload',    field: 'workload',      group: 'ratings' },
    { id: 'profRatingOverall', field: 'profOverall',   group: 'profRatingsForm' },
    { id: 'profRatingTeaching',field: 'profTeaching',  group: 'profRatingsForm' },
    { id: 'profRatingClarity', field: 'profClarity',   group: 'profRatingsForm' },
    { id: 'profRatingHelp',    field: 'profHelp',      group: 'profRatingsForm' },
    { id: 'profRatingGrading', field: 'profGrading',   group: 'profRatingsForm' },
  ];
  allFields.forEach(({ id, field, group }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const s = document.createElement('span');
      s.className  = 'star';
      s.textContent = '★';
      s.dataset.val = i;
      s.addEventListener('click',      () => { state[group][field] = i; updateStars(i, el); });
      s.addEventListener('mouseenter', () => updateStars(i, el));
      s.addEventListener('mouseleave', () => updateStars(state[group][field], el));
      el.appendChild(s);
    }
  });
}

function updateStars(val, el) {
  el.querySelectorAll('.star').forEach(s =>
    s.classList.toggle('active', parseInt(s.dataset.val) <= val)
  );
}

// ===== RENDER COURSE REVIEWS =====
function renderReviews() {
  const search      = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const dept        =  document.getElementById('filterDept')?.value   || '';
  const ratingFilter= parseInt(document.getElementById('filterRating')?.value || '0');

  const filtered = [...state.reviews].filter(r => {
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
    const q = search || dept || ratingFilter;
    empty.innerHTML = q
      ? `<div class="empty-icon">🔍</div>
         <h3>No reviews for "${escapeHtml(document.getElementById('searchInput').value)}" yet</h3>
         <p>Be the first to review this course!</p>
         <button class="btn-primary" style="margin-top:1rem;" onclick="document.getElementById('openReviewForm').click()">Write the First Review</button>`
      : `<div class="empty-icon">📝</div><h3>No reviews yet</h3><p>Be the first Dalhousie student to share your course experience!</p>`;
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = `<div class="reviews-list">${filtered.map(reviewCard).join('')}</div>`;
  list.querySelectorAll('.helpful-btn').forEach(btn =>
    btn.addEventListener('click', () => toggleHelpful(parseInt(btn.dataset.id)))
  );
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
        ${r.verified ? '<span class="verified-badge">✓ Verified</span>' : ''}
        <span class="recommend-badge ${recClass}">${recText}</span>
      </div>
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <span style="color:var(--text-dim);font-size:0.8rem;">${r.date}</span>
        <button class="helpful-btn ${liked ? 'liked' : ''}" data-id="${r.id}">👍 Helpful (${r.helpful})</button>
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

// ===== SUBMIT COURSE REVIEW =====
function submitReview() {
  const code = document.getElementById('courseCode').value.trim();
  const name = document.getElementById('courseName').value.trim();
  const prof = document.getElementById('profName').value.trim();
  const term = document.getElementById('termSelect').value;
  const text = document.getElementById('reviewText').value.trim();
  const recommend = document.querySelector('input[name="recommend"]:checked')?.value;

  if (!code || !name || !term || !text || !state.ratings.overall) {
    showToast('Please fill in all required fields and set an overall rating.', 'error'); return;
  }
  if (!state.user) {
    showToast('Please sign in first to submit a review.', 'error');
    document.getElementById('loginModal').classList.add('open'); return;
  }

  state.reviews.unshift({
    id: Date.now(),
    courseCode: code.toUpperCase(), courseName: name, prof, term,
    overall: state.ratings.overall,
    difficulty: state.ratings.difficulty || 3,
    workload:   state.ratings.workload   || 3,
    text, recommend: recommend || 'maybe',
    author: state.user.name, bannerId: state.user.bannerId,
    program: state.user.program, verified: state.user.verified || false,
    helpful: 0, date: new Date().toISOString().split('T')[0],
  });

  save();
  resetReviewForm();
  document.getElementById('reviewFormWrap').style.display  = 'none';
  document.getElementById('openReviewForm').style.display  = '';
  renderReviews();
  updateStats();
  showToast('Your review has been posted. Thank you!', 'success');
}

function resetReviewForm() {
  ['courseCode','courseName','profName','reviewText'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('termSelect').value = '';
  document.querySelectorAll('input[name="recommend"]').forEach(r => r.checked = false);
  state.ratings = { overall: 0, difficulty: 0, workload: 0 };
  buildStarInputs();
}

// ===== RENDER PROFESSOR RATINGS =====
function renderProfRatings() {
  const search = (document.getElementById('profSearchInput')?.value || '').toLowerCase();
  const dept   =  document.getElementById('filterProfDept')?.value  || '';

  const filtered = [...state.profRatings].filter(r => {
    const matchSearch = !search ||
      r.profName.toLowerCase().includes(search) ||
      r.dept.toLowerCase().includes(search) ||
      r.course?.toLowerCase().includes(search);
    const matchDept = !dept || r.dept === dept;
    return matchSearch && matchDept;
  }).sort((a, b) => b.id - a.id);

  const list  = document.getElementById('profList');
  const empty = document.getElementById('profEmpty');

  if (!filtered.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = `<div class="reviews-list">${filtered.map(profCard).join('')}</div>`;
}

function profCard(r) {
  const stars  = n => '★'.repeat(n) + '☆'.repeat(5 - n);
  const initials = r.profName.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0,2);
  const color  = AVATAR_COLORS[r.id % AVATAR_COLORS.length];
  const recMap = {
    yes:   ['recommend-yes',   'Would take again'],
    maybe: ['recommend-maybe', 'Maybe again'],
    no:    ['recommend-no',    'Would not take again'],
  };
  const [recClass, recText] = recMap[r.recommend] || ['recommend-maybe',''];

  const authorLine = r.anonymous
    ? `<span class="anon-label-chip">👤 Anonymous Student</span>`
    : `<div class="avatar" style="background:${color}">${initials.slice(0,1)}</div>
       <span>${escapeHtml(r.authorName)} &bull; ${escapeHtml(r.authorProgram || 'Student')}</span>
       ${r.verified ? '<span class="verified-badge">✓ Verified</span>' : ''}`;

  return `
  <div class="review-card prof-card">
    <div class="review-card-header">
      <div>
        <div class="prof-name-badge">
          <div class="prof-avatar-lg" style="background:${color}">${initials}</div>
          <div>
            <div class="course-title">${escapeHtml(r.profName)}</div>
            <div class="course-meta">${escapeHtml(r.dept)}${r.course ? ' &bull; ' + escapeHtml(r.course) : ''} &bull; ${escapeHtml(r.term)}</div>
          </div>
        </div>
      </div>
      <div class="review-rating">
        <div class="stars-display">${stars(r.overall)}</div>
        <div class="rating-metrics">
          <span class="metric-tag">Teaching: ${stars(r.teaching)}</span>
          <span class="metric-tag">Clarity: ${stars(r.clarity)}</span>
          <span class="metric-tag">Helpfulness: ${stars(r.helpfulness)}</span>
          <span class="metric-tag">Grading: ${stars(r.grading)}</span>
        </div>
      </div>
    </div>
    <div class="review-body">${escapeHtml(r.text)}</div>
    <div class="review-footer">
      <div class="reviewer-info">${authorLine}</div>
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <span style="color:var(--text-dim);font-size:0.8rem;">${r.date}</span>
        <span class="recommend-badge ${recClass}">${recText}</span>
      </div>
    </div>
  </div>`;
}

// ===== SUBMIT PROFESSOR RATING =====
function submitProfReview() {
  const profName = document.getElementById('profRateName').value.trim();
  const dept     = document.getElementById('profRateDept').value;
  const course   = document.getElementById('profRateCourse').value.trim();
  const term     = document.getElementById('profRateTerm').value;
  const text     = document.getElementById('profReviewText').value.trim();
  const recommend= document.querySelector('input[name="profRecommend"]:checked')?.value;
  const anonymous= document.getElementById('anonToggle').checked;

  if (!profName || !dept || !term || !text || !state.profRatingsForm.profOverall) {
    showToast('Please fill in all required fields and set an overall rating.', 'error'); return;
  }
  if (!state.user) {
    showToast('Please sign in first to submit a rating.', 'error');
    document.getElementById('loginModal').classList.add('open'); return;
  }

  state.profRatings.unshift({
    id:           Date.now(),
    profName, dept, course, term,
    overall:      state.profRatingsForm.profOverall,
    teaching:     state.profRatingsForm.profTeaching  || 3,
    clarity:      state.profRatingsForm.profClarity   || 3,
    helpfulness:  state.profRatingsForm.profHelp      || 3,
    grading:      state.profRatingsForm.profGrading   || 3,
    text,
    recommend:    recommend || 'maybe',
    anonymous,
    authorName:   anonymous ? '' : state.user.name,
    authorProgram:anonymous ? '' : (state.user.program || ''),
    verified:     state.user.verified || false,
    date:         new Date().toISOString().split('T')[0],
  });

  save();
  resetProfForm();
  document.getElementById('profFormWrap').style.display = 'none';
  document.getElementById('openProfForm').style.display = '';
  renderProfRatings();
  updateStats();
  showToast('Your professor rating has been posted!', 'success');
}

function resetProfForm() {
  ['profRateName','profRateCourse','profReviewText'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('profRateDept').value = '';
  document.getElementById('profRateTerm').value = '';
  document.querySelectorAll('input[name="profRecommend"]').forEach(r => r.checked = false);
  document.getElementById('anonToggle').checked = true;
  updateAnonLabel(true);
  state.profRatingsForm = { profOverall: 0, profTeaching: 0, profClarity: 0, profHelp: 0, profGrading: 0 };
  buildStarInputs();
}

function updateAnonLabel(isAnon) {
  document.getElementById('anonLabel').textContent = isAnon ? 'Post Anonymously' : 'Post with Your Name';
  document.getElementById('anonSub').textContent   = isAnon ? 'Your name will not be shown' : 'Your name will be visible on the rating';
}

// ===== STATS =====
function updateStats() {
  document.getElementById('statReviews').textContent  = state.reviews.length;
  const profs = new Set(state.profRatings.map(r => r.profName.toLowerCase()));
  document.getElementById('statProfs').textContent    = profs.size;
  const students = new Set([
    ...state.reviews.filter(r => r.bannerId).map(r => r.bannerId),
    ...state.profRatings.filter(r => !r.anonymous && r.authorName).map(r => r.authorName),
  ]);
  document.getElementById('statStudents').textContent = students.size;
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
    showToast('Please upload your Dal student ID to verify your enrolment.', 'error'); return;
  }
  const name    = document.getElementById('loginName').value.trim();
  const email   = document.getElementById('loginEmail').value.trim();
  const banner  = document.getElementById('loginBanner').value.trim();
  const program = document.getElementById('loginProgram').value.trim();

  const reader  = new FileReader();
  reader.onload = () => {
    state.user = { name, email, bannerId: banner.toUpperCase(), program, verified: true };
    localStorage.setItem('dal_user', JSON.stringify(state.user));
    document.getElementById('loginModal').classList.remove('open');
    resetLoginModal();
    updateLoginUI();
    updateStats();
    showToast(`Welcome, ${name}! Your Dal ID has been verified. ✓`, 'success');
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
  document.getElementById('idFileInput').value  = '';
}

function updateLoginUI() {
  const loginBtn = document.getElementById('loginBtn');
  const userMenu = document.getElementById('userMenu');

  if (state.user) {
    loginBtn.style.display = 'none';
    userMenu.style.display = 'flex';
    const initials = state.user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
    const color    = AVATAR_COLORS[state.user.bannerId.charCodeAt(1) % AVATAR_COLORS.length];
    const avatar   = document.getElementById('userAvatar');
    avatar.textContent       = initials;
    avatar.style.background  = color;
    document.getElementById('userBtnName').textContent = state.user.name.split(' ')[0];
    document.getElementById('userDropdownHeader').innerHTML = `
      <div class="dropdown-user-name">
        ${escapeHtml(state.user.name)}
        ${state.user.verified ? '<span class="verified-badge">✓ Verified</span>' : ''}
      </div>
      <div class="dropdown-user-meta">${escapeHtml(state.user.email)}</div>
      <div class="dropdown-user-meta">${escapeHtml(state.user.bannerId)} &bull; ${escapeHtml(state.user.program || '')}`;
  } else {
    loginBtn.style.display = '';
    userMenu.style.display = 'none';
  }
}

function signOut() {
  state.user = null;
  localStorage.removeItem('dal_user');
  document.getElementById('userDropdown').classList.remove('open');
  updateLoginUI();
  showToast('You have been signed out.', '');
}

// ===== INSTALL PROMPT =====
let deferredInstallPrompt = null;

function listenForInstallPrompt() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById('installBtn');
    if (btn) btn.style.display = 'flex';
  });
  window.addEventListener('appinstalled', () => {
    document.getElementById('installBtn').style.display = 'none';
    showToast('App installed!', 'success');
  });
}

function triggerInstall() {
  if (!deferredInstallPrompt) {
    showToast('Open in Chrome on Android to install.', ''); return;
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
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escapeAttr(str) {
  return String(str).replace(/'/g, "\\'");
}

// ===== AUTOCOMPLETE =====
function attachAutocomplete() {
  setupAutocomplete(
    document.getElementById('searchInput'),
    (course) => { document.getElementById('searchInput').value = course.code; renderReviews(); }
  );
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
  const wrap = document.createElement('div');
  const cs   = window.getComputedStyle(inputEl);
  wrap.style.position = 'relative';
  wrap.style.flex     = cs.flex !== 'none' ? cs.flex : '0 1 auto';
  wrap.style.minWidth = cs.minWidth;
  inputEl.style.width = '100%';
  inputEl.parentNode.insertBefore(wrap, inputEl);
  wrap.appendChild(inputEl);

  const dropdown = document.createElement('ul');
  dropdown.className = 'autocomplete-list';
  wrap.appendChild(dropdown);

  let currentMatches   = [];
  let clickingDropdown = false;

  function showSuggestions(query) {
    if (!query) { closeDropdown(); return; }
    const q = query.toLowerCase();
    currentMatches = DAL_COURSES.filter(c =>
      c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    ).slice(0, 8);
    if (!currentMatches.length) { closeDropdown(); return; }
    dropdown.innerHTML = currentMatches.map((c, i) => `
      <li class="autocomplete-item" data-idx="${i}">
        <span class="ac-code">${highlight(c.code, q)}</span>
        <span class="ac-name">${highlight(c.name, q)}</span>
      </li>`).join('');
    dropdown.style.display = 'block';
  }

  function closeDropdown() {
    dropdown.style.display = 'none';
    dropdown.querySelectorAll('.ac-active').forEach(el => el.classList.remove('ac-active'));
  }

  function selectIndex(i) {
    if (currentMatches[i]) { onSelect(currentMatches[i]); closeDropdown(); }
  }

  dropdown.addEventListener('pointerdown', () => { clickingDropdown = true; });
  dropdown.addEventListener('click', e => {
    const li = e.target.closest('.autocomplete-item');
    if (li) selectIndex(parseInt(li.dataset.idx));
    clickingDropdown = false;
  });
  inputEl.addEventListener('input',  () => showSuggestions(inputEl.value));
  inputEl.addEventListener('focus',  () => { if (inputEl.value) showSuggestions(inputEl.value); });
  inputEl.addEventListener('blur',   () => { if (clickingDropdown) { clickingDropdown = false; return; } closeDropdown(); });
  inputEl.addEventListener('keydown', e => {
    if (dropdown.style.display === 'none') return;
    const items  = dropdown.querySelectorAll('.autocomplete-item');
    const active = dropdown.querySelector('.ac-active');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = active ? active.nextElementSibling : items[0];
      active?.classList.remove('ac-active'); next?.classList.add('ac-active');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = active ? active.previousElementSibling : items[items.length - 1];
      active?.classList.remove('ac-active'); prev?.classList.add('ac-active');
    } else if (e.key === 'Enter') {
      const idx = active ? parseInt(active.dataset.idx) : 0;
      if (currentMatches[idx]) { e.preventDefault(); selectIndex(idx); }
    } else if (e.key === 'Escape') { closeDropdown(); }
  });
}

function highlight(text, query) {
  const safe  = escapeHtml(text);
  const safeQ = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(`(${safeQ})`, 'gi'), '<mark>$1</mark>');
}

// ===== EVENTS =====
function attachEvents() {
  document.querySelectorAll('.nav-btn').forEach(btn =>
    btn.addEventListener('click', () => navigateTo(btn.dataset.page))
  );

  // Hero buttons
  document.getElementById('heroReviewBtn').addEventListener('click', () => {
    navigateTo('reviews');
    document.getElementById('reviewFormWrap').style.display = 'block';
    document.getElementById('openReviewForm').style.display = 'none';
    document.getElementById('reviewFormWrap').scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('heroProfBtn').addEventListener('click', () => {
    navigateTo('professors');
    document.getElementById('profFormWrap').style.display  = 'block';
    document.getElementById('openProfForm').style.display  = 'none';
    document.getElementById('profFormWrap').scrollIntoView({ behavior: 'smooth' });
  });

  // Course review form
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

  // Professor rating form
  document.getElementById('openProfForm').addEventListener('click', () => {
    document.getElementById('profFormWrap').style.display = 'block';
    document.getElementById('openProfForm').style.display = 'none';
    document.getElementById('profFormWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('cancelProfReview').addEventListener('click', () => {
    document.getElementById('profFormWrap').style.display = 'none';
    document.getElementById('openProfForm').style.display = '';
    resetProfForm();
  });
  document.getElementById('submitProfReview').addEventListener('click', submitProfReview);
  document.getElementById('profSearchInput').addEventListener('input', renderProfRatings);
  document.getElementById('filterProfDept').addEventListener('change', renderProfRatings);

  // Anonymous toggle
  document.getElementById('anonToggle').addEventListener('change', e => updateAnonLabel(e.target.checked));

  // Auth
  document.getElementById('loginBtn').addEventListener('click', () => {
    document.getElementById('loginModal').classList.add('open');
  });
  document.getElementById('userBtn').addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('userDropdown').classList.toggle('open');
  });
  document.addEventListener('click', () => {
    document.getElementById('userDropdown').classList.remove('open');
  });
  document.getElementById('signOutBtn').addEventListener('click', signOut);
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
    const file    = e.target.files[0];
    const preview = document.getElementById('idPreview');
    if (!file) return;
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
