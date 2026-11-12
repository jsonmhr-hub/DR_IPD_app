const sql = require('mssql');

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

async function getPatientVisits(hn) {
  const clean = formatHn(hn);
  if (!clean) return [];
  const pool = await getHisPool();
  if (!pool) return [];

  try {
    const q = await pool.request()
      .input('hn', sql.NVarChar, clean)
      .query(`
        SELECT 
            T.*, 
            RTRIM(LTRIM(d.docName)) + ' ' + RTRIM(LTRIM(d.docLName)) AS doctor_full_name,
            Q.deptCode,
            D.deptDesc
        FROM [MHR].[dbo].[DoccTreatment] T WITH(NOLOCK)
        LEFT JOIN [MHR].[dbo].[DOCC] d WITH(NOLOCK) ON LTRIM(RTRIM(T.docCode)) = LTRIM(RTRIM(d.docCode))
        LEFT JOIN [MHR].[dbo].[Deptq_d] Q WITH (NOLOCK) ON T.RXNO = Q.rxNo
        LEFT JOIN [MHR].[dbo].[DEPT] D WITH (NOLOCK) ON Q.deptCode = D.deptCode
        WHERE T.hn = @hn
        ORDER BY T.hn desc, T.VisitDate desc
      `);
    return q.recordset || [];
  } catch (err) {
    console.error('[HIS] getPatientVisits error:', err.message);
    return [];
  }
}

async function getVisitVitals(hn, regNo) {
  const clean = formatHn(hn);
  if (!clean) return null;
  const pool = await getHisPool();
  if (!pool) return null;

  try {
    const req = pool.request().input('hn', sql.NVarChar, clean);
    let sqlText = `
      SELECT TOP 1
          S.hn,
          S.RegNo,
          S.RXNO,
          S.VitalSignNo,
          S.Weight,
          S.Height,
          S.Lbloodpress,
          S.Hbloodpress,
          S.Temperature,
          S.Pulse,
          S.Breathe,
          S.Sp02,
          ROUND(S.Weight / NULLIF(((S.Height * S.Height) / 10000), 0), 2) AS BMI
      FROM SSREGIST S WITH (NOLOCK)
      WHERE S.hn = @hn
    `;
    if (regNo) {
      sqlText += ` AND S.RegNo = @regNo `;
      req.input('regNo', sql.NVarChar, regNo);
    }
    sqlText += ` ORDER BY S.VitalSignNo DESC; `;
    const q = await req.query(sqlText);
    return q.recordset && q.recordset[0] ? q.recordset[0] : null;
  } catch (err) {
    console.error('[HIS] getVisitVitals error:', err.message);
    return null;
  }
}

