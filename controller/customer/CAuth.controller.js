const Joi = require("joi");
const bcrypt = require('bcrypt');
const dateFormat = require('dateformat');
const { db_Select, db_Insert } = require("../../model/Master.model");
const logger = require('../../model/LoggerModel');

const test = async (req, res) => {
    try {
        res.render('auth/login');
    } catch (err) {
        logger.error(err);
        res.render('auth/login');
    }
}


const login = async (req, res) => {
    try {
        res.render('auth/login');
    } catch (err) {
        logger.error(err);
        res.render('auth/login');
    }
}


const login_post = async (req, res) => {
    try {
        const schema = Joi.object({
            username: Joi.string().required(),
            password: Joi.string().required(),
        });
        const { error, value } = schema.validate(req.body, { abortEarly: false });
        if (error) {
            req.flash('error', "Please enter both username and password");
            return res.redirect('/login');
        }
        const user_id = value.username,
            password = value.password;

        // 1. Check in Super Admin table (md_super_admin)
        let superAdminWhr = `user_id='${user_id}'`;
        let superAdminData = await db_Select("sl_no,user_id,password,user_name,user_mobile_no,last_login,created_by,created_at", 'md_super_admin', superAdminWhr, null);

        if (superAdminData.msg && superAdminData.msg.length === 1) {
            if (await bcrypt.compare(password, superAdminData.msg[0].password)) {
                let datetime = dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss");
                let userData = superAdminData.msg[0];
                delete userData.password;
                req.session['user'] = {
                    userData,
                    user_data: {
                        is_superadmin: true,
                        user_type: 'S',
                        customer_id: null,
                        user_name: userData.user_name
                    },
                    datetime
                };
                req.flash('success', "Login successful");

                // Update last login
                db_Insert(
                    'md_super_admin',
                    `last_login='${datetime}',updated_by='SSS',updated_at='${datetime}'`,
                    null,
                    `user_id='${user_id}'`,
                    1
                ).catch((updateErr) => logger.error(updateErr));

                return res.redirect('/superadmin_dashboard');
            }
        }

        // 2. Check in Customer Admin table (md_user join md_customer, md_seller, md_locations)
        const table_name = "md_user a,md_customer b,md_seller c,md_locations d";
        const whr = `a.customer_id=b.customer_id AND a.seller_id=c.seller_id AND b.location_id=d.location_id AND a.user_id='${user_id}' AND a.user_type='C' AND a.allow_flag='Y'`;
        const selectData = "a.password,a.user_type, a.id, a.device_id, a.user_id, c.*, b.*, d.*";

        let user_data = await db_Select(selectData, table_name, whr, null);
        delete user_data.sql;

        if (user_data.msg && user_data.msg.length === 1) {
            if (user_data.msg[0] && await bcrypt.compare(password, user_data.msg[0].password)) {
                const datetime = dateFormat(new Date(), "dd/mm/yyyy hh:MM:ss");
                let adminData = user_data.msg[0];
                delete adminData.password;
                req.session['user'] = { user_data: adminData, datetime };
                req.flash('success', "Login successful");
                return res.redirect('/');
            } else {
                req.flash('error', "Password Not Matched");
                return res.redirect('/login');
            }
        }

        // Check if user was found in super admin table but password failed
        if (superAdminData.msg && superAdminData.msg.length === 1) {
            req.flash('error', "Password Not Matched");
            return res.redirect('/login');
        }

        req.flash('error', "User Not Found");
        return res.redirect('/login');
    } catch (err) {
        logger.error(err);
        req.flash('error', "An unexpected error occurred");
        return res.redirect('/login');
    }
}

const super_admin_login = (req, res) => {
    res.redirect('/login');
}

const super_admin_login_post = async (req, res) => {
    return login_post(req, res);
};

module.exports = { test, login, login_post, super_admin_login, super_admin_login_post };
