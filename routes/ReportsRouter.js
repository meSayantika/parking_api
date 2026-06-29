const { AuthCheckedMW } = require("../middleware/AuthChecked.middleware");
const { db_Select } = require("../model/Master.model");

const express = require("express"),
  reportRouter = express.Router(),
  dateFormat = require("dateformat");

reportRouter.get("/", AuthCheckedMW, async (req, res) => {
  res.redirect("/report/unbilled_report");
});

reportRouter.get("/details_report", AuthCheckedMW, async (req, res) => {
  var data = {
    title: "Detail Report",
    page_path: "reports/details_report",
    dtFormat: dateFormat,
  };
  res.render("common/layouts/main", data);
});

reportRouter.get("/details_report_new", AuthCheckedMW, async (req, res) => {
  var data = {
    title: "Detail Report",
    page_path: "reports/detail_report_new.ejs",
    dtFormat: dateFormat,
  };
  res.render("common/layouts/main", data);
});

reportRouter.post("/get_details_report", AuthCheckedMW, async (req, res) => {
  var custId = req.session.user.user_data.customer_id,
    userType = req.session.user.user_data.user_type;

  var data = req.body;
  var select = `receiptNo, date_time_in, mc_srl_no, vehicleType, vehicle_no, opratorName, date_time_out, paid_amt, mc_srl_no_out`,
    table_name = "td_backlog_data",
    whr = `DATE(date_time_out) BETWEEN '${data.frm_dt}' AND '${data.to_dt}'`,
    order = "ORDER BY receiptNo";
  var res_dt = await db_Select(select, table_name, whr, order);
  res.send(res_dt);
});

// reportRouter.post(
//   "/get_details_report_new",
//   AuthCheckedMW,
//   async (req, res) => {
//     var custId = req.session.user.user_data.customer_id,
//       userType = req.session.user.user_data.user_type;

//     var data = req.body;
//     console.log(data,'kk');
    
//     if(data.pay_mode == 'A'){
//       var select = `a.receipt_no, a.date_time_in, a.device_id, d.vehicle_name, a.vehicle_no, b.date_time_out, SEC_TO_TIME(TIMESTAMPDIFF(SECOND, a.date_time_in, b.date_time_out)) AS total_time, b.device_id device_id_out, c.base_amt, c.advance_amt, c.cgst, c.sgst, c.paid_amt, c.pay_mode, f.operator_name`,
//       table_name =
//         "td_vehicle_in a, td_vehicle_out b, td_receipt c, md_vehicle d, md_user e, md_operator f",
//       whr = `a.receipt_no=b.receipt_no AND a.receipt_no=c.receipt_no AND a.vehicle_id=d.vehicle_id AND a.user_id_in=e.id AND e.user_id=f.user_id AND a.car_out_flag = 'Y' AND b.date_time_out BETWEEN '${data.frm_dt}' AND '${data.to_dt}' AND a.customer_id = '${custId}'`,
//       order = "ORDER BY a.receipt_no";
//     var res_dt = await db_Select(select, table_name, whr, order);
//     console.log(res_dt);
//     res.send(res_dt);
//     }else {
//       var select = `a.receipt_no, a.date_time_in, a.device_id, d.vehicle_name, a.vehicle_no, b.date_time_out, SEC_TO_TIME(TIMESTAMPDIFF(SECOND, a.date_time_in, b.date_time_out)) AS total_time, b.device_id device_id_out, c.base_amt, c.advance_amt, c.cgst, c.sgst, c.paid_amt, c.pay_mode, f.operator_name`,
//       table_name =
//         "td_vehicle_in a, td_vehicle_out b, td_receipt c, md_vehicle d, md_user e, md_operator f",
//       whr = `a.receipt_no=b.receipt_no AND a.receipt_no=c.receipt_no AND a.vehicle_id=d.vehicle_id AND a.user_id_in=e.id AND e.user_id=f.user_id AND a.car_out_flag = 'Y' AND b.date_time_out BETWEEN '${data.frm_dt}' AND '${data.to_dt}' AND a.customer_id = '${custId}' AND c.pay_mode = '${data.pay_mode}'`,
//       order = "ORDER BY a.receipt_no";
//     var res_dt = await db_Select(select, table_name, whr, order);
//     console.log(res_dt);
//     res.send(res_dt);
//     }
   
//   }
// );

