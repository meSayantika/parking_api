const { db_Select_Sqery } = require("../../model/Master.model");
const logger = require("../../model/LoggerModel");

const dashboard = async (req, res) => {
    try {
        const user_data = req.session.user.user_data;
        const customerId = user_data.customer_id;

        const [
            customerRes,
            countsRes,
            revenueRes,
            trendRes,
            paymentModeRes,
            vehicleTypeRes,
            recentTransRes,
            topOperatorsRes,
            topDevicesRes
        ] = await Promise.all([
            db_Select_Sqery(`SELECT customer_name FROM md_customer WHERE customer_id = '${customerId}'`),
            db_Select_Sqery(`
                SELECT
                    (SELECT COUNT(*) FROM md_operator WHERE customer_id = '${customerId}') AS total_operators,
                    (SELECT COUNT(*) FROM md_setting WHERE customer_id = '${customerId}') AS total_devices,
                    (SELECT COUNT(*) FROM td_vehicle_in WHERE customer_id = '${customerId}') AS total_entries,
                    (SELECT COUNT(*) FROM td_vehicle_in WHERE customer_id = '${customerId}' AND DATE(date_time_in) = CURDATE()) AS today_entries,
                    (SELECT COUNT(*) FROM td_vehicle_in WHERE customer_id = '${customerId}' AND car_out_flag = 'N') AS active_parked
            `),
            db_Select_Sqery(`
                SELECT
                    IFNULL(SUM(CASE WHEN DATE(v.date_time_in) = CURDATE() THEN r.paid_amt ELSE 0 END), 0) AS today_revenue,
                    IFNULL(SUM(CASE WHEN DATE(v.date_time_in) = CURDATE() THEN r.advance_amt ELSE 0 END), 0) AS today_advance,
                    IFNULL(SUM(CASE WHEN MONTH(v.date_time_in) = MONTH(CURDATE()) AND YEAR(v.date_time_in) = YEAR(CURDATE()) THEN r.paid_amt ELSE 0 END), 0) AS month_revenue,
                    IFNULL(SUM(CASE WHEN MONTH(v.date_time_in) = MONTH(CURDATE()) AND YEAR(v.date_time_in) = YEAR(CURDATE()) THEN r.advance_amt ELSE 0 END), 0) AS month_advance,
                    IFNULL(SUM(r.paid_amt), 0) AS total_revenue,
                    IFNULL(SUM(r.advance_amt), 0) AS total_advance
                FROM td_vehicle_in v
                LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
                WHERE v.customer_id = '${customerId}'
            `),
            db_Select_Sqery(`
                SELECT
                    DATE(v.date_time_in) AS day_key,
                    DATE_FORMAT(v.date_time_in, '%d %b') AS day_label,
                    COUNT(v.vehicle_in_id) AS total_entries,
                    IFNULL(SUM(r.paid_amt), 0) AS total_paid,
                    IFNULL(SUM(r.advance_amt), 0) AS total_advance
                FROM td_vehicle_in v
                LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
                WHERE v.customer_id = '${customerId}' AND DATE(v.date_time_in) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                GROUP BY DATE(v.date_time_in), DATE_FORMAT(v.date_time_in, '%d %b')
                ORDER BY DATE(v.date_time_in) ASC
            `),
            db_Select_Sqery(`
                SELECT
                    CASE
                        WHEN r.pay_mode IS NULL OR TRIM(r.pay_mode) = '' THEN 'Unknown'
                        ELSE r.pay_mode
                    END AS pay_mode,
                    COUNT(*) AS total_transactions,
                    IFNULL(SUM(r.paid_amt), 0) AS total_amount
                FROM td_receipt r
                JOIN td_vehicle_in v ON v.receipt_no = r.receipt_no
                WHERE v.customer_id = '${customerId}'
                GROUP BY CASE
                    WHEN r.pay_mode IS NULL OR TRIM(r.pay_mode) = '' THEN 'Unknown'
                    ELSE r.pay_mode
                END
            `),
            db_Select_Sqery(`
                SELECT
                    COALESCE(m.vehicle_name, 'Unknown') AS vehicle_name,
                    COUNT(v.vehicle_in_id) AS total_entries,
                    IFNULL(SUM(r.paid_amt), 0) AS total_revenue
                FROM td_vehicle_in v
                LEFT JOIN md_vehicle m ON m.vehicle_id = v.vehicle_id
                LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
                WHERE v.customer_id = '${customerId}'
                GROUP BY COALESCE(m.vehicle_name, 'Unknown')
                ORDER BY total_entries DESC
            `),
            db_Select_Sqery(`
                SELECT
                    v.receipt_no,
                    DATE_FORMAT(v.date_time_in, '%d %b %Y %h:%i %p') AS date_time_in,
                    m.vehicle_name,
                    v.vehicle_no,
                    IFNULL(r.pay_mode, 'Unknown') AS pay_mode,
                    IFNULL(r.paid_amt, 0) AS paid_amt,
                    IFNULL(r.advance_amt, 0) AS advance_amt,
                    v.car_out_flag
                FROM td_vehicle_in v
                LEFT JOIN md_vehicle m ON m.vehicle_id = v.vehicle_id
                LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
                WHERE v.customer_id = '${customerId}'
                ORDER BY v.date_time_in DESC
                LIMIT 10
            `),
            db_Select_Sqery(`
                SELECT 
                    f.operator_name,
                    COUNT(v.vehicle_in_id) AS total_entries,
                    IFNULL(SUM(r.paid_amt), 0) AS total_revenue
                FROM md_operator f
                JOIN md_user e ON e.user_id = f.user_id
                JOIN td_vehicle_in v ON v.user_id_in = e.id
                LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
                WHERE v.customer_id = '${customerId}'
                GROUP BY f.operator_name
                ORDER BY total_revenue DESC, total_entries DESC
                LIMIT 6
            `),
            db_Select_Sqery(`
                SELECT 
                    v.device_id AS device_name,
                    COUNT(v.vehicle_in_id) AS total_entries,
                    IFNULL(SUM(r.paid_amt), 0) AS total_revenue
                FROM td_vehicle_in v
                LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
                WHERE v.customer_id = '${customerId}'
                GROUP BY v.device_id
                ORDER BY total_entries DESC, total_revenue DESC
                LIMIT 6
            `)
        ]);

        const customerName = customerRes.suc > 0 && customerRes.msg.length > 0 ? customerRes.msg[0].customer_name : 'Your Project';

        const dashboardData = {
            counts: countsRes.suc > 0 ? countsRes.msg[0] : {},
            revenue: revenueRes.suc > 0 ? revenueRes.msg[0] : {},
            trend: trendRes.suc > 0 ? trendRes.msg : [],
            paymentModes: paymentModeRes.suc > 0 ? paymentModeRes.msg : [],
            vehicleTypes: vehicleTypeRes.suc > 0 ? vehicleTypeRes.msg : [],
            recentTransactions: recentTransRes.suc > 0 ? recentTransRes.msg : [],
            topOperators: topOperatorsRes.suc > 0 ? topOperatorsRes.msg : [],
            topDevices: topDevicesRes.suc > 0 ? topDevicesRes.msg : []
        };

        const page_data = {
            title: "Dashboard",
            page_path: 'dashboard/dashboard',
            customerName: customerName,
            selectedCustomerId: customerId,
            dashboard: dashboardData
        };
        res.render('common/layouts/main', page_data);
    } catch (err) {
        logger.error(err);
        res.render('auth/login');
    }
}

