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
    currentEmrData: null,
    activeEmrTab: 'emr',
    orderCategoryFilter: 'all',
    orderSearchQuery: '',
    showAllWardChips: false,

    // Order Writer State (+Order)
    orderWriter: {
      activeCol: 'progress', // 'progress', 'D', 'C'
      soap: { title: '', s: '', o: '', a: '', p: '' },
      items: [], // [{ kind: 'med'|'lab'|'xray'|'diet'|'consult'|'text', type: 'D'|'C', label, ... }]
      note: '',
      meta: null, // { usages, freqs, spclties, reasons, neededs, labPriorities, xrayPriorities }
      currentDrawerDraft: null,
      editingIndex: null
    },

    // OPD EMR State
    opdEmr: {
      visits: [],
      selectedVisit: null,
      visitDetail: null,
      activeRightTab: 'LAB', // 'LAB', 'XRAY', 'MEDICINE'
      activeMobileTab: 'visits', // 'visits', 'card', 'tabs'
      previousView: 'orders' // 'orders' or 'emr'
    }
  };

  // DOM Elements
  const el = {
    loginView: document.getElementById('login-view'),
    mainShell: document.getElementById('main-shell'),
    landingView: document.getElementById('landing-view'),
    patientDetailView: document.getElementById('patient-detail-view'),
    patientEmrView: document.getElementById('patient-emr-view'),

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
    ordersGotoEmrBtn: document.getElementById('orders-goto-emr-btn'),
    refreshOrdersBtn: document.getElementById('refresh-orders-btn'),
    patientBanner: document.getElementById('patient-banner'),
    ordersCountHeading: document.getElementById('orders-count-heading'),
    orderItemSearch: document.getElementById('order-item-search'),
    orderCategoryTabs: document.getElementById('order-category-tabs'),
    ordersLoading: document.getElementById('orders-loading'),
    ordersTimelineContainer: document.getElementById('orders-timeline-container'),

    backFromEmrBtn: document.getElementById('back-from-emr-btn'),
    backFromEmrLabel: document.getElementById('back-from-emr-label'),
    emrGotoOrdersBtn: document.getElementById('emr-goto-orders-btn'),
    refreshEmrBtn: document.getElementById('refresh-emr-btn'),
    emrPatientBanner: document.getElementById('emr-patient-banner'),
    emrActiveMenuTitle: document.getElementById('emr-active-menu-title'),
    emrMenuTabs: document.getElementById('emr-menu-tabs'),
    emrLoading: document.getElementById('emr-loading'),
    emrContentContainer: document.getElementById('emr-content-container'),

    // Create Order Modal Elements (+Order)
    openCreateOrderBtn: document.getElementById('open-create-order-btn'),
    createOrderModal: document.getElementById('create-order-modal'),
    closeOrderModalBtn: document.getElementById('close-order-modal-btn'),
    orderModalPatientInfo: document.getElementById('order-modal-patient-info'),
    owPatientStrip: document.getElementById('ow-patient-strip'),
    owErrorBanner: document.getElementById('ow-error-banner'),
    soapTitle: document.getElementById('soap-title'),
    soapS: document.getElementById('soap-s'),
    soapO: document.getElementById('soap-o'),
    soapA: document.getElementById('soap-a'),
    soapP: document.getElementById('soap-p'),
    soapInsertVsBtn: document.getElementById('soap-insert-vs-btn'),
    owSearchD: document.getElementById('ow-search-D'),
    owFoundD: document.getElementById('ow-found-D'),
    owListD: document.getElementById('ow-list-D'),
    owSearchC: document.getElementById('ow-search-C'),
    owFoundC: document.getElementById('ow-found-C'),
    owListC: document.getElementById('ow-list-C'),
    owMasterNote: document.getElementById('ow-master-note'),
    owSummaryText: document.getElementById('ow-summary-text'),
    owCancelBtn: document.getElementById('ow-cancel-btn'),
    owSubmitBtn: document.getElementById('ow-submit-btn'),
    owItemFormDrawer: document.getElementById('ow-item-form-drawer'),
    owDrawerTitle: document.getElementById('ow-drawer-title'),
    owDrawerBody: document.getElementById('ow-drawer-body'),
    owDrawerCloseBtn: document.getElementById('ow-drawer-close-btn'),
    owDrawerCancelBtn: document.getElementById('ow-drawer-cancel-btn'),
    owDrawerConfirmBtn: document.getElementById('ow-drawer-confirm-btn'),

    // OPD EMR View Elements
    patientOpdView: document.getElementById('patient-opd-view'),
    backToIpdFromOpdBtn: document.getElementById('back-to-ipd-from-opd-btn'),
    opdNavTitle: document.getElementById('opd-nav-title'),
    refreshOpdBtn: document.getElementById('refresh-opd-btn'),
    opdPatientBanner: document.getElementById('opd-patient-banner'),
    opdLoading: document.getElementById('opd-loading'),
    opdGridContainer: document.getElementById('opd-grid-container'),
    opdVisitsList: document.getElementById('opd-visits-list'),
    opdVisitCountBadge: document.getElementById('opd-visit-count-badge'),
    opdCardDateBadge: document.getElementById('opd-card-date-badge'),
    opdCardDeptBadge: document.getElementById('opd-card-dept-badge'),
    opdCardBody: document.getElementById('opd-card-body'),
    opdRightTabContent: document.getElementById('opd-right-tab-content'),
    opdMobVisitCount: document.getElementById('opd-mob-visit-count'),
    ordersGotoOpdBtn: document.getElementById('orders-goto-opd-btn'),
    emrGotoOpdBtn: document.getElementById('emr-goto-opd-btn'),
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
    if (el.patientEmrView) el.patientEmrView.classList.add('hidden');
    if (el.patientOpdView) el.patientOpdView.classList.add('hidden');
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

    if (el.toggleAllWardsBtn) {
      el.toggleAllWardsBtn.textContent = state.showAllWardChips
        ? `แสดงเฉพาะวอร์ดที่มีผู้ป่วย (${wardsWithPatients.length})`
        : `แสดงหอผู้ป่วยทั้งหมด (${state.wards.length})`;
    }

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

  function compareBedNo(a, b) {
    const bedA = String((a && a.bed_no) || '').trim();
    const bedB = String((b && b.bed_no) || '').trim();
    if ((!bedA || bedA === '-') && (!bedB || bedB === '-')) return 0;
    if (!bedA || bedA === '-') return 1;
    if (!bedB || bedB === '-') return -1;
    return bedA.localeCompare(bedB, undefined, { numeric: true, sensitivity: 'base' });
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
        (p.prediag && p.prediag.toLowerCase().includes(q)) ||
        (p.incharge_doctor_name && p.incharge_doctor_name.toLowerCase().includes(q)) ||
        (p.adm_doctor_name && p.adm_doctor_name.toLowerCase().includes(q))
      );
    }).sort(compareBedNo);

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

            <div class="patient-card-actions">
              <button type="button" class="btn btn-emr select-emr-btn" data-emr-ipd="${pt.ipd_id}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
                <span>EMR</span>
              </button>
              <button type="button" class="btn btn-primary select-patient-btn" data-select-ipd="${pt.ipd_id}">
                <span>ดู Order</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    el.patientListGrid.querySelectorAll('.select-emr-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ipdId = Number(btn.getAttribute('data-emr-ipd'));
        if (ipdId) {
          openPatientEmr(ipdId, 'emr');
        }
      });
    });

    el.patientListGrid.querySelectorAll('.patient-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.select-emr-btn')) return;
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
    if (el.patientEmrView) el.patientEmrView.classList.add('hidden');
    if (el.patientOpdView) el.patientOpdView.classList.add('hidden');
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

  function renderPatientBanner(data, targetBannerEl) {
    const bannerEl = targetBannerEl || el.patientBanner;
    const pt = data.patient;
    const allergies = data.allergies || [];
    const doctors = data.doctors || [];
    const vitals = data.vitals || data.vitalsLatest || [];

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

    bannerEl.innerHTML = `
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
            <div class="oi-med-badges-wrap">
              ${dosePart ? `<span class="oi-med-pill dose">${escapeHtml(dosePart)}</span>` : ''}
              ${usagePart ? `<span class="oi-med-pill route">${escapeHtml(usagePart)}</span>` : ''}
              ${freqPart ? `<span class="oi-med-pill freq">${escapeHtml(freqPart)}</span>` : ''}
            </div>
            ${thaiSigLine ? `<div class="oi-med-thai-desc">${escapeHtml(thaiSigLine)}</div>` : ''}
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

  function renderOrdersLabTabContent(masters, hisLabs, hisDates) {
    const q = (state.orderSearchQuery || '').trim().toLowerCase();
    const pt = state.currentPatientData ? state.currentPatientData.patient : {};

    // Collect all order items of type Lab (typeId 6)
    const allLabOrders = [];
    for (const m of masters) {
      for (const ord of (m.orders || [])) {
        if (Number(ord.doctor_order_type_id) === 6) {
          allLabOrders.push({ ...ord, master_order_date: m.order_date, master_order_time: m.order_time });
        }
      }
    }

    // Filter HIS labs by search query
    const filteredHisLabs = (hisLabs || []).filter(r => {
      if (!q) return true;
      const haystack = [r.lab_name, r.result_name, r.lab_code, r.lab_type, r.lab_result, r.req_date_display].join(' ').toLowerCase();
      return haystack.includes(q);
    });

    const filteredOrders = allLabOrders.filter(o => {
      if (!q) return true;
      const haystack = [o.lab_set_name, o.order_desc, o.other, o.doctor_name].join(' ').toLowerCase();
      return haystack.includes(q);
    });

    el.ordersCountHeading.textContent = `รายการ Lab และผลตรวจจาก HIS (${filteredHisLabs.length} รายการผลตรวจ • ${filteredOrders.length} รายการสั่ง)`;

    const selectedDate = (hisLabs[0] && hisLabs[0].req_date) || (hisDates[0] && hisDates[0].req_date) || '';

    el.ordersTimelineContainer.innerHTML = `
      <div class="emr-sections-stack">
        <!-- Live HIS Lab Results Section -->
        <section class="emr-card card-surface">
          <div class="emr-card-head" style="flex-wrap:wrap; gap:10px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <h4 class="emr-card-title">ผลการตรวจทางห้องปฏิบัติการ (HIS Live Lab Results)</h4>
                <span class="badge-pill badge-active-pt">เชื่อมต่อระบบ HIS สด</span>
              </div>
              <p style="font-size:0.82rem; color:var(--text-muted); margin-top:2px;">
                ข้อมูลผลแลปของ HN <strong>${escapeHtml(pt.hn || '-')}</strong> AN <strong>${escapeHtml(pt.an || '-')}</strong> ดึงตรงจาก HIS (MHR)
              </p>
            </div>

            <!-- Date Selector Dropdown for HIS Dates -->
            ${hisDates.length > 0 ? `
              <div style="display:flex; align-items:center; gap:8px;">
                <label for="his-lab-date-select" style="font-size:0.82rem; font-weight:600; color:var(--text-muted);">เลือกวันตรวจ:</label>
                <select id="his-lab-date-select" class="form-select-sm" style="padding:6px 12px; border-radius:8px; border:1px solid var(--border); background:var(--surface); font-family:inherit; font-size:0.86rem; font-weight:600; color:var(--text);">
                  ${hisDates.map(d => `
                    <option value="${escapeHtml(d.req_date)}" ${d.req_date === selectedDate ? 'selected' : ''}>
                      ${escapeHtml(d.req_date_display)} (${escapeHtml(d.req_date_iso)})
                    </option>
                  `).join('')}
                </select>
              </div>
            ` : ''}
          </div>

          ${filteredHisLabs.length > 0 ? `
            <div class="emr-table-responsive">
              <table class="emr-table">
                <thead>
                  <tr>
                    <th>ลำดับ</th>
                    <th>ประเภท</th>
                    <th>รายการตรวจ (Lab Test)</th>
                    <th>รายการผล (Item)</th>
                    <th style="text-align:right;">ผลตรวจ (Result)</th>
                    <th>หน่วย</th>
                    <th>ค่าปกติ (Reference Range)</th>
                    <th>เวลาส่งตรวจ</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderHisLabTableRows(filteredHisLabs)}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="emr-empty-inline">
              ${hisDates.length === 0 ? 'ไม่พบข้อมูลผลตรวจ Lab ในระบบ HIS สำหรับผู้ป่วยรายนี้' : 'ไม่มีรายการผลตรวจ Lab ที่ตรงกับเงื่อนไขการค้นหา'}
            </div>
          `}
        </section>

        <!-- Doctor Order Labs Section -->
        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">ประวัติคำสั่งตรวจ Lab ของแพทย์ในระบบ IPD (${filteredOrders.length} รายการ)</h4>
          </div>
          ${filteredOrders.length > 0 ? `
            <div class="emr-table-responsive">
              <table class="emr-table">
                <thead>
                  <tr>
                    <th>วันที่-เวลาสั่ง</th>
                    <th>รายการตรวจ Lab</th>
                    <th>ประเภทคำสั่ง</th>
                    <th>แพทย์ผู้สั่ง</th>
                    <th>หมายเหตุ / คำแนะนำ</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredOrders.map(o => `
                    <tr>
                      <td><strong>${escapeHtml(formatThaiDate(o.master_order_date))}</strong> ${escapeHtml(formatTimeShort(o.master_order_time))}</td>
                      <td><strong>${escapeHtml(o.lab_set_name || o.order_desc || '-')}</strong> ${o.lab_is_tmr ? `<span class="badge-pill badge-order-pt">ส่งตรวจพรุ่งนี้</span>` : ''}</td>
                      <td>${o.order_type === 'D' ? 'One Day' : (o.order_type === 'C' ? 'Continue' : escapeHtml(o.order_type || '-'))}</td>
                      <td>${escapeHtml(o.doctor_name || '-')}</td>
                      <td>${escapeHtml(o.other || '-')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="emr-empty-inline">ไม่มีรายการสั่งตรวจ Lab ของแพทย์ในระบบ IPD</div>
          `}
        </section>
      </div>
    `;

    // Bind event listener to Date select
    const dateSelectEl = document.getElementById('his-lab-date-select');
    if (dateSelectEl) {
      dateSelectEl.addEventListener('change', async (e) => {
        const chosenDate = e.target.value;
        try {
          dateSelectEl.disabled = true;
          const fresh = await apiFetch(`/api/patients/${encodeURIComponent(pt.hn)}/his-lab?date=${encodeURIComponent(chosenDate)}`);
          if (state.currentPatientData) {
            state.currentPatientData.hisLabResults = fresh.results || [];
            renderOrdersLabTabContent(masters, fresh.results || [], hisDates);
          }
        } catch (err) {
          alert('ไม่สามารถโหลดผลตรวจวันที่เลือกได้: ' + err.message);
        } finally {
          if (dateSelectEl) dateSelectEl.disabled = false;
        }
      });
    }
  }

  function renderHisLabTableRows(rows) {
    let currentType = '';
    return rows.map((r, i) => {
      let headerRow = '';
      if (r.lab_type && r.lab_type !== currentType) {
        currentType = r.lab_type;
        headerRow = `
          <tr class="emr-table-group-header" style="background:var(--surface-sunken, #f1f5f9); font-weight:700;">
            <td colspan="9" style="padding:8px 12px; color:var(--text-muted); font-size:0.82rem; text-transform:uppercase; letter-spacing:0.04em;">
              หมวด: ${escapeHtml(currentType)}
            </td>
          </tr>
        `;
      }

      const isAbnormal = r.not_normal || r.not_normal_low || r.not_normal_high;
      const abnormalClass = isAbnormal ? 'text-danger font-bold' : '';
      const flagBadge = r.not_normal_high
        ? `<span class="badge-pill badge-danger" style="margin-left:4px; font-size:0.7rem;">H ↑</span>`
        : (r.not_normal_low ? `<span class="badge-pill badge-danger" style="margin-left:4px; font-size:0.7rem;">L ↓</span>` : (isAbnormal ? `<span class="badge-pill badge-danger" style="margin-left:4px; font-size:0.7rem;">!</span>` : ''));

      return `
        ${headerRow}
        <tr class="${isAbnormal ? 'emr-row-abnormal' : ''}">
          <td style="color:var(--text-muted); font-size:0.8rem;">${i + 1}</td>
          <td><span class="badge-pill badge-muted" style="font-size:0.75rem;">${escapeHtml(r.lab_type || 'General')}</span></td>
          <td><strong>${escapeHtml(r.lab_name || r.lab_code || '-')}</strong></td>
          <td>${escapeHtml(r.result_name || '-')}</td>
          <td style="text-align:right;">
            <span class="${abnormalClass}">${escapeHtml(r.lab_result || '-')}</span>
            ${flagBadge}
          </td>
          <td style="color:var(--text-muted); font-size:0.82rem;">${escapeHtml(r.result_unit || '')}</td>
          <td style="color:var(--text-muted); font-size:0.82rem;">${escapeHtml(r.normal_range || '-')}</td>
          <td style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(r.request_time || '-')}</td>
          <td>
            ${r.lab_result && !['--- รอดำเนินการ ---', '--- ดูผลผ่านระบบ EMR ---'].includes(r.lab_result)
              ? `<span class="badge-pill badge-active-pt" style="font-size:0.72rem;">รายงานผลแล้ว</span>`
              : `<span class="badge-pill badge-order-pt" style="font-size:0.72rem;">รอดำเนินการ</span>`
            }
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderOrdersTimeline() {
    if (!state.currentPatientData) return;
    const masters = state.currentPatientData.orderMasters || [];
    const hisLabs = state.currentPatientData.hisLabResults || [];
    const hisDates = state.currentPatientData.hisLabDates || [];

    // Special view when user clicks the "Lab" tab in Doctor Orders
    if (state.orderCategoryFilter === 'lab') {
      renderOrdersLabTabContent(masters, hisLabs, hisDates);
      return;
    }

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

  // ==================== PATIENT EMR VIEW & 10 MENUS ====================
  const EMR_MENU_TITLES = {
    emr: 'EMR • ข้อมูลทั่วไปและการเข้ารับการรักษา',
    vitals: 'Vital Sign • สัญญาณชีพและคะแนนประเมิน',
    nursenote: 'Nurse Note • บันทึกทางการพยาบาล',
    lab: 'Lab • รายการส่งตรวจและผลตรวจทางห้องปฏิบัติการ',
    xray: 'X Ray • รายการส่งตรวจและผลทางรังสีวิทยา',
    procedure: 'Procedure • หัตถการและอุปกรณ์ทางการแพทย์',
    document: 'Document • เอกสารเวชระเบียน แบบประเมิน และใบปรึกษา',
    discharge: 'Discharge Summary • สรุปการจำหน่ายผู้ป่วยใน',
    doctors: 'ทีมแพทย์ • รายชื่อแพทย์ผู้ดูแลรักษา',
    setor: 'Set OR • ข้อมูลการผ่าตัดและคำสั่ง Pre/Post-Op',
  };

  async function openPatientEmr(ipdId, initialTab = 'emr') {
    el.landingView.classList.add('hidden');
    el.patientDetailView.classList.add('hidden');
    if (el.patientOpdView) el.patientOpdView.classList.add('hidden');
    el.patientEmrView.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (state.selectedWard) {
      el.backFromEmrLabel.textContent = `กลับหอผู้ป่วย (${state.selectedWard.name})`;
    } else {
      el.backFromEmrLabel.textContent = 'กลับหน้ารายชื่อผู้ป่วย';
    }

    state.activeEmrTab = initialTab || 'emr';
    updateActiveEmrTabUi();

    await fetchAndRenderPatientEmr(ipdId);
  }

  function updateActiveEmrTabUi() {
    if (!el.emrMenuTabs) return;
    el.emrMenuTabs.querySelectorAll('.emr-tab-btn').forEach(btn => {
      const tabKey = btn.getAttribute('data-emr-tab');
      btn.classList.toggle('active', tabKey === state.activeEmrTab);
    });
    if (el.emrActiveMenuTitle) {
      el.emrActiveMenuTitle.textContent = EMR_MENU_TITLES[state.activeEmrTab] || 'เวชระเบียนผู้ป่วยใน (EMR)';
    }
  }

  async function fetchAndRenderPatientEmr(ipdId) {
    el.emrLoading.classList.remove('hidden');
    el.emrContentContainer.innerHTML = '';
    el.emrPatientBanner.innerHTML = `<div style="color: var(--text-muted);">กำลังโหลดข้อมูลผู้ป่วย...</div>`;

    try {
      const data = await apiFetch(`/api/patients/${ipdId}/emr`);
      state.currentEmrData = data;
      renderPatientBanner(data, el.emrPatientBanner);
      updateEmrTabBadges(data);
      renderActiveEmrTabContent();
    } catch (err) {
      el.emrContentContainer.innerHTML = `
        <div class="empty-box">
          <h4>ไม่สามารถดึงข้อมูลเวชระเบียน (EMR) ได้</h4>
          <p>${escapeHtml(err.message)}</p>
        </div>
      `;
    } finally {
      el.emrLoading.classList.add('hidden');
    }
  }

  function updateEmrTabBadges(data) {
    const setBadge = (id, val) => {
      const node = document.getElementById(id);
      if (node) node.textContent = String(val);
    };

    // Group vitals by date+time slot for count
    const vsSlots = groupVitalsBySlot(data.vitalsHistory || []);
    setBadge('emr-badge-emr', 'สรุป');
    setBadge('emr-badge-vitals', vsSlots.length + (data.clinicalScorings || []).length);
    setBadge('emr-badge-nursenote', (data.nurseNotes || []).length + (data.nurseSummaries || []).length);
    setBadge('emr-badge-lab', (data.labOrders || []).length + (data.labResults || []).length);
    setBadge('emr-badge-xray', (data.xrayOrders || []).length + (data.xrayResults || []).length);
    setBadge('emr-badge-procedure', (data.procedures || []).length + (data.orderProcedures || []).length + (data.records || []).length);
    setBadge('emr-badge-document', (data.chartDocs || []).length + (data.assessments || []).length + (data.consults || []).length + (data.paperScans || []).length);
    setBadge('emr-badge-discharge', (data.discharges || []).length + (data.summaries || []).length + (data.diagnoses || []).length);
    setBadge('emr-badge-doctors', (data.doctors || []).length || 1);
    setBadge('emr-badge-setor', (data.orCases || []).length + (data.orOrders || []).length + (data.orReturns || []).length);
  }

  function groupVitalsBySlot(historyRows) {
    const map = new Map();
    for (const r of historyRows) {
      const dateStr = formatThaiDate(r.vitalsign_date);
      const timeStr = r.vtime
        ? formatTimeShort(r.vtime)
        : (r.slot_id !== null && r.slot_id !== undefined ? `${String(r.slot_id).padStart(2, '0')}:00 น.` : '-');
      const key = `${r.vitalsign_date || ''}_${timeStr}`;
      if (!map.has(key)) {
        map.set(key, {
          dateVal: r.vitalsign_date,
          dateText: dateStr,
          timeText: timeStr,
          shiftName: r.nurse_shift_name || '',
          items: {}
        });
      }
      const group = map.get(key);
      const itemId = Number(r.vitalsign_item_id);
      if (group.items[itemId] === undefined) {
        group.items[itemId] = r.value;
      }
    }
    return Array.from(map.values());
  }

  function renderActiveEmrTabContent() {
    if (!state.currentEmrData) return;
    const d = state.currentEmrData;
    const tab = state.activeEmrTab;

    switch (tab) {
      case 'emr':
        el.emrContentContainer.innerHTML = renderEmrOverviewTab(d);
        break;
      case 'vitals':
        el.emrContentContainer.innerHTML = renderEmrVitalsTab(d);
        break;
      case 'nursenote':
        el.emrContentContainer.innerHTML = renderEmrNurseNoteTab(d);
        break;
      case 'lab':
        el.emrContentContainer.innerHTML = renderEmrLabTab(d);
        break;
      case 'xray':
        el.emrContentContainer.innerHTML = renderEmrXrayTab(d);
        break;
      case 'procedure':
        el.emrContentContainer.innerHTML = renderEmrProcedureTab(d);
        break;
      case 'document':
        el.emrContentContainer.innerHTML = renderEmrDocumentTab(d);
        break;
      case 'discharge':
        el.emrContentContainer.innerHTML = renderEmrDischargeTab(d);
        break;
      case 'doctors':
        el.emrContentContainer.innerHTML = renderEmrDoctorsTab(d);
        break;
      case 'setor':
        el.emrContentContainer.innerHTML = renderEmrSetOrTab(d);
        break;
      default:
        el.emrContentContainer.innerHTML = renderEmrOverviewTab(d);
    }

    // Bind quick tab jump buttons inside overview
    el.emrContentContainer.querySelectorAll('[data-jump-emr-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-jump-emr-tab');
        if (targetTab) {
          state.activeEmrTab = targetTab;
          updateActiveEmrTabUi();
          renderActiveEmrTabContent();
          window.scrollTo({ top: el.emrMenuTabs.offsetTop - 70, behavior: 'smooth' });
        }
      });
    });
  }

  // 1. EMR Overview Tab
  function renderEmrOverviewTab(d) {
    const pt = d.patient || {};
    const los = calculateLosDays(pt.regdate);
    const bedMoves = d.bedMoves || [];
    const progressNotes = d.progressNotes || [];
    const chartDocs = d.chartDocs || [];
    const diags = d.diagnoses || [];

    const sexText = pt.sex === '1' || pt.sex === 'M' || pt.sex === 'ชาย'
      ? 'ชาย'
      : (pt.sex === '2' || pt.sex === 'F' || pt.sex === 'หญิง' ? 'หญิง' : (pt.sex || '-'));
    const bloodText = [pt.blood_group_name, pt.blood_rh_name].filter(Boolean).join(' ') || '-';

    return `
      <div class="emr-sections-stack">
        <!-- Quick Summary Metrics Grid -->
        <div class="emr-stat-cards-grid">
          <button type="button" class="emr-stat-card" data-jump-emr-tab="vitals">
            <span class="esc-label">Vital Sign</span>
            <strong class="esc-val">${groupVitalsBySlot(d.vitalsHistory || []).length} ครั้ง</strong>
            <span class="esc-sub">ดูตารางสัญญาณชีพ →</span>
          </button>
          <button type="button" class="emr-stat-card" data-jump-emr-tab="nursenote">
            <span class="esc-label">Nurse Note</span>
            <strong class="esc-val">${(d.nurseNotes || []).length} รายการ</strong>
            <span class="esc-sub">บันทึกทางการพยาบาล →</span>
          </button>
          <button type="button" class="emr-stat-card" data-jump-emr-tab="lab">
            <span class="esc-label">Lab</span>
            <strong class="esc-val">${(d.labOrders || []).length} รายการ</strong>
            <span class="esc-sub">รายการส่งตรวจ Lab →</span>
          </button>
          <button type="button" class="emr-stat-card" data-jump-emr-tab="xray">
            <span class="esc-label">X Ray</span>
            <strong class="esc-val">${(d.xrayOrders || []).length} รายการ</strong>
            <span class="esc-sub">รายการรังสีวิทยา →</span>
          </button>
        </div>

        <!-- Admission & Demographics Card -->
        <section class="emr-card card-surface">
          <h4 class="emr-card-title">ข้อมูลการรับไว้ในโรงพยาบาล (Admission &amp; Clinical Summary)</h4>
          <div class="emr-info-grid">
            <div class="emr-info-item">
              <span class="ei-label">ชื่อ-สกุลผู้ป่วย</span>
              <span class="ei-val">${escapeHtml(pt.fullname || '-')}</span>
            </div>
            <div class="emr-info-item">
              <span class="ei-label">HN / AN / VN</span>
              <span class="ei-val">HN ${escapeHtml(pt.hn || '-')} • AN ${escapeHtml(pt.an || '-')} ${pt.vn ? `(VN ${escapeHtml(pt.vn)})` : ''}</span>
            </div>
            <div class="emr-info-item">
              <span class="ei-label">วันเกิด / อายุ / เพศ</span>
              <span class="ei-val">${escapeHtml(formatThaiDate(pt.birthday))} (${escapeHtml(calculateAgeText(pt.birthday))}) • เพศ: ${escapeHtml(sexText)}</span>
            </div>
            <div class="emr-info-item">
              <span class="ei-label">หมู่เลือด / เบอร์โทรศัพท์</span>
              <span class="ei-val">หมู่เลือด: ${escapeHtml(bloodText)} • โทร: ${escapeHtml(pt.mobile_phone_number || '-')}</span>
            </div>
            <div class="emr-info-item">
              <span class="ei-label">วันที่ Admit / ระยะเวลานอน</span>
              <span class="ei-val">${escapeHtml(formatThaiDate(pt.regdate))} ${escapeHtml(formatTimeShort(pt.regtime))} ${los ? `(${los} วัน)` : ''}</span>
            </div>
            <div class="emr-info-item">
              <span class="ei-label">ประเภทการรับ / ความรุนแรง</span>
              <span class="ei-val">${escapeHtml(pt.admit_type_name || '-')} • ระดับ: ${escapeHtml(pt.severe_name || '-')}</span>
            </div>
            <div class="emr-info-item">
              <span class="ei-label">การวินิจฉัยแรกรับ (Pre-Diagnosis)</span>
              <span class="ei-val">${escapeHtml(pt.prediag || '-')}</span>
            </div>
            <div class="emr-info-item">
              <span class="ei-label">Provisional Dx / Admit For</span>
              <span class="ei-val">${escapeHtml([pt.provision_dx, pt.admit_for].filter(Boolean).join(' • ') || '-')}</span>
            </div>
            <div class="emr-info-item">
              <span class="ei-label">โรคประจำตัว (PMH)</span>
              <span class="ei-val">${escapeHtml(pt.pmh || '-')}</span>
            </div>
            <div class="emr-info-item">
              <span class="ei-label">แพทย์ผู้สั่งรับ Admit</span>
              <span class="ei-val">${escapeHtml(pt.admitting_doctor_name || pt.adm_doctor_name || '-')}${pt.admitting_doctor_license ? ` (${escapeHtml(pt.admitting_doctor_license)})` : ''}</span>
            </div>
          </div>
        </section>

        <!-- Progress Notes (SOAP) -->
        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">บันทึกความก้าวหน้าการรักษาของแพทย์ (Doctor Progress Notes)</h4>
            <span class="badge-pill badge-order-pt">${progressNotes.length} รายการ</span>
          </div>
          ${progressNotes.length > 0 ? `
            <div class="emr-list-stack">
              ${progressNotes.map(pn => `
                <div class="emr-item-card">
                  <div class="emr-item-header">
                    <div>
                      <strong>${escapeHtml(pn.title || 'Progress Note')}</strong>
                      <span class="emr-meta-pill">${escapeHtml(formatThaiDate(pn.order_date || pn.progress_date))} ${escapeHtml(formatTimeShort(pn.progress_time || pn.order_time))}</span>
                    </div>
                    <span class="emr-doc-tag">${escapeHtml(pn.doctor_name || '-')}</span>
                  </div>
                  <div class="soap-grid" style="margin-top: 8px;">
                    ${pn.s_note ? `<div class="soap-row"><span class="soap-badge">S</span><div class="soap-text">${escapeHtml(pn.s_note)}</div></div>` : ''}
                    ${pn.o_note ? `<div class="soap-row"><span class="soap-badge">O</span><div class="soap-text">${escapeHtml(pn.o_note)}</div></div>` : ''}
                    ${pn.a_note ? `<div class="soap-row"><span class="soap-badge">A</span><div class="soap-text">${escapeHtml(pn.a_note)}</div></div>` : ''}
                    ${pn.p_note ? `<div class="soap-row"><span class="soap-badge">P</span><div class="soap-text">${escapeHtml(pn.p_note)}</div></div>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `<div class="emr-empty-inline">ไม่มีบันทึก Progress Note</div>`}
        </section>

        <!-- Bed Moves History -->
        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">ประวัติการย้ายหอผู้ป่วย / เตียง (Bed Move History)</h4>
            <span class="badge-pill badge-muted">${bedMoves.length} รายการ</span>
          </div>
          ${bedMoves.length > 0 ? `
            <div class="emr-table-responsive">
              <table class="emr-table">
                <thead>
                  <tr>
                    <th>วันที่ - เวลา</th>
                    <th>ประเภท</th>
                    <th>หอผู้ป่วย</th>
                    <th>เตียง / ห้อง</th>
                  </tr>
                </thead>
                <tbody>
                  ${bedMoves.map((bm, idx) => `
                    <tr>
                      <td>${escapeHtml(formatThaiDate(bm.movedate))} ${escapeHtml(formatTimeShort(bm.movetime))} ${idx === 0 ? `<span class="badge-pill badge-active-pt">ปัจจุบัน</span>` : ''}</td>
                      <td>${escapeHtml(bm.move_type_name || '-')}</td>
                      <td><strong>${escapeHtml(bm.ward_name || '-')}</strong></td>
                      <td>เตียง ${escapeHtml(bm.bed_no || '-')} ${bm.room_name ? `(${escapeHtml(bm.room_name)})` : ''}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `<div class="emr-empty-inline">ไม่มีประวัติการย้ายเตียง</div>`}
        </section>
      </div>
    `;
  }

  // 2. Vital Sign Tab
  function renderEmrVitalsTab(d) {
    const slots = groupVitalsBySlot(d.vitalsHistory || []);
    const scorings = d.clinicalScorings || [];

    return `
      <div class="emr-sections-stack">
        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">ตารางบันทึกสัญญาณชีพย้อนหลัง (Vital Signs Flowsheet)</h4>
            <span class="badge-pill badge-order-pt">${slots.length} ช่วงเวลา</span>
          </div>
          ${slots.length > 0 ? `
            <div class="emr-table-responsive">
              <table class="emr-table vitals-flow-table">
                <thead>
                  <tr>
                    <th>วันที่ / เวลา</th>
                    <th>เวร</th>
                    <th>Temp (°C)</th>
                    <th>Pulse (/min)</th>
                    <th>RR (/min)</th>
                    <th>BP (mmHg)</th>
                    <th>SpO2 (%)</th>
                    <th>Pain</th>
                    <th>BW / Ht</th>
                    <th>Intake / Output</th>
                  </tr>
                </thead>
                <tbody>
                  ${slots.map(s => {
                    const it = s.items;
                    const bp = (it[4] || it[5]) ? `${it[4] || '-'}/${it[5] || '-'}` : '-';
                    const bwHt = (it[8] || it[9]) ? `${it[8] ? `${it[8]} kg` : '-'}${it[9] ? ` / ${it[9]} cm` : ''}` : '-';
                    const ioParts = [];
                    if (it[11]) ioParts.push(`Oral: ${it[11]}`);
                    if (it[12]) ioParts.push(`IV: ${it[12]}`);
                    if (it[14]) ioParts.push(`Urine: ${it[14]}`);
                    return `
                      <tr>
                        <td><strong>${escapeHtml(s.dateText)}</strong><br><span class="text-muted-sm">${escapeHtml(s.timeText)}</span></td>
                        <td>${escapeHtml(s.shiftName || '-')}</td>
                        <td><strong class="${Number(it[1]) >= 37.8 ? 'text-danger' : ''}">${escapeHtml(it[1] || '-')}</strong></td>
                        <td><strong>${escapeHtml(it[2] || '-')}</strong></td>
                        <td><strong>${escapeHtml(it[3] || '-')}</strong></td>
                        <td><strong>${escapeHtml(bp)}</strong></td>
                        <td><strong>${escapeHtml(it[7] ? `${it[7]}%` : '-')}</strong></td>
                        <td>${escapeHtml(it[6] ?? '-')}</td>
                        <td>${escapeHtml(bwHt)}</td>
                        <td>${escapeHtml(ioParts.join(', ') || '-')}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : `<div class="emr-empty-inline">ยังไม่มีประวัติการบันทึกสัญญาณชีพ</div>`}
        </section>

        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">ผลประเมินคะแนนทางคลินิก (MEWS / Clinical Scoring)</h4>
            <span class="badge-pill badge-muted">${scorings.length} รายการ</span>
          </div>
          ${scorings.length > 0 ? `
            <div class="emr-list-stack">
              ${scorings.map(sc => `
                <div class="emr-item-card">
                  <div class="emr-item-header">
                    <div>
                      <strong>${escapeHtml(sc.short_name || sc.scoring_name || 'Clinical Score')}</strong>
                      <span class="emr-meta-pill">คะแนน: <strong>${escapeHtml(sc.score ?? '-')}</strong> ${sc.result_name ? `(${escapeHtml(sc.result_name)})` : ''}</span>
                    </div>
                    <span class="text-muted-sm">${escapeHtml(formatThaiDate(sc.score_date || sc.nurse_shift_date))} ${escapeHtml(formatTimeShort(sc.score_time))} ${sc.nurse_shift_name ? `• เวร${escapeHtml(sc.nurse_shift_name)}` : ''}</span>
                  </div>
                  ${sc.note ? `<div class="oi-subtext">หมายเหตุ: ${escapeHtml(sc.note)}</div>` : ''}
                  ${sc.created_by_name ? `<div class="text-muted-sm" style="margin-top:4px;">ผู้บันทึก: ${escapeHtml(sc.created_by_name)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          ` : `<div class="emr-empty-inline">ยังไม่มีข้อมูลคะแนนประเมินทางคลินิก</div>`}
        </section>
      </div>
    `;
  }

  // 3. Nurse Note Tab
  function renderEmrNurseNoteTab(d) {
    const notes = d.nurseNotes || [];
    const summaries = d.nurseSummaries || [];

    return `
      <div class="emr-sections-stack">
        ${summaries.length > 0 ? `
          <section class="emr-card card-surface">
            <div class="emr-card-head">
              <h4 class="emr-card-title">บันทึกสรุปทางการพยาบาล / แรกรับ (Nurse Summaries)</h4>
              <span class="badge-pill badge-order-pt">${summaries.length} รายการ</span>
            </div>
            <div class="emr-list-stack">
              ${summaries.map(s => `
                <div class="emr-item-card">
                  <div class="emr-item-header">
                    <strong>วันที่ ${escapeHtml(formatThaiDate(s.note_at))}</strong>
                    <span class="emr-doc-tag">พว. ${escapeHtml(s.nurse_name || '-')}</span>
                  </div>
                  <div class="oi-subtext" style="margin-top:6px;">${escapeHtml(s.body || '-')}</div>
                </div>
              `).join('')}
            </div>
          </section>
        ` : ''}

        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">บันทึกทางการพยาบาล (Nursing Diagnosis, Intervention &amp; Evaluation)</h4>
            <span class="badge-pill badge-order-pt">${notes.length} รายการ</span>
          </div>
          ${notes.length > 0 ? `
            <div class="emr-list-stack">
              ${notes.map(nn => {
                const asses = Array.isArray(nn.assessments) ? nn.assessments.filter(a => a && (a.asses_name || a.asses_value)) : [];
                const inters = Array.isArray(nn.interventions) ? nn.interventions.filter(i => i && (i.inter_name || i.inter_value)) : [];
                const sdiags = Array.isArray(nn.sub_diags) ? nn.sub_diags.filter(s => s && s.sdiag_name) : [];

                return `
                  <article class="emr-item-card nurse-note-card">
                    <div class="emr-item-header">
                      <div>
                        <span class="badge-pill badge-order-pt">วันที่ ${escapeHtml(formatThaiDate(nn.diag_date))} ${escapeHtml(formatTimeShort(nn.diag_time))}</span>
                        ${nn.nurse_shift_name ? `<span class="badge-pill badge-muted">เวร${escapeHtml(nn.nurse_shift_name)}</span>` : ''}
                        ${nn.eva_status_name ? `<span class="badge-pill badge-active-pt">${escapeHtml(nn.eva_status_name)}</span>` : ''}
                      </div>
                      <span class="emr-doc-tag">${escapeHtml(nn.nurse_name || 'พยาบาล')}</span>
                    </div>

                    <h5 class="nn-diag-title">${escapeHtml(nn.diag_name || nn.note_type_desc || 'บันทึกทางการพยาบาล')}</h5>
                    ${nn.goal ? `<div class="nn-goal"><strong>เป้าหมาย:</strong> ${escapeHtml(nn.goal)}</div>` : ''}

                    ${sdiags.length > 0 ? `
                      <div class="nn-block">
                        <span class="nn-block-label">ปัญหา/สาเหตุร่วม:</span>
                        <div class="nn-tags-row">
                          ${sdiags.map(s => `<span class="vital-chip">${escapeHtml(s.sdiag_name)}</span>`).join('')}
                        </div>
                      </div>
                    ` : ''}

                    ${asses.length > 0 ? `
                      <div class="nn-block">
                        <span class="nn-block-label">ข้อมูลสนับสนุน / การประเมิน (Assessment):</span>
                        <ul class="nn-list">
                          ${asses.map(a => `<li>${escapeHtml(a.asses_name || '')} ${a.asses_value ? `: <strong>${escapeHtml(a.asses_value)}</strong>` : ''} ${escapeHtml(a.unit || '')}</li>`).join('')}
                        </ul>
                      </div>
                    ` : ''}

                    ${inters.length > 0 ? `
                      <div class="nn-block">
                        <span class="nn-block-label">กิจกรรมการพยาบาล (Intervention):</span>
                        <ul class="nn-list">
                          ${inters.map(i => `<li>${escapeHtml(i.inter_name || '')} ${i.inter_value ? `: <strong>${escapeHtml(i.inter_value)}</strong>` : ''} ${escapeHtml(i.unit || '')}</li>`).join('')}
                        </ul>
                      </div>
                    ` : ''}

                    ${nn.narrative_body ? `
                      <div class="nn-block">
                        <span class="nn-block-label">บันทึกบรรยาย (Narrative):</span>
                        <div class="oi-subtext">${escapeHtml(nn.narrative_body)}</div>
                      </div>
                    ` : ''}

                    ${nn.lab_text ? `
                      <div class="nn-block">
                        <span class="nn-block-label">ผล Lab ที่เกี่ยวข้อง:</span>
                        <div class="oi-subtext">${escapeHtml(nn.lab_text)}</div>
                      </div>
                    ` : ''}

                    ${nn.eva_result ? `
                      <div class="nn-block nn-eval-box">
                        <span class="nn-block-label">การประเมินผล (Evaluation):</span>
                        <div class="oi-subtext">${escapeHtml(nn.eva_result)}</div>
                      </div>
                    ` : ''}
                  </article>
                `;
              }).join('')}
            </div>
          ` : `<div class="emr-empty-inline">ยังไม่มีบันทึกทางการพยาบาล (Nurse Note)</div>`}
        </section>
      </div>
    `;
  }

  // 4. Lab Tab
  function renderEmrLabTab(d) {
    const orders = d.labOrders || [];
    const hisLabs = d.hisLabResults || [];
    const hisDates = d.hisLabDates || [];
    const pt = d.patient || {};
    const selectedDate = (hisLabs[0] && hisLabs[0].req_date) || (hisDates[0] && hisDates[0].req_date) || '';

    // Schedule dropdown change binding after render
    setTimeout(() => {
      const emrDateSelectEl = document.getElementById('emr-his-lab-date-select');
      if (emrDateSelectEl) {
        emrDateSelectEl.addEventListener('change', async (e) => {
          const chosenDate = e.target.value;
          try {
            emrDateSelectEl.disabled = true;
            const fresh = await apiFetch(`/api/patients/${encodeURIComponent(pt.hn)}/his-lab?date=${encodeURIComponent(chosenDate)}`);
            if (state.currentEmrData) {
              state.currentEmrData.hisLabResults = fresh.results || [];
              renderActiveEmrTabContent();
            }
          } catch (err) {
            alert('ไม่สามารถโหลดผลตรวจวันที่เลือกได้: ' + err.message);
          } finally {
            if (emrDateSelectEl) emrDateSelectEl.disabled = false;
          }
        });
      }
    }, 50);

    return `
      <div class="emr-sections-stack">
        <!-- Live HIS Lab Results Section -->
        <section class="emr-card card-surface">
          <div class="emr-card-head" style="flex-wrap:wrap; gap:10px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <h4 class="emr-card-title">ผลตรวจทางห้องปฏิบัติการ (HIS Live Lab Results)</h4>
                <span class="badge-pill badge-active-pt">HIS MHR สด</span>
              </div>
              <p style="font-size:0.82rem; color:var(--text-muted); margin-top:2px;">
                HN <strong>${escapeHtml(pt.hn || '-')}</strong> AN <strong>${escapeHtml(pt.an || '-')}</strong> • ดึงตรงจากฐานข้อมูล HIS Homc/MHR
              </p>
            </div>

            <!-- Date Selector Dropdown for HIS Dates -->
            ${hisDates.length > 0 ? `
              <div style="display:flex; align-items:center; gap:8px;">
                <label for="emr-his-lab-date-select" style="font-size:0.82rem; font-weight:600; color:var(--text-muted);">เลือกวันตรวจ:</label>
                <select id="emr-his-lab-date-select" class="form-select-sm" style="padding:6px 12px; border-radius:8px; border:1px solid var(--border); background:var(--surface); font-family:inherit; font-size:0.86rem; font-weight:600; color:var(--text);">
                  ${hisDates.map(dt => `
                    <option value="${escapeHtml(dt.req_date)}" ${dt.req_date === selectedDate ? 'selected' : ''}>
                      ${escapeHtml(dt.req_date_display)} (${escapeHtml(dt.req_date_iso)})
                    </option>
                  `).join('')}
                </select>
              </div>
            ` : ''}
          </div>

          ${hisLabs.length > 0 ? `
            <div class="emr-table-responsive">
              <table class="emr-table">
                <thead>
                  <tr>
                    <th>ลำดับ</th>
                    <th>ประเภท</th>
                    <th>รายการตรวจ (Lab Test)</th>
                    <th>รายการผล (Item)</th>
                    <th style="text-align:right;">ผลตรวจ (Result)</th>
                    <th>หน่วย</th>
                    <th>ค่าปกติ (Reference Range)</th>
                    <th>เวลาส่งตรวจ</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderHisLabTableRows(hisLabs)}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="emr-empty-inline">
              ${hisDates.length === 0 ? 'ไม่พบข้อมูลผลตรวจ Lab ในระบบ HIS สำหรับผู้ป่วยรายนี้' : 'ไม่มีรายการผลตรวจ Lab ในวันที่เลือก'}
            </div>
          `}
        </section>

        <!-- Doctor Order Labs Section -->
        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">รายการสั่งตรวจทางห้องปฏิบัติการในระบบ IPD (Lab Orders)</h4>
            <span class="badge-pill badge-order-pt">${orders.length} รายการ</span>
          </div>
          ${orders.length > 0 ? `
            <div class="emr-table-responsive">
              <table class="emr-table">
                <thead>
                  <tr>
                    <th>วันที่-เวลาสั่ง</th>
                    <th>รายการตรวจ Lab</th>
                    <th>ประเภท</th>
                    <th>แพทย์ผู้สั่ง</th>
                    <th>หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  ${orders.map(o => `
                    <tr>
                      <td><strong>${escapeHtml(formatThaiDate(o.order_date))}</strong> ${escapeHtml(formatTimeShort(o.order_time))}</td>
                      <td><strong>${escapeHtml(o.lab_name || '-')}</strong> ${o.is_tmr ? `<span class="badge-pill badge-order-pt">ส่งตรวจพรุ่งนี้</span>` : ''}</td>
                      <td>${o.order_type === 'D' ? 'One Day' : (o.order_type === 'C' ? 'Continue' : escapeHtml(o.order_type || '-'))}</td>
                      <td>${escapeHtml(o.doctor_name || '-')}</td>
                      <td>${escapeHtml(o.other || '-')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `<div class="emr-empty-inline">ไม่มีรายการสั่งตรวจทางห้องปฏิบัติการ (Lab) ในระบบ IPD</div>`}
        </section>
      </div>
    `;
  }

  // 5. X-Ray Tab
  function renderEmrXrayTab(d) {
    const orders = d.xrayOrders || [];
    const results = d.xrayResults || [];

    return `
      <div class="emr-sections-stack">
        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">รายการสั่งตรวจทางรังสีวิทยา (X-Ray / Imaging Orders)</h4>
            <span class="badge-pill badge-order-pt">${orders.length} รายการ</span>
          </div>
          ${orders.length > 0 ? `
            <div class="emr-list-stack">
              ${orders.map(x => `
                <div class="emr-item-card">
                  <div class="emr-item-header">
                    <div>
                      <strong>${escapeHtml(x.xray_name || 'X-Ray Order')}</strong>
                      ${x.priority_name ? `<span class="badge-pill badge-order-pt">${escapeHtml(x.priority_name)}</span>` : ''}
                      ${x.xn ? `<span class="badge-pill badge-muted">XN: ${escapeHtml(x.xn)}</span>` : ''}
                    </div>
                    <span class="text-muted-sm">${escapeHtml(formatThaiDate(x.order_date))} ${escapeHtml(formatTimeShort(x.order_time))}</span>
                  </div>
                  ${x.clinical_diag ? `<div class="oi-subtext"><strong>Clinical Dx:</strong> ${escapeHtml(x.clinical_diag)}</div>` : ''}
                  ${x.clinical_info || x.other ? `<div class="oi-subtext"><strong>รายละเอียด/อาการ:</strong> ${escapeHtml(x.clinical_info || x.other)}</div>` : ''}
                  <div class="text-muted-sm" style="margin-top:4px;">แพทย์ผู้สั่ง: ${escapeHtml(x.doctor_name || '-')}</div>
                </div>
              `).join('')}
            </div>
          ` : `<div class="emr-empty-inline">ไม่มีรายการสั่งตรวจ X-Ray</div>`}
        </section>

        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">ผลอ่านทางรังสีวิทยา (Radiology Reports)</h4>
            <span class="badge-pill badge-muted">${results.length} รายการ</span>
          </div>
          ${results.length > 0 ? `
            <div class="emr-list-stack">
              ${results.map(r => `
                <div class="emr-item-card">
                  <div class="emr-item-header">
                    <strong>XN: ${escapeHtml(r.xn || '-')}</strong>
                    <span class="text-muted-sm">วันที่อ่านผล: ${escapeHtml(formatThaiDate(r.report_date || r.request_date))} ${escapeHtml(formatTimeShort(r.report_time || r.request_time))}</span>
                  </div>
                  <div class="oi-subtext">${escapeHtml(r.report_text || r.clinical_information || '-')}</div>
                </div>
              `).join('')}
            </div>
          ` : `<div class="emr-empty-inline">ยังไม่มีผลอ่านทางรังสีวิทยาในระบบ</div>`}
        </section>
      </div>
    `;
  }

  // 6. Procedure Tab
  function renderEmrProcedureTab(d) {
    const procs = d.procedures || [];
    const ordProcs = d.orderProcedures || [];
    const records = d.records || [];

    return `
      <div class="emr-sections-stack">
        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">หัตถการผู้ป่วยใน (IPD Procedures / ICD-9-CM)</h4>
            <span class="badge-pill badge-order-pt">${procs.length} รายการ</span>
          </div>
          ${procs.length > 0 ? `
            <div class="emr-list-stack">
              ${procs.map(p => `
                <div class="emr-item-card">
                  <div class="emr-item-header">
                    <div>
                      ${p.icd9cm || p.icd9_code ? `<span class="hn-pill" style="margin-right:6px;">ICD9: ${escapeHtml(p.icd9cm || p.icd9_code)}</span>` : ''}
                      <strong>${escapeHtml(p.print_text || p.search_text || p.note || 'หัตถการ')}</strong>
                    </div>
                    <span class="text-muted-sm">${escapeHtml(formatThaiDate(p.pdate))} ${escapeHtml(formatTimeShort(p.ptime))}</span>
                  </div>
                  ${p.note ? `<div class="oi-subtext">หมายเหตุ: ${escapeHtml(p.note)}</div>` : ''}
                  <div class="text-muted-sm" style="margin-top:4px;">ผู้บันทึก: ${escapeHtml(p.created_by_name || '-')} ${p.spclty_name ? `• แผนก ${escapeHtml(p.spclty_name)}` : ''}</div>
                </div>
              `).join('')}
            </div>
          ` : `<div class="emr-empty-inline">ไม่มีรายการหัตถการ ICD-9-CM</div>`}
        </section>

        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">คำสั่งทำหัตถการจากแพทย์ (Doctor Order Procedures)</h4>
            <span class="badge-pill badge-muted">${ordProcs.length} รายการ</span>
          </div>
          ${ordProcs.length > 0 ? `
            <div class="emr-list-stack">
              ${ordProcs.map(op => `
                <div class="emr-item-card">
                  <div class="emr-item-header">
                    <strong>${escapeHtml(op.order_desc || op.note || 'คำสั่งหัตถการ')}</strong>
                    <span class="text-muted-sm">${escapeHtml(formatThaiDate(op.order_date))} ${escapeHtml(formatTimeShort(op.order_time))}</span>
                  </div>
                  ${op.other || op.note ? `<div class="oi-subtext">${escapeHtml([op.other, op.note].filter(Boolean).join(' • '))}</div>` : ''}
                  <div class="text-muted-sm" style="margin-top:4px;">ผู้บันทึก: ${escapeHtml(op.created_by_name || '-')}</div>
                </div>
              `).join('')}
            </div>
          ` : `<div class="emr-empty-inline">ไม่มีคำสั่งทำหัตถการเพิ่มเติม</div>`}
        </section>

        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">บันทึกการใช้อุปกรณ์ / สายสวน / หัตถการพยาบาล (Invasive Devices &amp; Records)</h4>
            <span class="badge-pill badge-muted">${records.length} รายการ</span>
          </div>
          ${records.length > 0 ? `
            <div class="emr-table-responsive">
              <table class="emr-table">
                <thead>
                  <tr>
                    <th>อุปกรณ์ / หัตถการ</th>
                    <th>วันเริ่ม (Start)</th>
                    <th>วันสิ้นสุด (End)</th>
                    <th>หมายเหตุ</th>
                    <th>ผู้บันทึก</th>
                  </tr>
                </thead>
                <tbody>
                  ${records.map(r => `
                    <tr>
                      <td><strong>${escapeHtml(r.record_name || '-')}</strong></td>
                      <td>${escapeHtml(formatThaiDate(r.started_at))}</td>
                      <td>${r.ended_at ? escapeHtml(formatThaiDate(r.ended_at)) : `<span class="badge-pill badge-active-pt">กำลังใช้งาน</span>`}</td>
                      <td>${escapeHtml(r.remark || '-')}</td>
                      <td>${escapeHtml(r.created_by_name || '-')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `<div class="emr-empty-inline">ไม่มีบันทึกอุปกรณ์หรือสายสวน</div>`}
        </section>
      </div>
    `;
  }

  // 7. Document Tab
  function renderEmrDocumentTab(d) {
    const chartDocs = d.chartDocs || [];
    const asms = d.assessments || [];
    const consults = d.consults || [];
    const scans = d.paperScans || [];

    return `
      <div class="emr-sections-stack">
        <!-- Chart Docs -->
        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">เอกสารซักประวัติและตรวจร่างกายแรกรับ (Medical Chart Documents)</h4>
            <span class="badge-pill badge-order-pt">${chartDocs.length} รายการ</span>
          </div>
          ${chartDocs.length > 0 ? `
            <div class="emr-list-stack">
              ${chartDocs.map(cd => {
                const payload = cd.data && typeof cd.data === 'object' ? cd.data : {};
                const entries = Object.entries(payload).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '');
                return `
                  <div class="emr-item-card">
                    <div class="emr-item-header">
                      <strong>เอกสาร: ${escapeHtml(String(cd.doc_key || 'Chart Document').toUpperCase())}</strong>
                      <span class="text-muted-sm">${escapeHtml(formatThaiDate(cd.doc_date))} ${escapeHtml(formatTimeShort(cd.doc_time))} • ${escapeHtml(cd.created_by_name || '-')}</span>
                    </div>
                    ${entries.length > 0 ? `
                      <div class="emr-info-grid" style="margin-top:8px;">
                        ${entries.map(([k, v]) => `
                          <div class="emr-info-item">
                            <span class="ei-label">${escapeHtml(k.toUpperCase())}</span>
                            <span class="ei-val">${escapeHtml(typeof v === 'object' ? JSON.stringify(v) : String(v))}</span>
                          </div>
                        `).join('')}
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          ` : `<div class="emr-empty-inline">ไม่มีเอกสาร Chart Document</div>`}
        </section>

        <!-- Assessments (ipd_asms) -->
        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">แบบประเมินผู้ป่วยใน (Admission &amp; Nursing Assessments)</h4>
            <span class="badge-pill badge-order-pt">${asms.length} ฉบับ</span>
          </div>
          ${asms.length > 0 ? `
            <div class="emr-list-stack">
              ${asms.map(a => {
                const details = Array.isArray(a.details) ? a.details.filter(x => x && (x.label || x.value)) : [];
                return `
                  <div class="emr-item-card">
                    <div class="emr-item-header">
                      <div>
                        <strong>${escapeHtml(a.asm_name || 'แบบประเมินผู้ป่วย')}</strong>
                        ${a.nurse_shift_name ? `<span class="badge-pill badge-muted">เวร${escapeHtml(a.nurse_shift_name)}</span>` : ''}
                      </div>
                      <span class="text-muted-sm">${escapeHtml(formatThaiDate(a.asm_date))} ${escapeHtml(formatTimeShort(a.asm_time))} • ${escapeHtml(a.created_by_name || '-')}</span>
                    </div>
                    ${a.note ? `<div class="oi-subtext">หมายเหตุ: ${escapeHtml(a.note)}</div>` : ''}
                    ${details.length > 0 ? `
                      <div class="asm-details-grid">
                        ${details.slice(0, 24).map(dt => `
                          <div class="asm-detail-chip">
                            <span class="adc-label">${escapeHtml(dt.label || '-')}:</span>
                            <strong class="adc-val">${escapeHtml(dt.value || '-')}</strong>
                            ${dt.other ? `<span>(${escapeHtml(dt.other)})</span>` : ''}
                          </div>
                        `).join('')}
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          ` : `<div class="emr-empty-inline">ไม่มีแบบประเมินผู้ป่วยใน</div>`}
        </section>

        <!-- Consults -->
        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">ใบปรึกษาต่างแผนก (Consultation Documents)</h4>
            <span class="badge-pill badge-muted">${consults.length} รายการ</span>
          </div>
          ${consults.length > 0 ? `
            <div class="emr-list-stack">
              ${consults.map(c => `
                <div class="emr-item-card">
                  <div class="emr-item-header">
                    <strong>ปรึกษาแผนก: ${escapeHtml(c.spclty_name || '-')}</strong>
                    <span class="text-muted-sm">${escapeHtml(formatThaiDate(c.created_at))}</span>
                  </div>
                  ${c.clinical_diag ? `<div class="oi-subtext"><strong>Dx:</strong> ${escapeHtml(c.clinical_diag)}</div>` : ''}
                  ${c.clinical_info ? `<div class="oi-subtext"><strong>ข้อมูลทางคลินิก:</strong> ${escapeHtml(c.clinical_info)}</div>` : ''}
                  ${c.reason_text || c.needed_text ? `<div class="oi-subtext"><strong>วัตถุประสงค์:</strong> ${escapeHtml([c.reason_text, c.needed_text].filter(Boolean).join(' • '))}</div>` : ''}
                  <div class="text-muted-sm" style="margin-top:4px;">แพทย์ผู้ส่งปรึกษา: ${escapeHtml(c.from_doctor_name || '-')}</div>
                </div>
              `).join('')}
            </div>
          ` : `<div class="emr-empty-inline">ไม่มีรายการใบปรึกษาต่างแผนก</div>`}
        </section>

        <!-- Paper Scans -->
        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">ไฟล์สแกนเอกสารเวชระเบียน (Scanned Documents)</h4>
            <span class="badge-pill badge-muted">${scans.length} ไฟล์</span>
          </div>
          ${scans.length > 0 ? `
            <div class="emr-list-stack">
              ${scans.map(ps => `
                <div class="emr-item-card">
                  <div class="emr-item-header">
                    <strong>${escapeHtml(ps.paper_type_name || ps.file_name || 'เอกสารสแกน')}</strong>
                    <span class="text-muted-sm">${escapeHtml(formatThaiDate(ps.created_at))}</span>
                  </div>
                  ${ps.note ? `<div class="oi-subtext">${escapeHtml(ps.note)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          ` : `<div class="emr-empty-inline">ไม่มีไฟล์สแกนเอกสารแนบ</div>`}
        </section>
      </div>
    `;
  }

  // 8. Discharge Summary Tab
  function renderEmrDischargeTab(d) {
    const pt = d.patient || {};
    const dches = d.discharges || [];
    const summaries = d.summaries || [];
    const diags = d.diagnoses || [];
    const diagTexts = d.diagTexts || [];
    const homeMeds = d.homeMeds || [];

    const latestDch = dches[0] || null;
    const latestSum = summaries[0] || null;

    return `
      <div class="emr-sections-stack">
        <!-- Discharge Status & Summary Box -->
        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">ข้อมูลการจำหน่ายผู้ป่วย (Discharge Summary Status)</h4>
            <span class="badge-pill ${pt.confirm_discharge ? 'badge-active-pt' : 'badge-muted'}">
              ${pt.confirm_discharge ? 'จำหน่ายแล้ว (Discharged)' : 'กำลังรักษาในโรงพยาบาล (Admitted)'}
            </span>
          </div>

          <div class="emr-info-grid">
            <div class="emr-info-item">
              <span class="ei-label">วันที่จำหน่าย (Discharge Date)</span>
              <span class="ei-val">${latestDch && latestDch.dchdate ? `${escapeHtml(formatThaiDate(latestDch.dchdate))} ${escapeHtml(formatTimeShort(latestDch.dchtime))}` : '-'}</span>
            </div>
            <div class="emr-info-item">
              <span class="ei-label">ประเภทการจำหน่าย (Discharge Type)</span>
              <span class="ei-val">${escapeHtml((latestDch && latestDch.dch_type_name) || (latestSum && latestSum.dch_type_name) || '-')}</span>
            </div>
            <div class="emr-info-item">
              <span class="ei-label">สถานภาพการจำหน่าย (Discharge Status)</span>
              <span class="ei-val">${escapeHtml((latestDch && latestDch.dch_status_name) || (latestSum && latestSum.dch_status_name) || '-')}</span>
            </div>
            <div class="emr-info-item">
              <span class="ei-label">จำนวนวันนอนรวม (LOS)</span>
              <span class="ei-val">${escapeHtml(String((latestDch && latestDch.los) || calculateLosDays(pt.regdate) || '-'))} วัน</span>
            </div>
            <div class="emr-info-item">
              <span class="ei-label">แพทย์ผู้จำหน่าย / สรุปชาร์ต</span>
              <span class="ei-val">${escapeHtml((latestDch && (latestDch.dch_doctor_name || latestDch.summary_doctor_name)) || (latestSum && latestSum.doctor_user_name) || pt.incharge_doctor_name || '-')}</span>
            </div>
            <div class="emr-info-item">
              <span class="ei-label">แผนการรักษาต่อ / Operation</span>
              <span class="ei-val">${escapeHtml([latestDch && latestDch.plan, latestDch && latestDch.operation].filter(Boolean).join(' • ') || '-')}</span>
            </div>
          </div>
        </section>

        <!-- ICD-10 / ICD-9 Diagnoses -->
        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">การวินิจฉัยโรคและหัตถการสรุปจำหน่าย (ICD-10 / ICD-9 Coding)</h4>
            <span class="badge-pill badge-order-pt">${diags.length} รายการ</span>
          </div>
          ${diags.length > 0 ? `
            <div class="emr-table-responsive">
              <table class="emr-table">
                <thead>
                  <tr>
                    <th>ประเภท</th>
                    <th>รหัส (Code)</th>
                    <th>ชื่อการวินิจฉัย / หัตถการ</th>
                    <th>แพทย์ผู้บันทึก</th>
                  </tr>
                </thead>
                <tbody>
                  ${diags.map(dg => `
                    <tr>
                      <td><span class="badge-pill badge-order-pt">${escapeHtml(dg.diag_type_name || (dg.tab === 1 ? 'ICD-10' : 'ICD-9'))}</span></td>
                      <td><strong>${escapeHtml(dg.code || '-')}</strong></td>
                      <td>${escapeHtml(dg.icd10_name || dg.icd9_name || '-')}</td>
                      <td>${escapeHtml(dg.doctor_name || '-')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `<div class="emr-empty-inline">ยังไม่มีการลงรหัสวินิจฉัยสรุปจำหน่าย (Pre-Dx: ${escapeHtml(pt.prediag || '-')})</div>`}

          ${diagTexts.length > 0 ? `
            <div class="emr-list-stack" style="margin-top:12px;">
              ${diagTexts.map(dt => `
                <div class="emr-item-card">
                  <strong>${escapeHtml(dt.diag_type_name || 'Clinical Summary Note')}:</strong>
                  <div class="oi-subtext">${escapeHtml(dt.diag_text || '-')}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </section>

        <!-- Home Medications -->
        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">ยากลับบ้าน (Home Medication)</h4>
            <span class="badge-pill badge-order-pt">${homeMeds.length} รายการ</span>
          </div>
          ${homeMeds.length > 0 ? `
            <div class="emr-list-stack">
              ${homeMeds.map(hm => `
                <div class="emr-item-card">
                  <div class="emr-item-header">
                    <strong>${escapeHtml(hm.med_name || '-')}</strong>
                    <span class="badge-pill badge-active-pt">จำนวน ${escapeHtml(hm.qty || '-')} ${escapeHtml(hm.unit_name || '')}</span>
                  </div>
                  <div class="oi-subtext">
                    ${escapeHtml([hm.usage_text, hm.dose ? `ครั้งละ ${Number(hm.dose)} ${hm.unit_name || ''}` : '', hm.freq_text, hm.note].filter(Boolean).join(' • ') || '-')}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `<div class="emr-empty-inline">ยังไม่มีรายการยากลับบ้าน (Home Med)</div>`}
        </section>
      </div>
    `;
  }

  // 9. Care Team Doctors Tab (ทีมแพทย์)
  function renderEmrDoctorsTab(d) {
    const pt = d.patient || {};
    const doctors = d.doctors || [];

    return `
      <div class="emr-sections-stack">
        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">ทีมแพทย์ผู้ดูแลรักษา (Care Team Doctors)</h4>
            <span class="badge-pill badge-order-pt">${doctors.length} ท่าน</span>
          </div>

          ${doctors.length > 0 ? `
            <div class="doctors-team-grid">
              ${doctors.map(doc => {
                const isOwner = Number(doc.ipd_doctor_type_id) === 1;
                return `
                  <div class="doctor-team-card ${isOwner && doc.active ? 'owner-active' : ''}">
                    <div class="dtc-top">
                      <span class="badge-pill ${isOwner ? 'badge-order-pt' : 'badge-muted'}">
                        ${escapeHtml(doc.doctor_type_name || (isOwner ? 'แพทย์เจ้าของคนไข้' : 'แพทย์ร่วมรักษา'))}
                      </span>
                      <span class="badge-pill ${doc.active ? 'badge-active-pt' : 'badge-muted'}">
                        ${doc.active ? 'กำลังดูแล (Active)' : 'สิ้นสุดแล้ว'}
                      </span>
                    </div>
                    <h5 class="dtc-name">${escapeHtml(doc.doctor_name || '-')}</h5>
                    <div class="dtc-meta">
                      <span>เลข ว. / รหัส: <strong>${escapeHtml(doc.licenseno || doc.doctor_code || '-')}</strong></span>
                      ${doc.spclty_name ? `<span>สาขา: <strong>${escapeHtml(doc.spclty_name)}</strong></span>` : ''}
                      ${doc.position_name ? `<span>ตำแหน่ง: ${escapeHtml(doc.position_name)}</span>` : ''}
                    </div>
                    <div class="dtc-dates">
                      <div>เริ่มดูแล: ${escapeHtml(formatThaiDate(doc.incharge_date))} ${escapeHtml(formatTimeShort(doc.incharge_time))}</div>
                      ${doc.finish_date ? `<div>สิ้นสุด: ${escapeHtml(formatThaiDate(doc.finish_date))} ${escapeHtml(formatTimeShort(doc.finish_time))}</div>` : ''}
                      ${doc.remark ? `<div>หมายเหตุ: ${escapeHtml(doc.remark)}</div>` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : `<div class="emr-empty-inline">ไม่พบรายการในตารางทีมแพทย์</div>`}
        </section>

        <section class="emr-card card-surface">
          <h4 class="emr-card-title">ข้อมูลแพทย์แรกรับ (Admitting Doctor)</h4>
          <div class="emr-info-grid">
            <div class="emr-info-item">
              <span class="ei-label">แพทย์เจ้าของคนไข้ปัจจุบัน</span>
              <span class="ei-val">${escapeHtml(pt.incharge_doctor_name || '-')} ${pt.incharge_doctor_license ? `(${escapeHtml(pt.incharge_doctor_license)})` : ''}</span>
            </div>
            <div class="emr-info-item">
              <span class="ei-label">แพทย์ผู้สั่งรับผู้ป่วยใน (Admitting Doctor)</span>
              <span class="ei-val">${escapeHtml(pt.admitting_doctor_name || pt.adm_doctor_name || '-')} ${pt.admitting_doctor_license ? `(${escapeHtml(pt.admitting_doctor_license)})` : ''}</span>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  // 10. Set OR Tab
  function renderEmrSetOrTab(d) {
    const orCases = d.orCases || [];
    const orOrders = d.orOrders || [];
    const orReturns = d.orReturns || [];
    const procs = d.procedures || [];

    return `
      <div class="emr-sections-stack">
        <!-- Set OR Cases -->
        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">รายการนัดผ่าตัด / Set OR (OR Schedule &amp; Cases)</h4>
            <span class="badge-pill badge-order-pt">${orCases.length} รายการ</span>
          </div>
          ${orCases.length > 0 ? `
            <div class="emr-list-stack">
              ${orCases.map(oc => `
                <div class="emr-item-card">
                  <div class="emr-item-header">
                    <div>
                      <strong>วันที่ผ่าตัด: ${escapeHtml(formatThaiDate(oc.op_date))} ${escapeHtml(formatTimeShort(oc.op_time))}</strong>
                      ${oc.or_unit_name ? `<span class="badge-pill badge-order-pt">${escapeHtml(oc.or_unit_name)}</span>` : ''}
                      ${oc.stage ? `<span class="badge-pill badge-active-pt">${escapeHtml(oc.stage)}</span>` : ''}
                    </div>
                    <span class="emr-doc-tag">ศัลยแพทย์: ${escapeHtml(oc.surgeon_name || '-')}</span>
                  </div>
                  <div class="emr-info-grid" style="margin-top:8px;">
                    <div class="emr-info-item">
                      <span class="ei-label">ประเภทเคส / Anesthesia</span>
                      <span class="ei-val">${escapeHtml(oc.case_type || '-')} • Anes: ${escapeHtml(oc.anes_type || '-')}</span>
                    </div>
                    <div class="emr-info-item">
                      <span class="ei-label">ตำแหน่ง (Site / Side)</span>
                      <span class="ei-val">${escapeHtml([oc.site_other, oc.side].filter(Boolean).join(' • ') || '-')}</span>
                    </div>
                  </div>
                  ${oc.note ? `<div class="oi-subtext" style="margin-top:6px;">หมายเหตุ: ${escapeHtml(oc.note)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          ` : `<div class="emr-empty-inline">ไม่มีรายการนัดผ่าตัดในตาราง OR Cases</div>`}
        </section>

        <!-- Pre-Op / Operation Orders from Doctor Orders -->
        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">คำสั่งแพทย์เตรียมผ่าตัด / หัตถการ (Pre-Operative &amp; Operation Orders)</h4>
            <span class="badge-pill badge-order-pt">${orOrders.length} รายการ</span>
          </div>
          ${orOrders.length > 0 ? `
            <div class="emr-list-stack">
              ${orOrders.map(o => `
                <div class="emr-item-card">
                  <div class="emr-item-header">
                    <strong>${escapeHtml(o.order_desc || 'Operation Order')}</strong>
                    <span class="text-muted-sm">${escapeHtml(formatThaiDate(o.order_date))} ${escapeHtml(formatTimeShort(o.order_time))}</span>
                  </div>
                  ${o.other ? `<div class="oi-subtext">${escapeHtml(o.other)}</div>` : ''}
                  <div class="text-muted-sm" style="margin-top:4px;">แพทย์ผู้สั่ง: ${escapeHtml(o.doctor_name || '-')}</div>
                </div>
              `).join('')}
            </div>
          ` : `<div class="emr-empty-inline">ไม่มีคำสั่งแพทย์หมวด Operation</div>`}
        </section>

        <!-- OR Returns / Post-Op -->
        <section class="emr-card card-surface">
          <div class="emr-card-head">
            <h4 class="emr-card-title">บันทึกรับกลับจากห้องผ่าตัด (OR Return &amp; Post-Op Records)</h4>
            <span class="badge-pill badge-muted">${orReturns.length + procs.length} รายการ</span>
          </div>
          ${(orReturns.length > 0 || procs.length > 0) ? `
            <div class="emr-list-stack">
              ${orReturns.map(r => `
                <div class="emr-item-card">
                  <div class="emr-item-header">
                    <strong>รับกลับจาก OR เมื่อ: ${escapeHtml(formatThaiDate(r.return_at))}</strong>
                    <span class="emr-doc-tag">${escapeHtml(r.created_by_name || '-')}</span>
                  </div>
                  ${r.note ? `<div class="oi-subtext">${escapeHtml(r.note)}</div>` : ''}
                </div>
              `).join('')}
              ${procs.map(p => `
                <div class="emr-item-card">
                  <div class="emr-item-header">
                    <strong>${escapeHtml(p.print_text || p.search_text || 'หัตถการ/ผ่าตัด')} ${p.icd9cm ? `(ICD9: ${escapeHtml(p.icd9cm)})` : ''}</strong>
                    <span class="text-muted-sm">${escapeHtml(formatThaiDate(p.pdate))} ${escapeHtml(formatTimeShort(p.ptime))}</span>
                  </div>
                  ${p.note ? `<div class="oi-subtext">${escapeHtml(p.note)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          ` : `<div class="emr-empty-inline">ไม่มีบันทึกรับกลับจากห้องผ่าตัด</div>`}
        </section>
      </div>
    `;
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

    if (el.ordersGotoEmrBtn) {
      el.ordersGotoEmrBtn.addEventListener('click', () => {
        if (state.currentPatientData && state.currentPatientData.patient) {
          openPatientEmr(state.currentPatientData.patient.ipd_id, 'emr');
        }
      });
    }

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

    // EMR view navigation & 10 menu tabs
    if (el.backFromEmrBtn) {
      el.backFromEmrBtn.addEventListener('click', showLandingView);
    }

    if (el.emrGotoOrdersBtn) {
      el.emrGotoOrdersBtn.addEventListener('click', () => {
        if (state.currentEmrData && state.currentEmrData.patient) {
          openPatientDetail(state.currentEmrData.patient.ipd_id);
        }
      });
    }

    if (el.refreshEmrBtn) {
      el.refreshEmrBtn.addEventListener('click', () => {
        if (state.currentEmrData && state.currentEmrData.patient) {
          fetchAndRenderPatientEmr(state.currentEmrData.patient.ipd_id);
        }
      });
    }

    // OPD EMR Navigation buttons
    if (el.ordersGotoOpdBtn) {
      el.ordersGotoOpdBtn.addEventListener('click', () => openOpdEmrView('orders'));
    }
    if (el.emrGotoOpdBtn) {
      el.emrGotoOpdBtn.addEventListener('click', () => openOpdEmrView('emr'));
    }
    if (el.backToIpdFromOpdBtn) {
      el.backToIpdFromOpdBtn.addEventListener('click', returnToIpdFromOpd);
    }
    if (el.refreshOpdBtn) {
      el.refreshOpdBtn.addEventListener('click', () => {
        if (state.currentPatientData && state.currentPatientData.patient) {
          loadPatientVisits(state.currentPatientData.patient.hn);
        }
      });
    }

    // OPD Right Tab Navigation (LAB, XRAY, MEDICINE)
    document.querySelectorAll('.opd-right-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const rtab = tab.getAttribute('data-rtab') || 'LAB';
        state.opdEmr.activeRightTab = rtab;
        document.querySelectorAll('.opd-right-tab').forEach(t => t.classList.toggle('active', t === tab));
        renderOpdRightTabContent();
      });
    });

    // OPD Mobile Switcher Tabs
    document.querySelectorAll('.opd-mob-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const mob = tab.getAttribute('data-opd-mob');
        switchOpdMobileTab(mob);
      });
    });

    if (el.emrMenuTabs) {
      el.emrMenuTabs.querySelectorAll('.emr-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const tabKey = btn.getAttribute('data-emr-tab') || 'emr';
          state.activeEmrTab = tabKey;
          updateActiveEmrTabUi();
          renderActiveEmrTabContent();
        });
      });
    }

    // +Order popup modal bindings
    if (el.openCreateOrderBtn) {
      el.openCreateOrderBtn.addEventListener('click', () => {
        openOrderWriterModal();
      });
    }

    if (el.closeOrderModalBtn) {
      el.closeOrderModalBtn.addEventListener('click', closeOrderWriterModal);
    }
    if (el.owCancelBtn) {
      el.owCancelBtn.addEventListener('click', closeOrderWriterModal);
    }

    // Column switch tabs (Progress Note, One Day, Continue)
    document.querySelectorAll('.ow-col-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        const targetCol = tabBtn.getAttribute('data-col');
        switchOrderWriterCol(targetCol);
      });
    });

    // Insert Latest V/S into SOAP O
    if (el.soapInsertVsBtn) {
      el.soapInsertVsBtn.addEventListener('click', () => {
        insertLatestVsIntoSoap();
      });
    }

    // Fast search inputs for D and C
    setupOwSearchInput('D', el.owSearchD, el.owFoundD);
    setupOwSearchInput('C', el.owSearchC, el.owFoundC);

    // Quick category buttons (+ยา, +Lab, etc.)
    document.querySelectorAll('.btn-ow-kind').forEach(btn => {
      btn.addEventListener('click', () => {
        const col = btn.getAttribute('data-col') || 'D';
        const kind = btn.getAttribute('data-kind') || 'text';
        openDrawerForNewKind(col, kind);
      });
    });

    // Drawer cancel and close
    if (el.owDrawerCloseBtn) el.owDrawerCloseBtn.addEventListener('click', closeDrawer);
    if (el.owDrawerCancelBtn) el.owDrawerCancelBtn.addEventListener('click', closeDrawer);
    if (el.owDrawerConfirmBtn) el.owDrawerConfirmBtn.addEventListener('click', confirmDrawerItem);

    // Submit order button
    if (el.owSubmitBtn) {
      el.owSubmitBtn.addEventListener('click', submitDoctorOrder);
    }
  }

  // ==================== ORDER WRITER (+ORDER) FUNCTIONS ====================
  async function loadOrderMetaIfNeeded() {
    if (!state.orderWriter.meta) {
      try {
        const data = await apiFetch('/api/order-meta?kind=meta');
        state.orderWriter.meta = data;
      } catch (err) {
        console.warn('Failed to load order meta:', err.message);
      }
    }
  }

  function openOrderWriterModal() {
    if (!state.currentPatientData || !state.currentPatientData.patient) {
      alert('กรุณาเลือกผู้ป่วยก่อนเปิดเขียนคำสั่งการรักษา');
      return;
    }

    const pt = state.currentPatientData.patient;
    const allergies = state.currentPatientData.allergies || [];
    const vitals = state.currentPatientData.vitals || [];

    // Reset order writer state
    state.orderWriter.activeCol = 'progress';
    state.orderWriter.soap = { title: '', s: '', o: '', a: '', p: '' };
    state.orderWriter.items = [];
    state.orderWriter.note = '';
    state.orderWriter.editingIndex = null;
    state.orderWriter.currentDrawerDraft = null;

    if (el.soapTitle) el.soapTitle.value = '';
    if (el.soapS) el.soapS.value = '';
    if (el.soapO) el.soapO.value = '';
    if (el.soapA) el.soapA.value = '';
    if (el.soapP) el.soapP.value = '';
    if (el.owMasterNote) el.owMasterNote.value = '';
    if (el.owSearchD) el.owSearchD.value = '';
    if (el.owSearchC) el.owSearchC.value = '';
    if (el.owErrorBanner) el.owErrorBanner.classList.add('hidden');

    // Header info (only HN and AN, patient name and bed are shown below in the strip)
    if (el.orderModalPatientInfo) {
      el.orderModalPatientInfo.textContent = `HN: ${pt.hn || '-'} • AN: ${pt.an || '-'}`;
    }

    // Quick strip
    const allergyList = [];
    if (pt.drugallergy) allergyList.push(pt.drugallergy);
    allergies.forEach(a => {
      const s = `${a.agent || ''}${a.symptom ? ` (${a.symptom})` : ''}`.trim();
      if (s && !allergyList.includes(s)) allergyList.push(s);
    });

    if (el.owPatientStrip) {
      el.owPatientStrip.innerHTML = `
        <span class="ow-strip-chip">
          <strong>ผู้ป่วย:</strong> ${escapeHtml(pt.fullname || '-')} (${calculateAgeText(pt.birthday)})
        </span>
        <span class="ow-strip-chip">
          <strong>เตียง:</strong> ${escapeHtml(pt.bed_no || '-')}
        </span>
        <span class="ow-strip-chip">
          <strong>Dx:</strong> ${escapeHtml(pt.prediag || pt.provision_dx || pt.admit_for || '-')}
        </span>
        <span class="ow-strip-chip ${allergyList.length > 0 ? 'allergy' : ''}">
          <strong>แพ้ยา:</strong> ${allergyList.length > 0 ? escapeHtml(allergyList.join(', ')) : 'ไม่มีประวัติ'}
        </span>
      `;
    }

    switchOrderWriterCol('progress');
    renderOrderWriterItemsList();
    updateOrderWriterSummary();

    if (el.createOrderModal) {
      el.createOrderModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    loadOrderMetaIfNeeded();
  }

  function closeOrderWriterModal() {
    if (el.createOrderModal) {
      el.createOrderModal.classList.add('hidden');
      document.body.style.overflow = '';
    }
    closeDrawer();
  }

  function switchOrderWriterCol(colKey) {
    state.orderWriter.activeCol = colKey;

    document.querySelectorAll('.ow-col-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-col') === colKey);
    });

    document.querySelectorAll('.ow-pane').forEach(pane => {
      pane.classList.remove('active');
    });

    const targetPane = document.getElementById(`ow-section-${colKey}`);
    if (targetPane) targetPane.classList.add('active');
  }

  function insertLatestVsIntoSoap() {
    if (!state.currentPatientData) return;
    const vitals = state.currentPatientData.vitals || [];
    if (!vitals.length) {
      alert('ยังไม่มีข้อมูลสัญญาณชีพของผู้ป่วยรายนี้');
      return;
    }

    const latest = {};
    vitals.forEach(v => {
      const id = Number(v.vitalsign_item_id);
      if (!latest[id] && v.value) latest[id] = v;
    });

    const parts = [];
    if (latest[1]) parts.push(`BT ${latest[1].value} °C`);
    if (latest[2]) parts.push(`PR ${latest[2].value} /min`);
    if (latest[3]) parts.push(`RR ${latest[3].value} /min`);
    if (latest[4] || latest[5]) {
      const s = latest[4] ? latest[4].value : '-';
      const d = latest[5] ? latest[5].value : '-';
      parts.push(`BP ${s}/${d} mmHg`);
    }
    if (latest[7]) parts.push(`SpO2 ${latest[7].value}%`);

    if (parts.length > 0) {
      const vsLine = `V/S: ${parts.join(', ')}`;
      const currentO = (el.soapO ? el.soapO.value : '').trim();
      if (el.soapO) {
        el.soapO.value = currentO ? `${currentO}\n${vsLine}` : vsLine;
      }
    }
  }

  function setupOwSearchInput(col, inputEl, dropdownEl) {
    if (!inputEl || !dropdownEl) return;
    let debounceTimer = null;

    inputEl.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const q = inputEl.value.trim();
      if (q.length < 2) {
        dropdownEl.classList.add('hidden');
        dropdownEl.innerHTML = '';
        return;
      }

      debounceTimer = setTimeout(async () => {
        try {
          const res = await apiFetch(`/api/order-meta?q=${encodeURIComponent(q)}&kind=all`);
          const items = res.items || [];
          if (!items.length) {
            dropdownEl.innerHTML = `
              <div class="ow-search-item" data-action="custom-text">
                <div class="item-main">
                  <span class="item-kind-badge" style="background:#e2e8f0; color:#334155;">คำสั่งอื่น</span>
                  <span>กด Enter เพื่อเพิ่ม <strong>"${escapeHtml(q)}"</strong></span>
                </div>
              </div>
            `;
          } else {
            dropdownEl.innerHTML = items.map(it => `
              <div class="ow-search-item" data-kind="${it.kind}" data-id="${it.id}" data-label="${escapeHtml(it.label)}" data-unit="${escapeHtml(it.unit || '')}">
                <div class="item-main">
                  <span class="item-kind-badge ${getKindBadgeClass(it.kind)}">${getKindTitle(it.kind)}</span>
                  <span>${escapeHtml(it.label)}</span>
                </div>
                ${it.sub ? `<span class="item-sub">${escapeHtml(it.sub)}</span>` : ''}
              </div>
            `).join('');
          }
          dropdownEl.classList.remove('hidden');

          dropdownEl.querySelectorAll('.ow-search-item').forEach(row => {
            row.addEventListener('click', () => {
              const action = row.getAttribute('data-action');
              if (action === 'custom-text') {
                addQuickTextOrder(col, q);
              } else {
                const kind = row.getAttribute('data-kind');
                const id = row.getAttribute('data-id');
                const label = row.getAttribute('data-label');
                const unit = row.getAttribute('data-unit');
                chooseSearchResult(col, kind, id, label, unit);
              }
              dropdownEl.classList.add('hidden');
              inputEl.value = '';
            });
          });
        } catch (err) {
          console.warn('Search meta error:', err);
        }
      }, 250);
    });

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = inputEl.value.trim();
        if (q) {
          addQuickTextOrder(col, q);
          dropdownEl.classList.add('hidden');
          inputEl.value = '';
        }
      } else if (e.key === 'Escape') {
        dropdownEl.classList.add('hidden');
      }
    });

    document.addEventListener('click', (e) => {
      if (!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
        dropdownEl.classList.add('hidden');
      }
    });
  }

  function getKindBadgeClass(kind) {
    switch (kind) {
      case 'med': return 'badge-order-pt';
      case 'lab': return 'badge-muted';
      case 'xray': return 'badge-active-pt';
      case 'diet': return 'badge-muted';
      case 'consult': return 'badge-order-pt';
      default: return 'badge-muted';
    }
  }

  function getKindTitle(kind) {
    switch (kind) {
      case 'med': return '💊 ยา';
      case 'lab': return '🧪 Lab';
      case 'xray': return '🩻 X-Ray';
      case 'diet': return '🥣 อาหาร';
      case 'consult': return '🩺 Consult';
      default: return '📝 คำสั่ง';
    }
  }

  function addQuickTextOrder(col, text) {
    state.orderWriter.items.push({
      kind: 'text',
      type: col,
      type_id: 8,
      text: text,
      label: text
    });
    renderOrderWriterItemsList();
    updateOrderWriterSummary();
  }

  async function chooseSearchResult(col, kind, id, label, unit) {
    await loadOrderMetaIfNeeded();
    if (kind === 'med') {
      await openDrawerForMed(col, { drug_item_id: id, label, unit, dose: '', drug_usage_code_id: '', frequency_code_id: '', qty: '', note: '' });
    } else if (kind === 'consult') {
      openDrawerForConsult(col, { spclty_id: id, label });
    } else if (kind === 'lab') {
      state.orderWriter.items.push({ kind: 'lab', type: col, lab_set_id: id, label: `Lab: ${label}`, priority: 1 });
      renderOrderWriterItemsList();
      updateOrderWriterSummary();
    } else if (kind === 'xray') {
      state.orderWriter.items.push({ kind: 'xray', type: col, xray_set_id: id, label: `X-ray: ${label}`, priority: 1 });
      renderOrderWriterItemsList();
      updateOrderWriterSummary();
    } else if (kind === 'diet') {
      state.orderWriter.items.push({ kind: 'diet', type: col, diet_id: id, label: `Diet: ${label}` });
      renderOrderWriterItemsList();
      updateOrderWriterSummary();
    }
  }

  function openDrawerForNewKind(col, kind) {
    if (kind === 'text') {
      openDrawerForText(col, { text: '', type_id: 8 });
    } else if (kind === 'consult') {
      openDrawerForConsult(col, {});
    } else {
      // Prompt search or custom item
      openDrawerWithSearch(col, kind);
    }
  }

  function openDrawerWithSearch(col, kind) {
    const metaTitle = getKindTitle(kind);
    el.owDrawerTitle.textContent = `เลือกรายการ ${metaTitle} (${col === 'C' ? 'Continuous' : 'One Day'})`;

    el.owDrawerBody.innerHTML = `
      <div class="form-group">
        <label>พิมพ์ค้นหาชื่อ ${metaTitle}</label>
        <input type="text" id="drawer-search-q" class="form-control" placeholder="พิมพ์ชื่ออย่างน้อย 2 ตัวอักษร..." autofocus />
      </div>
      <div id="drawer-search-results" class="ow-items-list" style="max-height:220px; overflow-y:auto;"></div>
    `;

    el.owItemFormDrawer.classList.remove('hidden');

    const searchInput = document.getElementById('drawer-search-q');
    const resultsBox = document.getElementById('drawer-search-results');
    let timer = null;

    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      const q = searchInput.value.trim();
      if (q.length < 2) {
        resultsBox.innerHTML = '';
        return;
      }
      timer = setTimeout(async () => {
        try {
          const res = await apiFetch(`/api/order-meta?q=${encodeURIComponent(q)}&kind=${kind}`);
          const items = res.items || [];
          if (!items.length) {
            resultsBox.innerHTML = `<div class="ow-empty-notice">ไม่พบรายการ "${escapeHtml(q)}"</div>`;
          } else {
            resultsBox.innerHTML = items.map(it => `
              <button type="button" class="btn btn-outline" style="text-align:left; justify-content:space-between; padding:8px 12px; margin-bottom:4px;" data-id="${it.id}" data-label="${escapeHtml(it.label)}" data-unit="${escapeHtml(it.unit || '')}">
                <strong>${escapeHtml(it.label)}</strong>
                ${it.sub ? `<small style="color:var(--text-muted);">${escapeHtml(it.sub)}</small>` : ''}
              </button>
            `).join('');

            resultsBox.querySelectorAll('button').forEach(btn => {
              btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const label = btn.getAttribute('data-label');
                const unit = btn.getAttribute('data-unit');
                chooseSearchResult(col, kind, id, label, unit);
                closeDrawer();
              });
            });
          }
        } catch (err) {
          console.warn(err);
        }
      }, 250);
    });
  }

  async function openDrawerForMed(col, medItem, editIndex = null) {
    await loadOrderMetaIfNeeded();

    state.orderWriter.currentDrawerDraft = { kind: 'med', type: col, ...medItem };
    state.orderWriter.editingIndex = editIndex;

    const meta = state.orderWriter.meta || {};
    const usages = meta.usages || [];
    const freqs = meta.freqs || [];

    el.owDrawerTitle.textContent = `${editIndex !== null ? 'แก้ไข' : 'ระบุขนาดและวิธีใช้'} ยา: ${medItem.label || ''}`;

    let selectedUsageId = String(medItem.drug_usage_code_id || '');
    let selectedFreqId = String(medItem.frequency_code_id || '');

    el.owDrawerBody.innerHTML = `
      <div class="form-group">
        <label><strong>ชื่อยา:</strong></label>
        <div style="font-weight:700; color:var(--primary); font-size:1rem;">${escapeHtml(medItem.label || '-')}</div>
      </div>
      <div class="form-group">
        <label for="drawer-med-dose">Dose ${medItem.unit ? `(${escapeHtml(medItem.unit)})` : ''} <span class="text-danger">*</span></label>
        <input type="text" id="drawer-med-dose" class="form-control" value="${escapeHtml(medItem.dose || '')}" placeholder="เช่น 1, 500, 0.5" />
      </div>

      <!-- Searchable Route (วิธีใช้) -->
      <div class="form-group">
        <label for="drawer-med-usage">วิธีใช้ (Route) <span class="text-danger">*</span></label>
        <div class="ow-select-search-wrap">
          <input type="text" id="drawer-usage-filter" class="form-control form-control-sm ow-filter-input" placeholder="🔍 ค้นหาวิธีใช้ เช่น po, iv, oral, ทา..." autocomplete="off" />
          <select id="drawer-med-usage" class="form-control" size="4" style="height:115px; margin-top:4px;">
          </select>
        </div>
      </div>

      <!-- Searchable Frequency (ความถี่) -->
      <div class="form-group">
        <label for="drawer-med-freq">ความถี่ (Frequency) <span class="text-danger">*</span></label>
        <div class="ow-select-search-wrap">
          <input type="text" id="drawer-freq-filter" class="form-control form-control-sm ow-filter-input" placeholder="🔍 ค้นหาความถี่ เช่น tid, bid, od, q 8 hr..." autocomplete="off" />
          <select id="drawer-med-freq" class="form-control" size="4" style="height:115px; margin-top:4px;">
          </select>
        </div>
      </div>

      <div class="form-group">
        <label for="drawer-med-qty">จำนวน (Qty)</label>
        <input type="number" id="drawer-med-qty" class="form-control" value="${escapeHtml(medItem.qty || '')}" placeholder="ไม่บังคับ" />
      </div>
      <div class="form-group">
        <label for="drawer-med-note">หมายเหตุ / คำแนะนำเพิ่มเติม</label>
        <input type="text" id="drawer-med-note" class="form-control" value="${escapeHtml(medItem.note || '')}" placeholder="เช่น prn for pain q 4-6 hr" />
      </div>
    `;

    const usageSelect = document.getElementById('drawer-med-usage');
    const usageFilterInput = document.getElementById('drawer-usage-filter');
    const freqSelect = document.getElementById('drawer-med-freq');
    const freqFilterInput = document.getElementById('drawer-freq-filter');

    // Dynamic renderer for Route (วิธีใช้)
    function renderUsageOptions(query = '') {
      if (!usageSelect) return;
      const q = query.trim().toLowerCase();
      let filtered = usages;
      if (q) {
        filtered = usages.filter(u => {
          const haystack = [
            u.route_code,
            u.usage_code,
            u.raw_code,
            u.doctor_text,
            u.human_text,
            u.usage_label
          ].filter(Boolean).join(' ').toLowerCase();
          return haystack.includes(q);
        });
      }

      let list = filtered.slice();
      if (selectedUsageId && !list.some(u => String(u.id) === selectedUsageId)) {
        const found = usages.find(u => String(u.id) === selectedUsageId);
        if (found) list.unshift(found);
      }

      usageSelect.innerHTML = `
        <option value="">- เลือกวิธีใช้ (${filtered.length} รายการ) -</option>
        ${list.map(u => {
          const isSel = String(u.id) === selectedUsageId;
          const label = u.usage_label || `${u.usage_code || ''} ${u.doctor_text ? `• ${u.doctor_text}` : ''}`;
          return `<option value="${u.id}" ${isSel ? 'selected' : ''}>${escapeHtml(label)}</option>`;
        }).join('')}
      `;
    }

    // Dynamic renderer for Frequency (ความถี่)
    function renderFreqOptions(query = '') {
      if (!freqSelect) return;
      const q = query.trim().toLowerCase();
      let filtered = freqs;
      if (q) {
        filtered = freqs.filter(f => {
          const haystack = [
            f.freq_code,
            f.raw_code,
            f.freq_for_doctors,
            f.freq_name
          ].filter(Boolean).join(' ').toLowerCase();
          return haystack.includes(q);
        });
      }

      let list = filtered.slice();
      if (selectedFreqId && !list.some(f => String(f.id) === selectedFreqId)) {
        const found = freqs.find(f => String(f.id) === selectedFreqId);
        if (found) list.unshift(found);
      }

      freqSelect.innerHTML = `
        <option value="">- เลือกความถี่ (${filtered.length} รายการ) -</option>
        ${list.map(f => {
          const isSel = String(f.id) === selectedFreqId;
          const mainTitle = f.freq_code || f.raw_code || '';
          const subTitle = f.freq_name || f.freq_for_doctors || '';
          const codeTag = f.raw_code && f.raw_code !== f.freq_code ? ` [${f.raw_code}]` : '';
          return `<option value="${f.id}" ${isSel ? 'selected' : ''}>${escapeHtml(mainTitle)}${subTitle ? ` • ${escapeHtml(subTitle)}` : ''}${codeTag}</option>`;
        }).join('')}
      `;
    }

    if (usageSelect && usageFilterInput) {
      usageSelect.addEventListener('change', () => {
        selectedUsageId = usageSelect.value;
      });
      usageFilterInput.addEventListener('input', () => {
        renderUsageOptions(usageFilterInput.value);
      });
      renderUsageOptions('');
    }

    if (freqSelect && freqFilterInput) {
      freqSelect.addEventListener('change', () => {
        selectedFreqId = freqSelect.value;
      });
      freqFilterInput.addEventListener('input', () => {
        renderFreqOptions(freqFilterInput.value);
      });
      renderFreqOptions('');
    }

    el.owItemFormDrawer.classList.remove('hidden');
  }

  function openDrawerForConsult(col, consultItem, editIndex = null) {
    state.orderWriter.currentDrawerDraft = { kind: 'consult', type: col, ...consultItem };
    state.orderWriter.editingIndex = editIndex;

    const meta = state.orderWriter.meta || {};
    const spclties = meta.spclties || [];
    const reasons = meta.reasons || [];
    const neededs = meta.neededs || [];

    el.owDrawerTitle.textContent = `${editIndex !== null ? 'แก้ไข' : 'เพิ่ม'} ใบปรึกษา (Consult)`;

    el.owDrawerBody.innerHTML = `
      <div class="form-group">
        <label for="drawer-consult-spclty">สาขาที่ต้องการปรึกษา <span class="text-danger">*</span></label>
        <select id="drawer-consult-spclty" class="form-control">
          <option value="">- เลือกสาขาการแพทย์ -</option>
          ${spclties.map(s => `
            <option value="${s.id}" ${String(s.id) === String(consultItem.spclty_id) ? 'selected' : ''}>${escapeHtml(s.name)}</option>
          `).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="drawer-consult-reason">เหตุผลในการปรึกษา</label>
        <select id="drawer-consult-reason" class="form-control">
          <option value="">- เลือกเหตุผล -</option>
          ${reasons.map(r => `
            <option value="${r.id}" ${String(r.id) === String(consultItem.reason_id) ? 'selected' : ''}>${escapeHtml(r.text)}</option>
          `).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="drawer-consult-needed">ความต้องการ</label>
        <select id="drawer-consult-needed" class="form-control">
          <option value="">- เลือกความต้องการ -</option>
          ${neededs.map(n => `
            <option value="${n.id}" ${String(n.id) === String(consultItem.needed_id) ? 'selected' : ''}>${escapeHtml(n.text)}</option>
          `).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="drawer-consult-diag">Clinical diagnosis</label>
        <input type="text" id="drawer-consult-diag" class="form-control" value="${escapeHtml(consultItem.diag || '')}" placeholder="การวินิจฉัยโรค" />
      </div>
      <div class="form-group">
        <label for="drawer-consult-note">Clinical information / ข้อมูลทางคลินิก</label>
        <textarea id="drawer-consult-note" class="form-control" rows="3" placeholder="ระบุอาการสำคัญ ประวัติ และคำถามที่ต้องการปรึกษา">${escapeHtml(consultItem.note || '')}</textarea>
      </div>
    `;

    el.owItemFormDrawer.classList.remove('hidden');
  }

  function openDrawerForText(col, textItem, editIndex = null) {
    state.orderWriter.currentDrawerDraft = { kind: 'text', type: col, ...textItem };
    state.orderWriter.editingIndex = editIndex;

    el.owDrawerTitle.textContent = `${editIndex !== null ? 'แก้ไข' : 'เพิ่ม'} คำสั่งอื่น / กิจกรรมการรักษา`;

    el.owDrawerBody.innerHTML = `
      <div class="form-group">
        <label for="drawer-text-type">หมวดคำสั่ง</label>
        <select id="drawer-text-type" class="form-control">
          <option value="8" ${Number(textItem.type_id) === 8 ? 'selected' : ''}>Other (คำสั่งทั่วไป)</option>
          <option value="2" ${Number(textItem.type_id) === 2 ? 'selected' : ''}>Activity (กิจกรรม/การเคลื่อนไหว)</option>
          <option value="4" ${Number(textItem.type_id) === 4 ? 'selected' : ''}>Record (บันทึก/สังเกตอาการ)</option>
          <option value="9" ${Number(textItem.type_id) === 9 ? 'selected' : ''}>Operation (ผ่าตัด/หัตถการ)</option>
        </select>
      </div>
      <div class="form-group">
        <label for="drawer-text-desc">ข้อความคำสั่ง <span class="text-danger">*</span></label>
        <textarea id="drawer-text-desc" class="form-control" rows="3" placeholder="เช่น Record I/O, NPO after midnight, Bed rest, On O2 canula 3 LPM" autofocus>${escapeHtml(textItem.text || '')}</textarea>
      </div>
    `;

    el.owItemFormDrawer.classList.remove('hidden');
  }

  function closeDrawer() {
    if (el.owItemFormDrawer) el.owItemFormDrawer.classList.add('hidden');
    state.orderWriter.currentDrawerDraft = null;
    state.orderWriter.editingIndex = null;
  }

  function confirmDrawerItem() {
    const draft = state.orderWriter.currentDrawerDraft;
    if (!draft) {
      closeDrawer();
      return;
    }

    if (draft.kind === 'med') {
      const doseEl = document.getElementById('drawer-med-dose');
      const usageEl = document.getElementById('drawer-med-usage');
      const freqEl = document.getElementById('drawer-med-freq');
      const qtyEl = document.getElementById('drawer-med-qty');
      const noteEl = document.getElementById('drawer-med-note');

      const dose = doseEl ? doseEl.value.trim() : '';
      const usageId = usageEl ? usageEl.value : '';
      const freqId = freqEl ? freqEl.value : '';
      const qty = qtyEl ? qtyEl.value.trim() : '';
      const note = noteEl ? noteEl.value.trim() : '';

      if (!dose) {
        alert('กรุณากรอก Dose ของยา');
        if (doseEl) doseEl.focus();
        return;
      }
      if (!usageId) {
        alert('กรุณาเลือกวิธีใช้ยา');
        if (usageEl) usageEl.focus();
        return;
      }
      if (!freqId) {
        alert('กรุณาเลือกความถี่ในการให้ยา');
        if (freqEl) freqEl.focus();
        return;
      }

      const meta = state.orderWriter.meta || {};
      const usageObj = (meta.usages || []).find(u => String(u.id) === String(usageId));
      const freqObj = (meta.freqs || []).find(f => String(f.id) === String(freqId));

      const updated = {
        ...draft,
        dose,
        drug_usage_code_id: usageId,
        frequency_code_id: freqId,
        qty: qty || null,
        note: note || '',
        sigText: `${dose} ${draft.unit || ''} ${usageObj ? usageObj.usage_code : ''} ${freqObj ? freqObj.freq_code : ''}`.trim()
      };

      if (state.orderWriter.editingIndex !== null) {
        state.orderWriter.items[state.orderWriter.editingIndex] = updated;
      } else {
        state.orderWriter.items.push(updated);
      }

    } else if (draft.kind === 'consult') {
      const spEl = document.getElementById('drawer-consult-spclty');
      const rsEl = document.getElementById('drawer-consult-reason');
      const ndEl = document.getElementById('drawer-consult-needed');
      const dgEl = document.getElementById('drawer-consult-diag');
      const ntEl = document.getElementById('drawer-consult-note');

      const spcltyId = spEl ? spEl.value : '';
      if (!spcltyId) {
        alert('กรุณาเลือกสาขาที่ต้องการปรึกษา');
        return;
      }

      const meta = state.orderWriter.meta || {};
      const spObj = (meta.spclties || []).find(s => String(s.id) === String(spcltyId));

      const updated = {
        ...draft,
        spclty_id: spcltyId,
        reason_id: rsEl ? rsEl.value : '',
        needed_id: ndEl ? ndEl.value : '',
        diag: dgEl ? dgEl.value.trim() : '',
        note: ntEl ? ntEl.value.trim() : '',
        label: `Consult ${spObj ? spObj.name : ''}`
      };

      if (state.orderWriter.editingIndex !== null) {
        state.orderWriter.items[state.orderWriter.editingIndex] = updated;
      } else {
        state.orderWriter.items.push(updated);
      }

    } else if (draft.kind === 'text') {
      const typeEl = document.getElementById('drawer-text-type');
      const descEl = document.getElementById('drawer-text-desc');
      const desc = descEl ? descEl.value.trim() : '';

      if (!desc) {
        alert('กรุณากรอกข้อความคำสั่ง');
        return;
      }

      const updated = {
        ...draft,
        type_id: typeEl ? Number(typeEl.value) : 8,
        text: desc,
        label: desc
      };

      if (state.orderWriter.editingIndex !== null) {
        state.orderWriter.items[state.orderWriter.editingIndex] = updated;
      } else {
        state.orderWriter.items.push(updated);
      }
    }

    closeDrawer();
    renderOrderWriterItemsList();
    updateOrderWriterSummary();
  }

  function renderOrderWriterItemsList() {
    const items = state.orderWriter.items;
    const itemsD = items.map((it, idx) => ({ ...it, origIdx: idx })).filter(it => (it.type || 'D') === 'D');
    const itemsC = items.map((it, idx) => ({ ...it, origIdx: idx })).filter(it => (it.type || 'D') === 'C');

    // Badge counts
    const badgeD = document.getElementById('badge-count-D');
    const badgeC = document.getElementById('badge-count-C');
    if (badgeD) badgeD.textContent = String(itemsD.length);
    if (badgeC) badgeC.textContent = String(itemsC.length);

    if (el.owListD) {
      if (!itemsD.length) {
        el.owListD.innerHTML = `<div class="ow-empty-notice">- ยังไม่มีรายการ Daily Order -</div>`;
      } else {
        el.owListD.innerHTML = itemsD.map(it => renderOrderItemCard(it)).join('');
      }
    }

    if (el.owListC) {
      if (!itemsC.length) {
        el.owListC.innerHTML = `<div class="ow-empty-notice">- ยังไม่มีรายการ Continue Order -</div>`;
      } else {
        el.owListC.innerHTML = itemsC.map(it => renderOrderItemCard(it)).join('');
      }
    }

    // Bind action buttons on each item
    document.querySelectorAll('[data-ow-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-ow-action');
        const idx = Number(btn.getAttribute('data-idx'));
        if (action === 'delete') {
          state.orderWriter.items.splice(idx, 1);
          renderOrderWriterItemsList();
          updateOrderWriterSummary();
        } else if (action === 'switch-type') {
          const cur = state.orderWriter.items[idx];
          cur.type = (cur.type || 'D') === 'C' ? 'D' : 'C';
          renderOrderWriterItemsList();
          updateOrderWriterSummary();
        } else if (action === 'edit') {
          editOrderWriterItem(idx);
        }
      });
    });
  }

  function renderOrderItemCard(it) {
    const isMed = it.kind === 'med';
    const subSig = it.sigText || (isMed ? `${it.dose || ''} ${it.unit || ''}` : (it.note || it.text || ''));

    return `
      <div class="ow-order-item-card">
        <div class="ow-item-info">
          <span class="ow-item-badge-tag ${getKindBadgeClass(it.kind)}">${getKindTitle(it.kind)}</span>
          <div class="ow-item-name">${escapeHtml(it.label || it.text || '')}</div>
          ${subSig ? `<div class="ow-item-sig">${escapeHtml(subSig)}</div>` : ''}
          ${it.note && isMed ? `<div class="ow-item-sig" style="color:var(--text-muted);">หมายเหตุ: ${escapeHtml(it.note)}</div>` : ''}
        </div>
        <div class="ow-item-actions">
          <button type="button" class="ow-btn-action" data-ow-action="switch-type" data-idx="${it.origIdx}" title="สลับ Daily / Continue">
            ${it.type === 'C' ? 'ย้ายเป็น Daily' : 'ย้ายเป็น Continue'}
          </button>
          <button type="button" class="ow-btn-action" data-ow-action="edit" data-idx="${it.origIdx}" title="แก้ไขรายการ">
            แก้ไข
          </button>
          <button type="button" class="ow-btn-action del" data-ow-action="delete" data-idx="${it.origIdx}" title="ลบรายการ">
            ✕
          </button>
        </div>
      </div>
    `;
  }

  function editOrderWriterItem(idx) {
    const it = state.orderWriter.items[idx];
    if (!it) return;
    if (it.kind === 'med') {
      openDrawerForMed(it.type || 'D', it, idx);
    } else if (it.kind === 'consult') {
      openDrawerForConsult(it.type || 'D', it, idx);
    } else if (it.kind === 'text') {
      openDrawerForText(it.type || 'D', it, idx);
    }
  }

  function updateOrderWriterSummary() {
    const total = state.orderWriter.items.length;
    if (el.owSummaryText) {
      el.owSummaryText.textContent = `รวม ${total} รายการคำสั่ง`;
    }
  }

  async function submitDoctorOrder() {
    if (!state.currentPatientData || !state.currentPatientData.patient) return;
    const ipdId = state.currentPatientData.patient.ipd_id;

    // Collect SOAP
    const soap = {
      title: el.soapTitle ? el.soapTitle.value.trim() : '',
      s: el.soapS ? el.soapS.value.trim() : '',
      o: el.soapO ? el.soapO.value.trim() : '',
      a: el.soapA ? el.soapA.value.trim() : '',
      p: el.soapP ? el.soapP.value.trim() : ''
    };

    const hasSoap = soap.title || soap.s || soap.o || soap.a || soap.p;
    const items = state.orderWriter.items;
    const note = el.owMasterNote ? el.owMasterNote.value.trim() : '';

    if (!hasSoap && !items.length) {
      alert('กรุณากรอก Progress Note หรือเพิ่มรายการคำสั่งการรักษาอย่างน้อย 1 รายการ');
      return;
    }

    // Verify all meds have dose, usage, freq
    for (const it of items) {
      if (it.kind === 'med') {
        if (!it.dose || !it.drug_usage_code_id || !it.frequency_code_id) {
          alert(`รายการยา "${it.label || 'ยา'}" ข้อมูลยังไม่ครบ (ต้องมี Dose, วิธีใช้, ความถี่) กรุณากดแก้ไขก่อนบันทึก`);
          return;
        }
      }
    }

    if (el.owSubmitBtn) {
      el.owSubmitBtn.disabled = true;
      el.owSubmitBtn.innerHTML = `<span>กำลังบันทึกคำสั่ง...</span>`;
    }

    try {
      const res = await apiFetch(`/api/patients/${ipdId}/orders`, {
        method: 'POST',
        body: JSON.stringify({ soap, items, note })
      });

      alert(res.message || 'บันทึกคำสั่งแพทย์เรียบร้อยแล้ว');
      closeOrderWriterModal();

      // Refresh orders list
      await fetchAndRenderPatientOrders(ipdId);
    } catch (err) {
      if (el.owErrorBanner) {
        el.owErrorBanner.textContent = err.message;
        el.owErrorBanner.classList.remove('hidden');
      } else {
        alert('เกิดข้อผิดพลาดในการบันทึกคำสั่ง: ' + err.message);
      }
    } finally {
      if (el.owSubmitBtn) {
        el.owSubmitBtn.disabled = false;
        el.owSubmitBtn.innerHTML = `
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          <span>บันทึกคำสั่งแพทย์</span>
        `;
      }
    }
  }

  // ==================== OPD EMR FUNCTIONS ====================
  function openOpdEmrView(fromView = 'orders') {
    if (!state.currentPatientData || !state.currentPatientData.patient) {
      alert('กรุณาเลือกผู้ป่วยก่อนเปิดดู OPD EMR');
      return;
    }
    state.opdEmr.previousView = fromView;

    if (el.patientDetailView) el.patientDetailView.classList.add('hidden');
    if (el.patientEmrView) el.patientEmrView.classList.add('hidden');
    if (el.patientOpdView) el.patientOpdView.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    renderOpdPatientBanner(state.currentPatientData);
    switchOpdMobileTab('visits');
    loadPatientVisits(state.currentPatientData.patient.hn);
  }

  function returnToIpdFromOpd() {
    if (el.patientOpdView) el.patientOpdView.classList.add('hidden');
    if (state.opdEmr.previousView === 'emr') {
      if (el.patientEmrView) el.patientEmrView.classList.remove('hidden');
    } else {
      if (el.patientDetailView) el.patientDetailView.classList.remove('hidden');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function switchOpdMobileTab(tabKey) {
    state.opdEmr.activeMobileTab = tabKey;
    document.querySelectorAll('.opd-mob-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-opd-mob') === tabKey);
    });

    const grid = el.opdGridContainer;
    if (grid) {
      grid.classList.remove('mob-show-visits', 'mob-show-card', 'mob-show-tabs');
      grid.classList.add(`mob-show-${tabKey}`);
    }
  }

  function renderOpdPatientBanner(ptData) {
    if (!el.opdPatientBanner || !ptData || !ptData.patient) return;
    const pt = ptData.patient;
    const allergies = ptData.allergies || [];
    const ageText = calculateAgeText(pt.birthday);

    const allergyBadges = allergies.length > 0
      ? allergies.map(a => `<span class="badge badge-allergy">${escapeHtml(a.agent || 'ไม่ระบุ')}${a.symptom ? ` (${escapeHtml(a.symptom)})` : ''}</span>`).join(' ')
      : '<span class="text-muted">ไม่มีประวัติแพ้ยา</span>';

    el.opdPatientBanner.innerHTML = `
      <div class="banner-top-row">
        <div class="pt-name-wrap">
          <span class="pt-fullname">${escapeHtml(pt.fullname || '-')}</span>
          <span class="pt-age-gender">${escapeHtml(pt.gender || '-')} • ${escapeHtml(ageText)}</span>
          <span class="bed-chip ${pt.bed_no ? '' : 'no-bed'}">เตียง: ${escapeHtml(pt.bed_no || '-')}</span>
        </div>
        <div class="pt-identifiers">
          <span class="id-tag"><span class="id-label">HN:</span> <span class="id-val">${escapeHtml(pt.hn || '-')}</span></span>
          <span class="id-tag"><span class="id-label">AN:</span> <span class="id-val">${escapeHtml(pt.an || '-')}</span></span>
        </div>
      </div>
      <div class="banner-meta-row">
        <div class="meta-item">
          <span class="meta-label">สิทธิการรักษา:</span>
          <span class="meta-val">${escapeHtml(pt.pt_type_name || pt.pttype_name || '-')}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">ประวัติแพ้ยา:</span>
          <span class="meta-val">${allergyBadges}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">วอร์ดปัจจุบัน:</span>
          <span class="meta-val">${escapeHtml(pt.ward_name || state.selectedWard?.name || '-')}</span>
        </div>
      </div>
    `;
  }

  async function loadPatientVisits(hn) {
    if (!hn) return;
    if (el.opdLoading) el.opdLoading.classList.remove('hidden');

    try {
      const visits = await apiFetch(`/api/patients/${encodeURIComponent(hn)}/visits`);
      // De-duplicate visits (HIS join on Deptq_d may return the same RX twice)
      const seen = new Set();
      state.opdEmr.visits = (Array.isArray(visits) ? visits : []).filter(v => {
        const key = `${v.RegNo}|${String(v.RXNO || '').trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      state.opdEmr.selectedVisit = null;

      if (el.opdVisitCountBadge) el.opdVisitCountBadge.textContent = state.opdEmr.visits.length;
      if (el.opdMobVisitCount) el.opdMobVisitCount.textContent = state.opdEmr.visits.length;

      renderOpdVisitsList();

      if (state.opdEmr.visits.length > 0) {
        selectVisit(state.opdEmr.visits[0]);
      } else {
        if (el.opdCardBody) {
          el.opdCardBody.innerHTML = `
            <div class="opd-empty-prompt">
              <span class="empty-icon">📂</span>
              <p>ไม่พบประวัติการรับบริการ OPD สำหรับผู้ป่วย HN นี้</p>
            </div>
          `;
        }
        if (el.opdRightTabContent) {
          el.opdRightTabContent.innerHTML = `<div class="empty-col-placeholder">- ไม่มีข้อมูล -</div>`;
        }
      }
    } catch (err) {
      console.error('Failed to load OPD visits:', err);
      if (el.opdVisitsList) {
        el.opdVisitsList.innerHTML = `<div class="alert-box error" style="margin:10px;">เกิดข้อผิดพลาดในการดึงข้อมูล: ${escapeHtml(err.message)}</div>`;
      }
    } finally {
      if (el.opdLoading) el.opdLoading.classList.add('hidden');
    }
  }

  function renderOpdVisitsList() {
    if (!el.opdVisitsList) return;
    const visits = state.opdEmr.visits;

    if (!visits.length) {
      el.opdVisitsList.innerHTML = `<div class="opd-empty-list">- ไม่มีประวัติการตรวจ OPD -</div>`;
      return;
    }

    el.opdVisitsList.innerHTML = visits.map((v, idx) => {
      const isSelected = state.opdEmr.selectedVisit && state.opdEmr.selectedVisit.RegNo === v.RegNo && state.opdEmr.selectedVisit.RXNO === v.RXNO;
      const vDate = v.VisitDate ? new Date(v.VisitDate) : null;
      const dateStr = vDate ? vDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
      const timeStr = vDate ? vDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';

      return `
        <div class="opd-visit-item ${isSelected ? 'active' : ''}" data-visit-idx="${idx}">
          <div class="opd-v-top">
            <span class="opd-v-date">📅 ${escapeHtml(dateStr)} ${timeStr ? `<small>${escapeHtml(timeStr)} น.</small>` : ''}</span>
            <span class="opd-v-reg">Reg: ${escapeHtml(v.RegNo || '-')}</span>
          </div>
          <div class="opd-v-dept">🏥 ${escapeHtml(v.deptDesc || 'ตรวจทั่วไป')}</div>
          <div class="opd-v-doc">👨‍⚕️ ${escapeHtml(v.doctor_full_name || 'ไม่ระบุแพทย์')}</div>
        </div>
      `;
    }).join('');

    el.opdVisitsList.querySelectorAll('.opd-visit-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = Number(item.getAttribute('data-visit-idx'));
        const v = state.opdEmr.visits[idx];
        if (v) {
          selectVisit(v);
          if (window.innerWidth <= 900) {
            switchOpdMobileTab('card');
          }
        }
      });
    });
  }

  async function selectVisit(visit) {
    if (!visit) return;
    state.opdEmr.selectedVisit = visit;

    // Highlight active card
    el.opdVisitsList?.querySelectorAll('.opd-visit-item').forEach(card => {
      const idx = Number(card.getAttribute('data-visit-idx'));
      const v = state.opdEmr.visits[idx];
      const isSel = v && v.RegNo === visit.RegNo && v.RXNO === visit.RXNO;
      card.classList.toggle('active', isSel);
    });

    const vDate = visit.VisitDate ? new Date(visit.VisitDate) : null;
    const dateFormatted = vDate ? vDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';

    if (el.opdCardDateBadge) el.opdCardDateBadge.textContent = dateFormatted;
    if (el.opdCardDeptBadge) el.opdCardDeptBadge.textContent = visit.deptDesc || '';

    // Show temporary skeleton
    if (el.opdCardBody) {
      el.opdCardBody.innerHTML = `
        <div class="loading-box" style="padding:40px 10px;">
          <div class="spinner"></div>
          <p>กำลังดึงข้อมูลเวชระเบียน OPD Card...</p>
        </div>
      `;
    }

    try {
      const detail = await apiFetch(`/api/patients/${encodeURIComponent(visit.hn)}/visit-detail?regNo=${encodeURIComponent(visit.RegNo)}&rxNo=${encodeURIComponent(visit.RXNO || '')}`);
      state.opdEmr.visitDetail = detail || {};
      renderOpdCard(visit, state.opdEmr.visitDetail);
      renderOpdRightTabContent();
    } catch (err) {
      console.error('Failed to load visit detail:', err);
      if (el.opdCardBody) {
        el.opdCardBody.innerHTML = `<div class="alert-box error" style="margin:20px;">ไม่สามารถดึงข้อมูล Visit Detail ได้: ${escapeHtml(err.message)}</div>`;
      }
    }
  }

  function renderOpdCard(visit, detail) {
    if (!el.opdCardBody) return;
    const pt = state.currentPatientData?.patient || {};
    const vitals = detail.vitals || {};
    const vDate = visit.VisitDate ? new Date(visit.VisitDate) : null;
    const dateStr = vDate ? vDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
    const timeStr = vDate ? vDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';

    // Physical exam items
    let peContent = '';
    if (Array.isArray(detail.pe) && detail.pe.length > 0) {
      peContent = detail.pe.map(p => `
        <div class="opd-pe-item">
          <strong>${escapeHtml(p.physical_name || '')}:</strong> ${escapeHtml(p.result || '-')}
        </div>
      `).join('');
    } else if (visit.clinicalFiding) {
      peContent = `<div class="opd-pe-text">${escapeHtml(visit.clinicalFiding).replace(/\n/g, '<br/>')}</div>`;
    } else {
      peContent = '<span class="text-muted">- ไม่พบข้อมูลการตรวจร่างกาย -</span>';
    }

    el.opdCardBody.innerHTML = `
      <div class="opd-paper">
        <!-- Hospital & OPD Sheet Title -->
        <div class="opd-sheet-header">
          <div class="opd-hospital-title">OUTPATIENT DEPARTMENT</div>
          <div class="opd-sheet-sub">บันทึกการตรวจรักษาผู้ป่วยนอก (OPD Card)</div>
        </div>

        <!-- Patient Demographics Strip -->
        <div class="opd-patient-info-strip">
          <div class="opd-pi-col">
            <span class="opd-pi-label">ชื่อ-สกุล:</span>
            <span class="opd-pi-val"><strong>${escapeHtml(pt.fullname || '-')}</strong></span>
          </div>
          <div class="opd-pi-col">
            <span class="opd-pi-label">HN:</span>
            <span class="opd-pi-val"><strong>${escapeHtml(visit.hn || pt.hn || '-')}</strong></span>
          </div>
          <div class="opd-pi-col">
            <span class="opd-pi-label">อายุ:</span>
            <span class="opd-pi-val">${escapeHtml(calculateAgeText(pt.birthday))}</span>
          </div>
          <div class="opd-pi-col">
            <span class="opd-pi-label">เพศ:</span>
            <span class="opd-pi-val">${escapeHtml(pt.gender || '-')}</span>
          </div>
          <div class="opd-pi-col">
            <span class="opd-pi-label">วันที่ตรวจ:</span>
            <span class="opd-pi-val">${escapeHtml(dateStr)} ${timeStr ? `(${escapeHtml(timeStr)} น.)` : ''}</span>
          </div>
          <div class="opd-pi-col">
            <span class="opd-pi-label">RegNo:</span>
            <span class="opd-pi-val">${escapeHtml(visit.RegNo || '-')}</span>
          </div>
          <div class="opd-pi-col">
            <span class="opd-pi-label">แผนก:</span>
            <span class="opd-pi-val">${escapeHtml(visit.deptDesc || '-')}</span>
          </div>
        </div>

        <!-- Vital Signs Ribbon -->
        <div class="opd-vitals-strip">
          <div class="opd-vital-card">
            <span class="v-label">ความดัน (BP)</span>
            <span class="v-val">${vitals.Hbloodpress || vitals.Lbloodpress ? `${vitals.Hbloodpress || '-'}/${vitals.Lbloodpress || '-'}` : '-'} <small>mmHg</small></span>
          </div>
          <div class="opd-vital-card">
            <span class="v-label">ชีพจร (PR)</span>
            <span class="v-val">${vitals.Pulse || '-'} <small>bpm</small></span>
          </div>
          <div class="opd-vital-card">
            <span class="v-label">อุณหภูมิ (T)</span>
            <span class="v-val">${vitals.Temperature || '-'} <small>°C</small></span>
          </div>
          <div class="opd-vital-card">
            <span class="v-label">การหายใจ (RR)</span>
            <span class="v-val">${vitals.Breathe || '-'} <small>/min</small></span>
          </div>
          <div class="opd-vital-card">
            <span class="v-label">SpO2</span>
            <span class="v-val">${vitals.Sp02 || '-'} <small>%</small></span>
          </div>
          <div class="opd-vital-card">
            <span class="v-label">น้ำหนัก (BW)</span>
            <span class="v-val">${vitals.Weight || '-'} <small>kg</small></span>
          </div>
          <div class="opd-vital-card">
            <span class="v-label">ส่วนสูง (Ht)</span>
            <span class="v-val">${vitals.Height || '-'} <small>cm</small></span>
          </div>
          <div class="opd-vital-card">
            <span class="v-label">BMI</span>
            <span class="v-val">${vitals.BMI || '-'}</span>
          </div>
        </div>

        <!-- Clinical Notes Section -->
        <div class="opd-clinical-sections">
          <!-- Chief Complaint -->
          <div class="opd-section-block">
            <div class="opd-section-title">
              <span class="opd-sec-badge cc">CC</span>
              <strong>อาการสำคัญ (Chief Complaint):</strong>
            </div>
            <div class="opd-section-body">
              ${visit.Symtom ? escapeHtml(visit.Symtom).replace(/\n/g, '<br/>') : '<span class="text-muted">-</span>'}
            </div>
          </div>

          <!-- Present Illness -->
          <div class="opd-section-block">
            <div class="opd-section-title">
              <span class="opd-sec-badge pi">PI</span>
              <strong>ประวัติปัจจุบัน (Present Illness):</strong>
            </div>
            <div class="opd-section-body">
              ${visit.Present_illness ? escapeHtml(visit.Present_illness).replace(/\n/g, '<br/>') : '<span class="text-muted">-</span>'}
            </div>
          </div>

          <!-- Physical Examination -->
          <div class="opd-section-block">
            <div class="opd-section-title">
              <span class="opd-sec-badge pe">PE</span>
              <strong>การตรวจร่างกาย (Physical Examination):</strong>
            </div>
            <div class="opd-section-body">
              ${peContent}
            </div>
          </div>

          <!-- Diagnosis -->
          <div class="opd-section-block opd-highlight-box">
            <div class="opd-section-title">
              <span class="opd-sec-badge dx">Dx</span>
              <strong>การวินิจฉัยโรค (Diagnosis):</strong>
            </div>
            <div class="opd-section-body opd-dx-text">
              ${visit.DiagNote ? escapeHtml(visit.DiagNote).replace(/\n/g, '<br/>') : '<span class="text-muted">-</span>'}
            </div>
          </div>

          <!-- Treatment / Plan -->
          <div class="opd-section-block">
            <div class="opd-section-title">
              <span class="opd-sec-badge rx">Rx</span>
              <strong>การรักษา / คำสั่งการรักษา (Treatment & Plan):</strong>
            </div>
            <div class="opd-section-body">
              ${visit.Treatment ? escapeHtml(visit.Treatment).replace(/\n/g, '<br/>') : '<span class="text-muted">-</span>'}
            </div>
          </div>
        </div>

        <!-- Doctor Signature Footer -->
        <div class="opd-doctor-sig-box">
          <div class="opd-sig-line"></div>
          <div class="opd-sig-name">( แพทย์ผู้ตรวจ: <strong>${escapeHtml(visit.doctor_full_name || 'ไม่ระบุชื่อแพทย์')}</strong> )</div>
        </div>
      </div>
    `;
  }

  function renderOpdRightTabContent() {
    if (!el.opdRightTabContent) return;
    const detail = state.opdEmr.visitDetail || {};
    const currentTab = state.opdEmr.activeRightTab || 'LAB';

    if (currentTab === 'LAB') {
      const labs = (Array.isArray(detail.labs) ? detail.labs : []).filter(l => l.lab_code || l.lab_name);
      if (!labs.length) {
        el.opdRightTabContent.innerHTML = `<div class="empty-col-placeholder">- ไม่มีรายการส่งตรวจ Lab ใน Visit นี้ -</div>`;
        return;
      }
      el.opdRightTabContent.innerHTML = `
        <div class="opd-tab-list">
          <div class="opd-tab-list-header">รายการตรวจทางห้องปฏิบัติการ (${labs.length} รายการ)</div>
          ${labs.map((l, idx) => `
            <div class="opd-tab-card lab">
              <div class="opd-tc-top">
                <span class="opd-tc-idx">${idx + 1}.</span>
                <span class="opd-tc-name"><strong>${escapeHtml(l.lab_name || l.lab_code || '-')}</strong></span>
              </div>
              ${l.lab_code ? `<div class="opd-tc-sub">รหัส Lab: ${escapeHtml(l.lab_code)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    } else if (currentTab === 'XRAY') {
      const xrays = Array.isArray(detail.xrays) ? detail.xrays : [];
      if (!xrays.length) {
        el.opdRightTabContent.innerHTML = `<div class="empty-col-placeholder">- ไม่มีรายการเอกซเรย์ใน Visit นี้ -</div>`;
        return;
      }
      el.opdRightTabContent.innerHTML = `
        <div class="opd-tab-list">
          <div class="opd-tab-list-header">รายการเอกซเรย์ (${xrays.length} รายการ)</div>
          ${xrays.map((x, idx) => `
            <div class="opd-tab-card xray">
              <div class="opd-tc-top">
                <span class="opd-tc-idx">${idx + 1}.</span>
                <span class="opd-tc-name"><strong>${escapeHtml(x.xproc_des || '-')}</strong></span>
              </div>
              ${x.time_request ? `<div class="opd-tc-sub">เวลาขอตรวจ: ${escapeHtml(x.time_request)} น.</div>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    } else if (currentTab === 'MEDICINE') {
      const meds = Array.isArray(detail.medicines) ? detail.medicines : [];
      if (!meds.length) {
        el.opdRightTabContent.innerHTML = `<div class="empty-col-placeholder">- ไม่มีรายการสั่งยาใน Visit นี้ -</div>`;
        return;
      }
      el.opdRightTabContent.innerHTML = `
        <div class="opd-tab-list">
          <div class="opd-tab-list-header">รายการยาที่ได้รับ (${meds.length} รายการ)</div>
          ${meds.map((m, idx) => `
            <div class="opd-tab-card med">
              <div class="opd-tc-top">
                <span class="opd-tc-idx">${idx + 1}.</span>
                <span class="opd-tc-name"><strong>${escapeHtml(m.name || '-')}</strong></span>
                ${m.qty ? `<span class="opd-tc-qty">จำนวน: ${escapeHtml(m.qty)}</span>` : ''}
              </div>
              <div class="opd-tc-sig">💊 ${escapeHtml(m.dosagetxt || '-')}</div>
              ${m.DOCCFullName ? `<div class="opd-tc-doc">👨‍⚕️ สั่งโดย: ${escapeHtml(m.DOCCFullName)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    }
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