reportRouter.post(
  "/get_details_report_new",
  AuthCheckedMW,
  async (req, res) => {
    try {
    var custId = req.session.user.user_data.customer_id;
    var data = req.body;

    const start = parseInt(data.start) || 0;
    const length = parseInt(data.length) || 50;
    const search = data["search[value]"] || "";
    const period = data.period || "this_month"; // new

    // TABLE CHANGE BASED ON RADIO
    let vehicle_in_table = "td_vehicle_in";
    let vehicle_out_table = "td_vehicle_out";
    let receipt_table = "td_receipt";

    if (period === "prev_month") {
        vehicle_in_table = "td_vehicle_in_bkp";
        vehicle_out_table = "td_vehicle_out_bkp";
        receipt_table = "td_receipt_bkp";
    }

    // BASE WHERE (common for both modes)
    let baseWhere = `
      a.receipt_no=b.receipt_no 
      AND a.receipt_no=c.receipt_no 
      AND a.vehicle_id=d.vehicle_id 
      AND a.user_id_in=e.id 
      AND e.user_id=f.user_id 
      AND a.car_out_flag='Y'
      AND b.date_time_out BETWEEN '${data.frm_dt}' AND '${data.to_dt}'
    `;

    if (!req.session.user.user_data.is_superadmin) {
      baseWhere += ` AND a.customer_id='${custId}' `;
    }


    //    let baseWhere = `
    //  b.date_time_out BETWEEN '${data.frm_dt}' AND '${data.to_dt}'
    //   AND a.customer_id='${custId}'
    // `;

    // PAY MODE FILTER (A = ALL)
    if (data.pay_mode !== "A") {
      baseWhere += ` AND c.pay_mode='${data.pay_mode}' `;
    }

    // Count total records (without search)
    const totalRec = await db_Select(
      "COUNT(*) as count",
      // "td_vehicle_in a, td_vehicle_out b, td_receipt c, md_vehicle d, md_user e, md_operator f",
      `${vehicle_in_table} a, ${vehicle_out_table} b, ${receipt_table} c, md_vehicle d, md_user e, md_operator f`,
      baseWhere,
      null
    );
    let totalRecords = totalRec.suc > 0 ? totalRec.msg[0].count : 0;

    // APPLY SEARCH
    let whereClause = baseWhere;

    if (search) {
      const safeSearch = search.split("'").join("\\'");
      whereClause += `
        AND (
          a.receipt_no LIKE '%${safeSearch}%' OR
          a.vehicle_no LIKE '%${safeSearch}%' OR
          d.vehicle_name LIKE '%${safeSearch}%' OR
          c.pay_mode LIKE '%${safeSearch}%' OR
          f.operator_name LIKE '%${safeSearch}%'
        )
      `;
    }

    // Count filtered records
    const filteredRec = await db_Select(
      "COUNT(*) as count",
      // "td_vehicle_in a, td_vehicle_out b, td_receipt c, md_vehicle d, md_user e, md_operator f",
      `${vehicle_in_table} a, ${vehicle_out_table} b, ${receipt_table} c, md_vehicle d, md_user e, md_operator f`,
      whereClause,
      null
    );
    let filteredRecords = filteredRec.suc > 0 ? filteredRec.msg[0].count : 0;

    // MAIN SELECT QUERY (WITH PAGINATION)
    const select = `
      a.receipt_no,
      DATE_FORMAT(a.date_time_in,'%d/%m/%Y %H:%i:%s') date_time_in,
      a.device_id,
      d.vehicle_name,
      a.vehicle_no,
      DATE_FORMAT(b.date_time_out,'%d/%m/%Y %H:%i:%s') date_time_out,
      SEC_TO_TIME(TIMESTAMPDIFF(SECOND,a.date_time_in,b.date_time_out)) AS total_time,
      b.device_id device_id_out,
      IFNULL(c.base_amt, 0) AS base_amt,
      IFNULL(c.advance_amt, 0) AS advance_amt,
      IFNULL(c.cgst, 0) AS cgst,
      IFNULL(c.sgst, 0) AS sgst,
      IFNULL(c.igst, 0) AS igst,
      c.paid_amt,
      c.pay_mode,
      f.operator_name
    `;

    // const tableName = `
    //   td_vehicle_in a,td_vehicle_out b,td_receipt c,md_vehicle d, md_user e,md_operator f`;

     const tableName = `
      ${vehicle_in_table} a, ${vehicle_out_table} b, ${receipt_table} c, md_vehicle d, md_user e, md_operator f`;

    const orderLimit = `ORDER BY a.receipt_no LIMIT ${start}, ${length}`;

    const res_dt = await db_Select(select, tableName, whereClause, orderLimit);

     // ---------------------------------------------
    // PAGE TOTALS (based on current page only)
    // ---------------------------------------------

    // const totalsLimit = `ORDER BY a.receipt_no LIMIT ${start}, ${length}`;

    
    const totalsQuery = await db_Select(
  `
   SUM(IFNULL(t.base_amt,0)) AS base_amt,
   SUM(IFNULL(t.advance_amt,0)) AS advance_amt,
   SUM(IFNULL(t.cgst,0)) AS cgst,
   SUM(IFNULL(t.sgst,0)) AS sgst,
   SUM(IFNULL(t.igst,0)) AS igst,
   SUM(t.paid_amt) AS paid_amt,
   SUM(t.base_amt + t.advance_amt + t.cgst + t.sgst + t.igst) AS tot_amt,
   SUM(CASE WHEN UPPER(t.pay_mode)='U' THEN t.paid_amt ELSE 0 END) AS tot_upi,
   SUM(CASE WHEN UPPER(t.pay_mode)='C' THEN t.paid_amt ELSE 0 END) AS tot_cash
  `,
  `
  (
    SELECT 
      IFNULL(c.base_amt, 0) AS base_amt,
      IFNULL(c.advance_amt, 0) AS advance_amt,
      IFNULL(c.cgst, 0) AS cgst,
      IFNULL(c.sgst, 0) AS sgst,
      IFNULL(c.igst, 0) AS igst,
      c.paid_amt,
      c.pay_mode
    FROM ${vehicle_in_table} a
    JOIN ${vehicle_out_table} b ON a.receipt_no=b.receipt_no
    JOIN ${receipt_table} c ON a.receipt_no=c.receipt_no
    JOIN md_vehicle d ON a.vehicle_id=d.vehicle_id
    JOIN md_user e ON a.user_id_in=e.id
    JOIN md_operator f ON e.user_id=f.user_id
    WHERE ${whereClause}
    ORDER BY a.receipt_no
    LIMIT ${start}, ${length}
  ) AS t
  `,
  null,
  null
);

    const totals = totalsQuery.suc > 0 ? totalsQuery.msg[0] : {
      base_amt: 0,
      advance_amt: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      paid_amt: 0,
      tot_amt: 0,
      tot_upi: 0,
      tot_cash: 0
    };

    // ---------------------------------------------------------------
      // GRAND TOTALS (for FULL DATA) — NO LIMIT
      // ---------------------------------------------------------------
      const grandTotalsQuery = await db_Select(
        `
         SUM(IFNULL(c.base_amt,0)) AS base_amt,
         SUM(IFNULL(c.advance_amt,0)) AS advance_amt,
         SUM(IFNULL(c.cgst,0)) AS cgst,
         SUM(IFNULL(c.sgst,0)) AS sgst,
         SUM(IFNULL(c.igst,0)) AS igst,
         SUM(c.paid_amt) AS paid_amt,
         SUM(c.base_amt + c.advance_amt + c.cgst + c.sgst + c.igst) AS tot_amt,
         SUM(CASE WHEN UPPER(c.pay_mode)='U' THEN c.paid_amt ELSE 0 END) AS tot_upi,
         SUM(CASE WHEN UPPER(c.pay_mode)='C' THEN c.paid_amt ELSE 0 END) AS tot_cash
        `,
        `
          ${vehicle_in_table} a
          JOIN ${vehicle_out_table} b ON a.receipt_no=b.receipt_no
          JOIN ${receipt_table} c ON a.receipt_no=c.receipt_no
          JOIN md_vehicle d ON a.vehicle_id=d.vehicle_id
          JOIN md_user e ON a.user_id_in=e.id
          JOIN md_operator f ON e.user_id=f.user_id
        `,
        baseWhere,
        null
      );

      const grandTotals = grandTotalsQuery.suc > 0 ? grandTotalsQuery.msg[0] : {
        base_amt: 0, advance_amt: 0, cgst: 0, sgst: 0, igst: 0, paid_amt: 0,
        tot_amt: 0, tot_upi: 0, tot_cash: 0
      };

    // FINAL JSON RESPONSE FOR DATATABLES
    res.json({
      draw: parseInt(data.draw),
      recordsTotal: totalRecords,
      recordsFiltered: filteredRecords,
      data: res_dt.suc > 0 ? res_dt.msg : [],
      totals,  // TOTALS FOR CURRENT PAGE
      grandTotals  // TOTALS FOR FULL DATA
    });
    
    } catch (err) {
      console.log("ERROR:", err);
      res.status(500).json({ error: "Server error", details: err });
    }
  }
);


