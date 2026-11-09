(function () {
  'use strict';

  const TOKEN_KEY = 'mnrh_dr_ipd_token';
  const USER_KEY = 'mnrh_dr_ipd_user';

  const state = {
    token: localStorage.getItem(TOKEN_KEY) || null,
    user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
    wards: [],
    selectedWard: null,
    patientStatusFilter: 'active', // 'active' | 'all'
    patientSearchQuery: '',
    patients: [],
    currentPatientData: null, // { patient, allergies, doctors, vitals, orderMasters }
    orderCategoryFilter: 'all',
    orderSearchQuery: '',
    showAllWardChips: false,
  };

  // DOM Elements
  const el = {
    loginView: document.getElementById('login-view'),
    mainShell: document.getElementById('main-shell'),
    landingView: document.getElementById('landing-view'),
    patientDetailView: document.getElementById('patient-detail-view'),

    loginForm: document.getElementById('login-form'),
    loginUsername: document.getElementById('login-username'),
    loginPassword: document.getElementById('login-password'),
    togglePasswordBtn: document.getElementById('toggle-password-btn'),
    loginError: document.getElementById('login-error'),
    loginSubmitBtn: document.getElementById('login-submit-btn'),
    sampleUsersList: document.getElementById('sample-users-list'),
    dbConnLabel: document.getElementById('db-conn-label'),

    topbarHomeTrigger: document.getElementById('topbar-home-trigger'),
    headerUserAvatar: document.getElementById('header-user-avatar'),
    headerUserName: document.getElementById('header-user-name'),
    headerUserLicense: document.getElementById('header-user-license'),
    logoutBtn: document.getElementById('logout-btn'),

    wardTotalBadge: document.getElementById('ward-total-badge'),
    wardSearchInput: document.getElementById('ward-search-input'),
    clearWardInputBtn: document.getElementById('clear-ward-input-btn'),
    wardDropdown: document.getElementById('ward-dropdown'),
    wardChipsContainer: document.getElementById('ward-chips-container'),
    toggleAllWardsBtn: document.getElementById('toggle-all-wards-btn'),

    activeWardCode: document.getElementById('active-ward-code'),
    activeWardTitle: document.getElementById('active-ward-title'),
    activeWardSubtitle: document.getElementById('active-ward-subtitle'),
    patientSearchInput: document.getElementById('patient-search-input'),
    filterStatusActive: document.getElementById('filter-status-active'),
    filterStatusAll: document.getElementById('filter-status-all'),

    patientsLoading: document.getElementById('patients-loading'),
    patientsEmpty: document.getElementById('patients-empty'),
    patientsEmptyTitle: document.getElementById('patients-empty-title'),
    patientsEmptyDesc: document.getElementById('patients-empty-desc'),
    patientListGrid: document.getElementById('patient-list-grid'),

    backToWardBtn: document.getElementById('back-to-ward-btn'),
    backToWardLabel: document.getElementById('back-to-ward-label'),
    refreshOrdersBtn: document.getElementById('refresh-orders-btn'),
    patientBanner: document.getElementById('patient-banner'),
    ordersCountHeading: document.getElementById('orders-count-heading'),
    orderItemSearch: document.getElementById('order-item-search'),
    orderCategoryTabs: document.getElementById('order-category-tabs'),
    ordersLoading: document.getElementById('orders-loading'),
    ordersTimelineContainer: document.getElementById('orders-timeline-container'),
  };

  // ==================== HELPERS ====================
  function escapeHtml(val) {
    if (val === null || val === undefined) return '';
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const THAI_MONTHS_SHORT = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];

  // Parse PostgreSQL date accurately (handling UTC offset shift for DATE columns)
  function parsePgDate(dateVal) {
    if (!dateVal) return null;
    if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      const [y, m, d] = dateVal.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const dt = new Date(dateVal);
    if (isNaN(dt.getTime())) return null;
    // Convert to Bangkok local date (+07:00)
    const bkkMs = dt.getTime() + 7 * 3600 * 1000;
    const bkk = new Date(bkkMs);
    return new Date(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate());
  }

  function formatThaiDate(dateVal) {
    const dt = parsePgDate(dateVal);
    if (!dt) return '-';
    const d = dt.getDate();
    const m = THAI_MONTHS_SHORT[dt.getMonth()];
    const y = dt.getFullYear() + 543;
    return `${d} ${m} ${y}`;
  }

  function formatTimeShort(timeVal) {
    if (!timeVal) return '';
    const str = String(timeVal).trim();
    const parts = str.split(':');
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')} น.`;
    }
    return str;
  }

  function calculateAgeText(birthdayVal) {
    const bDate = parsePgDate(birthdayVal);
    if (!bDate) return '-';
    const now = new Date();
    let years = now.getFullYear() - bDate.getFullYear();
    let months = now.getMonth() - bDate.getMonth();
    if (now.getDate() < bDate.getDate()) {
      months--;
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    if (years < 0) return '-';
    if (years === 0) {
      return `${Math.max(months, 1)} เดือน`;
    }
    if (years < 6 && months > 0) {
      return `${years} ปี ${months} ด.`;
    }
    return `${years} ปี`;
  }

  function calculateLosDays(regDateVal) {
    const rDate = parsePgDate(regDateVal);
    if (!rDate) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.max(1, Math.round((today - rDate) / (1000 * 60 * 60 * 24)) + 1);
    return diffDays;
  }

  async function apiFetch(url, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }
    const response = await fetch(url, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      if (state.token && url !== '/api/auth/login') {
        handleLogout();
      }
      throw new Error(data.error || 'กรุณาเข้าสู่ระบบใหม่');
    }
    if (!response.ok) {
      throw new Error(data.error || `HTTP Error ${response.status}`);
    }
    return data;
  }

  // ==================== AUTH & LOGIN ====================
  async function loadHealthAndSampleUsers() {
    try {
      const health = await fetch('/api/health').then(r => r.json());
      if (health && health.host) {
        const dbPart = health.database ? ` • DB: ${health.database}` : '';
        el.dbConnLabel.textContent = `PostgreSQL ${health.host}${dbPart} (table users)`;
      }
    } catch (_) {}

    try {
      const res = await fetch('/api/auth/sample-users').then(r => r.json());
      if (res && Array.isArray(res.users)) {
        el.sampleUsersList.innerHTML = res.users.map(u => {
          const codeLabel = u.licenseno ? `${u.licenseno} (${u.usercode})` : u.usercode;
          return `
            <button type="button" class="sample-user-btn" data-usercode="${escapeHtml(u.usercode)}">
              <span class="su-name">${escapeHtml(u.name)}</span>
              <span class="su-code">User: ${escapeHtml(codeLabel)}</span>
            </button>
          `;
        }).join('');

        el.sampleUsersList.querySelectorAll('.sample-user-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            el.loginUsername.value = btn.getAttribute('data-usercode') || '';
            el.loginPassword.value = '12345678';
            el.loginError.classList.add('hidden');
            el.loginUsername.focus();
          });
        });
      }
    } catch (_) {}
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    const username = el.loginUsername.value.trim();
    const password = el.loginPassword.value;

    if (!username || !password) {
      showLoginError('กรุณากรอกชื่อผู้ใช้งาน (User) และรหัสผ่าน (Password)');
      return;
    }

    el.loginError.classList.add('hidden');
    el.loginSubmitBtn.disabled = true;
    const origText = el.loginSubmitBtn.innerHTML;
    el.loginSubmitBtn.innerHTML = '<span>กำลังตรวจสอบข้อมูล...</span>';

    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      state.token = data.token;
      state.user = data.user;
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));

      enterAuthenticatedApp();
    } catch (err) {
      showLoginError(err.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      el.loginSubmitBtn.disabled = false;
      el.loginSubmitBtn.innerHTML = origText;
    }
  }

  function showLoginError(msg) {
    el.loginError.textContent = msg;
    el.loginError.classList.remove('hidden');
  }

  function handleLogout() {
    state.token = null;
    state.user = null;
    state.selectedWard = null;
    state.patients = [];
    state.currentPatientData = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    el.mainShell.classList.add('hidden');
    el.loginView.classList.remove('hidden');
    el.loginPassword.value = '';
  }

  function updateHeaderUser() {
    if (!state.user) return;
    const name = state.user.name || state.user.usercode || 'แพทย์';
    el.headerUserName.textContent = name;
    const subParts = [];
    if (state.user.licenseno) subParts.push(state.user.licenseno);
    else if (state.user.doctor_code) subParts.push(`รหัส ${state.user.doctor_code}`);
    else subParts.push(`User: ${state.user.usercode}`);
    el.headerUserLicense.textContent = subParts.join(' • ');
    el.headerUserAvatar.textContent = name.replace(/^(นพ\.|พญ\.|นายแพทย์|แพทย์หญิง)/, '').trim().charAt(0) || 'พ';
  }

  // ==================== LANDING VIEW: WARDS ====================
  async function enterAuthenticatedApp() {
    el.loginView.classList.add('hidden');
    el.mainShell.classList.remove('hidden');
    showLandingView();
    updateHeaderUser();
    await loadWards();
  }

  function showLandingView() {
    el.patientDetailView.classList.add('hidden');
    el.landingView.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function loadWards() {
    try {
      const data = await apiFetch('/api/wards');
      state.wards = data.wards || [];

      const activeWardsCount = state.wards.filter(w => w.active_patients > 0).length;
      const totalActivePatients = state.wards.reduce((sum, w) => sum + (w.active_patients || 0), 0);
      el.wardTotalBadge.textContent = `${state.wards.length} หอผู้ป่วย • ผู้ป่วยใน ${totalActivePatients} ราย`;

      renderWardChips();

      // Auto-select ward if none selected yet:
      // Prefer a ward with active patients that have orders so the doctor immediately sees sample patients,
      // or the user's current_ward_id if it has patients.
      if (!state.selectedWard && state.wards.length > 0) {
        let initialWard = null;
        if (state.user && state.user.current_ward_id) {
          initialWard = state.wards.find(w => Number(w.id) === Number(state.user.current_ward_id) && w.active_patients > 0);
        }
        if (!initialWard) {
          initialWard = state.wards.find(w => w.active_with_orders > 0) || state.wards.find(w => w.active_patients > 0) || state.wards[0];
        }
        if (initialWard) {
          selectWard(initialWard, false);
        }
      }
    } catch (err) {
      el.wardTotalBadge.textContent = 'ไม่สามารถโหลดรายชื่อหอผู้ป่วย';
    }
  }

  function renderWardChips() {
    // Show wards with active patients (or all if toggled)
    const wardsWithPatients = state.wards.filter(w => w.active_patients > 0 || w.total_patients > 0);
    const listToShow = state.showAllWardChips ? state.wards : (wardsWithPatients.length > 0 ? wardsWithPatients : state.wards.slice(0, 15));

    el.toggleAllWardsBtn.textContent = state.showAllWardChips
      ? `แสดงเฉพาะวอร์ดที่มีผู้ป่วย (${wardsWithPatients.length})`
      : `แสดงหอผู้ป่วยทั้งหมด (${state.wards.length})`;

    el.wardChipsContainer.classList.toggle('expanded-grid', state.showAllWardChips);

    el.wardChipsContainer.innerHTML = listToShow.map(w => {
      const isSelected = state.selectedWard && Number(state.selectedWard.id) === Number(w.id);
      const countText = w.active_patients > 0 ? `${w.active_patients} ราย` : `${w.total_patients} ราย`;
      return `
        <button
          type="button"
          class="ward-chip ${isSelected ? 'selected' : ''}"
          data-ward-id="${w.id}"
        >
          <span>${escapeHtml(w.name)}</span>
          <span class="chip-count">${escapeHtml(countText)}</span>
        </button>
      `;
    }).join('');

    el.wardChipsContainer.querySelectorAll('.ward-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const wId = Number(btn.getAttribute('data-ward-id'));
        const found = state.wards.find(w => Number(w.id) === wId);
        if (found) {
          selectWard(found, true);
        }
      });
    });
  }

  function renderWardDropdown(queryText) {
    const q = (queryText || '').trim().toLowerCase();
    const filtered = state.wards.filter(w => {
      if (!q) return true;
      return (
        (w.name && w.name.toLowerCase().includes(q)) ||
        (w.ward_code && w.ward_code.toLowerCase().includes(q))
      );
    });

    if (filtered.length === 0) {
      el.wardDropdown.innerHTML = `
        <div class="ward-option-item">
          <span class="ward-option-name" style="color: var(--text-muted);">ไม่พบหอผู้ป่วยที่ตรงกับ "${escapeHtml(queryText)}"</span>
        </div>
      `;
      el.wardDropdown.classList.remove('hidden');
      return;
    }

    el.wardDropdown.innerHTML = filtered.slice(0, 30).map(w => {
      const isSelected = state.selectedWard && Number(state.selectedWard.id) === Number(w.id);
      return `
        <div class="ward-option-item ${isSelected ? 'active' : ''}" data-ward-id="${w.id}" role="option">
          <div class="ward-option-left">
            <span class="ward-option-code">${escapeHtml(w.ward_code || w.id)}</span>
            <span class="ward-option-name">${escapeHtml(w.name)}</span>
          </div>
          <div class="ward-option-badges">
            ${w.active_with_orders > 0 ? `<span class="badge-pill badge-order-pt">มี Order ${w.active_with_orders} ราย</span>` : ''}
            ${w.active_patients > 0
              ? `<span class="badge-pill badge-active-pt">ผู้ป่วย ${w.active_patients} ราย</span>`
              : `<span class="badge-pill badge-muted">0 ราย</span>`
            }
          </div>
        </div>
      `;
    }).join('');

    el.wardDropdown.classList.remove('hidden');

    el.wardDropdown.querySelectorAll('.ward-option-item[data-ward-id]').forEach(item => {
      item.addEventListener('click', () => {
        const wId = Number(item.getAttribute('data-ward-id'));
        const found = state.wards.find(w => Number(w.id) === wId);
        if (found) {
          selectWard(found, true);
        }
      });
    });
  }

  async function selectWard(ward, updateInputBox = true) {
    state.selectedWard = ward;
    el.wardDropdown.classList.add('hidden');

    if (updateInputBox) {
      el.wardSearchInput.value = ward.name;
      el.clearWardInputBtn.classList.remove('hidden');
    }

    el.activeWardCode.textContent = ward.ward_code || `W${ward.id}`;
    el.activeWardTitle.textContent = ward.name;
    el.activeWardSubtitle.textContent = `รหัสหอผู้ป่วย ${ward.ward_code || '-'} • กำลังโหลดรายชื่อผู้ป่วย...`;

    renderWardChips();
    await loadWardPatients();
  }

  // ==================== WARD PATIENTS LIST ====================
  async function loadWardPatients() {
    if (!state.selectedWard) return;

    el.patientsLoading.classList.remove('hidden');
    el.patientsEmpty.classList.add('hidden');
    el.patientListGrid.innerHTML = '';

    try {
      const params = new URLSearchParams({
        status: state.patientStatusFilter,
        q: state.patientSearchQuery,
      });
      const data = await apiFetch(`/api/wards/${state.selectedWard.id}/patients?${params.toString()}`);
      state.patients = data.patients || [];

      const statusLabel = state.patientStatusFilter === 'active' ? 'ผู้ป่วยกำลังรักษาในวอร์ด' : 'ผู้ป่วยทั้งหมดในวอร์ด';
      el.activeWardSubtitle.textContent = `${statusLabel} ${state.patients.length} ราย • แตะปุ่มเลือกผู้ป่วยเพื่อดูรายการ Order`;

      renderPatientCards();
    } catch (err) {
      el.patientsEmptyTitle.textContent = 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
      el.patientsEmptyDesc.textContent = err.message;
      el.patientsEmpty.classList.remove('hidden');
    } finally {
      el.patientsLoading.classList.add('hidden');
    }
  }

  function renderPatientCards() {
    const q = (state.patientSearchQuery || '').trim().toLowerCase();
    const list = state.patients.filter(p => {
      if (!q) return true;
      return (
        (p.hn && p.hn.toLowerCase().includes(q)) ||
        (p.an && p.an.toLowerCase().includes(q)) ||
        (p.fullname && p.fullname.toLowerCase().includes(q)) ||
        (p.bed_no && p.bed_no.toLowerCase().includes(q)) ||
        (p.prediag && p.prediag.toLowerCase().includes(q))
      );
    });

    if (list.length === 0) {
      el.patientListGrid.innerHTML = '';
      el.patientsEmptyTitle.textContent = 'ไม่พบผู้ป่วยในเงื่อนไขที่เลือก';
      el.patientsEmptyDesc.textContent = state.patientStatusFilter === 'active'
        ? 'ไม่มีผู้ป่วยกำลังรักษาในหอผู้ป่วยนี้ หรือลองสลับเป็น "ทั้งหมดในวอร์ด"'
        : 'ไม่พบรายชื่อผู้ป่วยที่ตรงกับคำค้นหา';
      el.patientsEmpty.classList.remove('hidden');
      return;
    }

    el.patientsEmpty.classList.add('hidden');

    el.patientListGrid.innerHTML = list.map(pt => {
      const ageText = calculateAgeText(pt.birthday);
      const los = calculateLosDays(pt.regdate);
      const diagText = pt.prediag || pt.provision_dx || pt.admit_for || 'ไม่ระบุการวินิจฉัยแรกรับ';
      const primaryDocName = pt.incharge_doctor_name || pt.adm_doctor_name || '';
      const primaryDocLicense = pt.incharge_doctor_name ? pt.incharge_doctor_license : pt.adm_doctor_license;
      const doctorText = primaryDocName
        ? `${primaryDocName}${primaryDocLicense ? ` (${primaryDocLicense})` : ''}`
        : 'ไม่ระบุแพทย์';
      const orderCount = Number(pt.order_master_count || 0);
      const itemCount = Number(pt.order_item_count || 0);
      const lastOrderText = pt.last_order_date
        ? `ล่าสุด ${formatThaiDate(pt.last_order_date)} ${formatTimeShort(pt.last_order_time)}`
        : 'ยังไม่มีรายการ Order';

      // Format latest vital signs for patient card
      const vsArr = Array.isArray(pt.latest_vitals) ? pt.latest_vitals : [];
      const vsById = {};
      let latestVsRec = null;
      for (const v of vsArr) {
        if (!v || v.value === null || v.value === undefined || String(v.value).trim() === '') continue;
        vsById[Number(v.vitalsign_item_id)] = v;
        if (!latestVsRec) {
          latestVsRec = v;
        } else {
          const curD = parsePgDate(latestVsRec.vitalsign_date);
          const newD = parsePgDate(v.vitalsign_date);
          const curT = String(latestVsRec.vtime || '');
          const newT = String(v.vtime || '');
          if (newD && (!curD || newD > curD || (newD.getTime() === curD.getTime() && newT > curT))) {
            latestVsRec = v;
          }
        }
      }

      let cardVsTimeText = '-';
      if (latestVsRec) {
        const dPart = latestVsRec.vitalsign_date ? formatThaiDate(latestVsRec.vitalsign_date) : '';
        let tPart = '';
        if (latestVsRec.vtime) {
          tPart = formatTimeShort(latestVsRec.vtime);
        } else if (latestVsRec.slot_id !== null && latestVsRec.slot_id !== undefined) {
          tPart = `${String(latestVsRec.slot_id).padStart(2, '0')}:00 น.`;
        }
        cardVsTimeText = [dPart, tPart].filter(Boolean).join(' ') || '-';
      }

      const cardTemp = vsById[1] ? `${vsById[1].value}°C` : '-';
      const cardPulse = vsById[2] ? `${vsById[2].value}` : '-';
      const cardRR = vsById[3] ? `${vsById[3].value}` : '-';
      const cardBP = (vsById[4] || vsById[5])
        ? `${vsById[4] ? vsById[4].value : '-'}/${vsById[5] ? vsById[5].value : '-'}`
        : '-';
      const cardSpO2 = vsById[7] ? `${vsById[7].value}%` : '-';

      return `
        <article class="patient-card" data-ipd-id="${pt.ipd_id}">
          <div>
            <div class="patient-card-top">
              <span class="bed-badge">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/>
                </svg>
                เตียง ${escapeHtml(pt.bed_no || '-')}
              </span>
              <div class="hn-an-badges">
                <span class="hn-pill">HN ${escapeHtml(pt.hn)}</span>
                <span class="an-pill">AN ${escapeHtml(pt.an)}</span>
              </div>
            </div>

            <div class="patient-main-identity">
              <h4>${escapeHtml(pt.fullname)}</h4>
              <div class="patient-sub-demographics">
                <span>อายุ ${escapeHtml(ageText)}</span>
                <span>•</span>
                <span>Admit ${escapeHtml(formatThaiDate(pt.regdate))}${los ? ` (${los} วัน)` : ''}</span>
                ${pt.confirm_discharge ? `<span class="badge-pill badge-muted">จำหน่ายแล้ว</span>` : ''}
              </div>
            </div>

            <div class="patient-clinical-box" style="margin-top: 10px;">
              <div class="clinical-row">
                <span class="clinical-label">Dx:</span>
                <span class="clinical-val">${escapeHtml(diagText)}</span>
              </div>
              <div class="clinical-row">
                <span class="clinical-label">แพทย์เจ้าของไข้:</span>
                <span class="clinical-val">${escapeHtml(doctorText)}</span>
              </div>
              <div class="clinical-row card-vitals-row">
                <span class="clinical-label">V/S ล่าสุด:</span>
                <div class="card-vitals-content">
                  <div class="card-vitals-items">
                    <span>T: <strong>${escapeHtml(cardTemp)}</strong></span>
                    <span>P: <strong>${escapeHtml(cardPulse)}</strong></span>
                    <span>RR: <strong>${escapeHtml(cardRR)}</strong></span>
                    <span>BP: <strong>${escapeHtml(cardBP)}</strong></span>
                    <span>SpO2: <strong>${escapeHtml(cardSpO2)}</strong></span>
                  </div>
                  <div class="card-vitals-time">เวลาที่บันทึก: ${escapeHtml(cardVsTimeText)}</div>
                </div>
              </div>
              ${pt.drugallergy ? `
                <div class="clinical-row" style="margin-top: 6px;">
                  <span class="allergy-tag">⚠ แพ้ยา: ${escapeHtml(pt.drugallergy)}</span>
                </div>
              ` : ''}
            </div>
          </div>

          <div class="patient-card-footer">
            <div class="order-stat-info">
              <span class="order-count-badge ${orderCount === 0 ? 'zero' : ''}">
                ${orderCount > 0 ? `ใบคำสั่งแพทย์ ${orderCount} ครั้ง (${itemCount} รายการ)` : 'ยังไม่มีใบคำสั่งแพทย์'}
              </span>
              <span class="order-last-date">${escapeHtml(lastOrderText)}</span>
            </div>

            <button type="button" class="btn btn-primary select-patient-btn" data-select-ipd="${pt.ipd_id}">
              <span>ดู Order</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </article>
      `;
    }).join('');

    el.patientListGrid.querySelectorAll('.patient-card').forEach(card => {
      card.addEventListener('click', () => {
        const ipdId = Number(card.getAttribute('data-ipd-id'));
        if (ipdId) {
          openPatientDetail(ipdId);
        }
      });
    });
  }

  // ==================== PATIENT DETAIL & ORDERS VIEW ====================
  async function openPatientDetail(ipdId) {
    el.landingView.classList.add('hidden');
    el.patientDetailView.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (state.selectedWard) {
      el.backToWardLabel.textContent = `กลับหอผู้ป่วย (${state.selectedWard.name})`;
    } else {
      el.backToWardLabel.textContent = 'กลับหน้ารายชื่อผู้ป่วย';
    }

    state.orderCategoryFilter = 'all';
    state.orderSearchQuery = '';
    el.orderItemSearch.value = '';
    el.orderCategoryTabs.querySelectorAll('.cat-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-cat') === 'all');
    });

    await fetchAndRenderPatientOrders(ipdId);
  }

  async function fetchAndRenderPatientOrders(ipdId) {
    el.ordersLoading.classList.remove('hidden');
    el.ordersTimelineContainer.innerHTML = '';
    el.patientBanner.innerHTML = `<div style="color: var(--text-muted);">กำลังโหลดข้อมูลผู้ป่วย...</div>`;

    try {
      const data = await apiFetch(`/api/patients/${ipdId}/orders`);
      state.currentPatientData = data;
      renderPatientBanner(data);
      renderOrdersTimeline();
    } catch (err) {
      el.ordersTimelineContainer.innerHTML = `
        <div class="empty-box">
          <h4>ไม่สามารถดึงข้อมูลคำสั่งการรักษาได้</h4>
          <p>${escapeHtml(err.message)}</p>
        </div>
      `;
    } finally {
      el.ordersLoading.classList.add('hidden');
    }
  }

  function renderPatientBanner(data) {
    const pt = data.patient;
    const allergies = data.allergies || [];
    const doctors = data.doctors || [];
    const vitals = data.vitals || [];

    const ageText = calculateAgeText(pt.birthday);
    const los = calculateLosDays(pt.regdate);
    const diagText = pt.prediag || pt.provision_dx || pt.admit_for || '-';

    // Combine drugallergy field and patient_allergies table
    const allergyTexts = [];
    if (pt.drugallergy) allergyTexts.push(pt.drugallergy);
    for (const al of allergies) {
      const s = `${al.agent || ''}${al.symptom ? ` (${al.symptom})` : ''}`.trim();
      if (s && !allergyTexts.includes(s)) allergyTexts.push(s);
    }

    // Latest vitals map by item_display and vitalsign_item_id
    const latestVitalsMap = {};
    const latestVitalsById = {};
    let latestVitalRecord = null;

    for (const v of vitals) {
      const val = v.value !== null && v.value !== undefined ? String(v.value).trim() : '';
      if (!val) continue;

      const key = v.item_display || v.item_ename;
      const itemId = Number(v.vitalsign_item_id);
      if (key && !latestVitalsMap[key]) {
        latestVitalsMap[key] = v;
      }
      if (itemId && !latestVitalsById[itemId]) {
        latestVitalsById[itemId] = v;
      }

      if (!latestVitalRecord) {
        latestVitalRecord = v;
      } else {
        const curDate = parsePgDate(latestVitalRecord.vitalsign_date);
        const newDate = parsePgDate(v.vitalsign_date);
        const curTime = String(latestVitalRecord.vtime || '');
        const newTime = String(v.vtime || '');
        if (newDate && (!curDate || newDate > curDate || (newDate.getTime() === curDate.getTime() && newTime > curTime))) {
          latestVitalRecord = v;
        }
      }
    }

    const formatVitalTimeInfo = (rec) => {
      if (!rec) return '';
      const dStr = rec.vitalsign_date ? formatThaiDate(rec.vitalsign_date) : '';
      let tStr = '';
      if (rec.vtime) {
        tStr = formatTimeShort(rec.vtime);
      } else if (rec.slot_id !== null && rec.slot_id !== undefined) {
        tStr = `${String(rec.slot_id).padStart(2, '0')}:00 น.`;
      }
      return [dStr, tStr].filter(Boolean).join(' ');
    };

    const standardVitals = [
      { label: 'Temp', unit: '°C', getRec: () => latestVitalsById[1] || latestVitalsMap['Temp'] },
      { label: 'Pulse', unit: '/min', getRec: () => latestVitalsById[2] || latestVitalsMap['Pulse'] },
      { label: 'RR', unit: '/min', getRec: () => latestVitalsById[3] || latestVitalsMap['Respirations'] },
      {
        label: 'BP',
        unit: 'mmHg',
        getCustom: () => {
          const sbp = latestVitalsById[4] || latestVitalsMap['B.P. Systolic'];
          const dbp = latestVitalsById[5] || latestVitalsMap['B.P. Diastolic'];
          if (!sbp && !dbp) return null;
          const sVal = sbp ? sbp.value : '-';
          const dVal = dbp ? dbp.value : '-';
          return {
            value: `${sVal}/${dVal}`,
            rec: sbp || dbp
          };
        }
      },
      { label: 'O2 Sat', unit: '%', getRec: () => latestVitalsById[7] || latestVitalsMap['O2 Sat'] },
      { label: 'Pain Score', unit: '', getRec: () => latestVitalsById[6] || latestVitalsMap['Pain Score'] },
      { label: 'BW', unit: 'kg', getRec: () => latestVitalsById[8] || latestVitalsMap['Weight'] },
      { label: 'Height', unit: 'cm', getRec: () => latestVitalsById[9] || latestVitalsMap['Height'] },
    ];

    const hasAnyVital = Boolean(latestVitalRecord);
    const overallVitalTimeText = hasAnyVital ? formatVitalTimeInfo(latestVitalRecord) : '-';

    const inchargeFromList = doctors.find(d => Number(d.ipd_doctor_type_id) === 1 && d.active)
      || doctors.find(d => Number(d.ipd_doctor_type_id) === 1)
      || doctors[0];
    const primaryDocName = pt.incharge_doctor_name
      || (inchargeFromList && inchargeFromList.doctor_name)
      || pt.adm_doctor_name
      || '';
    const primaryDocLicense = pt.incharge_doctor_name
      ? pt.incharge_doctor_license
      : (inchargeFromList && inchargeFromList.doctor_name ? inchargeFromList.licenseno : pt.adm_doctor_license);
    const primaryDoc = primaryDocName
      ? `${primaryDocName}${primaryDocLicense ? ` (${primaryDocLicense})` : ''}`
      : '-';

    el.patientBanner.innerHTML = `
      <div class="banner-top">
        <div class="banner-name-group">
          <h2>${escapeHtml(pt.fullname)}</h2>
          <div style="font-size: 0.88rem; color: var(--text-secondary);">
            หอผู้ป่วย: <strong>${escapeHtml(pt.ward_name || '-')}</strong> • เตียง: <strong>${escapeHtml(pt.bed_no || '-')}</strong>
            ${pt.room_name ? `(${escapeHtml(pt.room_name)})` : ''}
          </div>
        </div>
        <div class="banner-badges">
          <span class="hn-pill" style="font-size: 0.92rem; padding: 5px 12px;">HN ${escapeHtml(pt.hn)}</span>
          <span class="an-pill" style="font-size: 0.88rem; padding: 5px 12px;">AN ${escapeHtml(pt.an)}</span>
          <span class="bed-badge">อายุ ${escapeHtml(ageText)}</span>
        </div>
      </div>

      <div class="banner-grid">
        <div class="banner-item">
          <span class="b-label">การวินิจฉัย (Diagnosis)</span>
          <span class="b-value">${escapeHtml(diagText)}</span>
        </div>
        <div class="banner-item">
          <span class="b-label">แพทย์เจ้าของไข้</span>
          <span class="b-value">${escapeHtml(primaryDoc)}</span>
        </div>
        <div class="banner-item">
          <span class="b-label">วันที่เข้ารับการรักษา (Admit)</span>
          <span class="b-value">${escapeHtml(formatThaiDate(pt.regdate))} ${escapeHtml(formatTimeShort(pt.regtime))} ${los ? `(นอน ${los} วัน)` : ''}</span>
        </div>
        <div class="banner-item">
          <span class="b-label">สิทธิการรักษา / แผนก</span>
          <span class="b-value">${escapeHtml(pt.pttype_name || '-')} ${pt.spclty_name ? `• ${escapeHtml(pt.spclty_name)}` : ''}</span>
        </div>
      </div>

      ${allergyTexts.length > 0 ? `
        <div class="banner-allergy-bar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>ประวัติแพ้ยา: ${escapeHtml(allergyTexts.join(' | '))}</span>
        </div>
      ` : ''}

      <div class="vitals-strip">
        <div class="vitals-strip-header">
          <span class="vitals-strip-title">สัญญาณชีพล่าสุด (Vital Signs):</span>
          <span class="vitals-strip-time">เวลาที่บันทึก: <strong>${escapeHtml(overallVitalTimeText)}</strong></span>
        </div>
        <div class="vitals-chips-wrap">
          ${standardVitals.map(item => {
            let valText = '-';
            let timeTooltip = '';
            if (item.getCustom) {
              const custom = item.getCustom();
              if (custom) {
                valText = `${custom.value}${item.unit ? ` ${item.unit}` : ''}`;
                timeTooltip = formatVitalTimeInfo(custom.rec);
              }
            } else if (item.getRec) {
              const rec = item.getRec();
              if (rec && rec.value !== null && rec.value !== undefined && String(rec.value).trim() !== '') {
                valText = `${rec.value}${item.unit ? ` ${item.unit}` : ''}`;
                timeTooltip = formatVitalTimeInfo(rec);
              }
            }
            const isMissing = valText === '-';
            return `
              <span class="vital-chip ${isMissing ? 'vital-empty' : ''}" ${timeTooltip ? `title="บันทึกเมื่อ ${escapeHtml(timeTooltip)}"` : ''}>
                ${escapeHtml(item.label)}: <strong>${escapeHtml(valText)}</strong>
                ${timeTooltip && timeTooltip !== overallVitalTimeText ? `<small class="vital-item-time">(${escapeHtml(timeTooltip)})</small>` : ''}
              </span>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // Check if an order item matches the active category & search query
  function itemMatchesFilters(item) {
    const cat = state.orderCategoryFilter;
    const typeId = Number(item.doctor_order_type_id);
    const ordType = (item.order_type || '').trim();

    if (cat === 'oneday' && ordType !== 'D') return false;
    if (cat === 'continue' && ordType !== 'C') return false;
    if (cat === 'progress' && typeId !== 11 && ordType !== 'N') return false;
    if (cat === 'med' && typeId !== 5 && typeId !== 13) return false;
    if (cat === 'lab' && typeId !== 6) return false;
    if (cat === 'xray' && typeId !== 7) return false;
    if (cat === 'general' && ![1, 2, 3, 4, 8, 9, 10, 12].includes(typeId)) return false;

    const q = (state.orderSearchQuery || '').trim().toLowerCase();
    if (!q) return true;

    const searchable = [
      item.type_name,
      item.order_desc,
      item.other,
      item.med_iname,
      item.usage_human_text,
      item.usage_doctor_text,
      item.freq_name,
      item.freq_for_doctors,
      item.pn_title,
      item.s_note,
      item.o_note,
      item.a_note,
      item.p_note,
      item.lab_set_name,
      item.xray_set_name,
      item.diet_full_name,
      item.diet_type_name,
      item.consult_info,
      ...(item.resolved_subtypes || [])
    ].filter(Boolean).join(' ').toLowerCase();

    return searchable.includes(q);
  }

  function renderSingleOrderItem(item) {
    const typeId = Number(item.doctor_order_type_id);
    const ordType = (item.order_type || '').trim();

    // 1. Progress Note (type 11)
    if (typeId === 11 || ordType === 'N') {
      const title = item.pn_title || item.order_desc || 'Progress Note';
      return `
        <div class="order-item-box type-progress">
          <div class="oi-header">
            <span class="oi-type-tag progress">Progress Note</span>
            ${item.progress_time ? `<span style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(formatTimeShort(item.progress_time))}</span>` : ''}
          </div>
          <div class="oi-title">${escapeHtml(title)}</div>
          <div class="soap-grid">
            ${item.s_note ? `<div class="soap-row"><span class="soap-badge">S</span><div class="soap-text">${escapeHtml(item.s_note)}</div></div>` : ''}
            ${item.o_note ? `<div class="soap-row"><span class="soap-badge">O</span><div class="soap-text">${escapeHtml(item.o_note)}</div></div>` : ''}
            ${item.a_note ? `<div class="soap-row"><span class="soap-badge">A</span><div class="soap-text">${escapeHtml(item.a_note)}</div></div>` : ''}
            ${item.p_note ? `<div class="soap-row"><span class="soap-badge">P</span><div class="soap-text">${escapeHtml(item.p_note)}</div></div>` : ''}
            ${(!item.s_note && !item.o_note && !item.a_note && !item.p_note && item.other) ? `<div class="oi-subtext">${escapeHtml(item.other)}</div>` : ''}
          </div>
        </div>
      `;
    }

    // 2. Medication (type 5 or 13)
    if (typeId === 5 || typeId === 13) {
      const isOff = typeId === 13 || Boolean(item.off_date || item.med_off_at);
      const medTitle = item.med_iname || item.order_desc || 'รายการยา';
      const dosePart = item.med_dose ? `${Number(item.med_dose)} ${item.med_unit_name || item.med_usage_unit_code || ''}`.trim() : '';
      const usagePart = item.usage_doctor_text || item.usage_human_text || '';
      const freqPart = item.freq_for_doctors || item.freq_name || item.freq_code || '';
      const sigLine = [usagePart, dosePart, freqPart].filter(Boolean).join(' • ');
      const thaiSigLine = [item.usage_human_text, dosePart, item.freq_name, item.time_name].filter(Boolean).join(' ');

      return `
        <div class="order-item-box ${isOff ? 'type-off' : 'type-med'}">
          <div class="oi-header">
            <span class="oi-type-tag ${isOff ? 'off' : 'med'}">
              ${isOff ? 'Off Medication' : (ordType === 'H' ? 'Home Med' : 'Medication')}
            </span>
            ${item.med_stat ? `<span class="allergy-tag">STAT</span>` : ''}
            ${item.med_qty && Number(item.med_qty) > 0 ? `<span style="font-size:0.76rem; font-weight:600; color:var(--text-muted);">จำนวน ${Number(item.med_qty)}</span>` : ''}
          </div>
          <div class="oi-title">${escapeHtml(medTitle)}</div>
          <div class="oi-med-sig">
            ${sigLine ? `<div class="oi-med-dose-line">${escapeHtml(sigLine)}</div>` : ''}
            ${thaiSigLine && thaiSigLine !== sigLine ? `<div>${escapeHtml(thaiSigLine)}</div>` : ''}
            ${item.med_note || item.other ? `<div class="oi-subtext">หมายเหตุ: ${escapeHtml(item.med_note || item.other)}</div>` : ''}
            ${item.off_date ? `<div style="color:var(--danger); font-weight:600; font-size:0.78rem;">Off เมื่อ: ${escapeHtml(formatThaiDate(item.off_date))} ${escapeHtml(formatTimeShort(item.off_time))}</div>` : ''}
          </div>
        </div>
      `;
    }

    // 3. Lab (type 6)
    if (typeId === 6) {
      const labName = item.lab_set_name || item.order_desc || 'Lab Order';
      return `
        <div class="order-item-box type-lab">
          <div class="oi-header">
            <span class="oi-type-tag lab">Lab</span>
            ${item.lab_is_tmr ? `<span class="badge-pill badge-order-pt">ส่งตรวจพรุ่งนี้</span>` : ''}
          </div>
          <div class="oi-title">${escapeHtml(labName)}</div>
          ${item.other ? `<div class="oi-subtext">${escapeHtml(item.other)}</div>` : ''}
        </div>
      `;
    }

    // 4. X-Ray (type 7)
    if (typeId === 7) {
      const xrayName = item.xray_set_name || item.order_desc || 'X-Ray Order';
      return `
        <div class="order-item-box type-xray">
          <div class="oi-header">
            <span class="oi-type-tag xray">X-Ray</span>
            ${item.rad_priority_name ? `<span style="font-size:0.75rem; font-weight:600; color:var(--accent-amber);">${escapeHtml(item.rad_priority_name)}</span>` : ''}
          </div>
          <div class="oi-title">${escapeHtml(xrayName)}</div>
          ${item.rad_clinical_info || item.other ? `<div class="oi-subtext">${escapeHtml(item.rad_clinical_info || item.other)}</div>` : ''}
        </div>
      `;
    }

    // 5. Diet (type 1)
    if (typeId === 1) {
      const dietTitle = item.diet_full_name || item.order_desc || item.diet_type_name || 'Diet Order';
      const dietExtra = [item.diet_dose_name, item.diet_other_name, item.diet_note, item.other].filter(Boolean).join(' • ');
      return `
        <div class="order-item-box">
          <div class="oi-header">
            <span class="oi-type-tag">Diet (อาหาร)</span>
          </div>
          <div class="oi-title">${escapeHtml(dietTitle)}</div>
          ${dietExtra ? `<div class="oi-subtext">${escapeHtml(dietExtra)}</div>` : ''}
        </div>
      `;
    }

    // 6. Blood G/M (type 10)
    if (typeId === 10) {
      const bloodTitle = item.blood_item_name || item.order_desc || 'Blood Order';
      const details = [
        item.blood_qty ? `จำนวน ${item.blood_qty} unit` : '',
        item.blood_cc ? `${item.blood_cc} cc` : '',
        item.blood_request_type_desc || item.blood_request_type_name || ''
      ].filter(Boolean).join(' • ');
      return `
        <div class="order-item-box">
          <div class="oi-header">
            <span class="oi-type-tag off">Blood (G/M)</span>
          </div>
          <div class="oi-title">${escapeHtml(bloodTitle)}</div>
          ${details ? `<div class="oi-subtext">${escapeHtml(details)}</div>` : ''}
        </div>
      `;
    }

    // 7. Consult (type 12)
    if (typeId === 12) {
      const consultTitle = item.consult_spclty_name ? `Consult ${item.consult_spclty_name}` : (item.order_desc || 'Consult');
      const consultBody = [item.consult_diag ? `Dx: ${item.consult_diag}` : '', item.consult_info, item.other].filter(Boolean).join('\n');
      return `
        <div class="order-item-box">
          <div class="oi-header">
            <span class="oi-type-tag">Consult</span>
          </div>
          <div class="oi-title">${escapeHtml(consultTitle)}</div>
          ${consultBody ? `<div class="oi-subtext">${escapeHtml(consultBody)}</div>` : ''}
        </div>
      `;
    }

    // 8. General orders: Activity (2), Retained (3), Record (4), Other (8), Operation (9)
    const subtypeList = (item.resolved_subtypes || []).join(', ');
    const mainTitle = item.order_desc || subtypeList || item.other || item.type_name || 'Order';
    const subNote = (item.order_desc && item.other && item.other !== item.order_desc) ? item.other : '';

    return `
      <div class="order-item-box">
        <div class="oi-header">
          <span class="oi-type-tag">${escapeHtml(item.type_name || 'Order')}</span>
          ${item.off_date ? `<span style="font-size:0.74rem; color:var(--danger); font-weight:600;">Off ${escapeHtml(formatThaiDate(item.off_date))}</span>` : ''}
        </div>
        <div class="oi-title">${escapeHtml(mainTitle)}</div>
        ${subNote ? `<div class="oi-subtext">${escapeHtml(subNote)}</div>` : ''}
      </div>
    `;
  }

  function renderOrdersTimeline() {
    if (!state.currentPatientData) return;
    const masters = state.currentPatientData.orderMasters || [];

    // Filter masters whose orders match current filters
    const filteredMasters = [];
    let totalMatchingItems = 0;

    for (const m of masters) {
      const matchingOrders = (m.orders || []).filter(itemMatchesFilters);
      if (matchingOrders.length > 0 || (state.orderCategoryFilter === 'all' && !state.orderSearchQuery && m.admit_for)) {
        filteredMasters.push({ ...m, filteredOrders: matchingOrders });
        totalMatchingItems += matchingOrders.length;
      }
    }

    el.ordersCountHeading.textContent = `รายการคำสั่งการรักษา (${filteredMasters.length} วัน/ครั้ง • ${totalMatchingItems} รายการ) เรียงจากปัจจุบันไปอดีต`;

    if (filteredMasters.length === 0) {
      el.ordersTimelineContainer.innerHTML = `
        <div class="empty-box">
          <div class="empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <h4>ไม่พบรายการคำสั่งการรักษา (Order)</h4>
          <p>ผู้ป่วยรายนี้ยังไม่มีคำสั่งการรักษาในหมวดหมู่ที่เลือก หรือลองเปลี่ยนตัวกรองด้านบน</p>
        </div>
      `;
      return;
    }

    el.ordersTimelineContainer.innerHTML = filteredMasters.map((master, index) => {
      const orders = master.filteredOrders || [];
      const progressItems = orders.filter(o => Number(o.doctor_order_type_id) === 11 || o.order_type === 'N');
      const oneDayItems = orders.filter(o => Number(o.doctor_order_type_id) !== 11 && o.order_type === 'D');
      const continueItems = orders.filter(o => Number(o.doctor_order_type_id) !== 11 && o.order_type !== 'D');

      const doctorDisplay = master.doctor_name
        ? `${master.doctor_name}${master.doctor_license ? ` (${master.doctor_license})` : ''}`
        : (master.created_by_name || 'แพทย์ผู้สั่ง');

      const isLatest = index === 0;
      const chronLabel = isLatest ? 'ล่าสุด (ปัจจุบัน)' : `ย้อนหลัง #${index + 1}`;

      const showThreeCols = state.orderCategoryFilter === 'all';

      return `
        <article class="order-master-card">
          <header class="order-master-header">
            <div class="om-date-group">
              <span class="om-chron-badge ${isLatest ? '' : 'older'}">${escapeHtml(chronLabel)}</span>
              <span class="om-datetime">วันที่ ${escapeHtml(formatThaiDate(master.order_date))}</span>
              ${master.order_time ? `<span class="om-time-pill">เวลา ${escapeHtml(formatTimeShort(master.order_time))}</span>` : ''}
              ${master.admit_for ? `<span class="badge-pill badge-order-pt">Admit for: ${escapeHtml(master.admit_for)}</span>` : ''}
            </div>

            <div class="om-meta-right">
              <span class="om-doctor">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                ${escapeHtml(doctorDisplay)}
              </span>
              <span class="om-status-pill ${master.confirm ? 'confirmed' : 'draft'}">
                ${master.confirm ? '✓ ยืนยันคำสั่งแล้ว' : 'ฉบับร่าง / รอยืนยัน'}
              </span>
            </div>
          </header>

          ${showThreeCols ? `
            <div class="order-sheet-grid three-col">
              <!-- Column 1: Progress Note -->
              <div class="order-col">
                <div class="order-col-title col-progress">
                  <span>Progress Note (SOAP)</span>
                  <span>${progressItems.length} รายการ</span>
                </div>
                <div class="order-items-stack">
                  ${progressItems.length > 0
                    ? progressItems.map(renderSingleOrderItem).join('')
                    : `<div class="empty-col-placeholder">- ไม่มีบันทึก Progress Note -</div>`
                  }
                </div>
              </div>

              <!-- Column 2: One Day Orders -->
              <div class="order-col">
                <div class="order-col-title col-oneday">
                  <span>Order for One Day</span>
                  <span>${oneDayItems.length} รายการ</span>
                </div>
                <div class="order-items-stack">
                  ${oneDayItems.length > 0
                    ? oneDayItems.map(renderSingleOrderItem).join('')
                    : `<div class="empty-col-placeholder">- ไม่มีรายการ One Day Order -</div>`
                  }
                </div>
              </div>

              <!-- Column 3: Continuous Orders -->
              <div class="order-col">
                <div class="order-col-title col-continue">
                  <span>Order for Continuation</span>
                  <span>${continueItems.length} รายการ</span>
                </div>
                <div class="order-items-stack">
                  ${continueItems.length > 0
                    ? continueItems.map(renderSingleOrderItem).join('')
                    : `<div class="empty-col-placeholder">- ไม่มีรายการ Continuous Order -</div>`
                  }
                </div>
              </div>
            </div>
          ` : `
            <div class="order-col">
              <div class="order-items-stack">
                ${orders.map(renderSingleOrderItem).join('')}
              </div>
            </div>
          `}
        </article>
      `;
    }).join('');
  }

  // ==================== EVENT LISTENERS ====================
  function bindEvents() {
    el.loginForm.addEventListener('submit', handleLoginSubmit);

    el.togglePasswordBtn.addEventListener('click', () => {
      const isPwd = el.loginPassword.type === 'password';
      el.loginPassword.type = isPwd ? 'text' : 'password';
    });

    el.logoutBtn.addEventListener('click', handleLogout);
    el.topbarHomeTrigger.addEventListener('click', showLandingView);

    // Ward search input events
    el.wardSearchInput.addEventListener('focus', () => {
      renderWardDropdown(el.wardSearchInput.value);
    });

    el.wardSearchInput.addEventListener('input', () => {
      const val = el.wardSearchInput.value;
      el.clearWardInputBtn.classList.toggle('hidden', !val);
      renderWardDropdown(val);
    });

    el.wardSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const firstOpt = el.wardDropdown.querySelector('.ward-option-item[data-ward-id]');
        if (firstOpt) {
          firstOpt.click();
        }
      } else if (e.key === 'Escape') {
        el.wardDropdown.classList.add('hidden');
      }
    });

    el.clearWardInputBtn.addEventListener('click', () => {
      el.wardSearchInput.value = '';
      el.clearWardInputBtn.classList.add('hidden');
      renderWardDropdown('');
      el.wardSearchInput.focus();
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.ward-input-wrapper')) {
        el.wardDropdown.classList.add('hidden');
      }
    });

    el.toggleAllWardsBtn.addEventListener('click', () => {
      state.showAllWardChips = !state.showAllWardChips;
      renderWardChips();
    });

    // Patient filter & status toggle
    el.patientSearchInput.addEventListener('input', () => {
      state.patientSearchQuery = el.patientSearchInput.value;
      renderPatientCards();
    });

    el.filterStatusActive.addEventListener('click', () => {
      if (state.patientStatusFilter === 'active') return;
      state.patientStatusFilter = 'active';
      el.filterStatusActive.classList.add('active');
      el.filterStatusAll.classList.remove('active');
      loadWardPatients();
    });

    el.filterStatusAll.addEventListener('click', () => {
      if (state.patientStatusFilter === 'all') return;
      state.patientStatusFilter = 'all';
      el.filterStatusAll.classList.add('active');
      el.filterStatusActive.classList.remove('active');
      loadWardPatients();
    });

    // Detail view navigation & order filters
    el.backToWardBtn.addEventListener('click', showLandingView);

    el.refreshOrdersBtn.addEventListener('click', () => {
      if (state.currentPatientData && state.currentPatientData.patient) {
        fetchAndRenderPatientOrders(state.currentPatientData.patient.ipd_id);
      }
    });

    el.orderItemSearch.addEventListener('input', () => {
      state.orderSearchQuery = el.orderItemSearch.value;
      renderOrdersTimeline();
    });

    el.orderCategoryTabs.querySelectorAll('.cat-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state.orderCategoryFilter = tab.getAttribute('data-cat') || 'all';
        el.orderCategoryTabs.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderOrdersTimeline();
      });
    });
  }

  // ==================== INIT ====================
  async function init() {
    bindEvents();
    await loadHealthAndSampleUsers();

    if (state.token && state.user) {
      try {
        await apiFetch('/api/auth/me');
        enterAuthenticatedApp();
      } catch (_) {
        handleLogout();
      }
    }
  }

  init();
})();