async function getVisitPE(hn, regNo, rxNo) {
  const clean = formatHn(hn);
  if (!clean || !regNo || !rxNo) return [];
  const pool = await getHisPool();
  if (!pool) return [];

  try {
    const q = await pool.request()
      .input('hn', sql.NVarChar, clean)
      .input('regNo', sql.NVarChar, regNo)
      .input('rxNo', sql.NVarChar, rxNo)
      .query(`
select * from(  
SELECT nn,vs.physical_name
,case	when isnull( vs.Normal,'N') = 'Y'  and vs.physical_vs = '' then 'Normal'
		else vs.physical_vs end result
from (
(select top 1 'GA :' physical_name ,isnull(VPE.Normal_GA,s.PE_GA_normal)  as Normal
   ,ISNULL(VPE.GA,
			SUBSTRING(dbo.RTF2TXT_TH(v.Physical_Exam)
			,charindex('[GA]',dbo.RTF2TXT_TH(v.Physical_Exam))+5
			,ABS(charindex('[OTHER]',dbo.RTF2TXT_TH(v.Physical_Exam)) - charindex('[GA]',dbo.RTF2TXT_TH(v.Physical_Exam))-6))) as physical_vs ,v.SYSID,v.RXNO, v.VitalSignNo,v.RegNo ,v.hn  
	,1 as nn    
from VitalSign v (nolock ) left join SSREGIST s (nolock ) on s.hn=v.hn and s.RegNo = v.RegNo
left join VitalSignPE VPE (nolock ) on VPE.Hn = s.hn and VPE.RegNo = s.RegNo and  v.RXNO = VPE.RXNO   
where v.hn = @hn
and v.RegNo = @regNo 
and v.RXNO = @rxNo     
and v.SYSID ='DOCSTN'    
and v.VitalSignNo = (SELECT top 1 vt.VitalSignNo FROM dbo.VitalSign vt (nolock ) where vt.hn = v.hn and vt.RegNo = vt.RegNo and vt.RXNO = v.RXNO and vt.SYSID = 'DOCSTN'order by vt.VitalSignNo desc)
)
union 
(select top 1 'HEENT :' physical_name ,isnull((isnull(VPE.Normal_HEENT,s.PE_Head_normal)),s.PE_Neck_normal)  as Normal
   ,replace(ISNULL(VPE.HEENT,''+
			SUBSTRING(dbo.RTF2TXT_TH(v.Physical_Exam)
			,charindex('[HEAD]',dbo.RTF2TXT_TH(v.Physical_Exam))+7
			,ABS(charindex('[NECK]',dbo.RTF2TXT_TH(v.Physical_Exam))-9)) 
			+'' + SUBSTRING(dbo.RTF2TXT_TH(v.Physical_Exam)
			,charindex('[NECK]',dbo.RTF2TXT_TH(v.Physical_Exam))+7
			,ABS(charindex('[CHEST]',dbo.RTF2TXT_TH(v.Physical_Exam)) - charindex('[NECK]',dbo.RTF2TXT_TH(v.Physical_Exam))-9)))
			,char(10),'')
			 as physical_vs,v.SYSID,v.RXNO, v.VitalSignNo,v.RegNo ,v.hn  
 	,2 as nn  
from VitalSign v (nolock ) left join SSREGIST s (nolock ) on s.hn=v.hn and s.RegNo = v.RegNo
left join VitalSignPE VPE (nolock ) on VPE.Hn = s.hn and VPE.RegNo = s.RegNo and  v.RXNO = VPE.RXNO   
where v.hn = @hn
and v.RegNo = @regNo  
and v.RXNO = @rxNo       
and v.SYSID ='DOCSTN'    
and v.VitalSignNo = (SELECT top 1 vt.VitalSignNo FROM dbo.VitalSign vt (nolock ) where vt.hn = v.hn and vt.RegNo = vt.RegNo and vt.RXNO = v.RXNO and vt.SYSID = 'DOCSTN'order by vt.VitalSignNo desc)
) 
union 
(select top 1 'Heart :' physical_name ,isnull(VPE.Normal_HEART,s.PE_Chest_normal)  as Normal
   ,ISNULL(VPE.HEART,
			SUBSTRING(dbo.RTF2TXT_TH(v.Physical_Exam)
			,charindex('[CHEST]',dbo.RTF2TXT_TH(v.Physical_Exam))+8
			,ABS(charindex('[ABDOMEN]',dbo.RTF2TXT_TH(v.Physical_Exam)) - charindex('[CHEST]',dbo.RTF2TXT_TH(v.Physical_Exam))-9))) as physical_vs,v.SYSID,v.RXNO, v.VitalSignNo,v.RegNo ,v.hn  
 	,3 as nn  
from VitalSign v (nolock ) left join SSREGIST s (nolock ) on s.hn=v.hn and s.RegNo = v.RegNo
left join VitalSignPE VPE (nolock ) on VPE.Hn = s.hn and VPE.RegNo = s.RegNo  and  v.RXNO = VPE.RXNO   
where v.hn = @hn
and v.RegNo = @regNo 
and v.RXNO = @rxNo       
and v.SYSID ='DOCSTN'    
and v.VitalSignNo = (SELECT top 1 vt.VitalSignNo FROM dbo.VitalSign vt (nolock ) where vt.hn = v.hn and vt.RegNo = vt.RegNo and vt.RXNO = v.RXNO and vt.SYSID = 'DOCSTN'order by vt.VitalSignNo desc)
) 
union 
(select top 1 'Lung :' physical_name ,VPE.Normal_LUNG as Normal
,ISNULL(VPE.LUNG,'') as physical_vs,v.SYSID,v.RXNO, v.VitalSignNo,v.RegNo ,v.hn  
 	,4 as nn  
from VitalSign v (nolock ) left join SSREGIST s (nolock ) on s.hn=v.hn and s.RegNo = v.RegNo
left join VitalSignPE VPE (nolock ) on VPE.Hn = s.hn and VPE.RegNo = s.RegNo and  v.RXNO = VPE.RXNO   
where v.hn = @hn
and v.RegNo = @regNo  
and v.RXNO = @rxNo      
and v.SYSID ='DOCSTN'    
and v.VitalSignNo = (SELECT top 1 vt.VitalSignNo FROM dbo.VitalSign vt (nolock ) where vt.hn = v.hn and vt.RegNo = vt.RegNo and vt.RXNO = v.RXNO and vt.SYSID = 'DOCSTN'order by vt.VitalSignNo desc)
)
union 
(select top 1 'Abdomen :' physical_name ,isnull(VPE.Normal_Ab,s.PE_Abdomen_normal)  as Normal
,isnull(VPE.Ab,
			SUBSTRING(dbo.RTF2TXT_TH(v.Physical_Exam)
			,charindex('[ABDOMEN]',dbo.RTF2TXT_TH(v.Physical_Exam))+10
			,ABS(charindex('[EXTRA]',dbo.RTF2TXT_TH(v.Physical_Exam)) - charindex('[ABDOMEN]',dbo.RTF2TXT_TH(v.Physical_Exam))-11))) as physical_vs,v.SYSID,v.RXNO, v.VitalSignNo,v.RegNo ,v.hn  
 	,5 as nn  
from VitalSign v (nolock ) left join SSREGIST s (nolock ) on s.hn=v.hn and s.RegNo = v.RegNo
left join VitalSignPE VPE (nolock ) on VPE.Hn = s.hn and VPE.RegNo = s.RegNo and  v.RXNO = VPE.RXNO   
where v.hn = @hn
and v.RegNo = @regNo 
and v.RXNO = @rxNo       
and v.SYSID ='DOCSTN'    
and v.VitalSignNo = (SELECT top 1 vt.VitalSignNo FROM dbo.VitalSign vt (nolock ) where vt.hn = v.hn and vt.RegNo = vt.RegNo and vt.RXNO = v.RXNO and vt.SYSID = 'DOCSTN'order by vt.VitalSignNo desc)
)
union 
(select top 1 'Extremity :' physical_name ,isnull(VPE.Normal_Ext,s.PE_Extremity_normal)  as Normal
   ,ISNULL(VPE.Ext,
			SUBSTRING(dbo.RTF2TXT_TH(v.Physical_Exam)
			,charindex('[EXTRA]',dbo.RTF2TXT_TH(v.Physical_Exam))+8
			,ABS(charindex('[GA]',dbo.RTF2TXT_TH(v.Physical_Exam)) - charindex('[EXTRA]',dbo.RTF2TXT_TH(v.Physical_Exam))-9))) as physical_vs,v.SYSID,v.RXNO, v.VitalSignNo,v.RegNo ,v.hn  
  	,6 as nn  
from VitalSign v (nolock ) left join SSREGIST s (nolock ) on s.hn=v.hn and s.RegNo = v.RegNo
left join VitalSignPE VPE (nolock ) on VPE.Hn = s.hn and VPE.RegNo = s.RegNo  and  v.RXNO = VPE.RXNO   
where v.hn = @hn
and v.RegNo = @regNo  
and v.RXNO = @rxNo       
and v.SYSID ='DOCSTN'    
and v.VitalSignNo = (SELECT top 1 vt.VitalSignNo FROM dbo.VitalSign vt (nolock ) where vt.hn = v.hn and vt.RegNo = vt.RegNo and vt.RXNO = v.RXNO and vt.SYSID = 'DOCSTN'order by vt.VitalSignNo desc)
)
union 
(select top 1 'Neuro :' physical_name ,VPE.Normal_Neuro as Normal
,ISNULL(VPE.Neuro,'') as physical_vs,v.SYSID,v.RXNO, v.VitalSignNo,v.RegNo ,v.hn  
 	,7 as nn  
from VitalSign v (nolock ) left join SSREGIST s (nolock ) on s.hn=v.hn and s.RegNo = v.RegNo
left join VitalSignPE VPE (nolock ) on VPE.Hn = s.hn and VPE.RegNo = s.RegNo  and  v.RXNO = VPE.RXNO   
where v.hn = @hn
and v.RegNo = @regNo 
and v.RXNO = @rxNo  
and v.SYSID ='DOCSTN'    
and v.VitalSignNo = (SELECT top 1 vt.VitalSignNo FROM dbo.VitalSign vt (nolock ) where vt.hn = v.hn and vt.RegNo = vt.RegNo and vt.RXNO = v.RXNO and vt.SYSID = 'DOCSTN'order by vt.VitalSignNo desc)
)
union 
(select top 1 'Other :' physical_name ,isnull(VPE.Normal_Other,s.PE_Others_normal)  as Normal
,ISNULL(VPE.Other,SUBSTRING(dbo.RTF2TXT_TH(v.Physical_Exam),charindex('[OTHER]'
,dbo.RTF2TXT_TH(v.Physical_Exam))+8,ABS(charindex('[HEART]',dbo.RTF2TXT_TH(v.Physical_Exam)) - charindex('[OTHER]',dbo.RTF2TXT_TH(v.Physical_Exam))-9))) as physical_vs
,v.SYSID,v.RXNO, v.VitalSignNo,v.RegNo ,v.hn  
	,8 as nn  
from VitalSign v (nolock ) left join SSREGIST s (nolock ) on s.hn=v.hn and s.RegNo = v.RegNo
left join VitalSignPE VPE (nolock ) on VPE.Hn = s.hn and VPE.RegNo = s.RegNo and  v.RXNO = VPE.RXNO   
where v.hn = @hn
and v.RegNo = @regNo 
and v.RXNO = @rxNo       
and v.SYSID ='DOCSTN'    
and v.VitalSignNo = (SELECT top 1 vt.VitalSignNo FROM dbo.VitalSign vt (nolock ) where vt.hn = v.hn and vt.RegNo = vt.RegNo and vt.RXNO = v.RXNO and vt.SYSID = 'DOCSTN'order by vt.VitalSignNo desc)
)
) vs
)D where D.result <> ''
order by nn
      `);
    return q.recordset || [];
  } catch (err) {
    console.error('[HIS] getVisitPE error:', err.message);
    return [];
  }
}