// reportRouter.post(
//   "/get_details_report_excel",
//   AuthCheckedMW,
//   async (req, res) => {

//     var custId = req.session.user.user_data.customer_id;
//     var data = req.body;

//     console.log(data, "kkk");

//     let table_name = `td_vehicle_in a, td_vehicle_out b, td_receipt c, md_vehicle d, md_user e, md_operator f`;

//     let whr = `
//       a.receipt_no = b.receipt_no 
//       AND a.receipt_no = c.receipt_no 
//       AND a.vehicle_id = d.vehicle_id 
//       AND a.user_id_in = e.id 
//       AND e.user_id = f.user_id 
//       AND a.car_out_flag = 'Y'
//       AND b.date_time_out BETWEEN '${data.frm_dt}' AND '${data.to_dt}'
//       AND a.customer_id = '${custId}'
//     `;

//     if (data.pay_mode !== "A") {
//       whr += ` AND c.pay_mode = '${data.pay_mode}'`;
//     }

//     let select = `
//       a.receipt_no,
//       DATE_FORMAT(a.date_time_in, '%d/%m/%Y %H:%i:%s') AS date_time_in,
//       a.device_id,
//       d.vehicle_name,
//       a.vehicle_no,
//       DATE_FORMAT(b.date_time_out, '%d/%m/%Y %H:%i:%s') AS date_time_out,
//       SEC_TO_TIME(TIMESTAMPDIFF(SECOND, a.date_time_in, b.date_time_out)) AS total_time,
//       b.device_id AS device_id_out,
//       c.base_amt,
//       c.advance_amt,
//       c.cgst,
//       c.sgst,
//       c.paid_amt,
//       c.pay_mode,
//       f.operator_name
//     `;

//     let order = `ORDER BY a.receipt_no`;

//     // USING YOUR ORIGINAL STYLE
//     let res_dt = await db_Select(select, table_name, whr, order);
//     console.log(res_dt);

//     res.send(res_dt);
//   }
// );

reportRouter.post(
  "/get_details_report_excel",
  AuthCheckedMW,
  async (req, res) => {

    var custId = req.session.user.user_data.customer_id;
    var data = req.body;
    const period = data.period || "this_month";

     // TABLE SWITCH
    let vehicle_in_table = "td_vehicle_in";
    let vehicle_out_table = "td_vehicle_out";
    let receipt_table = "td_receipt";

    if (period === "prev_month") {
        vehicle_in_table = "td_vehicle_in_bkp";
        vehicle_out_table = "td_vehicle_out_bkp";
        receipt_table = "td_receipt_bkp";
    }

     let table_name = `
        ${vehicle_in_table} a,
        ${vehicle_out_table} b,
        ${receipt_table} c,
        md_vehicle d,
        md_user e,
        md_operator f
    `;

    // let table_name = `td_vehicle_in a, td_vehicle_out b, td_receipt c, md_vehicle d, md_user e, md_operator f`;

    let whr = `
      a.receipt_no = b.receipt_no 
      AND a.receipt_no = c.receipt_no 
      AND a.vehicle_id = d.vehicle_id 
      AND a.user_id_in = e.id 
      AND e.user_id = f.user_id 
      AND a.car_out_flag = 'Y'
      AND b.date_time_out BETWEEN '${data.frm_dt}' AND '${data.to_dt}'
    `;

    if (!req.session.user.user_data.is_superadmin) {
      whr += ` AND a.customer_id = '${custId}' `;
    }


    if (data.pay_mode !== "A") {
      whr += ` AND c.pay_mode = '${data.pay_mode}'`;
    }

    // MAIN DATA
    let select = `
      a.receipt_no,
      DATE_FORMAT(a.date_time_in, '%d/%m/%Y %H:%i:%s') AS date_time_in,
      a.device_id,
      d.vehicle_name,
      a.vehicle_no,
      DATE_FORMAT(b.date_time_out, '%d/%m/%Y %H:%i:%s') AS date_time_out,
      SEC_TO_TIME(TIMESTAMPDIFF(SECOND, a.date_time_in, b.date_time_out)) AS total_time,
      b.device_id AS device_id_out,
      IFNULL(c.base_amt, 0) AS base_amt,
      IFNULL(c.advance_amt, 0) AS advance_amt,
      IFNULL(c.cgst, 0) AS cgst,
      IFNULL(c.sgst, 0) AS sgst,
      IFNULL(c.igst, 0) AS igst,
      c.paid_amt,
      c.pay_mode,
      f.operator_name
    `;

    let order = `ORDER BY a.receipt_no`;

    let res_dt = await db_Select(select, table_name, whr, order);

    // TOTAL QUERY ------------------------------------
    let totalSelect = `
      SUM(IFNULL(c.base_amt,0)) AS total_base,
      SUM(IFNULL(c.advance_amt,0)) AS total_advance,
      SUM(IFNULL(c.cgst,0)) AS total_cgst,
      SUM(IFNULL(c.sgst,0)) AS total_sgst,
      SUM(IFNULL(c.igst,0)) AS igst,
      SUM(c.paid_amt) AS total_paid,
      SUM(c.paid_amt + c.advance_amt) AS total_net,
      SUM(CASE WHEN c.pay_mode='C' THEN c.paid_amt ELSE 0 END) AS total_cash,
      SUM(CASE WHEN c.pay_mode='U' THEN c.paid_amt ELSE 0 END) AS total_upi
    `;

    let totals = await db_Select(totalSelect, table_name, whr);

    res.send({
      suc: res_dt.suc,
      data: res_dt.msg,
      totals: totals.msg[0] // <-- all totals in one object
    });
  }
);


