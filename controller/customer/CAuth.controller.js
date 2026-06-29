const Joi = require("joi");
const bcrypt = require('bcrypt');
const dateFormat = require('dateformat');
const { db_Select, db_Insert } = require("../../model/Master.model");
const logger = require('../../model/LoggerModel');

const test = async (req, res) => {
    try {
        req.flash('error', "Bank Add Successful");
        res.render('auth/login');
    } catch (err) {
        req.flash('success', "Bank Add Successful");
        res.render('auth/login');
    }
}


const login = async (req, res) => {
    try {
        req.flash('error', "Bank Add Successful");
        res.render('auth/login');
    } catch (err) {
        req.flash('success', "Bank Add Successful");
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
            const errors = {};
            error.details.forEach(detail => {
                errors[detail.context.key] = detail.message;
            });
            res.flash('error', errors);
            res.redirect('/login');
        }
        const user_id = value.username,
            password = value.password;
        const table_name = "md_user a,md_customer b,md_seller c,md_locations d";
        const whr = `a.customer_id=b.customer_id AND a.seller_id=c.seller_id AND b.location_id=d.location_id AND a.user_id='${user_id}' AND a.user_type='C' AND a.allow_flag='Y'`;
        const selectData = "a.password,a.user_type, a.id, a.device_id, a.user_id, c.*, b.*, d.*";

        let user_data = await db_Select(selectData, table_name, whr, null);
        delete user_data.sql;

        if ((user_data.msg).length == 1) {
            if (user_data.msg[0] && await bcrypt.compare(password, user_data.msg[0].password)) {
                const datetime = dateFormat(new Date(), "dd/mm/yyyy hh:MM:ss");
                user_data = user_data.msg[0];
                delete user_data.password;
                req.session['user'] = { user_data, datetime }
                req.flash('success', "Login successful");
                res.redirect('/');
            } else {
                req.flash('error', "Password Not Matched");
                res.redirect('/login');
            }
        } else {
            req.flash('error', "User Not Found");
            res.redirect('/login');
        }
    } catch (err) {
        req.flash('error', err);
        res.redirect('/login');
    }
}

const super_admin_login = (req, res) => {
    res.render('auth/superadmin_login')
}

const super_admin_login_post = async (req, res) => {
    try {
        let datetime = dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss")
        const schema = Joi.object({
            password: Joi.string().required(),
            user_id: Joi.string().required(),
        });
        const { error, value } = schema.validate(req.body, { abortEarly: false });
        if (error) {
            const errors = {};
            error.details.forEach(detail => {
                errors[detail.context.key] = detail.message;
            });
            return res.json(sendErrorResponce(errors));
        }

        let whr = `user_id='${value.user_id}'`
        var userData = await db_Select("sl_no,user_id,password,user_name,user_mobile_no,last_login,created_by,created_at", 'md_super_admin', whr, null)
        if ((userData.msg).length == 1) {
            if (await bcrypt.compare(value.password, userData.msg[0].password)) {
                userData = userData.msg[0];
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
                }
                req.flash('success', "Login successful");

                // Update last login without blocking the user's redirect.
                db_Insert(
                    'md_super_admin',
                    `last_login='${datetime}',updated_by='SSS',updated_at='${datetime}'`,
                    null,
                    `user_id='${value.user_id}'`,
                    1
                ).catch((updateErr) => logger.error(updateErr));

                res.redirect('/superadmin_dashboard');
               
            } else {
                req.flash('danger', "Please check your userid or password");
                res.redirect('/superadmin_login');
            }
        } else {
            req.flash('danger', "Please check your userid or password");
            res.redirect('/superadmin_login');
        }
    } catch (error) {
        // console.log(error);
        logger.error(err); // Log the error
        req.flash('danger', error);
        res.redirect('/superadmin_login');
    }
};

module.exports = { test, login, login_post, super_admin_login, super_admin_login_post };
