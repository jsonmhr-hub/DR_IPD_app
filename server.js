require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool, Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3003;
const DB_HOST = process.env.DB_HOST;
const JWT_SECRET = process.env.JWT_SECRET || 'mnrh-dr-ipd-secret-2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pool = null;
let activeDbName = process.env.DB_NAME || 'ipdmnrh';

async function initDbPool() {
  const baseConfig = {
    host: DB_HOST,
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
    await testClient.end().catch(() => {});
    activeDbName = preferredDb;
    pool = new Pool({ ...baseConfig, database: preferredDb });
    console.log(`[DB] Connected to PostgreSQL ${baseConfig.host}:${baseConfig.port}/${activeDbName}`);
  } catch (err) {
    await testClient.end().catch(() => {});
    console.log(`[DB] Connecting to "${preferredDb}" failed (${err.code || err.message}); trying "${fallbackDb}" on ${baseConfig.host}...`);
    activeDbName = fallbackDb;
    pool = new Pool({ ...baseConfig, database: fallbackDb });
    const verifyClient = await pool.connect();
    verifyClient.release();
    console.log(`[DB] Connected to PostgreSQL ${baseConfig.host}:${baseConfig.port}/${activeDbName}`);
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
      host: DB_HOST,
      database: activeDbName,
      serverTime: r.rows[0].now
    });
  } catch (err) {
    res.status(500).json({ status: 'error', host: DB_HOST, error: err.message });
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
        TRIM(COALESCE(NULLIF(incharge_doc.doctor_name, ''), adm_doc.fullname, '')) AS incharge_doctor_name,
        TRIM(COALESCE(NULLIF(incharge_doc.doctor_license, ''), adm_doc.licenseno, adm_doc.doctor_code, '')) AS incharge_doctor_license,
        TRIM(COALESCE(NULLIF(incharge_doc.doctor_name, ''), adm_doc.fullname, '')) AS adm_doctor_name,
        TRIM(COALESCE(NULLIF(incharge_doc.doctor_license, ''), adm_doc.licenseno, adm_doc.doctor_code, '')) AS adm_doctor_license,
        TRIM(COALESCE(adm_doc.fullname, '')) AS admitting_doctor_name,
        TRIM(COALESCE(adm_doc.licenseno, adm_doc.doctor_code, '')) AS admitting_doctor_license,
        TRIM(COALESCE(sp.name, '')) AS spclty_name,
        TRIM(COALESCE(pt.name, '')) AS pttype_name,
        TRIM(COALESCE(sev.name, '')) AS severe_name,
        i.ipd_severe_id,
        COALESCE(ord_stats.order_master_count, 0)::int AS order_master_count,
        COALESCE(ord_stats.order_item_count, 0)::int AS order_item_count,
        ord_stats.last_order_date,
        ord_stats.last_order_time,
        vs_stats.latest_vitals
      FROM ipds i
      JOIN ipd_bedmoves bm ON bm.id = i.current_bedmove_id AND bm.deleted_at IS NULL
      JOIN patients p ON p.id = i.patient_id
      LEFT JOIN beds b ON b.id = bm.bed_id
      LEFT JOIN rooms r ON r.id = b.room_id
      LEFT JOIN officers adm_doc ON adm_doc.id = i.adm_officer_id
      LEFT JOIN LATERAL (
        SELECT
          TRIM(COALESCE(o.fullname, '')) AS doctor_name,
          TRIM(COALESCE(o.licenseno, o.doctor_code, '')) AS doctor_license
        FROM ipd_doctor_lists dl
        JOIN officers o ON o.id = dl.officer_id
        WHERE dl.ipd_id = i.id AND dl.deleted_at IS NULL
        ORDER BY
          CASE WHEN dl.ipd_doctor_type_id = 1 THEN 0 ELSE 1 END ASC,
          CASE WHEN dl.active IS TRUE THEN 0 ELSE 1 END ASC,
          dl.incharge_date DESC NULLS LAST,
          dl.incharge_time DESC NULLS LAST,
          dl.id DESC
        LIMIT 1
      ) incharge_doc ON true
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
      LEFT JOIN LATERAL (
        SELECT json_agg(v_row) AS latest_vitals
        FROM (
          SELECT DISTINCT ON (gsd.vitalsign_item_id)
            gsd.vitalsign_item_id,
            gsm.vitalsign_date,
            gsd.vtime,
            gsd.slot_id,
            gsd.value
          FROM ipd_graphic_sheet_masters gsm
          JOIN ipd_graphic_sheet_details gsd ON gsd.ipd_graphic_sheet_master_id = gsm.id
          WHERE gsm.ipd_id = i.id AND gsm.deleted_at IS NULL
            AND gsd.vitalsign_item_id IN (1, 2, 3, 4, 5, 6, 7)
            AND gsd.value IS NOT NULL AND TRIM(gsd.value) <> ''
          ORDER BY gsd.vitalsign_item_id,
                   gsm.vitalsign_date DESC,
                   gsd.vtime DESC NULLS LAST,
                   gsd.slot_id DESC NULLS LAST,
                   gsd.id DESC
        ) v_row
      ) vs_stats ON true
      WHERE bm.ward_id = $1
      ${filterSql}
      ORDER BY
        COALESCE(NULLIF(substring(TRIM(COALESCE(b.bed_name, b.bed_code, '')) from '^[0-9]+'), '')::bigint, 999999999) ASC,
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
        TRIM(COALESCE(NULLIF(incharge_doc.doctor_name, ''), adm_doc.fullname, '')) AS incharge_doctor_name,
        TRIM(COALESCE(NULLIF(incharge_doc.doctor_license, ''), adm_doc.licenseno, adm_doc.doctor_code, '')) AS incharge_doctor_license,
        TRIM(COALESCE(NULLIF(incharge_doc.doctor_name, ''), adm_doc.fullname, '')) AS adm_doctor_name,
        TRIM(COALESCE(NULLIF(incharge_doc.doctor_license, ''), adm_doc.licenseno, adm_doc.doctor_code, '')) AS adm_doctor_license,
        TRIM(COALESCE(adm_doc.fullname, '')) AS admitting_doctor_name,
        TRIM(COALESCE(adm_doc.licenseno, adm_doc.doctor_code, '')) AS admitting_doctor_license,
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
      LEFT JOIN LATERAL (
        SELECT
          TRIM(COALESCE(o.fullname, '')) AS doctor_name,
          TRIM(COALESCE(o.licenseno, o.doctor_code, '')) AS doctor_license
        FROM ipd_doctor_lists dl
        JOIN officers o ON o.id = dl.officer_id
        WHERE dl.ipd_id = i.id AND dl.deleted_at IS NULL
        ORDER BY
          CASE WHEN dl.ipd_doctor_type_id = 1 THEN 0 ELSE 1 END ASC,
          CASE WHEN dl.active IS TRUE THEN 0 ELSE 1 END ASC,
          dl.incharge_date DESC NULLS LAST,
          dl.incharge_time DESC NULLS LAST,
          dl.id DESC
        LIMIT 1
      ) incharge_doc ON true
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
      SELECT dl.id, dl.active, dl.ipd_doctor_type_id, dl.incharge_date, dl.incharge_time,
             TRIM(COALESCE(o.fullname, '')) AS doctor_name,
             TRIM(COALESCE(o.licenseno, o.doctor_code, '')) AS licenseno,
             dt.name AS doctor_type_name
      FROM ipd_doctor_lists dl
      LEFT JOIN officers o ON o.id = dl.officer_id
      LEFT JOIN ipd_doctor_types dt ON dt.id = dl.ipd_doctor_type_id
      WHERE dl.ipd_id = $1 AND dl.deleted_at IS NULL
      ORDER BY
        CASE WHEN dl.ipd_doctor_type_id = 1 THEN 0 ELSE 1 END ASC,
        CASE WHEN dl.active IS TRUE THEN 0 ELSE 1 END ASC,
        dl.incharge_date DESC NULLS LAST,
        dl.incharge_time DESC NULLS LAST,
        dl.id DESC
    `, [ipdId]);

    // Fetch latest vital signs from ipd_graphic_sheet_masters & details
    const vsRes = await pool.query(`
      SELECT DISTINCT ON (gsd.vitalsign_item_id)
             gsm.vitalsign_date, gsd.vtime, gsd.slot_id, gsd.vitalsign_item_id,
             vi.item_ename, vi.item_display, gsd.value, gsd.created_at
      FROM ipd_graphic_sheet_masters gsm
      JOIN ipd_graphic_sheet_details gsd ON gsd.ipd_graphic_sheet_master_id = gsm.id
      JOIN vitalsign_items vi ON vi.id = gsd.vitalsign_item_id
      WHERE gsm.ipd_id = $1 AND gsm.deleted_at IS NULL
        AND gsd.vitalsign_item_id IN (1, 2, 3, 4, 5, 6, 7, 8, 9)
        AND gsd.value IS NOT NULL AND TRIM(gsd.value) <> ''
      ORDER BY gsd.vitalsign_item_id,
               gsm.vitalsign_date DESC,
               gsd.vtime DESC NULLS LAST,
               gsd.slot_id DESC NULLS LAST,
               gsd.id DESC
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

// GET /api/patients/:ipdId/emr - Comprehensive EMR data across all 10 tabs
app.get('/api/patients/:ipdId/emr', authenticateToken, async (req, res) => {
  try {
    const ipdId = Number(req.params.ipdId);
    if (!ipdId) {
      return res.status(400).json({ error: 'รหัสผู้ป่วย IPD ไม่ถูกต้อง' });
    }

    // 1. Patient & Admission Info
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
        TRIM(COALESCE(NULLIF(incharge_doc.doctor_name, ''), adm_doc.fullname, '')) AS incharge_doctor_name,
        TRIM(COALESCE(NULLIF(incharge_doc.doctor_license, ''), adm_doc.licenseno, adm_doc.doctor_code, '')) AS incharge_doctor_license,
        TRIM(COALESCE(adm_doc.fullname, '')) AS adm_doctor_name,
        TRIM(COALESCE(adm_doc.licenseno, adm_doc.doctor_code, '')) AS adm_doctor_license,
        TRIM(COALESCE(sp.name, '')) AS spclty_name,
        TRIM(COALESCE(pt.name, '')) AS pttype_name,
        TRIM(COALESCE(sev.name, '')) AS severe_name,
        at.name AS admit_type_name
      FROM ipds i
      JOIN patients p ON p.id = i.patient_id
      LEFT JOIN blood_groups bg ON bg.id = p.blood_group_id
      LEFT JOIN blood_rhs brh ON brh.id = p.blood_rh_id
      LEFT JOIN ipd_bedmoves bm ON bm.id = i.current_bedmove_id
      LEFT JOIN wards w ON w.id = bm.ward_id
      LEFT JOIN beds b ON b.id = bm.bed_id
      LEFT JOIN rooms r ON r.id = b.room_id
      LEFT JOIN officers adm_doc ON adm_doc.id = i.adm_officer_id
      LEFT JOIN LATERAL (
        SELECT
          TRIM(COALESCE(o.fullname, '')) AS doctor_name,
          TRIM(COALESCE(o.licenseno, o.doctor_code, '')) AS doctor_license
        FROM ipd_doctor_lists dl
        JOIN officers o ON o.id = dl.officer_id
        WHERE dl.ipd_id = i.id AND dl.deleted_at IS NULL
        ORDER BY
          CASE WHEN dl.ipd_doctor_type_id = 1 THEN 0 ELSE 1 END ASC,
          CASE WHEN dl.active IS TRUE THEN 0 ELSE 1 END ASC,
          dl.incharge_date DESC NULLS LAST,
          dl.incharge_time DESC NULLS LAST,
          dl.id DESC
        LIMIT 1
      ) incharge_doc ON true
      LEFT JOIN spclties sp ON sp.id = i.spclty_id
      LEFT JOIN pttypes pt ON pt.id = i.pttype_id
      LEFT JOIN ipd_severes sev ON sev.id = i.ipd_severe_id
      LEFT JOIN ipd_admit_types at ON at.id = i.ipd_admit_type_id
      WHERE i.id = $1
    `, [ipdId]);

    if (ptRes.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ป่วยในระบบ' });
    }
    const patient = ptRes.rows[0];

    // 2. Allergies & Bed Moves History
    const [allergyRes, bedMovesRes] = await Promise.all([
      pool.query(`
        SELECT id, agent, symptom, relation_level, report_date, note
        FROM patient_allergies
        WHERE patient_id = $1 OR TRIM(hn) = $2
        ORDER BY report_date DESC NULLS LAST, id DESC
      `, [patient.patient_id, patient.hn]),
      pool.query(`
        SELECT bm.id, bm.movedate, bm.movetime, bm.ward_id,
               TRIM(COALESCE(w.name, '')) AS ward_name,
               TRIM(COALESCE(b.bed_name, b.bed_code, '-')) AS bed_no,
               TRIM(COALESCE(r.room_name, '')) AS room_name,
               bmt.bedmove_type_name AS move_type_name
        FROM ipd_bedmoves bm
        LEFT JOIN wards w ON w.id = bm.ward_id
        LEFT JOIN beds b ON b.id = bm.bed_id
        LEFT JOIN rooms r ON r.id = b.room_id
        LEFT JOIN ipd_bedmove_types bmt ON bmt.id = bm.bedmove_type_id
        WHERE bm.ipd_id = $1 AND bm.deleted_at IS NULL
        ORDER BY bm.movedate DESC NULLS LAST, bm.movetime DESC NULLS LAST, bm.id DESC
      `, [ipdId])
    ]);

    // 3. Vital Signs History (full timeline + latest per item)
    const [latestVsRes, historyVsRes, scoringRes] = await Promise.all([
      pool.query(`
        SELECT DISTINCT ON (gsd.vitalsign_item_id)
               gsm.vitalsign_date, gsd.vtime, gsd.slot_id, gsd.vitalsign_item_id,
               vi.item_ename, vi.item_display, gsd.value, gsd.created_at
        FROM ipd_graphic_sheet_masters gsm
        JOIN ipd_graphic_sheet_details gsd ON gsd.ipd_graphic_sheet_master_id = gsm.id
        JOIN vitalsign_items vi ON vi.id = gsd.vitalsign_item_id
        WHERE gsm.ipd_id = $1 AND gsm.deleted_at IS NULL
          AND gsd.vitalsign_item_id IN (1, 2, 3, 4, 5, 6, 7, 8, 9)
          AND gsd.value IS NOT NULL AND TRIM(gsd.value) <> ''
        ORDER BY gsd.vitalsign_item_id,
                 gsm.vitalsign_date DESC,
                 gsd.vtime DESC NULLS LAST,
                 gsd.slot_id DESC NULLS LAST,
                 gsd.id DESC
      `, [ipdId]),
      pool.query(`
        SELECT gsm.id AS master_id, gsm.vitalsign_date, gsd.vtime, gsd.slot_id,
               gsd.vitalsign_item_id, vi.item_ename, vi.item_display, gsd.value,
               ns.nurse_shift_name, gsd.created_at
        FROM ipd_graphic_sheet_masters gsm
        JOIN ipd_graphic_sheet_details gsd ON gsd.ipd_graphic_sheet_master_id = gsm.id
        JOIN vitalsign_items vi ON vi.id = gsd.vitalsign_item_id
        LEFT JOIN ipd_nurse_shifts ns ON ns.id = gsd.ipd_nurse_shift_id
        WHERE gsm.ipd_id = $1 AND gsm.deleted_at IS NULL
          AND gsd.vitalsign_item_id IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 20)
          AND gsd.value IS NOT NULL AND TRIM(gsd.value) <> ''
        ORDER BY gsm.vitalsign_date DESC,
                 COALESCE(gsd.vtime::text, LPAD(COALESCE(gsd.slot_id, 0)::text, 2, '0') || ':00:00') DESC,
                 gsd.slot_id DESC NULLS LAST,
                 gsd.vitalsign_item_id ASC
        LIMIT 300
      `, [ipdId]),
      pool.query(`
        SELECT cs.id, cs.score_date, cs.score_time, cs.nurse_shift_date, cs.score, cs.note,
               cst.name AS scoring_name, cst.short_name,
               csr.name AS result_name,
               ns.nurse_shift_name,
               TRIM(COALESCE(u.name, '')) AS created_by_name
        FROM ipd_clinical_scorings cs
        LEFT JOIN ipd_clinical_scoring_types cst ON cst.id = cs.clinical_scoring_type_id
        LEFT JOIN ipd_clinical_scoring_results csr ON csr.id = cs.clinical_scoring_result_id
        LEFT JOIN ipd_nurse_shifts ns ON ns.id = cs.ipd_nurse_shift_id
        LEFT JOIN users u ON u.id = cs.created_by
        WHERE cs.ipd_id = $1 AND cs.deleted_at IS NULL
        ORDER BY COALESCE(cs.score_date, cs.nurse_shift_date) DESC NULLS LAST, cs.score_time DESC NULLS LAST, cs.id DESC
        LIMIT 50
      `, [ipdId])
    ]);

    // 4. Nurse Notes
    const [nurseNotesRes, nurseSummariesRes] = await Promise.all([
      pool.query(`
        SELECT nn.id, nn.diag_date, nn.diag_time, nn.eva_result, nn.note_type_desc,
               nnd.diag_name, nnd.goal,
               ns.nurse_shift_name,
               es.name AS eva_status_name,
               nar.body AS narrative_body,
               nl.lab_text,
               TRIM(COALESCE(u.name, '')) AS nurse_name,
               COALESCE((
                 SELECT json_agg(json_build_object('asses_name', nna.asses_name, 'asses_value', inna.asses_value, 'unit', nna.unit))
                 FROM ipd_nurse_note_asses inna
                 LEFT JOIN nurse_note_asses nna ON nna.id = inna.nurse_note_asses_id
                 WHERE inna.ipd_nurse_note_id = nn.id
               ), '[]'::json) AS assessments,
               COALESCE((
                 SELECT json_agg(json_build_object('inter_name', nni.inter_name, 'inter_value', inni.inter_value, 'unit', nni.unit))
                 FROM ipd_nurse_note_inters inni
                 LEFT JOIN nurse_note_inters nni ON nni.id = inni.nurse_note_inter_id
                 WHERE inni.ipd_nurse_note_id = nn.id
               ), '[]'::json) AS interventions,
               COALESCE((
                 SELECT json_agg(json_build_object('sdiag_name', nns.sdiag_name))
                 FROM ipd_nurse_note_sdiags inns
                 LEFT JOIN nurse_note_sdiags nns ON nns.id = inns.nurse_note_sdiag_id
                 WHERE inns.ipd_nurse_note_id = nn.id
               ), '[]'::json) AS sub_diags
        FROM ipd_nurse_notes nn
        LEFT JOIN nurse_note_diags nnd ON nnd.id = nn.nurse_note_diag_id
        LEFT JOIN ipd_nurse_shifts ns ON ns.id = nn.ipd_nurse_shift_id
        LEFT JOIN nurse_note_eva_statuses es ON es.id = nn.nurse_note_eva_status_id
        LEFT JOIN mnrh_nurse_note_narratives nar ON nar.ipd_nurse_note_id = nn.id
        LEFT JOIN mnrh_nurse_note_labs nl ON nl.ipd_nurse_note_id = nn.id
        LEFT JOIN users u ON u.id = nn.created_by
        WHERE nn.ipd_id = $1 AND nn.deleted_at IS NULL
        ORDER BY nn.diag_date DESC NULLS LAST, nn.diag_time DESC NULLS LAST, nn.id DESC
        LIMIT 100
      `, [ipdId]),
      pool.query(`
        SELECT s.id, s.note_at, s.body, TRIM(COALESCE(u.name, '')) AS nurse_name
        FROM mnrh_nurse_note_summaries s
        LEFT JOIN users u ON u.id = s.created_by
        WHERE s.ipd_id = $1 AND s.deleted_at IS NULL
        ORDER BY s.note_at DESC NULLS LAST, s.id DESC
      `, [ipdId])
    ]);

    // 5. Lab Orders & Results
    const [labOrdersRes, labResultsRes] = await Promise.all([
      pool.query(`
        SELECT d.id AS order_id, dom.order_date, dom.order_time,
               COALESCE(lab.lab_set_name, d.order_desc) AS lab_name,
               lab.is_tmr, lab.order_date AS target_date,
               d.other, d.order_type,
               TRIM(COALESCE(o.fullname, u.name, '')) AS doctor_name
        FROM doctor_order_masters dom
        JOIN doctor_orders d ON d.doctor_order_master_id = dom.id AND d.deleted_at IS NULL
        LEFT JOIN doctor_order_labs lab ON lab.id = d.ref_id
        LEFT JOIN users u ON u.id = dom.created_by
        LEFT JOIN officers o ON o.id = u.officer_id
        WHERE dom.ipd_id = $1 AND dom.deleted_at IS NULL AND d.doctor_order_type_id = 6
        ORDER BY dom.order_date DESC, dom.order_time DESC, d.id DESC
      `, [ipdId]),
      pool.query(`
        SELECT lr.id, lr.result_date, lr.result_time, lr.lab_result, lr.abnormal, lr.lab_result_status,
               hl.lab_name, hl.lab_items_unit, hl.lab_items_normal_value
        FROM lab_results lr
        LEFT JOIN his_labs hl ON hl.id = lr.lab_item_id
        WHERE lr.ipd_id = $1
        ORDER BY lr.result_date DESC NULLS LAST, lr.result_time DESC NULLS LAST, lr.id DESC
      `, [ipdId])
    ]);

    // 6. X-Ray Orders & Results
    const [xrayOrdersRes, xrayResultsRes] = await Promise.all([
      pool.query(`
        SELECT d.id AS order_id, dom.order_date, dom.order_time,
               COALESCE(rad.xray_set_name, d.order_desc) AS xray_name,
               rad.xn, rad.clinical_info, rad.clinical_diag,
               xp.priority_name,
               d.other, d.order_type,
               TRIM(COALESCE(o.fullname, u.name, '')) AS doctor_name
        FROM doctor_order_masters dom
        JOIN doctor_orders d ON d.doctor_order_master_id = dom.id AND d.deleted_at IS NULL
        LEFT JOIN doctor_order_rads rad ON rad.id = d.ref_id
        LEFT JOIN xray_priorities xp ON xp.id = rad.xray_priority_id
        LEFT JOIN users u ON u.id = dom.created_by
        LEFT JOIN officers o ON o.id = u.officer_id
        WHERE dom.ipd_id = $1 AND dom.deleted_at IS NULL AND d.doctor_order_type_id = 7
        ORDER BY dom.order_date DESC, dom.order_time DESC, d.id DESC
      `, [ipdId]),
      pool.query(`
        SELECT xr.id, xr.xn, xr.request_date, xr.request_time, xr.clinical_information,
               xr.report_date, xr.report_time, xr.report_text, xr.confirm
        FROM xray_results xr
        WHERE xr.ipd_id = $1
        ORDER BY xr.request_date DESC NULLS LAST, xr.request_time DESC NULLS LAST, xr.id DESC
      `, [ipdId])
    ]);

    // 7. Procedures & Invasive Devices / Records
    const [ipdProcRes, orderProcRes, recordListsRes] = await Promise.all([
      pool.query(`
        SELECT pr.id, pr.pdate, pr.ptime, pr.end_date, pr.end_time, pr.note,
               ic.code AS icd9_code, ic.icd9cm, ic.print_text, ic.search_text,
               sp.name AS spclty_name,
               TRIM(COALESCE(u.name, '')) AS created_by_name
        FROM ipd_procedures pr
        LEFT JOIN icd9s ic ON ic.id = pr.icd9_id
        LEFT JOIN spclties sp ON sp.id = pr.spclty_id
        LEFT JOIN users u ON u.id = pr.created_by
        WHERE pr.ipd_id = $1 AND pr.deleted_at IS NULL
        ORDER BY pr.pdate DESC NULLS LAST, pr.ptime DESC NULLS LAST, pr.id DESC
      `, [ipdId]),
      pool.query(`
        SELECT dop.id, dop.note, dop.created_at,
               d.order_desc, d.other, dom.order_date, dom.order_time,
               TRIM(COALESCE(u.name, '')) AS created_by_name
        FROM doctor_order_procedures dop
        JOIN doctor_orders d ON d.id = dop.doctor_order_id AND d.deleted_at IS NULL
        JOIN doctor_order_masters dom ON dom.id = d.doctor_order_master_id AND dom.deleted_at IS NULL
        LEFT JOIN users u ON u.id = dop.created_by
        WHERE dom.ipd_id = $1 AND dop.deleted_at IS NULL
        ORDER BY dom.order_date DESC, dom.order_time DESC, dop.id DESC
      `, [ipdId]),
      pool.query(`
        SELECT rl.id, rl.started_at, rl.ended_at, rl.duration, rl.remark,
               rec.record_name,
               TRIM(COALESCE(u.name, '')) AS created_by_name
        FROM ipd_record_lists rl
        LEFT JOIN ipd_records rec ON rec.id = rl.ipd_record_id
        LEFT JOIN users u ON u.id = rl.created_by
        WHERE rl.ipd_id = $1 AND rl.deleted_at IS NULL
        ORDER BY rl.started_at DESC NULLS LAST, rl.id DESC
      `, [ipdId])
    ]);

    // 8. Documents (Chart Docs, Assessments, Paper Scans, Consults)
    const [chartDocsRes, asmsRes, paperScansRes, consultsRes] = await Promise.all([
      pool.query(`
        SELECT cd.id, cd.doc_key, cd.doc_date, cd.doc_time, cd.data, cd.signed_at,
               TRIM(COALESCE(u.name, '')) AS created_by_name
        FROM mnrh_nurse_chart_docs cd
        LEFT JOIN users u ON u.id = cd.created_by
        WHERE cd.ipd_id = $1 AND cd.deleted_at IS NULL
        ORDER BY cd.doc_date DESC NULLS LAST, cd.doc_time DESC NULLS LAST, cd.id DESC
      `, [ipdId]),
      pool.query(`
        SELECT a.id, a.asm_date, a.asm_time, a.note, a.saved_at,
               fa.asm_name,
               ns.nurse_shift_name,
               TRIM(COALESCE(u.name, '')) AS created_by_name,
               COALESCE((
                 SELECT json_agg(json_build_object(
                   'label', COALESCE(fad.web_label, fad.report_label, ''),
                   'value', COALESCE(fav.label, ad.asm_value_text, ad.asm_value, ''),
                   'other', ad.other
                 ) ORDER BY fad.display_order ASC NULLS LAST, ad.id ASC)
                 FROM ipd_asm_details ad
                 LEFT JOIN ipd_form_asm_details fad ON fad.id = ad.ipd_form_asm_detail_id
                 LEFT JOIN ipd_form_asm_values fav ON fav.id::text = ad.ipd_form_asm_value_id
                 WHERE ad.ipd_asm_id = a.id AND ad.deleted_at IS NULL
               ), '[]'::json) AS details
        FROM ipd_asms a
        LEFT JOIN ipd_form_asms fa ON fa.id = a.ipd_asm_form_id
        LEFT JOIN ipd_nurse_shifts ns ON ns.id = a.ipd_nurse_shift_id
        LEFT JOIN users u ON u.id = a.created_by
        WHERE a.ipd_id = $1 AND a.deleted_at IS NULL
        ORDER BY a.asm_date DESC NULLS LAST, a.asm_time DESC NULLS LAST, a.id DESC
      `, [ipdId]),
      pool.query(`
        SELECT ps.id, ps.file_name, ps.note, ps.created_at,
               pt.name AS paper_type_name,
               TRIM(COALESCE(u.name, '')) AS created_by_name
        FROM paper_scans ps
        LEFT JOIN paper_types pt ON pt.id = ps.paper_type_id
        LEFT JOIN users u ON u.id = ps.created_by
        WHERE ps.ipd_id = $1
        ORDER BY ps.created_at DESC, ps.id DESC
      `, [ipdId]),
      pool.query(`
        SELECT con.id, con.clinical_diag, con.clinical_info, con.created_at,
               sp.name AS spclty_name,
               cr.text AS reason_text,
               cn.text AS needed_text,
               TRIM(COALESCE(o.fullname, u.name, '')) AS from_doctor_name
        FROM consults con
        LEFT JOIN spclties sp ON sp.id = con.spclty_id
        LEFT JOIN consult_reasons cr ON cr.id = con.consult_reason_id
        LEFT JOIN consult_neededs cn ON cn.id = con.consult_needed_id
        LEFT JOIN doctor_orders d ON d.id = con.doctor_order_id
        LEFT JOIN doctor_order_masters dom ON dom.id = d.doctor_order_master_id
        LEFT JOIN users u ON u.id = dom.created_by
        LEFT JOIN officers o ON o.id = u.officer_id
        WHERE (dom.ipd_id = $1 OR con.ipd_id = $1) AND con.deleted_at IS NULL
        ORDER BY con.created_at DESC, con.id DESC
      `, [ipdId]).catch(() => ({ rows: [] }))
    ]);

    // 9. Discharge Summary (ipd_dches, ipd_summaries, ipd_diags, ipd_diag_texts,ipd_nurse_dcs)
    const [dchRes, summaryRes, diagsRes, diagTextsRes, homeMedRes] = await Promise.all([
      pool.query(`
        SELECT dch.*,
               dt.name AS dch_type_name,
               ds.name AS dch_status_name,
               dts.name AS dch_type_sub_name,
               TRIM(COALESCE(o_dch.fullname, '')) AS dch_doctor_name,
               TRIM(COALESCE(o_dch.licenseno, o_dch.doctor_code, '')) AS dch_doctor_license,
               TRIM(COALESCE(o_sum.fullname, '')) AS summary_doctor_name
        FROM ipd_dches dch
        LEFT JOIN dch_types dt ON dt.id = dch.dch_type_id
        LEFT JOIN dch_statuses ds ON ds.id = dch.dch_status_id
        LEFT JOIN dch_type_subs dts ON dts.id = dch.dch_type_sub_id
        LEFT JOIN officers o_dch ON o_dch.id = dch.dch_officer_id
        LEFT JOIN officers o_sum ON o_sum.id = dch.summary_dc_officer_id
        WHERE dch.ipd_id = $1 AND dch.deleted_at IS NULL
        ORDER BY dch.id DESC
      `, [ipdId]),
      pool.query(`
        SELECT s.*,
               dt.name AS dch_type_name,
               ds.name AS dch_status_name,
               TRIM(COALESCE(u_doc.name, '')) AS doctor_user_name,
               TRIM(COALESCE(u_cod.name, '')) AS coder_user_name
        FROM ipd_summaries s
        LEFT JOIN dch_types dt ON dt.id = s.dch_type_id
        LEFT JOIN dch_statuses ds ON ds.id = s.dch_status_id
        LEFT JOIN users u_doc ON u_doc.id = s.user_id
        LEFT JOIN users u_cod ON u_cod.id = s.coder_id
        WHERE s.ipd_id = $1
        ORDER BY s.id DESC
      `, [ipdId]),
      pool.query(`
        SELECT dg.id, dg.tab, dg.diag_type_id, dg.code, dg.display_order,
               dt.diag_type_name,
               ic10.print_text AS icd10_name,
               ic9.print_text AS icd9_name,
               TRIM(COALESCE(u.name, '')) AS doctor_name
        FROM ipd_diags dg
        LEFT JOIN diag_types dt ON dt.id = dg.diag_type_id
        LEFT JOIN icd10s ic10 ON ic10.id = dg.diag_id AND dg.tab = 1
        LEFT JOIN icd9s ic9 ON ic9.id = dg.diag_id AND dg.tab = 2
        LEFT JOIN users u ON u.id = dg.doctor_id
        WHERE dg.ipd_id = $1 AND dg.deleted_at IS NULL
        ORDER BY dg.tab ASC, dg.diag_type_id ASC, dg.display_order ASC, dg.id ASC
      `, [ipdId]),
      pool.query(`
        SELECT dgt.id, dgt.tab, dgt.diag_type_id, dgt.diag_text,
               dt.diag_type_name,
               TRIM(COALESCE(u.name, '')) AS created_by_name
        FROM ipd_diag_texts dgt
        LEFT JOIN diag_types dt ON dt.id = dgt.diag_type_id
        LEFT JOIN users u ON u.id = dgt.created_by
        WHERE dgt.ipd_id = $1
        ORDER BY dgt.tab ASC, dgt.diag_type_id ASC, dgt.id ASC
      `, [ipdId]),
      pool.query(`
        SELECT d.id, dom.order_date, dom.order_time,
               COALESCE(med.iname, d.order_desc) AS med_name,
               med.dose, med.qty, med.note,
               TRIM(COALESCE(uu.usage_unit_name, med.usage_unit_code, '')) AS unit_name,
               TRIM(COALESCE(duc.human_text, duc.doctor_text, '')) AS usage_text,
               TRIM(COALESCE(fc.freq_name, fc.freq_for_doctors, '')) AS freq_text
        FROM doctor_order_masters dom
        JOIN doctor_orders d ON d.doctor_order_master_id = dom.id AND d.deleted_at IS NULL
        LEFT JOIN doctor_order_medications med ON med.id = d.ref_id AND med.deleted_at IS NULL
        LEFT JOIN usage_units uu ON LOWER(TRIM(uu.usage_unit_code)) = LOWER(TRIM(med.usage_unit_code))
        LEFT JOIN drug_usage_codes duc ON duc.id = med.drug_usage_code_id
        LEFT JOIN frequency_codes fc ON fc.id = med.frequency_code_id
        WHERE dom.ipd_id = $1 AND dom.deleted_at IS NULL
          AND (d.order_type = 'H' OR dom.homemed IS TRUE)
        ORDER BY dom.order_date DESC, d.id ASC
      `, [ipdId])
    ]);

    // 10. Care Team Doctors (ทีมแพทย์)
    const docTeamRes = await pool.query(`
      SELECT dl.id, dl.active, dl.ipd_doctor_type_id, dl.incharge_date, dl.incharge_time,
             dl.finish_date, dl.finish_time, dl.remark,
             TRIM(COALESCE(o.fullname, '')) AS doctor_name,
             TRIM(COALESCE(o.licenseno, o.doctor_code, '')) AS licenseno,
             TRIM(COALESCE(o.doctor_code, '')) AS doctor_code,
             dt.name AS doctor_type_name,
             sp.name AS spclty_name,
             op.name AS position_name
      FROM ipd_doctor_lists dl
      LEFT JOIN officers o ON o.id = dl.officer_id
      LEFT JOIN ipd_doctor_types dt ON dt.id = dl.ipd_doctor_type_id
      LEFT JOIN spclties sp ON sp.id = o.spclty_id
      LEFT JOIN officer_positions op ON op.id = o.officer_position_id
      WHERE dl.ipd_id = $1 AND dl.deleted_at IS NULL
      ORDER BY
        CASE WHEN dl.ipd_doctor_type_id = 1 THEN 0 ELSE 1 END ASC,
        CASE WHEN dl.active IS TRUE THEN 0 ELSE 1 END ASC,
        dl.incharge_date DESC NULLS LAST,
        dl.incharge_time DESC NULLS LAST,
        dl.id DESC
    `, [ipdId]);

    // 11. Set OR (Operation Orders, OR Cases, OR Returns)
    const [orCasesRes, orOrdersRes, orReturnsRes] = await Promise.all([
      pool.query(`
        SELECT oc.*,
               ou.name AS or_unit_name, ou.short_name AS or_unit_short
        FROM mnrh_nurse_or_cases oc
        LEFT JOIN mnrh_nurse_or_units ou ON ou.id = oc.unit_id
        WHERE oc.ipd_id = $1 OR TRIM(oc.an) = $2
        ORDER BY oc.op_date DESC NULLS LAST, oc.op_time DESC NULLS LAST, oc.id DESC
      `, [ipdId, patient.an]),
      pool.query(`
        SELECT d.id AS order_id, dom.order_date, dom.order_time,
               d.order_desc, d.other, d.order_type, d.off_date, d.off_time,
               TRIM(COALESCE(o.fullname, u.name, '')) AS doctor_name
        FROM doctor_order_masters dom
        JOIN doctor_orders d ON d.doctor_order_master_id = dom.id AND d.deleted_at IS NULL
        LEFT JOIN users u ON u.id = dom.created_by
        LEFT JOIN officers o ON o.id = u.officer_id
        WHERE dom.ipd_id = $1 AND dom.deleted_at IS NULL AND d.doctor_order_type_id = 9
        ORDER BY dom.order_date DESC, dom.order_time DESC, d.id DESC
      `, [ipdId]),
      pool.query(`
        SELECT r.id, r.return_at, r.note, r.icd9_ids, r.procedure_ids,
               TRIM(COALESCE(u.name, '')) AS created_by_name
        FROM mnrh_nurse_or_returns r
        LEFT JOIN users u ON u.id = r.created_by
        WHERE r.ipd_id = $1 AND r.deleted_at IS NULL
        ORDER BY r.return_at DESC NULLS LAST, r.id DESC
      `, [ipdId])
    ]);

    // 12. Progress Notes & Order Summary count for EMR overview
    const progressNotesRes = await pool.query(`
      SELECT pn.id, pn.progress_date, pn.progress_time, pn.title,
             pn.s_note, pn.o_note, pn.a_note, pn.p_note,
             dom.order_date, dom.order_time,
             TRIM(COALESCE(o.fullname, u.name, '')) AS doctor_name
      FROM doctor_orders d
      JOIN doctor_order_masters dom ON dom.id = d.doctor_order_master_id AND dom.deleted_at IS NULL
      JOIN doctor_progress_notes pn ON pn.id = d.ref_id
      LEFT JOIN users u ON u.id = dom.created_by
      LEFT JOIN officers o ON o.id = u.officer_id
      WHERE dom.ipd_id = $1 AND d.deleted_at IS NULL AND d.doctor_order_type_id = 11
      ORDER BY dom.order_date DESC, dom.order_time DESC, pn.id DESC
    `, [ipdId]);

    res.json({
      patient,
      allergies: allergyRes.rows,
      bedMoves: bedMovesRes.rows,
      vitalsLatest: latestVsRes.rows,
      vitalsHistory: historyVsRes.rows,
      clinicalScorings: scoringRes.rows,
      nurseNotes: nurseNotesRes.rows,
      nurseSummaries: nurseSummariesRes.rows,
      labOrders: labOrdersRes.rows,
      labResults: labResultsRes.rows,
      xrayOrders: xrayOrdersRes.rows,
      xrayResults: xrayResultsRes.rows,
      procedures: ipdProcRes.rows,
      orderProcedures: orderProcRes.rows,
      records: recordListsRes.rows,
      chartDocs: chartDocsRes.rows,
      assessments: asmsRes.rows,
      paperScans: paperScansRes.rows,
      consults: consultsRes.rows,
      discharges: dchRes.rows,
      summaries: summaryRes.rows,
      diagnoses: diagsRes.rows,
      diagTexts: diagTextsRes.rows,
      homeMeds: homeMedRes.rows,
      doctors: docTeamRes.rows,
      orCases: orCasesRes.rows,
      orOrders: orOrdersRes.rows,
      orReturns: orReturnsRes.rows,
      progressNotes: progressNotesRes.rows
    });
  } catch (err) {
    console.error('Get patient EMR error:', err);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลเวชระเบียน (EMR) ได้: ' + err.message });
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
