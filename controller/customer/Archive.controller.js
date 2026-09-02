const dateFormat = require("dateformat");
const logger = require('../../model/LoggerModel');
const { db_Select } = require("../../model/Master.model");

const upload_to_archive = async (req, res) => {
  try {
    const page_data = {
      title: "Upload to Archive",
      page_path: "archive/upload_to_archive.ejs",
      dtFormat: dateFormat,
    };
    res.render("common/layouts/main", page_data);
  } catch (err) {
    logger.error(err);
    res.redirect("/login");
  }
};

const get_unbilled_archive = async (req, res) => {
  try {
    var custId = (req.session.user && req.session.user.user_data)
      ? req.session.user.user_data.customer_id
      : (req.session.user && req.session.user.userData)
        ? req.session.user.userData.customer_id
        : 0;

    var select = `a.receipt_no, a.date_time_in, a.device_id, d.vehicle_name, a.vehicle_no, f.operator_name, IFNULL(g.advance_amt, 0) AS advance_amt`,
      table_name = `td_vehicle_in a JOIN  md_vehicle d ON  a.vehicle_id=d.vehicle_id
        JOIN md_user e  ON a.user_id_in=e.id 
        JOIN md_operator f ON e.user_id=f.user_id
        LEFT JOIN td_receipt g ON a.receipt_no = g.receipt_no`,
      whr = `a.car_out_flag = 'N' AND a.customer_id = '${custId}'`,
      order = "ORDER BY a.receipt_no";

    var res_dt = await db_Select(select, table_name, whr, order);
    res.send(res_dt);
  } catch (err) {
    logger.error(err);
    res.send({ suc: 0, msg: [], error: err.message });
  }
};