reportRouter.get("/unbilled_report", AuthCheckedMW, async (req, res) => {
  var data = {
    title: "Unbilled Report",
    page_path: "reports/unbilled_report.ejs",
    dtFormat: dateFormat,
  };
  res.render("common/layouts/main", data);
});

// reportRouter.post("/get_unbilled_report", AuthCheckedMW, async (req, res) => {
//   var custId = req.session.user.user_data.customer_id,
//     userType = req.session.user.user_data.user_type;

//   var data = req.body;
//   var select = `a.receipt_no, a.date_time_in, a.device_id, d.vehicle_name, a.vehicle_no, f.operator_name, IFNULL(g.advance_amt, 0) AS advance_amt`,
//     table_name = `td_vehicle_in a JOIN  md_vehicle d ON  a.vehicle_id=d.vehicle_id
//         JOIN md_user e  ON a.user_id_in=e.id 
//         JOIN md_operator f ON e.user_id=f.user_id  
//         LEFT JOIN td_receipt g ON a.receipt_no = g.receipt_no`,
//     whr = `a.car_out_flag = 'N' AND a.date_time_in BETWEEN '${data.frm_dt}' AND '${data.to_dt}' AND a.customer_id = '${custId}'`,
//     order = "ORDER BY a.receipt_no";
//   var res_dt = await db_Select(select, table_name, whr, order);
//   res.send(res_dt);
// });

reportRouter.post("/get_unbilled_report", AuthCheckedMW, async (req, res) => {
  var custId = req.session.user.user_data.customer_id,
    userType = req.session.user.user_data.user_type;

  var data = req.body;
  var select = `a.receipt_no, a.date_time_in, a.device_id, d.vehicle_name, a.vehicle_no, f.operator_name, IFNULL(g.advance_amt, 0) AS advance_amt`,
    table_name = `td_vehicle_in a JOIN  md_vehicle d ON  a.vehicle_id=d.vehicle_id
        JOIN md_user e  ON a.user_id_in=e.id 
        JOIN md_operator f ON e.user_id=f.user_id  
        LEFT JOIN td_receipt g ON a.receipt_no = g.receipt_no`,
    whr = `a.car_out_flag = 'N' AND a.date_time_in BETWEEN '${data.frm_dt}' AND '${data.to_dt}'`,
    order = "ORDER BY a.receipt_no";

  if (!req.session.user.user_data.is_superadmin) {
    whr += ` AND a.customer_id = '${custId}' `;
  }

  var res_dt = await db_Select(select, table_name, whr, order);
  res.send(res_dt);
});

reportRouter.get("/veh_wise_repo", AuthCheckedMW, async (req, res) => {
  var data = {
    title: "Veichle Wise Report",
    page_path: "reports/veh_wise_repo",
    dtFormat: dateFormat,
  };
  res.render("common/layouts/main", data);
});

reportRouter.get("/veh_wise_repo_new", AuthCheckedMW, async (req, res) => {
  var data = {
    title: "Veichle Wise Report",
    page_path: "reports/veh_wise_repo_new",
    dtFormat: dateFormat,
  };
  res.render("common/layouts/main", data);
});

reportRouter.post("/get_veh_wise_report", AuthCheckedMW, async (req, res) => {
  var data = req.body;
  var select = `mc_srl_no_out, vehicleType, COUNT(receiptNo) tot_vehi, SUM(paid_amt) tot_amt`,
    table_name = "td_backlog_data",
    whr = `DATE(date_time_out) BETWEEN '${data.frm_dt}' AND '${data.to_dt}'`,
    order = "GROUP BY vehicleType, mc_srl_no_out";
  var res_dt = await db_Select(select, table_name, whr, order);
  res.send(res_dt);
});

