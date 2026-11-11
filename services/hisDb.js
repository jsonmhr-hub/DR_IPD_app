const sql = require('d:/DR_IPD_app/node_modules/mssql');

const hisConfig = {
  user: process.env.HIS_DB_USERNAME || 'suphot',
  password: process.env.HIS_DB_PASSWORD || '46103879',
  server: process.env.HIS_DB_HOST || '192.168.44.1',
  port: parseInt(process.env.HIS_DB_PORT || '1433', 10),
  database: process.env.HIS_DB_DATABASE || 'MHR',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let hisPool = null;
let hisConnecting = null;

async function getHisPool() {
  if (hisPool && hisPool.connected) {
    return hisPool;
  }
  if (hisConnecting) {
    return hisConnecting;
  }
  hisConnecting = (async () => {
    try {
      const p = new sql.ConnectionPool(hisConfig);
      await p.connect();
      hisPool = p;
      hisConnecting = null;
      console.log('[HIS] Connected to HIS MS SQL Server at ' + hisConfig.server);
      return hisPool;
    } catch (err) {
      hisConnecting = null;
      console.error('[HIS] Connection error:', err.message);
      return null;
    }
  })();
  return hisConnecting;
}

function formatHn(hn) {
  const clean = String(hn || '').trim();
  if (!clean) return '';
  return clean.length < 7 ? clean.padStart(7, ' ') : clean;
}

async function getHisLabDates(hn) {
  const clean = formatHn(hn);
  if (!clean) return [];
  const pool = await getHisPool();
  if (!pool) return [];

  try {
    const q = await pool.request()
      .input('hn', sql.VarChar, clean)
      .query(`
        SELECT DISTINCT
            h.hn,
            h.req_date,
            SUBSTRING(h.req_date, 7, 2) + '-' + SUBSTRING(h.req_date, 5, 2) + '-' + SUBSTRING(h.req_date, 1, 4) AS req_date_display,
            SUBSTRING(h.req_date, 1, 4) + '-' + SUBSTRING(h.req_date, 5, 2) + '-' + SUBSTRING(h.req_date, 7, 2) AS req_date_iso
        FROM Labreq_h h WITH (NOLOCK)
        WHERE h.hn = @hn AND h.labUnit = 'LAB' AND h.lconfirm <> 'Z'
        ORDER BY h.req_date DESC
      `);
    return q.recordset || [];
  } catch (err) {
    console.error('[HIS] getHisLabDates error:', err.message);
    return [];
  }
}

async function getHisLabResults(hn, reqDate = null) {
  const clean = formatHn(hn);
  if (!clean) return [];
  const pool = await getHisPool();
  if (!pool) return [];

  try {
    const dateClauseD = reqDate ? 'AND (ld.date = @reqDate)' : '';
    const dateClauseH = reqDate ? 'AND (h.req_date = @reqDate)' : '';

    const req = pool.request()
      .input('hn1', sql.VarChar, clean)
      .input('hn2', sql.VarChar, clean)
      .input('hn3', sql.VarChar, clean);

    if (reqDate) {
      req.input('reqDate', sql.VarChar, reqDate);
    }

    const queryStr = `
      SELECT DISTINCT
          ROW_NUMBER() OVER(ORDER BY AA.TYPE ASC, AA.GroupName ASC, AA.req_no DESC, AA.GroupSub ASC, AA.GroupRunno ASC, AA.labName ASC) AS row_no,
          AA.Hn AS hn,
          AA.labCode,
          AA.result_name,
          AA.TYPE AS lab_type,
          AA.req_no,
          AA.req_date,
          AA.req_date_display,
          AA.request_time,
          AA.labName,
          AA.remark,
          AA.Lab_result AS lab_result,
          AA.not_normal,
          AA.result_unit,
          AA.normal_range,
          AA.real_res,
          AA.low_normal,
          AA.high_normal,
          AA.resNormal,
          AA.not_normal_low,
          AA.not_normal_high,
          AA.GroupName,
          AA.GroupSub,
          AA.GroupRunno,
          AA.special_comments
      FROM (
          -- 1. Microbiology ที่ยังไม่ออกผล (res_ready = 'N')
          SELECT '' AS Hn, l.labCode, l.labName AS Labname, '' AS Res_item,
          CASE 
              WHEN (ld.lab_type = 'cc') THEN 'Chemistry' 
              WHEN (ld.lab_type = 'imm') THEN 'Immunology' 
              WHEN (ld.lab_type = 'he') THEN 'Hematology' 
              WHEN (ld.lab_type = 'cm') THEN 'Microscopy' 
              WHEN (ld.lab_type = 'bac') THEN 'Microbiology' 
              WHEN (ld.lab_type = 'bb') THEN 'Blood Bank' 
              WHEN (ld.lab_type = 'chk') THEN 'Check Up'
              ELSE 'General'
          END AS TYPE,
          ld.req_no,
          h.req_date,
          SUBSTRING(h.req_date, 7, 2) + '-' + SUBSTRING(h.req_date, 5, 2) + '-' + SUBSTRING(h.req_date, 1, 4) AS req_date_display,
          SUBSTRING(h.req_time, 1, 2) + ':' + SUBSTRING(h.req_time, 3, 2) AS request_time,
          l.labName,
          N'--- ดูผลผ่านระบบ EMR ---' AS result_name,
          '' AS remark,
          '' AS Lab_result,
          'False' AS not_normal,
          '' AS result_unit,
          '' AS normal_range,
          '' AS real_res, '' AS low_normal, '' AS high_normal, '' AS resNormal,
          'False' AS not_normal_low,
          'False' AS not_normal_high,
          '' AS GroupName, '' AS GroupSub, '' AS GroupRunno,
          '' AS special_comments
          FROM Labreq_d ld WITH (NOLOCK)
          LEFT JOIN Labreq_h h WITH (NOLOCK) ON ld.req_no = h.req_no
          LEFT JOIN Lab l WITH (NOLOCK) ON ld.lab_code = l.labCode AND ld.lab_type = l.labType
          WHERE (ld.hn = @hn1) AND (ld.lab_type IN ('bac')) AND h.lconfirm <> 'Z'
            AND (ld.reverse_flag = '' OR ld.reverse_flag IS NULL)
            ${dateClauseD}
            AND (ld.res_ready = 'N') AND (l.labCode NOT IN ('CC023', 'CC024'))
          GROUP BY l.labCode, l.labName, ld.lab_type, ld.req_no, h.req_time, h.req_date

          UNION

          -- 2. กลุ่มอื่นๆ ที่ยังไม่ออกผล (res_ready = 'N')
          SELECT '' AS Hn, l.labCode, l.labName AS Labname, '' AS Res_item,
          CASE 
              WHEN (ld.lab_type = 'cc') THEN 'Chemistry' 
              WHEN (ld.lab_type = 'imm') THEN 'Immunology' 
              WHEN (ld.lab_type = 'he') THEN 'Hematology' 
              WHEN (ld.lab_type = 'cm') THEN 'Microscopy' 
              WHEN (ld.lab_type = 'bac') THEN 'Microbiology' 
              WHEN (ld.lab_type = 'bb') THEN 'Blood Bank' 
              WHEN (ld.lab_type = 'chk') THEN 'Check Up'
              ELSE 'General'
          END AS TYPE,
          ld.req_no,
          h.req_date,
          SUBSTRING(h.req_date, 7, 2) + '-' + SUBSTRING(h.req_date, 5, 2) + '-' + SUBSTRING(h.req_date, 1, 4) AS req_date_display,
          SUBSTRING(h.req_time, 1, 2) + ':' + SUBSTRING(h.req_time, 3, 2) AS request_time,
          l.labName,
          N'--- รอดำเนินการ ---' AS result_name,
          '' AS remark,
          '' AS Lab_result,
          'False' AS not_normal,
          '' AS result_unit,
          '' AS normal_range,
          '' AS real_res, '' AS low_normal, '' AS high_normal, '' AS resNormal,
          'False' AS not_normal_low,
          'False' AS not_normal_high,
          '' AS GroupName, '' AS GroupSub, '' AS GroupRunno,
          '' AS special_comments
          FROM Labreq_d ld WITH (NOLOCK)
          LEFT JOIN Labreq_h h WITH (NOLOCK) ON ld.req_no = h.req_no
          LEFT JOIN Lab l WITH (NOLOCK) ON ld.lab_code = l.labCode AND ld.lab_type = l.labType
          WHERE (ld.hn = @hn2) AND (ld.lab_type IN ('cc', 'cm', 'he', 'imm', 'bb', 'chk')) AND h.lconfirm <> 'Z'
            AND (ld.reverse_flag = '' OR ld.reverse_flag IS NULL)
            ${dateClauseD}
            AND (ld.res_ready = 'N') AND (l.labCode NOT IN ('CC023', 'CC024'))
          GROUP BY l.labCode, l.labName, ld.lab_type, ld.req_no, h.req_time, h.req_date

          UNION

          -- 3. ผลที่ออกแล้วจาก Labres_d
          SELECT r.hn AS Hn, l.labCode, l.labName AS Labname, r.res_item AS Res_item,
          CASE 
              WHEN (l.labType = 'cc') THEN 'Chemistry' 
              WHEN (l.labType = 'imm') THEN 'Immunology' 
              WHEN (l.labType = 'he') THEN 'Hematology' 
              WHEN (l.labType = 'cm') THEN 'Microscopy' 
              WHEN (l.labType = 'bac') THEN 'Microbiology' 
              WHEN (l.labType = 'bb') THEN 'Blood Bank' 
              WHEN (l.labType = 'chk') THEN 'Check Up'
              ELSE 'General'
          END AS TYPE,
          r.req_no,
          h.req_date,
          SUBSTRING(h.req_date, 7, 2) + '-' + SUBSTRING(h.req_date, 5, 2) + '-' + SUBSTRING(h.req_date, 1, 4) AS req_date_display,
          SUBSTRING(h.req_time, 1, 2) + ':' + SUBSTRING(h.req_time, 3, 2) AS request_time,
          l.labName,
          r.result_name AS result_name, r.remark,
          CASE	
              WHEN l.labCode IN ('IMM039', 'IMM048') THEN '###'
              WHEN l.labCode IN ('IMM484', 'IMM485') THEN N'ผลออกแล้วติดต่อดูผลห้องแลป/แพทย์ประจำวอร์ดเพื่อขอดูผล'  
              WHEN l.labCode IN ('IMM033', 'IMM035', 'IMM161', 'IMM086', 'IMM038', 'IMM037', 'IMM036') THEN 
              (
                  CASE 
                      WHEN ISNUMERIC(real_res) = 1 THEN 
                          CASE 
                              WHEN CHARINDEX('.', real_res) > 0 THEN 
                                  CAST(ROUND(CAST(real_res AS FLOAT), 1) AS VARCHAR)
                              ELSE real_res
                          END 
                      ELSE real_res
                  END 
              )
              WHEN s.res_txt_num = 'T' THEN d2.res_text
              ELSE r.real_res
          END AS Lab_result,
          CASE WHEN r.resNormal = 'N' THEN 'True' ELSE 'False' END AS not_normal,
          CASE WHEN s.result_unit IS NULL THEN '' ELSE s.result_unit END AS result_unit,
          CASE 
              WHEN (s.normal_value_mhr IS NULL OR s.normal_value_mhr = '') THEN 
                  CASE 
                      WHEN RTRIM(LTRIM(r.low_normal)) = '999999.999' OR RTRIM(LTRIM(r.high_normal)) = '999999.999' THEN ' '
                      ELSE 'N: ' + RTRIM(LTRIM(r.low_normal)) + ' - ' + RTRIM(LTRIM(r.high_normal))
                  END
              ELSE s.normal_value_mhr
          END AS normal_range,
          r.real_res, r.low_normal, r.high_normal, r.resNormal,
          CASE WHEN 
              (CASE WHEN (r.resNormal = 'N') THEN (CASE WHEN ISNUMERIC(r.real_res) = 1 THEN 'N' ELSE 'Y' END)
                    WHEN (r.resNormal = 'Y') THEN (CASE WHEN ISNUMERIC(r.real_res) = 1 THEN 'Y' ELSE 'Y' END) END) = 'N'
              AND CONVERT(FLOAT, CONVERT(MONEY, r.real_res)) < CONVERT(FLOAT, r.low_normal) 
              THEN 'True' ELSE 'False' END AS not_normal_low,
          CASE WHEN 
              (CASE WHEN (r.resNormal = 'N') THEN (CASE WHEN ISNUMERIC(r.real_res) = 1 THEN 'N' ELSE 'Y' END)
                    WHEN (r.resNormal = 'Y') THEN (CASE WHEN ISNUMERIC(r.real_res) = 1 THEN 'Y' ELSE 'Y' END) END) = 'N'
              AND CONVERT(FLOAT, CONVERT(MONEY, r.real_res)) > CONVERT(FLOAT, r.high_normal) 
              THEN 'True' ELSE 'False' END AS not_normal_high,
          lg.GroupName, lg.GroupSub, lg.GroupRunno,
          ISNULL(RTRIM(LTRIM(s.method_mhr)), '') AS special_comments
          FROM Labres_d r WITH (NOLOCK)
          LEFT JOIN Labreq_h h WITH (NOLOCK) ON r.req_no = h.req_no
          LEFT JOIN lres_d2 d2 WITH (NOLOCK) ON h.req_no = d2.req_no AND r.result_name = d2.result_name
          LEFT JOIN Lab l WITH (NOLOCK) ON r.lab_code = l.labCode AND r.lab_type = l.labType
          LEFT JOIN Labtype lt WITH (NOLOCK) ON l.labType = lt.lab_type
          LEFT JOIN Labre_s s WITH (NOLOCK) ON ((s.labType = r.lab_type) AND (s.lab_code = r.lab_code) AND (s.res_run_no = r.res_item))
          LEFT JOIN LabGroup lg ON r.lab_code = lg.labCode AND r.res_item = lg.res_run_no
          WHERE (r.hn = @hn3) AND (r.lab_type IN ('cc', 'cm', 'he', 'imm', 'bac', 'bb', 'chk')) AND h.lconfirm <> 'Z'
            ${dateClauseH}
            AND (l.labCode NOT IN ('CC023', 'CC024'))
            AND NOT EXISTS (SELECT 1 FROM Labre_s WHERE (s.lab_code = 'HE016' AND s.res_run_no = '02' AND s.lab_code = lab_code AND s.res_run_no = res_run_no))
          GROUP BY r.hn, l.labCode, l.labName, r.res_item, l.labType, s.printSeq, r.req_no, r.result_name, s.res_txt_num,
                   d2.res_text, r.real_res, r.low_normal, r.high_normal, r.resNormal, s.result_unit,
                   lg.GroupName, lg.GroupSub, lg.GroupRunno, method_mhr, h.req_time, h.req_date, r.remark, s.normal_value_mhr
      ) AS AA
      ORDER BY AA.TYPE ASC, AA.GroupName ASC, AA.req_no DESC, AA.GroupSub ASC, AA.GroupRunno ASC, AA.labName ASC
    `;

    const q = await req.query(queryStr);
    return (q.recordset || []).map(r => ({
      hn: (r.hn || '').trim(),
      lab_code: (r.labCode || '').trim(),
      result_name: (r.result_name || '').trim(),
      lab_type: (r.lab_type || 'General').trim(),
      req_no: (r.req_no || '').trim(),
      req_date: (r.req_date || '').trim(),
      req_date_display: (r.req_date_display || '').trim(),
      request_time: (r.request_time || '').trim(),
      lab_name: (r.labName || '').trim(),
      remark: (r.remark || '').trim(),
      lab_result: (r.lab_result || '').trim(),
      not_normal: r.not_normal === 'True',
      result_unit: (r.result_unit || '').trim(),
      normal_range: (r.normal_range || '').trim(),
      real_res: (r.real_res || '').trim(),
      low_normal: (r.low_normal || '').trim(),
      high_normal: (r.high_normal || '').trim(),
      res_normal: (r.resNormal || '').trim(),
      not_normal_low: r.not_normal_low === 'True',
      not_normal_high: r.not_normal_high === 'True',
      group_name: (r.GroupName || '').trim(),
      group_sub: (r.GroupSub || '').trim(),
      group_runno: (r.GroupRunno || '').trim(),
      special_comments: (r.special_comments || '').trim()
    }));
  } catch (err) {
    console.error('[HIS] getHisLabResults error:', err.message);
    return [];
  }
}

module.exports = {
  getHisPool,
  getHisLabDates,
  getHisLabResults,
  formatHn
};

