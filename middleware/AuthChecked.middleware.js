const AuthCheckedMW = (req, res, next) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        } else {
            next();
        }
    } catch (error) {
        res.redirect('/login');
    }
}

const AuthSuperCheckedMW = (req, res, next) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        } else {
            next();
        }
    } catch (error) {
        res.redirect('/login');
    }
}

const LoginCheckedMW = (req, res, next) => {
    try {
        if (req.session.user) {
            if (req.session.user.user_data && (req.session.user.user_data.is_superadmin || req.session.user.user_data.user_type === 'S')) {
                return res.redirect('/superadmin_dashboard');
            }
            return res.redirect('/');
        } else {
            next();
        }
    } catch (error) {
        res.redirect('/');
    }
}

const LoginSuperCheckedMW = (req, res, next) => {
    try {
        if (req.session.user) {
            if (req.session.user.user_data && (req.session.user.user_data.is_superadmin || req.session.user.user_data.user_type === 'S')) {
                return res.redirect('/superadmin_dashboard');
            }
            return res.redirect('/');
        } else {
            next();
        }
    } catch (error) {
        res.redirect('/login');
    }
}

const logout = async (req, res, next) => {
    req.session.destroy();
    res.redirect('/login');
}

const super_admin_logout = async (req, res, next) => {
    req.session.destroy();
    res.redirect('/login');
}

module.exports = { AuthCheckedMW, LoginCheckedMW, logout, LoginSuperCheckedMW, AuthSuperCheckedMW, super_admin_logout };