reportRouter.post(
  "/get_veh_wise_report_new",
  AuthCheckedMW,
  async (req, res) => {
    var custId = req.session.user.user_data.customer_id;
    var data = req.body;
    const start = parseInt(data.start) || 0;
    const length = parseInt(data.length) || 10;
    const isExport = data.export === 'true';

    var select = `d.vehicle_name vehicleType, COUNT(b.receipt_no) tot_vehi, SUM(c.paid_amt) paid_amt, SUM(c.advance_amt) advance_amt, SUM(c.base_amt) base_amt,SUM(c.cgst) cgst, SUM(c.sgst) sgst, SUM(c.igst) igst`,
      table_name =
        "td_vehicle_in a, td_vehicle_out b, td_receipt c, md_vehicle d",
      whr = `a.receipt_no=b.receipt_no AND a.receipt_no=c.receipt_no AND a.vehicle_id=d.vehicle_id AND a.car_out_flag = 'Y' AND b.date_time_out BETWEEN '${data.frm_dt}' AND '${data.to_dt}'`;

    if (!req.session.user.user_data.is_superadmin) {
      whr += ` AND a.customer_id = '${custId}' `;
    }

    const countQuery = await db_Select("COUNT(DISTINCT a.vehicle_id) as count", table_name, whr, null);
    const recordsTotal = countQuery.suc > 0 ? countQuery.msg[0].count : 0;

    let order = "GROUP BY a.vehicle_id,d.vehicle_name";
    if (!isExport) {
        order += ` LIMIT ${start}, ${length}`;
    }
    var res_dt = await db_Select(select, table_name, whr, order);

    var totalSelect = `COUNT(b.receipt_no) tot_vehi, SUM(c.paid_amt) paid_amt, SUM(c.advance_amt) advance_amt, SUM(c.base_amt) base_amt, SUM(c.cgst) cgst, SUM(c.sgst) sgst, SUM(c.igst) igst`;
    var totals_dt = await db_Select(totalSelect, table_name, whr, null);
    var totals = totals_dt.suc > 0 ? totals_dt.msg[0] : { tot_vehi: 0, paid_amt: 0, advance_amt: 0, base_amt: 0, cgst: 0, sgst: 0, igst: 0 };

    if (isExport) {
        res.send(res_dt);
    } else {
        res.json({
            draw: parseInt(data.draw) || 1,
            recordsTotal: recordsTotal,
            recordsFiltered: recordsTotal,
            data: res_dt.suc > 0 ? res_dt.msg : [],
            totals: totals
        });
    }
  }
);

reportRouter.get("/dev_wise_repo", AuthCheckedMW, async (req, res) => {
  var data = {
    title: "Device Wise Report",
    page_path: "reports/dev_wise_repo",
    dtFormat: dateFormat,
  };
  res.render("common/layouts/main", data);
});

reportRouter.get("/dev_wise_repo_new", AuthCheckedMW, async (req, res) => {
  var data = {
    title: "Device Wise Report",
    page_path: "reports/dev_wise_repo_new",
    dtFormat: dateFormat,
  };
  res.render("common/layouts/main", data);
});

reportRouter.post("/get_dev_wise_report", AuthCheckedMW, async (req, res) => {
  var data = req.body;
  var select = `vehicleType, COUNT(receiptNo) tot_vehi, SUM(paid_amt) tot_amt`,
    table_name = "td_backlog_data",
    whr = `DATE(date_time_out) BETWEEN '${data.frm_dt}' AND '${data.to_dt}'`,
    order = "GROUP BY vehicleType";
  var res_dt = await db_Select(select, table_name, whr, order);
  res.send(res_dt);
});

reportRouter.post(
  "/get_dev_wise_report_new",
  AuthCheckedMW,
  async (req, res) => {
    var custId = req.session.user.user_data.customer_id;
    var data = req.body;
    const start = parseInt(data.start) || 0;
    const length = parseInt(data.length) || 10;
    const isExport = data.export === 'true';

    var select = `b.device_id mc_srl_no_out,COUNT(b.receipt_no) tot_vehi, SUM(c.paid_amt) paid_amt, SUM(c.advance_amt) advance_amt,SUM(c.base_amt) base_amt, SUM(c.cgst) cgst, SUM(c.sgst) sgst, SUM(c.igst) igst`,
      table_name =
        "td_vehicle_in a, td_vehicle_out b, td_receipt c",
      whr = `a.receipt_no=b.receipt_no AND a.receipt_no=c.receipt_no AND a.car_out_flag = 'Y' AND b.date_time_out BETWEEN '${data.frm_dt}' AND '${data.to_dt}'`;

    if (!req.session.user.user_data.is_superadmin) {
      whr += ` AND a.customer_id = '${custId}' `;
    }

    const countQuery = await db_Select("COUNT(DISTINCT b.device_id) as count", table_name, whr, null);
    const recordsTotal = countQuery.suc > 0 ? countQuery.msg[0].count : 0;

    let order = "GROUP BY b.device_id";
    if (!isExport) {
        order += ` LIMIT ${start}, ${length}`;
    }
    var res_dt = await db_Select(select, table_name, whr, order);

    var totalSelect = `COUNT(b.receipt_no) tot_vehi, SUM(c.paid_amt) paid_amt, SUM(c.advance_amt) advance_amt, SUM(c.base_amt) base_amt, SUM(c.cgst) cgst, SUM(c.sgst) sgst, SUM(c.igst) igst`;
    var totals_dt = await db_Select(totalSelect, table_name, whr, null);
    var totals = totals_dt.suc > 0 ? totals_dt.msg[0] : { tot_vehi: 0, paid_amt: 0, advance_amt: 0, base_amt: 0, cgst: 0, sgst: 0, igst: 0 };

    if (isExport) {
        res.send(res_dt);
    } else {
        res.json({
            draw: parseInt(data.draw) || 1,
            recordsTotal: recordsTotal,
            recordsFiltered: recordsTotal,
            data: res_dt.suc > 0 ? res_dt.msg : [],
            totals: totals
        });
    }
  }
);

reportRouter.get("/operator_wise_repo_new", AuthCheckedMW, async (req, res) => {
  var data = {
    title: "Operator Wise Report",
    page_path: "reports/operator_wise_repo_new",
    dtFormat: dateFormat,
  };
  res.render("common/layouts/main", data);
});

// reportRouter.post(
//   "/get_operator_wise_repo_new",
//   AuthCheckedMW,
//   async (req, res) => {
//     var custId = req.session.user.user_data.customer_id,
//       userType = req.session.user.user_data.user_type;