const chunkArray = (arr, size) => {
  var chunks = [];
  for (var i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const save_unbilled_archive = async (req, res) => {
  try {
    var custId = (req.session.user && req.session.user.user_data)
      ? req.session.user.user_data.customer_id
      : (req.session.user && req.session.user.userData)
        ? req.session.user.userData.customer_id
        : 0;

    var { receipt_nos } = req.body;

    if (!receipt_nos || (Array.isArray(receipt_nos) && receipt_nos.length === 0)) {
      return res.send({ suc: 0, msg: "No receipts selected for archive." });
    }

    var receipts = Array.isArray(receipt_nos) ? receipt_nos : [receipt_nos];
    var chunks = chunkArray(receipts, 500);

    for (var i = 0; i < chunks.length; i++) {
      var chunk = chunks[i];
      var receiptsList = chunk.map(r => `'${r.toString().replace(/'/g, "\\'")}'`).join(',');

      var insertSql = `
        INSERT INTO td_vehicle_in_arc
        SELECT * 
        FROM td_vehicle_in
        WHERE customer_id = '${custId}'
        AND receipt_no IN (${receiptsList})
      `;
      var insertRes = await db_Select(null, null, null, null, true, insertSql);

      if (insertRes && insertRes.suc > 0) {
        var deleteSql = `
          DELETE FROM td_vehicle_in
          WHERE customer_id = '${custId}'
          AND receipt_no IN (${receiptsList})
        `;
        await db_Select(null, null, null, null, true, deleteSql);
      }
    }

    return res.send({ suc: 1, msg: `${receipts.length} unbilled record(s) uploaded to archive successfully!` });
  } catch (err) {
    logger.error(err);
    return res.send({ suc: 0, msg: "Error archiving records: " + err.message });
  }
};

const get_billed_archive = async (req, res) => {
  try {
    var custId = (req.session.user && req.session.user.user_data)
      ? req.session.user.user_data.customer_id
      : (req.session.user && req.session.user.userData)
        ? req.session.user.userData.customer_id
        : 0;

    var { frm_dt, to_dt } = req.body;

    var select = `a.receipt_no, a.date_time_in, a.device_id, d.vehicle_name, a.vehicle_no, f.operator_name, IFNULL(g.paid_amt, IFNULL(g.advance_amt, 0)) AS advance_amt`,
      table_name = `td_vehicle_in_bkp a JOIN md_vehicle d ON a.vehicle_id=d.vehicle_id
        JOIN md_user e ON a.user_id_in=e.id 
        JOIN md_operator f ON e.user_id=f.user_id
        LEFT JOIN td_receipt_bkp g ON a.receipt_no = g.receipt_no`,
      whr = `a.car_out_flag = 'Y' AND a.customer_id = '${custId}'`,
      order = "ORDER BY a.receipt_no";

    if (frm_dt && to_dt) {
      var formattedFrmDt = frm_dt.includes('T') ? frm_dt.replace('T', ' ') : (frm_dt.length === 10 ? `${frm_dt} 00:00:00` : frm_dt);
      var formattedToDt = to_dt.includes('T') ? to_dt.replace('T', ' ') : (to_dt.length === 10 ? `${to_dt} 23:59:59` : to_dt);
      whr += ` AND a.date_time_in BETWEEN '${formattedFrmDt}' AND '${formattedToDt}'`;
    }

    var res_dt = await db_Select(select, table_name, whr, order);
    res.send(res_dt);
  } catch (err) {
    logger.error(err);
    res.send({ suc: 0, msg: [], error: err.message });
  }
};

const save_billed_archive = async (req, res) => {
  try {
    var custId = (req.session.user && req.session.user.user_data)
      ? req.session.user.user_data.customer_id
      : (req.session.user && req.session.user.userData)
        ? req.session.user.userData.customer_id
        : 0;

    var { receipt_nos } = req.body;

    if (!receipt_nos || (Array.isArray(receipt_nos) && receipt_nos.length === 0)) {
      return res.send({ suc: 0, msg: "No receipts selected for archive." });
    }

    var receipts = Array.isArray(receipt_nos) ? receipt_nos : [receipt_nos];
    var chunks = chunkArray(receipts, 500);

    for (var i = 0; i < chunks.length; i++) {
      var chunk = chunks[i];
      var receiptsList = chunk.map(r => `'${r.toString().replace(/'/g, "\\'")}'`).join(',');

      // 1. Insert into td_vehicle_in_arc
      var insertInArcSql = `
        INSERT INTO td_vehicle_in_arc
        SELECT * 
        FROM td_vehicle_in_bkp
        WHERE customer_id = '${custId}'
        AND receipt_no IN (${receiptsList})
      `;
      var resInArc = await db_Select(null, null, null, null, true, insertInArcSql);

      if (resInArc && resInArc.suc > 0) {
        // 2. Insert into td_vehicle_out_arc
        var insertOutArcSql = `
          INSERT INTO td_vehicle_out_arc
          SELECT *
          FROM td_vehicle_out_bkp
          WHERE receipt_no IN (${receiptsList})
        `;
        await db_Select(null, null, null, null, true, insertOutArcSql);

        // 3. Insert into td_receipt_arc
        var insertReceiptArcSql = `
          INSERT INTO td_receipt_arc
          SELECT *
          FROM td_receipt_bkp
          WHERE receipt_no IN (${receiptsList})
        `;
        await db_Select(null, null, null, null, true, insertReceiptArcSql);

        // 4. Delete from td_vehicle_out_bkp
        var deleteOutSql = `
          DELETE FROM td_vehicle_out_bkp
          WHERE receipt_no IN (${receiptsList})
        `;
        await db_Select(null, null, null, null, true, deleteOutSql);

        // 5. Delete from td_receipt_bkp
        var deleteReceiptSql = `
          DELETE FROM td_receipt_bkp
          WHERE receipt_no IN (${receiptsList})
        `;
        await db_Select(null, null, null, null, true, deleteReceiptSql);

        // 6. Delete from td_vehicle_in_bkp
        var deleteInSql = `
          DELETE FROM td_vehicle_in_bkp
          WHERE customer_id = '${custId}'
          AND receipt_no IN (${receiptsList})
        `;
        await db_Select(null, null, null, null, true, deleteInSql);
      }
    }

    return res.send({ suc: 1, msg: `${receipts.length} billed record(s) uploaded to archive successfully!` });
  } catch (err) {
    logger.error(err);
    return res.send({ suc: 0, msg: "Error archiving billed records: " + err.message });
  }
};

module.exports = {
  upload_to_archive,
  get_unbilled_archive,
  get_billed_archive,
  save_unbilled_archive,
  save_billed_archive,
};