let dashboardCache = null;
let cacheTime = null;

const superadmin_dashboard = async (req, res) => {
    try {

           if (!req.query.loadData) {
            return res.render('common/layouts/main', {
                title: "Superadmin Dashboard",
                page_path: 'superadmin_dashboard/superadmin_dashboard',
                dashboard: {}
            });
        }

        if (dashboardCache && (Date.now() - cacheTime < 60000)) {
            return res.render('common/layouts/main', dashboardCache);
        }

        const [
            countsRes,
            revenueRes,
            trendRes,
            paymentModeRes,
            customerRevenueRes,
            locationActivityRes,
            vehicleTypeRes,
            recentTransRes,
            operatorPerCustomerRes,
            devicePerCustomerRes
        ] = await Promise.all([
            db_Select_Sqery(`
                SELECT
                    (SELECT COUNT(*) FROM md_locations) AS total_locations,
                    (SELECT COUNT(*) FROM md_seller) AS total_sellers,
                    (SELECT COUNT(*) FROM md_customer) AS total_customers,
                    (SELECT COUNT(*) FROM md_operator) AS total_operators,
                    (SELECT COUNT(*) FROM md_vehicle) AS total_vehicles,
                    (SELECT COUNT(*) FROM td_vehicle_in) AS total_entries,
                    (SELECT COUNT(*) FROM td_vehicle_in WHERE DATE(date_time_in) = CURDATE()) AS today_entries,
                    (SELECT COUNT(*) FROM td_vehicle_in WHERE car_out_flag = 'N') AS active_parked
            `),
            db_Select_Sqery(`
                SELECT
                    IFNULL(SUM(CASE WHEN DATE(v.date_time_in) = CURDATE() THEN r.paid_amt ELSE 0 END), 0) AS today_revenue,
                    IFNULL(SUM(CASE WHEN DATE(v.date_time_in) = CURDATE() THEN r.advance_amt ELSE 0 END), 0) AS today_advance,
                    IFNULL(SUM(CASE WHEN MONTH(v.date_time_in) = MONTH(CURDATE()) AND YEAR(v.date_time_in) = YEAR(CURDATE()) THEN r.paid_amt ELSE 0 END), 0) AS month_revenue,
                    IFNULL(SUM(CASE WHEN MONTH(v.date_time_in) = MONTH(CURDATE()) AND YEAR(v.date_time_in) = YEAR(CURDATE()) THEN r.advance_amt ELSE 0 END), 0) AS month_advance,
                    IFNULL(SUM(r.paid_amt), 0) AS total_revenue,
                    IFNULL(SUM(r.advance_amt), 0) AS total_advance
                FROM td_vehicle_in v
                LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
            `),
            db_Select_Sqery(`
                SELECT
                    DATE(v.date_time_in) AS day_key,
                    DATE_FORMAT(v.date_time_in, '%d %b') AS day_label,
                    COUNT(v.vehicle_in_id) AS total_entries,
                    IFNULL(SUM(r.paid_amt), 0) AS total_paid,
                    IFNULL(SUM(r.advance_amt), 0) AS total_advance
                FROM td_vehicle_in v
                LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
                WHERE DATE(v.date_time_in) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                GROUP BY DATE(v.date_time_in), DATE_FORMAT(v.date_time_in, '%d %b')
                ORDER BY DATE(v.date_time_in) ASC
            `),
            db_Select_Sqery(`
                SELECT
                    CASE
                        WHEN r.pay_mode IS NULL OR TRIM(r.pay_mode) = '' THEN 'Unknown'
                        ELSE r.pay_mode
                    END AS pay_mode,
                    COUNT(*) AS total_transactions,
                    IFNULL(SUM(r.paid_amt), 0) AS total_amount
                FROM td_receipt r
                GROUP BY CASE
                    WHEN r.pay_mode IS NULL OR TRIM(r.pay_mode) = '' THEN 'Unknown'
                    ELSE r.pay_mode
                END
                ORDER BY total_amount DESC, total_transactions DESC
            `),
            db_Select_Sqery(`
                SELECT
                    c.customer_name,
                    COUNT(v.vehicle_in_id) AS total_entries,
                    IFNULL(SUM(r.paid_amt), 0) AS total_revenue
                FROM md_customer c
                LEFT JOIN td_vehicle_in v ON v.customer_id = c.customer_id
                LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
                GROUP BY c.customer_id, c.customer_name
                ORDER BY total_revenue DESC, total_entries DESC
                LIMIT 6
            `),
            db_Select_Sqery(`
                SELECT
                    l.loction AS location_name,
                    COUNT(v.vehicle_in_id) AS total_entries,
                    IFNULL(SUM(r.paid_amt), 0) AS total_revenue
                FROM md_locations l
                LEFT JOIN md_customer c ON c.location_id = l.location_id
                LEFT JOIN td_vehicle_in v ON v.customer_id = c.customer_id
                LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
                GROUP BY l.location_id, l.loction
                ORDER BY total_entries DESC, total_revenue DESC
                LIMIT 6
            `),
            db_Select_Sqery(`
                SELECT
                    COALESCE(m.vehicle_name, 'Unknown') AS vehicle_name,
                    COUNT(v.vehicle_in_id) AS total_entries,
                    IFNULL(SUM(r.paid_amt), 0) AS total_revenue
                FROM td_vehicle_in v
                LEFT JOIN md_vehicle m ON m.vehicle_id = v.vehicle_id
                LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
                GROUP BY COALESCE(m.vehicle_name, 'Unknown')
                ORDER BY total_entries DESC, total_revenue DESC
                LIMIT 6
            `),
            db_Select_Sqery(`
                SELECT
                    v.receipt_no,
                    DATE_FORMAT(v.date_time_in, '%d %b %Y %h:%i %p') AS date_time_in,
                    c.customer_name,
                    m.vehicle_name,
                    v.vehicle_no,
                    IFNULL(r.pay_mode, 'Unknown') AS pay_mode,
                    IFNULL(r.paid_amt, 0) AS paid_amt,
                    IFNULL(r.advance_amt, 0) AS advance_amt,
                    v.car_out_flag
                FROM td_vehicle_in v
                LEFT JOIN md_customer c ON c.customer_id = v.customer_id
                LEFT JOIN md_vehicle m ON m.vehicle_id = v.vehicle_id
                LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
                ORDER BY v.date_time_in DESC
                LIMIT 8
            `),
            db_Select_Sqery(`SELECT 
                c.customer_name,
                COUNT(o.operator_id) AS total_operators
                FROM md_customer c
                LEFT JOIN md_operator o ON o.customer_id = c.customer_id
                GROUP BY c.customer_id, c.customer_name
                ORDER BY total_operators DESC
                LIMIT 6
                `),
            db_Select_Sqery(`SELECT 
                c.customer_name,
                COUNT(d.app_id) AS total_devices
                FROM md_customer c
                LEFT JOIN md_setting d ON d.customer_id = c.customer_id
                GROUP BY c.customer_id, c.customer_name
                ORDER BY total_devices DESC
                LIMIT 6
                `)    
            ]);

        const counts = countsRes.suc > 0 && countsRes.msg.length ? countsRes.msg[0] : {};
        const revenue = revenueRes.suc > 0 && revenueRes.msg.length ? revenueRes.msg[0] : {};
        const trend = trendRes.suc > 0 ? trendRes.msg : [];
        const paymentModes = paymentModeRes.suc > 0 ? paymentModeRes.msg : [];
        const topCustomers = customerRevenueRes.suc > 0 ? customerRevenueRes.msg : [];
        const topLocations = locationActivityRes.suc > 0 ? locationActivityRes.msg : [];
        const vehicleTypes = vehicleTypeRes.suc > 0 ? vehicleTypeRes.msg : [];
        const recentTransactions = recentTransRes.suc > 0 ? recentTransRes.msg : [];
        const operatorPerCustomers = operatorPerCustomerRes.suc > 0 && operatorPerCustomerRes.msg.length ? operatorPerCustomerRes.msg : [];
        const devicePerCustomers = devicePerCustomerRes.suc > 0 && devicePerCustomerRes.msg.length ? devicePerCustomerRes.msg : [];

        const page_data = {
            title: "Superadmin Dashboard",
            page_path: 'superadmin_dashboard/superadmin_dashboard',
            dashboard: {
                counts,
                revenue,
                trend,
                paymentModes,
                topCustomers,
                topLocations,
                vehicleTypes,
                recentTransactions,
                operatorPerCustomers,
                devicePerCustomers
            }
        };

         dashboardCache = page_data;
        cacheTime = Date.now();


        res.render('common/layouts/main', page_data);
    } catch (err) {
        logger.error(err);
        req.flash('error', 'Unable to load dashboard data');
        res.redirect('/login');
    }
}