//     var data = req.body;
//     var select = `b.device_id mc_srl_no_out, d.vehicle_name vehicleType, COUNT(b.receipt_no) tot_vehi, SUM(c.paid_amt) paid_amt, SUM(c.advance_amt) as advance_amt,SUM(c.base_amt) base_amt, SUM(c.cgst) cgst, SUM(c.sgst) sgst, f.operator_name opratorName`,
//       table_name =
//         "td_vehicle_in a, td_vehicle_out b, td_receipt c, md_vehicle d, md_user e, md_operator f",
//       whr = `a.receipt_no=b.receipt_no AND a.receipt_no=c.receipt_no AND a.vehicle_id=d.vehicle_id AND a.user_id_in=e.id AND e.user_id=f.user_id AND a.car_out_flag = 'Y' AND b.date_time_out BETWEEN '${data.frm_dt}' AND '${data.to_dt}' AND a.customer_id = '${custId}'`;
//     // order = "GROUP BY a.user_id_in";
//     order = "GROUP BY a.user_id_in,b.device_id,d.vehicle_name,f.operator_name";
//     var res_dt = await db_Select(select, table_name, whr, order);
//     // console.log(res_dt);
//     res.send(res_dt);
//   }
// );

reportRouter.post(
  "/get_operator_wise_repo_new",
  AuthCheckedMW,
  async (req, res) => {
    var custId = req.session.user.user_data.customer_id;
    var data = req.body;
    const start = parseInt(data.start) || 0;
    const length = parseInt(data.length) || 10;
    const isExport = data.export === 'true';

    var select = `a.device_id mc_srl_no_out,e.operator_name opratorName,g.vehicle_name vehicleType,
       COUNT(a.receipt_no) tot_vehi,SUM(b.paid_amt) paid_amt,SUM(b.advance_amt) AS advance_amt,
       SUM(b.base_amt) base_amt,SUM(b.cgst) cgst,SUM(b.sgst) sgst, SUM(b.igst) igst`,
      table_name = "td_vehicle_out a,td_receipt b,md_user d,md_operator e,td_vehicle_in f,md_vehicle g",
      whr = `a.receipt_no = b.receipt_no
             AND a.user_id    = d.id
             AND d.user_id    = e.user_id
             AND a.receipt_no = f.receipt_no
             AND f.vehicle_id = g.vehicle_id
             AND a.date_time_out BETWEEN '${data.frm_dt}' AND '${data.to_dt}'`;
    
    if (!req.session.user.user_data.is_superadmin) {
      whr += ` AND f.customer_id = '${custId}' `;
    }

    const countQuery = await db_Select("COUNT(DISTINCT CONCAT(a.device_id, '-', e.operator_name, '-', g.vehicle_name)) as count", table_name, whr, null);
    const recordsTotal = countQuery.suc > 0 ? countQuery.msg[0].count : 0;

    let order = `GROUP BY a.device_id,e.operator_name,g.vehicle_name ORDER BY opratorName`;
    if (!isExport) {
        order += ` LIMIT ${start}, ${length}`;
    }
    var res_dt = await db_Select(select, table_name, whr, order);

    var totalSelect = `COUNT(a.receipt_no) tot_vehi, SUM(b.paid_amt) paid_amt, SUM(b.advance_amt) advance_amt, SUM(b.base_amt) base_amt, SUM(b.cgst) cgst, SUM(b.sgst) sgst, SUM(b.igst) igst`;
    var totals_dt = await db_Select(totalSelect, table_name, whr, null);
    var totals = totals_dt.suc > 0 ? totals_dt.msg[0] : { tot_vehi: 0, paid_amt: 0, advance_amt: 0, base_amt: 0, cgst: 0, sgst: 0, igst: 0 };

    if (isExport) {
        res.send(res_dt);
    } else {
        res.json({
            draw: parseInt(data.draw) || 1,
            recordsTotal: recordsTotal,
            recordsFiltered: recordsTotal,
            data: res_dt.suc > 0 ? res_dt.msg : [],
            totals: totals
        });
    }
  }
);

reportRouter.get("/combine_repo_new", AuthCheckedMW, async (req, res) => {
  var custId = req.session.user.user_data.customer_id,
    combineData = await db_Select("vehicle_id , customer_id, vehicle_name, vehicle_icon","md_vehicle", req.session.user.user_data.is_superadmin ? null : `customer_id=${custId}`);

  var data = {
    title: "Combine Report (Vehicle)",
    page_path: "reports/combine_report_new",
    dtFormat: dateFormat,
    combineData: combineData,
  };
  res.render("common/layouts/main", data);
});

reportRouter.post("/get_combine_repo_new",  AuthCheckedMW,async (req, res) => {
      var custId = req.session.user.user_data.customer_id;
      var data = req.body;
      const start = parseInt(data.start) || 0;
      const length = parseInt(data.length) || 10;
      const isExport = data.export === 'true';

      var select = `f.operator_name, a.device_id,sum(c.advance_amt)advance_amt,sum(c.paid_amt)paid_amt,SUM(c.base_amt) base_amt,SUM(c.cgst) cgst, SUM(c.sgst) sgst, SUM(c.igst) igst`,
        table_name = "td_vehicle_in a,md_vehicle b,td_receipt c,td_vehicle_out d,md_user e,md_operator f",
        whr = `a.vehicle_id = b.vehicle_id and a.receipt_no = c.receipt_no
        and   a.receipt_no = d.receipt_no and c.user_id = e.id
        and   e.user_id = f.user_id
        and   a.vehicle_id = '${data.vehicle_id}' and d.date_time_out between '${data.frm_dt}' and '${data.to_dt}'`

      if (!req.session.user.user_data.is_superadmin) {
        whr += ` AND a.customer_id = '${custId}' `;
      }

      const countQuery = await db_Select("COUNT(DISTINCT CONCAT(f.operator_name, '-', a.device_id)) as count", table_name, whr, null);
      const recordsTotal = countQuery.suc > 0 ? countQuery.msg[0].count : 0;

      let order = "GROUP BY f.operator_name,a.device_id";
      if (!isExport) {
          order += ` LIMIT ${start}, ${length}`;
      }
      var res_dt = await db_Select(select, table_name, whr, order);

      var totalSelect = `SUM(c.paid_amt) paid_amt, SUM(c.advance_amt) advance_amt, SUM(c.base_amt) base_amt, SUM(c.cgst) cgst, SUM(c.sgst) sgst, SUM(c.igst) igst`;
      var totals_dt = await db_Select(totalSelect, table_name, whr, null);
      var totals = totals_dt.suc > 0 ? totals_dt.msg[0] : { paid_amt: 0, advance_amt: 0, base_amt: 0, cgst: 0, sgst: 0, igst: 0 };

      if (isExport) {
          res.send(res_dt);
      } else {
          res.json({
              draw: parseInt(data.draw) || 1,
              recordsTotal: recordsTotal,
              recordsFiltered: recordsTotal,
              data: res_dt.suc > 0 ? res_dt.msg : [],
              totals: totals
          });
      }
    }
  );

  reportRouter.get("/combine_repo_dev_new", AuthCheckedMW, async (req, res) => {
    var custId = req.session.user.user_data.customer_id,
      combineData_dev = await db_Select("*","md_setting", req.session.user.user_data.is_superadmin ? null : `customer_id=${custId}`);
    var data = {
      title: "Combine Report (Device)",
      page_path: "reports/combine_report_dev_new",
      dtFormat: dateFormat,
      combineData_dev: combineData_dev,
    };
    // console.log(combineData_dev);
    res.render("common/layouts/main", data);
  });