async function getVisitLabs(hn, regNo) {
  const clean = formatHn(hn);
  if (!clean || !regNo) return [];
  const pool = await getHisPool();
  if (!pool) return [];

  try {
    const q = await pool.request()
      .input('hn', sql.NVarChar, clean)
      .input('regNo', sql.NVarChar, regNo)
      .query(`
        select distinct o.hn, o.regNo, o.registDate, h.req_no,
        rd.lab_code, rd.lab_name
        from OPD_H o with (nolock)
        left join Labreq_h h with (nolock) on o.hn=h.hn and o.regNo=h.reg_flag
        left join Labreq_d rd with (nolock) on h.req_no=rd.req_no
        where o.hn = @hn and o.regNo = @regNo
        and (isnull(rd.reverse_flag,'')='')
      `);
    return q.recordset || [];
  } catch (err) {
    console.error('[HIS] getVisitLabs error:', err.message);
    return [];
  }
}

async function getVisitXrays(hn, regNo) {
  const clean = formatHn(hn);
  if (!clean || !regNo) return [];
  const pool = await getHisPool();
  if (!pool) return [];

  try {
    const q = await pool.request()
      .input('hn', sql.NVarChar, clean)
      .input('regNo', sql.NVarChar, regNo)
      .query(`
        SELECT 
        convert(char,convert(numeric,convert(char,a.xreq_date,112))+5430000) as date
        ,b.xreq_time
        ,substring(b.xreq_time,1,2)+':'+substring(b.xreq_time,3,2) as 'time_request'
        ,b.hn,b.regist_flag
        ,g.xproc_des
        ,ltrim(rtrim(b.xreq_doc_code)) as xreq_doc_code
        FROM Xreq_d a with (nolock)
        left join Xreq_h b with (nolock) on ((a.xrunno=b.xrunno)and (a.xprefix = b.xprefix) and (a.xreq_date=b.xreq_date))
        left join Xpart f with (nolock) on (a.xpart_code = f.xpart_code)
        left join Xproc g with (nolock) on (f.xpart_code = g.xproc_part and a.xproc_code = g.xproc_code)
        where b.hn = @hn and b.regist_flag = @regNo
        and isnull(a.xrev_flag,'')=''
        order by ltrim(rtrim(b.xreq_doc_code)), g.xproc_des
      `);
    return q.recordset || [];
  } catch (err) {
    console.error('[HIS] getVisitXrays error:', err.message);
    return [];
  }
}