const project_dashboard = async (req, res) => {
    try {
        const customerId = req.query.customerId || null;
        
        // Fetch all customers for the dropdown
        const customersRes = await db_Select_Sqery("SELECT customer_id, customer_name FROM md_customer ORDER BY customer_name ASC");
        const customers = customersRes.suc > 0 ? customersRes.msg : [];

        let dashboardData = {};
        
        if (customerId) {
            const [
                countsRes,
                revenueRes,
                trendRes,
                paymentModeRes,
                vehicleTypeRes,
                recentTransRes,
                topOperatorsRes,
                topDevicesRes
            ] = await Promise.all([
                db_Select_Sqery(`
                    SELECT
                        (SELECT COUNT(*) FROM md_operator WHERE customer_id = ${customerId}) AS total_operators,
                        (SELECT COUNT(*) FROM md_setting WHERE customer_id = ${customerId}) AS total_devices,
                        (SELECT COUNT(*) FROM td_vehicle_in WHERE customer_id = ${customerId}) AS total_entries,
                        (SELECT COUNT(*) FROM td_vehicle_in WHERE customer_id = ${customerId} AND DATE(date_time_in) = CURDATE()) AS today_entries,
                        (SELECT COUNT(*) FROM td_vehicle_in WHERE customer_id = ${customerId} AND car_out_flag = 'N') AS active_parked
                `),
                db_Select_Sqery(`
                    SELECT
                        IFNULL(SUM(CASE WHEN DATE(v.date_time_in) = CURDATE() THEN r.paid_amt ELSE 0 END), 0) AS today_revenue,
                        IFNULL(SUM(CASE WHEN DATE(v.date_time_in) = CURDATE() THEN r.advance_amt ELSE 0 END), 0) AS today_advance,
                        IFNULL(SUM(CASE WHEN MONTH(v.date_time_in) = MONTH(CURDATE()) AND YEAR(v.date_time_in) = YEAR(CURDATE()) THEN r.paid_amt ELSE 0 END), 0) AS month_revenue,
                        IFNULL(SUM(CASE WHEN MONTH(v.date_time_in) = MONTH(CURDATE()) AND YEAR(v.date_time_in) = YEAR(CURDATE()) THEN r.advance_amt ELSE 0 END), 0) AS month_advance,
                        IFNULL(SUM(r.paid_amt), 0) AS total_revenue,
                        IFNULL(SUM(r.advance_amt), 0) AS total_advance
                    FROM td_vehicle_in v
                    LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
                    WHERE v.customer_id = ${customerId}
                `),
                db_Select_Sqery(`
                    SELECT
                        DATE(v.date_time_in) AS day_key,
                        DATE_FORMAT(v.date_time_in, '%d %b') AS day_label,
                        COUNT(v.vehicle_in_id) AS total_entries,
                        IFNULL(SUM(r.paid_amt), 0) AS total_paid,
                        IFNULL(SUM(r.advance_amt), 0) AS total_advance
                    FROM td_vehicle_in v
                    LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
                    WHERE v.customer_id = ${customerId} AND DATE(v.date_time_in) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                    GROUP BY DATE(v.date_time_in), DATE_FORMAT(v.date_time_in, '%d %b')
                    ORDER BY DATE(v.date_time_in) ASC
                `),
                db_Select_Sqery(`
                    SELECT
                        CASE
                            WHEN r.pay_mode IS NULL OR TRIM(r.pay_mode) = '' THEN 'Unknown'
                            ELSE r.pay_mode
                        END AS pay_mode,
                        COUNT(*) AS total_transactions,
                        IFNULL(SUM(r.paid_amt), 0) AS total_amount
                    FROM td_receipt r
                    JOIN td_vehicle_in v ON v.receipt_no = r.receipt_no
                    WHERE v.customer_id = ${customerId}
                    GROUP BY CASE
                        WHEN r.pay_mode IS NULL OR TRIM(r.pay_mode) = '' THEN 'Unknown'
                        ELSE r.pay_mode
                    END
                `),
                db_Select_Sqery(`
                    SELECT
                        COALESCE(m.vehicle_name, 'Unknown') AS vehicle_name,
                        COUNT(v.vehicle_in_id) AS total_entries,
                        IFNULL(SUM(r.paid_amt), 0) AS total_revenue
                    FROM td_vehicle_in v
                    LEFT JOIN md_vehicle m ON m.vehicle_id = v.vehicle_id
                    LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
                    WHERE v.customer_id = ${customerId}
                    GROUP BY COALESCE(m.vehicle_name, 'Unknown')
                    ORDER BY total_entries DESC
                `),
                db_Select_Sqery(`
                    SELECT
                        v.receipt_no,
                        DATE_FORMAT(v.date_time_in, '%d %b %Y %h:%i %p') AS date_time_in,
                        m.vehicle_name,
                        v.vehicle_no,
                        IFNULL(r.pay_mode, 'Unknown') AS pay_mode,
                        IFNULL(r.paid_amt, 0) AS paid_amt,
                        IFNULL(r.advance_amt, 0) AS advance_amt,
                        v.car_out_flag
                    FROM td_vehicle_in v
                    LEFT JOIN md_vehicle m ON m.vehicle_id = v.vehicle_id
                    LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
                    WHERE v.customer_id = ${customerId}
                    ORDER BY v.date_time_in DESC
                    LIMIT 10
                `),
                db_Select_Sqery(`
                    SELECT 
                        f.operator_name,
                        COUNT(v.vehicle_in_id) AS total_entries,
                        IFNULL(SUM(r.paid_amt), 0) AS total_revenue
                FROM md_operator f
                JOIN md_user e ON e.user_id = f.user_id
                JOIN td_vehicle_in v ON v.user_id_in = e.id
                LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
                WHERE v.customer_id = ${customerId}
                GROUP BY f.operator_name
                ORDER BY total_revenue DESC, total_entries DESC
                LIMIT 6
                `),
                db_Select_Sqery(`
                    SELECT 
                        v.device_id AS device_name,
                        COUNT(v.vehicle_in_id) AS total_entries,
                        IFNULL(SUM(r.paid_amt), 0) AS total_revenue
                FROM td_vehicle_in v
                LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
                WHERE v.customer_id = ${customerId}
                GROUP BY v.device_id
                ORDER BY total_entries DESC, total_revenue DESC
                LIMIT 6
                `)
            ]);

            dashboardData = {
                counts: countsRes.suc > 0 ? countsRes.msg[0] : {},
                revenue: revenueRes.suc > 0 ? revenueRes.msg[0] : {},
                trend: trendRes.suc > 0 ? trendRes.msg : [],
                paymentModes: paymentModeRes.suc > 0 ? paymentModeRes.msg : [],
                vehicleTypes: vehicleTypeRes.suc > 0 ? vehicleTypeRes.msg : [],
                recentTransactions: recentTransRes.suc > 0 ? recentTransRes.msg : [],
                topOperators: topOperatorsRes.suc > 0 ? topOperatorsRes.msg : [],
                topDevices: topDevicesRes.suc > 0 ? topDevicesRes.msg : []
            };
        }

        const page_data = {
            title: "Project Dashboard",
            page_path: 'superadmin_dashboard/project_dashboard',
            customers: customers,
            selectedCustomerId: customerId,
            dashboard: dashboardData
        };

        res.render('common/layouts/main', page_data);
    } catch (err) {
        logger.error(err);
        req.flash('error', 'Unable to load project dashboard');
        res.redirect('/superadmin_dashboard');
    }
}