//   reportRouter.post("/get_combine_repo_dev_new",  AuthCheckedMW,async (req, res) => {
//     var custId = req.session.user.user_data.customer_id,
//       userType = req.session.user.user_data.user_type;

//     var data = req.body;
//     var select = `f.operator_name, a.device_id, b.vehicle_name vehicleType, sum(c.advance_amt)advance_amt, sum(c.paid_amt)paid_amt,SUM(c.base_amt) base_amt,SUM(c.cgst) cgst, SUM(c.sgst) sgst`,
//       table_name = "td_vehicle_in a,md_vehicle b,td_receipt c,td_vehicle_out d,md_user e,md_operator f",
//       whr = `a.vehicle_id = b.vehicle_id 
//       and    a.receipt_no = c.receipt_no
//       and    a.receipt_no = d.receipt_no 
//       and    c.user_id = e.id
//       and    e.user_id = f.user_id 
//       and    a.customer_id = '${custId}'
//       and    d.device_id = '${data.device_id}' and d.date_time_out between '${data.frm_dt}' and '${data.to_dt}'`
//       order = "Group BY f.operator_name,a.device_id,b.vehicle_name";
//     var res_dt = await db_Select(select, table_name, whr, order);
//     // console.log(res_dt);
//     res.send(res_dt);
//   }
// );


  reportRouter.post("/get_combine_repo_dev_new",  AuthCheckedMW,async (req, res) => {
    var custId = req.session.user.user_data.customer_id;
    var data = req.body;
    const start = parseInt(data.start) || 0;
    const length = parseInt(data.length) || 10;
    const isExport = data.export === 'true';

    var select = `f.operator_name, d.device_id, b.vehicle_name vehicleType, SUM(c.advance_amt)advance_amt, SUM(c.paid_amt)paid_amt,SUM(c.base_amt) base_amt,SUM(c.cgst) cgst, SUM(c.sgst) sgst, SUM(c.igst) igst`,
      table_name = `td_vehicle_in a JOIN md_vehicle b ON a.vehicle_id = b.vehicle_id
                    JOIN td_receipt c ON a.receipt_no = c.receipt_no
                    JOIN td_vehicle_out d ON a.receipt_no = d.receipt_no
                    JOIN md_user e ON c.user_id = e.id
                    JOIN md_operator f ON e.user_id = f.user_id`,
      whr = ` d.date_time_out between '${data.frm_dt}' and '${data.to_dt}'`;
      
    if (data.device_id) {
       whr += ` AND d.device_id = '${data.device_id}'`;
    }

    if (!req.session.user.user_data.is_superadmin) {
      whr = `a.customer_id = '${custId}' and ` + whr;
    }

    const countQuery = await db_Select("COUNT(DISTINCT CONCAT(f.operator_name, '-', d.device_id, '-', b.vehicle_name)) as count", table_name, whr, null);
    const recordsTotal = countQuery.suc > 0 ? countQuery.msg[0].count : 0;

    let order = "Group BY f.operator_name,d.device_id,b.vehicle_name";
    if (!isExport) {
        order += ` LIMIT ${start}, ${length}`;
    }
    
    var res_dt = await db_Select(select, table_name, whr, order);

    var totalSelect = `SUM(c.paid_amt) paid_amt, SUM(c.advance_amt) advance_amt, SUM(c.base_amt) base_amt, SUM(c.cgst) cgst, SUM(c.sgst) sgst, SUM(c.igst) igst`;
    var totals_dt = await db_Select(totalSelect, table_name, whr, null);
    var totals = totals_dt.suc > 0 ? totals_dt.msg[0] : { paid_amt: 0, advance_amt: 0, base_amt: 0, cgst: 0, sgst: 0, igst: 0 };

    if (isExport) {
        res.send(res_dt);
    } else {
        res.json({
            draw: parseInt(data.draw) || 1,
            recordsTotal: recordsTotal,
            recordsFiltered: recordsTotal,
            data: res_dt.suc > 0 ? res_dt.msg : [],
            totals: totals
        });
    }
  }
);

reportRouter.get("/usr_wise_repo", AuthCheckedMW, async (req, res) => {
  var data = {
    title: "User Wise Report",
    page_path: "reports/usr_wise_repo",
    dtFormat: dateFormat,
  };
  res.render("common/layouts/main", data);
});

reportRouter.get("/usr_wise_repo_new", AuthCheckedMW, async (req, res) => {
  var data = {
    title: "User Wise Report",
    page_path: "reports/usr_wise_repo_new",
    dtFormat: dateFormat,
  };
  res.render("common/layouts/main", data);
});