async function getVisitMedicines(hn, regNo, rxNo) {
  const clean = formatHn(hn);
  if (!clean || !regNo || !rxNo) return [];
  const pool = await getHisPool();
  if (!pool) return [];

  try {
    const q = await pool.request()
      .input('hn', sql.NVarChar, clean)
      .input('regNo', sql.NVarChar, regNo)
      .input('rxNo', sql.NVarChar, rxNo)
      .query(`
        select distinct                     
        H.hn, H.regNo
        ,L.remark as rxNo
        ,L.inv_code, UPPER(M.name) as name                       
        ,convert(numeric, L.quant) as qty
        ,isnull([dbo].[chkEyeHow](HOW.lamed_code) 
        + rtrim(case when P.qtyPerFeed = '0' then '' else P.qtyPerFeed end) 
        + rtrim(dbo.chkUnit(UN.lamed_code)) 
        + case when P.lamedTimeText = TM.lamed_name then ' x '+ TM.alias else ' ' + rtrim(isnull(P.lamedTimeText,'')) 
        +' ' + UN.lamed_name end, rtrim(isnull(HOW.lamed_name,''))+ ' ' + rtrim(isnull(case when P.qtyPerFeed ='0' then '' else P.qtyPerFeed end,'')) 
        +' ' +rtrim(isnull(UN.lamed_name,'')) + '  '+ isnull(P.lamedTimeText,'') ) +'  ' +isnull([dbo].[GetLamedDayText](P.lamedDayText),'') as dosagetxt 
        ,IH.reqNo
        ,IH.reqUser
        ,case when IH.reqUser like 'S%' then rtrim(isnull(DC.doctitle,'')) + ' ' + rtrim(isnull(DC.docName,'')) + ' ' + rtrim(DC.docLName) +' / Staff : '
        +rtrim(isnull(DC1.doctitle,'')) + ' ' + rtrim(isnull(DC1.docName,'')) + ' ' + rtrim(DC1.docLName) +'  ' + rtrim(isnull(DC1.doctorID,'')) 
        when DC.doctype not in ('001','002','003','004') or DC.doctype is null then rtrim(isnull(DC1.doctitle,'')) + ' ' + rtrim(isnull(DC1.docName,'')) + ' ' + rtrim(DC1.docLName) +'  ' + rtrim(isnull(DC1.doctorID,'')) 
        else rtrim(isnull(DC.doctitle,'')) + ' ' + rtrim(isnull(DC.docName,'')) + ' ' + rtrim(DC.docLName) +'  ' + rtrim(isnull(DC.doctorID,'')) end as DOCCFullName  
        from Med_logh H (nolock)
        LEFT JOIN Med_log L (nolock) on L.batch_no = H.batch_no
        LEFT JOIN Patmed P (nolock) on P.hn = H.hn and P.registNo = H.regNo and P.invCode = L.inv_code and P.runNo = L.quant_diff
        LEFT JOIN Med_inv M (nolock) on M.code = L.inv_code and M.site ='1'
        LEFT JOIN InvReqH IH (nolock) on IH.hn = H.hn and IH.reqNo = L.reqNo
        LEFT JOIN Lamed HOW (NOLOCK) ON (HOW.lamed_code = P.lamedHow or HOW.lamed_code = '*'+ P.lamedHow)
        LEFT JOIN Lamed UN (NOLOCK) ON (UN.lamed_code = P.lamedUnit or UN.lamed_code = '!'+ P.lamedUnit)
        LEFT JOIN Lamed TM (NOLOCK) ON (TM.lamed_code = P.lamedTime or TM.lamed_code = '&' + P.lamedTime)
        LEFT JOIN DOCC DC ON ltrim(DC.docCode) = ltrim(IH.reqUser) and isnull(DC.hideSelect ,'N') <>'Y'  
        LEFT JOIN DOCC DC1 ON ltrim(DC1.docCode) = ltrim(P.orderDoc) and isnull(DC1.hideSelect ,'N') <>'Y'
        where H.hn = @hn and H.regNo = @regNo and L.remark = @rxNo                                                                                   
        and isnull(L.revFlag,'') not in ('r','R')
        order by L.remark, UPPER(M.name) ASC
      `);
    return q.recordset || [];
  } catch (err) {
    console.error('[HIS] getVisitMedicines error:', err.message);
    return [];
  }
}

async function getVisitFullDetail(hn, regNo, rxNo) {
  const [vitals, pe, labs, xrays, medicines] = await Promise.all([
    getVisitVitals(hn, regNo),
    getVisitPE(hn, regNo, rxNo),
    getVisitLabs(hn, regNo),
    getVisitXrays(hn, regNo),
    getVisitMedicines(hn, regNo, rxNo)
  ]);
  return { vitals, pe, labs, xrays, medicines };
}

module.exports = {
  getHisPool,
  getHisLabDates,
  getHisLabResults,
  getPatientVisits,
  getVisitVitals,
  getVisitPE,
  getVisitLabs,
  getVisitXrays,
  getVisitMedicines,
  getVisitFullDetail,
  formatHn
};

