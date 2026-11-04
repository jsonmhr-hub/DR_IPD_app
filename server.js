require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool, Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3003;
const JWT_SECRET = process.env.JWT_SECRET || 'mnrh-dr-ipd-secret-2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pool = null;
let activeDbName = process.env.DB_NAME || 'ipdmnrh';

async function initDbPool() {
  const baseConfig = {
    host: process.env.DB_HOST || '192.168.43.237',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'sprdd',
    password: process.env.DB_PASS || 'ICTMhr@MNRH2025',
    ssl: false,
    max: 15,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
  };

  const preferredDb = process.env.DB_NAME || 'ipdmnrh';
  const fallbackDb = process.env.DB_FALLBACK_NAME || 'sprdd';

  // Test preferred database first
  const testClient = new Client({ ...baseConfig, database: preferredDb });
  try {
    await testClient.connect();
    await testClient.end();
    activeDbName = preferredDb;
    pool = new Pool({ ...baseConfig, database: preferredDb });
    console.log(`[DB] Connected to PostgreSQL ${baseConfig.host}:${baseConfig.port}/${activeDbName}`);
  } catch (err) {
    if (err.code === '3D000' || (err.message && err.message.includes('does not exist'))) {
      console.log(`[DB] Database "${preferredDb}" not found on server; using "${fallbackDb}" schema on ${baseConfig.host}.`);
      activeDbName = fallbackDb;
      pool = new Pool({ ...baseConfig, database: fallbackDb });
      const verifyClient = await pool.connect();
      verifyClient.release();
      console.log(`[DB] Connected to PostgreSQL ${baseConfig.host}:${baseConfig.port}/${activeDbName}`);
    } else {
      throw err;
    }
  }
}

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน (Unauthorized)' });
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    }
    req.user = user;
    next();
  });
}

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const r = await pool.query('SELECT NOW() as now');
    res.json({
      status: 'ok',
      host: process.env.DB_HOST || '192.168.43.237',
      database: activeDbName,
      serverTime: r.rows[0].now
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Sample doctor accounts for quick demo / testing on mobile & iPad
app.get('/api/auth/sample-users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, TRIM(u.usercode) as usercode, TRIM(u.name) as name,
             TRIM(o.doctor_code) as doctor_code, TRIM(o.licenseno) as licenseno,
             op.name as position_name, sp.name as spclty_name
      FROM users u
      LEFT JOIN officers o ON o.id = u.officer_id
      LEFT JOIN officer_positions op ON op.id = o.officer_position_id
      LEFT JOIN spclties sp ON sp.id = o.spclty_id
      WHERE u.active = true
        AND u.id IN (76, 321, 90, 2)
      ORDER BY CASE u.id WHEN 76 THEN 1 WHEN 321 THEN 2 WHEN 90 THEN 3 ELSE 4 END
    `);
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้งาน (User) และรหัสผ่าน (Password)' });
    }

    const cleanUser = String(username).trim();

    const userQuery = await pool.query(`
      SELECT u.id, TRIM(u.usercode) as usercode, TRIM(u.name) as name, u.email,
             u.password, u.is_admin, u.active, u.current_ward_id, u.officer_id, u.cid,
             TRIM(o.doctor_code) as doctor_code, TRIM(o.licenseno) as licenseno,
             TRIM(o.fullname) as officer_fullname,
             op.name as position_name, sp.name as spclty_name
      FROM users u
      LEFT JOIN officers o ON o.id = u.officer_id
      LEFT JOIN officer_positions op ON op.id = o.officer_position_id
      LEFT JOIN spclties sp ON sp.id = o.spclty_id
      WHERE u.active = true
        AND (
          TRIM(u.usercode) = $1
          OR TRIM(u.cid) = $1
          OR LOWER(TRIM(COALESCE(u.email, ''))) = LOWER($1)
          OR LOWER(TRIM(COALESCE(o.doctor_code, ''))) = LOWER($1)
          OR LOWER(TRIM(COALESCE(o.licenseno, ''))) = LOWER($1)
          OR TRIM(u.name) = $1
        )
      ORDER BY u.id ASC
      LIMIT 5
    `, [cleanUser]);

    if (userQuery.rows.length === 0) {
      return res.status(401).json({ error: 'ไม่พบบัญชีผู้ใช้งานนี้ในระบบ หรือบัญชีถูกระงับ' });
    }

    let matchedUser = null;
    for (const candidate of userQuery.rows) {
      const dbPass = candidate.password || '';
      // Convert Laravel $2y$ prefix to $2a$ for bcryptjs compatibility
      const normalizedHash = dbPass.replace(/^\$2y\$/, '$2a$');
      let isValid = false;
      if (normalizedHash.startsWith('$2a$') || normalizedHash.startsWith('$2b$')) {
        isValid = bcrypt.compareSync(String(password), normalizedHash);
      } else {
        isValid = String(password) === dbPass;
      }
      if (isValid) {
        matchedUser = candidate;
        break;
      }
    }

    if (!matchedUser) {
      return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' });
    }

    const payload = {
      id: matchedUser.id,
      usercode: matchedUser.usercode,
      name: matchedUser.name,
      is_admin: matchedUser.is_admin,
      current_ward_id: matchedUser.current_ward_id,
      officer_id: matchedUser.officer_id,
      doctor_code: matchedUser.doctor_code,
      licenseno: matchedUser.licenseno,
      position_name: matchedUser.position_name,
      spclty_name: matchedUser.spclty_name
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      user: payload
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล: ' + err.message });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/wards - List wards with active & total patient counts and doctor order counts
app.get('/api/wards', authenticateToken, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const params = [];
    let searchClause = '';
    if (q) {
      params.push(`%${q}%`);
      searchClause = `AND (TRIM(w.name) ILIKE $1 OR TRIM(w.ward_code) ILIKE $1)`;
    }

    const result = await pool.query(`
      WITH ward_stats AS (
        SELECT
          bm.ward_id,
          COUNT(DISTINCT i.id) FILTER (WHERE i.confirm_discharge IS NOT TRUE) AS active_patients,
          COUNT(DISTINCT i.id) AS total_patients,
          COUNT(DISTINCT dom.ipd_id) FILTER (WHERE i.confirm_discharge IS NOT TRUE AND dom.deleted_at IS NULL) AS active_with_orders,
          COUNT(DISTINCT dom.id) FILTER (WHERE dom.deleted_at IS NULL) AS total_order_sheets
        FROM ipd_bedmoves bm
        JOIN ipds i ON i.current_bedmove_id = bm.id
        LEFT JOIN doctor_order_masters dom ON dom.ipd_id = i.id AND dom.deleted_at IS NULL
        WHERE bm.deleted_at IS NULL
        GROUP BY bm.ward_id
      )
      SELECT
        w.id,
        TRIM(w.name) AS name,
        TRIM(w.ward_code) AS ward_code,
        w.bedcount,
        w.display_order,
        wt.type_name AS ward_type_name,
        COALESCE(ws.active_patients, 0)::int AS active_patients,
        COALESCE(ws.total_patients, 0)::int AS total_patients,
        COALESCE(ws.active_with_orders, 0)::int AS active_with_orders,
        COALESCE(ws.total_order_sheets, 0)::int AS total_order_sheets
      FROM wards w
      LEFT JOIN ward_types wt ON wt.id = w.ward_type_id
      LEFT JOIN ward_stats ws ON ws.ward_id = w.id
      WHERE w.active = true
      ${searchClause}
      ORDER BY
        CASE WHEN COALESCE(ws.active_patients, 0) > 0 THEN 0 ELSE 1 END,
        w.display_order ASC NULLS LAST,
        w.id ASC
    `, params);

    res.json({ wards: result.rows });
  } catch (err) {
    console.error('Get wards error:', err);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลหอผู้ป่วยได้: ' + err.message });
  }
});

// GET /api/wards/:wardId/patients - List patients in a selected ward
app.get('/api/wards/:wardId/patients', authenticateToken, async (req, res) => {
  try {
    const wardId = Number(req.params.wardId);
    if (!wardId) {
      return res.status(400).json({ error: 'รหัสหอผู้ป่วยไม่ถูกต้อง' });
    }

    const statusFilter = req.query.status || 'active'; // 'active' | 'all'
    const search = (req.query.q || '').trim();

    const wardRes = await pool.query(`
      SELECT w.id, TRIM(w.name) AS name, TRIM(w.ward_code) AS ward_code, w.bedcount, wt.type_name AS ward_type_name
      FROM wards w
      LEFT JOIN ward_types wt ON wt.id = w.ward_type_id
      WHERE w.id = $1
    `, [wardId]);

    if (wardRes.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบหอผู้ป่วยที่ระบุ' });
    }

    const params = [wardId];
    let filterSql = '';

    if (statusFilter === 'active') {
      filterSql += ` AND i.confirm_discharge IS NOT TRUE`;
    }

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      filterSql += ` AND (
        TRIM(p.hn) ILIKE $${idx}
        OR TRIM(i.an) ILIKE $${idx}
        OR TRIM(COALESCE(p.pname,'') || COALESCE(p.fname,'') || ' ' || COALESCE(p.lname,'')) ILIKE $${idx}
        OR TRIM(COALESCE(b.bed_name, b.bed_code, '')) ILIKE $${idx}
      )`;
    }

    const patientsRes = await pool.query(`
      SELECT
        i.id AS ipd_id,
        TRIM(i.an) AS an,
        TRIM(i.vn) AS vn,
        i.patient_id,
        TRIM(p.hn) AS hn,
        TRIM(COALESCE(p.pname, '')) AS pname,
        TRIM(COALESCE(p.fname, '')) AS fname,
        TRIM(COALESCE(p.lname, '')) AS lname,
        TRIM(COALESCE(p.pname, '')) || TRIM(COALESCE(p.fname, '')) || ' ' || TRIM(COALESCE(p.lname, '')) AS fullname,
        p.birthday,
        p.sex,
        p.drugallergy,
        i.prediag,
        i.provision_dx,
        i.admit_for,
        i.regdate,
        i.regtime,
        i.confirm_discharge,
        bm.id AS bedmove_id,
        bm.ward_id,
        bm.movedate,
        bm.movetime,
        TRIM(COALESCE(b.bed_name, b.bed_code, '-')) AS bed_no,
        TRIM(COALESCE(r.room_name, '')) AS room_name,
        TRIM(COALESCE(adm_doc.fullname, '')) AS adm_doctor_name,
        TRIM(COALESCE(adm_doc.licenseno, adm_doc.doctor_code, '')) AS adm_doctor_license,
        TRIM(COALESCE(sp.name, '')) AS spclty_name,
        TRIM(COALESCE(pt.name, '')) AS pttype_name,
        TRIM(COALESCE(sev.name, '')) AS severe_name,
        i.ipd_severe_id,
        COALESCE(ord_stats.order_master_count, 0)::int AS order_master_count,
        COALESCE(ord_stats.order_item_count, 0)::int AS order_item_count,
        ord_stats.last_order_date,
        ord_stats.last_order_time
      FROM ipds i
      JOIN ipd_bedmoves bm ON bm.id = i.current_bedmove_id AND bm.deleted_at IS NULL
      JOIN patients p ON p.id = i.patient_id
      LEFT JOIN beds b ON b.id = bm.bed_id
      LEFT JOIN rooms r ON r.id = b.room_id
      LEFT JOIN officers adm_doc ON adm_doc.id = i.adm_officer_id
      LEFT JOIN spclties sp ON sp.id = i.spclty_id
      LEFT JOIN pttypes pt ON pt.id = i.pttype_id
      LEFT JOIN ipd_severes sev ON sev.id = i.ipd_severe_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT dom.id) AS order_master_count,
          COUNT(do_item.id) AS order_item_count,
          MAX(dom.order_date) AS last_order_date,
          (ARRAY_AGG(dom.order_time ORDER BY dom.order_date DESC, dom.order_time DESC))[1] AS last_order_time
        FROM doctor_order_masters dom
        LEFT JOIN doctor_orders do_item ON do_item.doctor_order_master_id = dom.id AND do_item.deleted_at IS NULL
        WHERE dom.ipd_id = i.id AND dom.deleted_at IS NULL
      ) ord_stats ON true
      WHERE bm.ward_id = $1
      ${filterSql}
      ORDER BY
        CASE WHEN COALESCE(ord_stats.order_master_count, 0) > 0 THEN 0 ELSE 1 END,
        b.display_order ASC NULLS LAST,
        TRIM(COALESCE(b.bed_name, b.bed_code, 'ZZZ')) ASC,
        i.regdate DESC,
        i.id DESC
    `, params);

    res.json({
      ward: wardRes.rows[0],
      patients: patientsRes.rows
    });
  } catch (err) {
    console.error('Get ward patients error:', err);
    res.status(500).json({ error: 'ไม่สามารถดึงรายชื่อผู้ป่วยในหอผู้ป่วยได้: ' + err.message });
  }
});

// GET /api/patients/:ipdId/orders - Patient detail + full Doctor Orders sorted newest to oldest
app.get('/api/patients/:ipdId/orders', authenticateToken, async (req, res) => {
  try {
    const ipdId = Number(req.params.ipdId);
    if (!ipdId) {
      return res.status(400).json({ error: 'รหัสผู้ป่วย IPD ไม่ถูกต้อง' });
    }

    // 1. Fetch patient & admission summary
    const ptRes = await pool.query(`
      SELECT
        i.id AS ipd_id,
        TRIM(i.an) AS an,
        TRIM(i.vn) AS vn,
        i.patient_id,
        TRIM(p.hn) AS hn,
        TRIM(COALESCE(p.pname, '')) AS pname,
        TRIM(COALESCE(p.fname, '')) AS fname,
        TRIM(COALESCE(p.lname, '')) AS lname,
        TRIM(COALESCE(p.pname, '')) || TRIM(COALESCE(p.fname, '')) || ' ' || TRIM(COALESCE(p.lname, '')) AS fullname,
        p.birthday,
        p.sex,
        p.drugallergy,
        p.pmh,
        p.mobile_phone_number,
        bg.name AS blood_group_name,
        brh.name AS blood_rh_name,
        i.prediag,
        i.provision_dx,
        i.admit_for,
        i.regdate,
        i.regtime,
        i.confirm_discharge,
        bm.ward_id,
        TRIM(COALESCE(w.name, '')) AS ward_name,
        TRIM(COALESCE(w.ward_code, '')) AS ward_code,
        TRIM(COALESCE(b.bed_name, b.bed_code, '-')) AS bed_no,
        TRIM(COALESCE(r.room_name, '')) AS room_name,
        TRIM(COALESCE(adm_doc.fullname, '')) AS adm_doctor_name,
        TRIM(COALESCE(adm_doc.licenseno, adm_doc.doctor_code, '')) AS adm_doctor_license,
        TRIM(COALESCE(sp.name, '')) AS spclty_name,
        TRIM(COALESCE(pt.name, '')) AS pttype_name,
        TRIM(COALESCE(sev.name, '')) AS severe_name
      FROM ipds i
      JOIN patients p ON p.id = i.patient_id
      LEFT JOIN blood_groups bg ON bg.id = p.blood_group_id
      LEFT JOIN blood_rhs brh ON brh.id = p.blood_rh_id
      LEFT JOIN ipd_bedmoves bm ON bm.id = i.current_bedmove_id
      LEFT JOIN wards w ON w.id = bm.ward_id
      LEFT JOIN beds b ON b.id = bm.bed_id
      LEFT JOIN rooms r ON r.id = b.room_id
      LEFT JOIN officers adm_doc ON adm_doc.id = i.adm_officer_id
      LEFT JOIN spclties sp ON sp.id = i.spclty_id
      LEFT JOIN pttypes pt ON pt.id = i.pttype_id
      LEFT JOIN ipd_severes sev ON sev.id = i.ipd_severe_id
      WHERE i.id = $1
    `, [ipdId]);

    if (ptRes.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ป่วยในระบบ' });
    }

    const patient = ptRes.rows[0];

    // Fetch patient allergies from patient_allergies table as well
    const allergyRes = await pool.query(`
      SELECT id, agent, symptom, relation_level, report_date, note
      FROM patient_allergies
      WHERE patient_id = $1 OR TRIM(hn) = $2
      ORDER BY report_date DESC NULLS LAST, id DESC
    `, [patient.patient_id, patient.hn]);

    // Fetch care team doctors from ipd_doctor_lists
    const docTeamRes = await pool.query(`
      SELECT dl.id, dl.active, dl.incharge_date, dl.incharge_time,
             TRIM(COALESCE(o.fullname, '')) AS doctor_name,
             TRIM(COALESCE(o.licenseno, o.doctor_code, '')) AS licenseno,
             dt.name AS doctor_type_name
      FROM ipd_doctor_lists dl
      LEFT JOIN officers o ON o.id = dl.officer_id
      LEFT JOIN ipd_doctor_types dt ON dt.id = dl.ipd_doctor_type_id
      WHERE dl.ipd_id = $1 AND dl.deleted_at IS NULL
      ORDER BY dl.ipd_doctor_type_id ASC, dl.id ASC
    `, [ipdId]);

    // Fetch latest vital signs from ipd_graphic_sheet_masters & details
    const vsRes = await pool.query(`
      SELECT gsm.vitalsign_date, gsd.vtime, gsd.slot_id, gsd.vitalsign_item_id,
             vi.item_ename, vi.item_display, gsd.value
      FROM ipd_graphic_sheet_masters gsm
      JOIN ipd_graphic_sheet_details gsd ON gsd.ipd_graphic_sheet_master_id = gsm.id
      JOIN vitalsign_items vi ON vi.id = gsd.vitalsign_item_id
      WHERE gsm.ipd_id = $1 AND gsm.deleted_at IS NULL
        AND gsd.vitalsign_item_id IN (1, 2, 3, 4, 5, 6, 8, 9)
      ORDER BY gsm.vitalsign_date DESC, gsd.slot_id DESC, gsd.id DESC
      LIMIT 30
    `, [ipdId]);

    // 2. Fetch Doctor Order Masters ordered from present (newest) to past (oldest)
    const mastersRes = await pool.query(`
      SELECT
        dom.id,
        dom.ipd_id,
        dom.patient_id,
        dom.order_date,
        dom.order_time,
        dom.order_type,
        dom.admit_for,
        dom.next_date,
        dom.followup,
        dom.homemed,
        dom.confirm,
        dom.confirm_at,
        dom.od_count,
        dom.con_count,
        dom.prgn_count,
        dom.note,
        dom.saved_at,
        dom.created_at,
        dom.updated_at,
        dom.ward_id,
        TRIM(COALESCE(w.name, '')) AS ward_name,
        TRIM(COALESCE(u_create.name, '')) AS created_by_name,
        TRIM(COALESCE(o_create.fullname, u_create.name, '')) AS doctor_name,
        TRIM(COALESCE(o_create.licenseno, o_create.doctor_code, '')) AS doctor_license,
        TRIM(COALESCE(u_confirm.name, '')) AS confirm_by_name,
        TRIM(COALESCE(u_accept.name, '')) AS accepted_by_name,
        dom.accepted_at
      FROM doctor_order_masters dom
      LEFT JOIN wards w ON w.id = dom.ward_id
      LEFT JOIN users u_create ON u_create.id = dom.created_by
      LEFT JOIN officers o_create ON o_create.id = u_create.officer_id
      LEFT JOIN users u_confirm ON u_confirm.id = dom.confirm_by
      LEFT JOIN users u_accept ON u_accept.id = dom.accepted_by
      WHERE dom.ipd_id = $1 AND dom.deleted_at IS NULL
      ORDER BY dom.order_date DESC, dom.order_time DESC, dom.id DESC
    `, [ipdId]);

    const masters = mastersRes.rows;
    const masterIds = masters.map(m => Number(m.id));

    let items = [];
    let subtypeMap = {};

    // Load all subtypes for resolving multi_value
    const subtypeRes = await pool.query(`
      SELECT id, subtype_name, doctor_order_type_id
      FROM doctor_order_subtypes
    `);
    for (const st of subtypeRes.rows) {
      subtypeMap[String(st.id)] = st.subtype_name;
    }

    if (masterIds.length > 0) {
      const ordersRes = await pool.query(`
        SELECT
          d.id,
          d.doctor_order_master_id,
          d.doctor_order_type_id,
          COALESCE(dot.type_name, 'Order') AS type_name,
          dot.component,
          dot.display_order AS type_display_order,
          d.ref_id,
          d.order_desc,
          d.order_type,
          d.off_date,
          d.off_time,
          d.off_by,
          TRIM(COALESCE(u_off.name, '')) AS off_by_name,
          d.other,
          d.multi_value,
          d.display_order,
          d.is_mix,
          d.created_at,
          -- Medication details
          med.id AS med_id,
          med.drug_item_id,
          TRIM(COALESCE(med.iname, '')) AS med_iname,
          med.itype AS med_itype,
          med.dose AS med_dose,
          TRIM(COALESCE(med.usage_unit_code, '')) AS med_usage_unit_code,
          TRIM(COALESCE(uu.usage_unit_name, med.unit_name, med.usage_unit_code, '')) AS med_unit_name,
          med.qty AS med_qty,
          med.rx_qty AS med_rx_qty,
          med.note AS med_note,
          med.stat AS med_stat,
          med.dose_text AS med_dose_text,
          med.unit_rate AS med_unit_rate,
          med.off_at AS med_off_at,
          TRIM(COALESCE(duc.usage_code, '')) AS usage_code,
          TRIM(COALESCE(duc.human_text, '')) AS usage_human_text,
          TRIM(COALESCE(duc.doctor_text, '')) AS usage_doctor_text,
          TRIM(COALESCE(fc.freq_code, '')) AS freq_code,
          TRIM(COALESCE(fc.freq_name, '')) AS freq_name,
          TRIM(COALESCE(fc.freq_for_doctors, '')) AS freq_for_doctors,
          TRIM(COALESCE(tc.time_code, '')) AS time_code,
          TRIM(COALESCE(tc.time_name, '')) AS time_name,
          -- Progress note details
          pn.id AS pn_id,
          pn.progress_date,
          pn.progress_time,
          pn.title AS pn_title,
          pn.s_note,
          pn.o_note,
          pn.a_note,
          pn.p_note,
          -- Lab details
          lab.lab_set_name,
          lab.lab_priority_id,
          lab.is_tmr AS lab_is_tmr,
          lab.order_date AS lab_order_date,
          -- X-Ray details
          rad.xray_set_name,
          rad.clinical_info AS rad_clinical_info,
          rad.clinical_diag AS rad_clinical_diag,
          rad.xn AS rad_xn,
          xp.priority_name AS rad_priority_name,
          -- Diet details
          dt.diet_type_name,
          dopt.opt_name AS diet_option_name,
          di.diet_name AS diet_full_name,
          ddose.diet_dose_name,
          doth.diet_other_name,
          dod.note AS diet_note,
          -- Blood details
          bl.item_name AS blood_item_name,
          bl.list_qty AS blood_qty,
          bl.cc AS blood_cc,
          bl.operative_date AS blood_operative_date,
          brt.type_name AS blood_request_type_name,
          brt.type_desc AS blood_request_type_desc,
          -- Consult details
          con.clinical_diag AS consult_diag,
          con.clinical_info AS consult_info,
          sp_con.name AS consult_spclty_name,
          cr.text AS consult_reason_text,
          cn.text AS consult_needed_text
        FROM doctor_orders d
        LEFT JOIN doctor_order_types dot ON dot.id = d.doctor_order_type_id
        LEFT JOIN users u_off ON u_off.id = d.off_by
        LEFT JOIN doctor_order_medications med
          ON d.doctor_order_type_id IN (5, 13)
          AND (med.id = d.ref_id OR med.doctor_order_id = d.id)
          AND med.deleted_at IS NULL
        LEFT JOIN usage_units uu ON LOWER(TRIM(uu.usage_unit_code)) = LOWER(TRIM(med.usage_unit_code))
        LEFT JOIN drug_usage_codes duc ON duc.id = med.drug_usage_code_id
        LEFT JOIN frequency_codes fc ON fc.id = med.frequency_code_id
        LEFT JOIN time_codes tc ON tc.id = med.time_code_id
        LEFT JOIN doctor_progress_notes pn
          ON d.doctor_order_type_id = 11 AND pn.id = d.ref_id
        LEFT JOIN doctor_order_labs lab
          ON d.doctor_order_type_id = 6 AND (lab.id = d.ref_id OR lab.doctor_order_id = d.id)
        LEFT JOIN doctor_order_rads rad
          ON d.doctor_order_type_id = 7 AND (rad.id = d.ref_id OR rad.doctor_order_id = d.id)
        LEFT JOIN xray_priorities xp ON xp.id = rad.xray_priority_id
        LEFT JOIN doctor_order_diets dod
          ON d.doctor_order_type_id = 1 AND (dod.id = d.ref_id OR dod.doctor_order_id = d.id)
        LEFT JOIN diet_types dt ON dt.id = dod.diet_type_id
        LEFT JOIN diet_options dopt ON dopt.id = dod.diet_option_id
        LEFT JOIN diets di ON di.id = dod.diet_id
        LEFT JOIN diet_doses ddose ON ddose.id = dod.diet_dose_id
        LEFT JOIN diet_others doth ON doth.id = dod.diet_other_id
        LEFT JOIN doctor_order_bloods bl
          ON d.doctor_order_type_id = 10 AND (bl.id = d.ref_id OR bl.doctor_order_id = d.id)
        LEFT JOIN blood_request_types brt ON brt.id = bl.request_type_id
        LEFT JOIN consults con
          ON d.doctor_order_type_id = 12 AND (con.id = d.ref_id OR con.doctor_order_id = d.id) AND con.deleted_at IS NULL
        LEFT JOIN spclties sp_con ON sp_con.id = con.spclty_id
        LEFT JOIN consult_reasons cr ON cr.id = con.consult_reason_id
        LEFT JOIN consult_neededs cn ON cn.id = con.consult_needed_id
        WHERE d.doctor_order_master_id = ANY($1::int[])
          AND d.deleted_at IS NULL
        ORDER BY
          d.doctor_order_master_id DESC,
          COALESCE(dot.display_order, 99) ASC,
          COALESCE(d.display_order, 9999) ASC,
          d.id ASC
      `, [masterIds]);

      // Deduplicate by d.id in case of multiple joins
      const seenOrderIds = new Set();
      for (const row of ordersRes.rows) {
        if (seenOrderIds.has(row.id)) continue;
        seenOrderIds.add(row.id);

        // Resolve multi_value subtype IDs if present
        let resolvedSubtypes = [];
        if (Array.isArray(row.multi_value)) {
          resolvedSubtypes = row.multi_value
            .map(val => subtypeMap[String(val)] || String(val))
            .filter(Boolean);
        }
        row.resolved_subtypes = resolvedSubtypes;
        items.push(row);
      }
    }

    // Group items by doctor_order_master_id
    const itemsByMaster = {};
    for (const item of items) {
      const mId = String(item.doctor_order_master_id);
      if (!itemsByMaster[mId]) itemsByMaster[mId] = [];
      itemsByMaster[mId].push(item);
    }

    const orderGroups = masters.map(master => ({
      ...master,
      orders: itemsByMaster[String(master.id)] || []
    }));

    res.json({
      patient,
      allergies: allergyRes.rows,
      doctors: docTeamRes.rows,
      vitals: vsRes.rows,
      orderMasters: orderGroups
    });
  } catch (err) {
    console.error('Get patient orders error:', err);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลคำสั่งการรักษา (Order) ได้: ' + err.message });
  }
});

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDbPool()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] DR IPD Application running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('[Fatal] Failed to initialize database pool:', err);
    process.exit(1);
  });