reportRouter.post("/get_user_wise_report", AuthCheckedMW, async (req, res) => {
  var data = req.body;
  var select = `opratorName, mc_srl_no_out, COUNT(receiptNo) tot_vehi, SUM(paid_amt) tot_amt`,
    table_name = "td_backlog_data",
    whr = `DATE(date_time_out) BETWEEN '${data.frm_dt}' AND '${data.to_dt}'`,
    order = "GROUP BY opratorName, mc_srl_no_out";
  var res_dt = await db_Select(select, table_name, whr, order);
  res.send(res_dt);
});

reportRouter.post(
  "/get_user_wise_report_new",
  AuthCheckedMW,
  async (req, res) => {
    var custId = req.session.user.user_data.customer_id,
      userType = req.session.user.user_data.user_type;

    var data = req.body;
    var select = `b.device_id mc_srl_no_out, d.vehicle_name vehicleType, COUNT(b.receipt_no) tot_vehi, SUM(c.paid_amt) paid_amt, SUM(c.advance_amt) advance_amt,SUM(c.base_amt) base_amt,SUM(c.cgst) cgst, SUM(c.sgst) sgst,  SUM(c.igst) igst, f.operator_name opratorName`,
      table_name =
        "td_vehicle_in a, td_vehicle_out b, td_receipt c, md_vehicle d, md_user e, md_operator f",
      whr = `a.receipt_no=b.receipt_no AND a.receipt_no=c.receipt_no AND a.vehicle_id=d.vehicle_id AND a.user_id_in=e.id AND e.user_id=f.user_id AND a.car_out_flag = 'Y' AND b.date_time_out BETWEEN '${data.frm_dt}' AND '${data.to_dt}'`,
      order = "GROUP BY a.user_id_in,b.device_id,d.vehicle_name,f.operator_name";

    if (!req.session.user.user_data.is_superadmin) {
      whr += ` AND a.customer_id = '${custId}' `;
    }

    var res_dt = await db_Select(select, table_name, whr, order);
    res.send(res_dt);
  }
);

reportRouter.get("/shift_wise_repo", AuthCheckedMW, async (req, res) => {
  var custId = req.session.user.user_data.customer_id,
    shiftData = await db_Select(
      "shift_id, shift_name, f_time, t_time",
      "md_shift",
      req.session.user.user_data.is_superadmin ? null : `customer_id=${custId}`,
      "ORDER BY f_time"
    );

  // console.log(shiftData)

  var data = {
    title: "Shiftwise Report",
    page_path: "reports/shift_report_new",
    dtFormat: dateFormat,
    shiftData: shiftData,
  };
  res.render("common/layouts/main", data);
});

reportRouter.post("/shift_wise_repo", AuthCheckedMW, async (req, res) => {
  var custId = req.session.user.user_data.customer_id,
    userType = req.session.user.user_data.user_type;

  var data = req.body;

  let shift_time = await db_Select(
    "f_time, t_time",
    "md_shift",
    `shift_id=${data.shift_id}`,
    null
  );
  let ftime = shift_time.msg[0].f_time;
  let ttime = shift_time.msg[0].t_time;

 if(data.pay_mode == 'A'){
  var select = `b.device_id mc_srl_no_out, d.vehicle_name vehicleType, COUNT(b.receipt_no) tot_vehi, SUM(c.paid_amt) paid_amt, SUM(c.advance_amt) advance_amt, SUM(c.base_amt) base_amt, c.pay_mode,SUM(c.cgst) cgst,SUM(c.sgst) sgst, SUM(c.igst) igst,f.operator_name opratorName`,
    table_name =
      "td_vehicle_in a, td_vehicle_out b, td_receipt c, md_vehicle d, md_user e, md_operator f",
    whr = `a.receipt_no=b.receipt_no AND a.receipt_no=c.receipt_no AND a.vehicle_id=d.vehicle_id AND a.user_id_in=e.id AND e.user_id=f.user_id AND a.car_out_flag = 'Y' AND DATE(b.date_time_out) BETWEEN '${data.frm_dt}' AND '${data.to_dt}' AND TIME(b.date_time_out) BETWEEN '${ftime}' AND '${ttime}'`,
    order = "GROUP BY a.user_id_in,c.pay_mode,b.device_id,d.vehicle_name,f.operator_name";

  if (!req.session.user.user_data.is_superadmin) {
    whr += ` AND a.customer_id = '${custId}' `;
  }

  var res_dt = await db_Select(select, table_name, whr, order);
  res.send(res_dt);
  }else {
    var select = `b.device_id mc_srl_no_out, d.vehicle_name vehicleType, COUNT(b.receipt_no) tot_vehi, SUM(c.paid_amt) paid_amt, SUM(c.advance_amt) advance_amt, SUM(c.base_amt) base_amt, c.pay_mode,SUM(c.cgst) cgst,SUM(c.sgst) sgst, SUM(c.igst) igst,f.operator_name opratorName`,
    table_name =
      "td_vehicle_in a, td_vehicle_out b, td_receipt c, md_vehicle d, md_user e, md_operator f",
    whr = `a.receipt_no=b.receipt_no AND a.receipt_no=c.receipt_no AND a.vehicle_id=d.vehicle_id AND a.user_id_in=e.id AND e.user_id=f.user_id AND a.car_out_flag = 'Y' AND DATE(b.date_time_out) BETWEEN '${data.frm_dt}' AND '${data.to_dt}' AND TIME(b.date_time_out) BETWEEN '${ftime}' AND '${ttime}' AND c.pay_mode = '${data.pay_mode}'`,
    order = "GROUP BY a.user_id_in,b.device_id,d.vehicle_name,c.pay_mode,f.operator_name";

  if (!req.session.user.user_data.is_superadmin) {
    whr += ` AND a.customer_id = '${custId}' `;
  }

  var res_dt = await db_Select(select, table_name, whr, order);
  res.send(res_dt);
  }
});

module.exports = { reportRouter };