// const superadmin_dashboard = async (req, res) => {
//     try {
//         const page_data = {
//             title: "Superadmin Dashboard",
//             page_path: 'superadmin_dashboard/superadmin_dashboard',
//             dashboard: {} // empty initially
//         };

//         // res.render('common/layouts/main', page_data);
//         res.json({
//         counts,
//         revenue,
//         trend,
//         paymentModes,
//         topCustomers,
//         topLocations,
//         vehicleTypes,
//         recentTransactions,
//         operatorPerCustomers,
//         devicePerCustomers
//         });
//     } catch (err) {
//         logger.error(err);
//         res.render('auth/superadmin_login');
//     }
// };


// const superadmin_dashboard_data = async (req, res) => {
//     try {
//         const [
//             countsRes,
//             revenueRes,
//             trendRes,
//             paymentModeRes,
//             customerRevenueRes,
//             locationActivityRes,
//             vehicleTypeRes,
//             recentTransRes,
//             operatorPerCustomerRes,
//             devicePerCustomerRes
//         ] = await Promise.all([
//             db_Select_Sqery(`
//                 SELECT
//                     (SELECT COUNT(*) FROM md_locations) AS total_locations,
//                     (SELECT COUNT(*) FROM md_seller) AS total_sellers,
//                     (SELECT COUNT(*) FROM md_customer) AS total_customers,
//                     (SELECT COUNT(*) FROM md_operator) AS total_operators,
//                     (SELECT COUNT(*) FROM md_vehicle) AS total_vehicles,
//                     (SELECT COUNT(*) FROM td_vehicle_in) AS total_entries,
//                     (SELECT COUNT(*) FROM td_vehicle_in WHERE DATE(date_time_in) = CURDATE()) AS today_entries,
//                     (SELECT COUNT(*) FROM td_vehicle_in WHERE car_out_flag = 'N') AS active_parked
//             `),
//             db_Select_Sqery(`
//                 SELECT
//                     IFNULL(SUM(CASE WHEN DATE(v.date_time_in) = CURDATE() THEN r.paid_amt ELSE 0 END), 0) AS today_revenue,
//                     IFNULL(SUM(CASE WHEN DATE(v.date_time_in) = CURDATE() THEN r.advance_amt ELSE 0 END), 0) AS today_advance,
//                     IFNULL(SUM(CASE WHEN MONTH(v.date_time_in) = MONTH(CURDATE()) AND YEAR(v.date_time_in) = YEAR(CURDATE()) THEN r.paid_amt ELSE 0 END), 0) AS month_revenue,
//                     IFNULL(SUM(CASE WHEN MONTH(v.date_time_in) = MONTH(CURDATE()) AND YEAR(v.date_time_in) = YEAR(CURDATE()) THEN r.advance_amt ELSE 0 END), 0) AS month_advance,
//                     IFNULL(SUM(r.paid_amt), 0) AS total_revenue,
//                     IFNULL(SUM(r.advance_amt), 0) AS total_advance
//                 FROM td_vehicle_in v
//                 LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
//             `),
//             db_Select_Sqery(`
//                 SELECT
//                     DATE(v.date_time_in) AS day_key,
//                     DATE_FORMAT(v.date_time_in, '%d %b') AS day_label,
//                     COUNT(v.vehicle_in_id) AS total_entries,
//                     IFNULL(SUM(r.paid_amt), 0) AS total_paid,
//                     IFNULL(SUM(r.advance_amt), 0) AS total_advance
//                 FROM td_vehicle_in v
//                 LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
//                 WHERE DATE(v.date_time_in) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
//                 GROUP BY DATE(v.date_time_in), DATE_FORMAT(v.date_time_in, '%d %b')
//                 ORDER BY DATE(v.date_time_in) ASC
//             `),
//             db_Select_Sqery(`
//                 SELECT
//                     CASE
//                         WHEN r.pay_mode IS NULL OR TRIM(r.pay_mode) = '' THEN 'Unknown'
//                         ELSE r.pay_mode
//                     END AS pay_mode,
//                     COUNT(*) AS total_transactions,
//                     IFNULL(SUM(r.paid_amt), 0) AS total_amount
//                 FROM td_receipt r
//                 GROUP BY CASE
//                     WHEN r.pay_mode IS NULL OR TRIM(r.pay_mode) = '' THEN 'Unknown'
//                     ELSE r.pay_mode
//                 END
//                 ORDER BY total_amount DESC, total_transactions DESC
//             `),
//             db_Select_Sqery(`
//                 SELECT
//                     c.customer_name,
//                     COUNT(v.vehicle_in_id) AS total_entries,
//                     IFNULL(SUM(r.paid_amt), 0) AS total_revenue
//                 FROM md_customer c
//                 LEFT JOIN td_vehicle_in v ON v.customer_id = c.customer_id
//                 LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
//                 GROUP BY c.customer_id, c.customer_name
//                 ORDER BY total_revenue DESC, total_entries DESC
//                 LIMIT 6
//             `),
//             db_Select_Sqery(`
//                 SELECT
//                     l.loction AS location_name,
//                     COUNT(v.vehicle_in_id) AS total_entries,
//                     IFNULL(SUM(r.paid_amt), 0) AS total_revenue
//                 FROM md_locations l
//                 LEFT JOIN md_customer c ON c.location_id = l.location_id
//                 LEFT JOIN td_vehicle_in v ON v.customer_id = c.customer_id
//                 LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
//                 GROUP BY l.location_id, l.loction
//                 ORDER BY total_entries DESC, total_revenue DESC
//                 LIMIT 6
//             `),
//             db_Select_Sqery(`
//                 SELECT
//                     COALESCE(m.vehicle_name, 'Unknown') AS vehicle_name,
//                     COUNT(v.vehicle_in_id) AS total_entries,
//                     IFNULL(SUM(r.paid_amt), 0) AS total_revenue
//                 FROM td_vehicle_in v
//                 LEFT JOIN md_vehicle m ON m.vehicle_id = v.vehicle_id
//                 LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
//                 GROUP BY COALESCE(m.vehicle_name, 'Unknown')
//                 ORDER BY total_entries DESC, total_revenue DESC
//                 LIMIT 6
//             `),
//             db_Select_Sqery(`
//                 SELECT
//                     v.receipt_no,
//                     DATE_FORMAT(v.date_time_in, '%d %b %Y %h:%i %p') AS date_time_in,
//                     c.customer_name,
//                     m.vehicle_name,
//                     v.vehicle_no,
//                     IFNULL(r.pay_mode, 'Unknown') AS pay_mode,
//                     IFNULL(r.paid_amt, 0) AS paid_amt,
//                     IFNULL(r.advance_amt, 0) AS advance_amt,
//                     v.car_out_flag
//                 FROM td_vehicle_in v
//                 LEFT JOIN md_customer c ON c.customer_id = v.customer_id
//                 LEFT JOIN md_vehicle m ON m.vehicle_id = v.vehicle_id
//                 LEFT JOIN td_receipt r ON r.receipt_no = v.receipt_no
//                 ORDER BY v.date_time_in DESC
//                 LIMIT 8
//             `),
//             db_Select_Sqery(`SELECT 
//                 c.customer_name,
//                 COUNT(o.operator_id) AS total_operators
//                 FROM md_customer c
//                 LEFT JOIN md_operator o ON o.customer_id = c.customer_id
//                 GROUP BY c.customer_id, c.customer_name
//                 ORDER BY total_operators DESC
//                 LIMIT 6
//                 `),
//             db_Select_Sqery(`SELECT 
//                 c.customer_name,
//                 COUNT(d.app_id) AS total_devices
//                 FROM md_customer c
//                 LEFT JOIN md_setting d ON d.customer_id = c.customer_id
//                 GROUP BY c.customer_id, c.customer_name
//                 ORDER BY total_devices DESC
//                 LIMIT 6
//                 `)    
//             ]);

//         const counts = countsRes.suc > 0 && countsRes.msg.length ? countsRes.msg[0] : {};
//         const revenue = revenueRes.suc > 0 && revenueRes.msg.length ? revenueRes.msg[0] : {};
//         const trend = trendRes.suc > 0 ? trendRes.msg : [];
//         const paymentModes = paymentModeRes.suc > 0 ? paymentModeRes.msg : [];
//         const topCustomers = customerRevenueRes.suc > 0 ? customerRevenueRes.msg : [];
//         const topLocations = locationActivityRes.suc > 0 ? locationActivityRes.msg : [];
//         const vehicleTypes = vehicleTypeRes.suc > 0 ? vehicleTypeRes.msg : [];
//         const recentTransactions = recentTransRes.suc > 0 ? recentTransRes.msg : [];
//         const operatorPerCustomers = operatorPerCustomerRes.suc > 0 && operatorPerCustomerRes.msg.length ? operatorPerCustomerRes.msg : [];
//         const devicePerCustomers = devicePerCustomerRes.suc > 0 && devicePerCustomerRes.msg.length ? devicePerCustomerRes.msg : [];

//         const page_data = {
//             title: "Superadmin Dashboard",
//             page_path: 'superadmin_dashboard/superadmin_dashboard',
//             dashboard: {
//                 counts,
//                 revenue,
//                 trend,
//                 paymentModes,
//                 topCustomers,
//                 topLocations,
//                 vehicleTypes,
//                 recentTransactions,
//                 operatorPerCustomers,
//                 devicePerCustomers
//             }
//         };

//         res.render('common/layouts/main', page_data);
//     } catch (err) {
//         logger.error(err);
//         req.flash('error', 'Unable to load dashboard data');
//         res.render('auth/superadmin_login');
//     }
// }


const blank = async (req, res) => {
    try {
        page_data = {
            title: "blank",
            page_path: 'blank/bkank',
        }
        req.flash('success', "Blank Page");
        res.render('common/layouts/main', page_data);
    } catch (err) {
        res.render('/login');
    }
}

module.exports = { dashboard, blank, superadmin_dashboard, project_dashboard };
