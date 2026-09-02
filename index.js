require("dotenv").config();
const express = require('express');

//const { Api } = require('./routes/Api.routes');
const { Api: V1Api } = require('./routes/V1/Api.routes');
const { Api: V2Api } = require('./routes/V2/Api.routes');
const { Api: V3Api } = require('./routes/V3/Api.routes');
const { Api: v4Api } = require('./routes/V4/Api.routes');
const { Api: v5Api } = require('./routes/V5/Api.routes');
const { Api: v6Api } = require('./routes/V6/Api.routes');
const { Api: v8Api } = require('./routes/V8/Api.routes');
const { Api: v9Api } = require('./routes/V9/Api.routes');
const { Api: v10Api } = require('./routes/V10/Api.routes');
const { Api: v11Api } = require('./routes/V11/Api.routes');
const { Api: v12Api } = require('./routes/V12/Api.routes');
const { Api: v13Api } = require('./routes/V13/Api.routes');

const { Customer } = require('./routes/Customer.routes');
const { reportRouter } = require('./routes/ReportsRouter');
const { Header_footerRouter } = require('./routes/Header_footerRouter');
const { DeviceRouter } = require('./routes/device_settingRouter');
const { Customer_settingRouter } = require('./routes/Customer_settingRouter');
const { Manage_operatorRouter } = require('./routes/Manage_operatorRouter');
const { ShiftRouter } = require('./routes/ShiftRouter');
const { vehicleRouter } = require('./routes/VehicleRouter');
const { vehicle_rateRouter } = require('./routes/Vehicle_rateRouter');
const { SuperAdminRouter } = require('./routes/SuperAdminRouter');
const logger = require('./model/LoggerModel');
const { gstRouter } = require('./routes/gstRouter');
const { archiveRouter } = require('./routes/ArchiveRouter');

const app = express(),
  session = require('express-session'),
  MemoryStore = require('memorystore')(session),
  flash = require('connect-flash'),
  path = require('path'),
  port = process.env.PORT || 3002;




// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  req.on('aborted', () => {
    console.warn('Request aborted:', req.method, req.originalUrl);
  });
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb', parameterLimit: 100000 }));
app.use(express.static(path.join(__dirname, 'public')));
app.use("views", express.static(path.join(__dirname, "views")));



// SESSION
app.use(
  session({
    secret: "PARKING_ONLINE",//project name secretKey
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 36000000,//time 1000 h
    },
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
  })
);
// END

app.use((req, res, next) => {
  res.locals.user = req.session.user ? req.session.user : null
  next()
})


// Global error handling middleware
app.use((err, req, res, next) => {
  logger.error(err); // Log the error
  next();
  // res.send('Internal Server Error');
});



app.use(flash());
var sessionFlash = function (req, res, next) {
  res.locals.currentUser = req.user;
  res.locals.error = req.flash('error');
  res.locals.info = req.flash('info');
  res.locals.warning = req.flash('warning');
  res.locals.success = req.flash('success');
  next();
}
app.use(sessionFlash)


app.set('view engine', 'ejs');

app.get('/customer', (req, res) => {
  res.send('Hello World');
});

//app.use('/api', Api);
app.use('/api', V1Api);
app.use('/v2/api', V2Api);
app.use('/v3/api', V3Api);
app.use('/v4/api', v4Api);
app.use('/v5/api', v5Api);
app.use('/v6/api', v6Api);
app.use('/v8/api', v8Api);
app.use('/v9/api', v9Api);
app.use('/v10/api', v10Api);
app.use('/v11/api', v11Api);
app.use('/v12/api', v12Api);
app.use('/v13/api', v13Api);

app.use('/', Customer);

// MODIFY 09/01/2024 SUBHAM
app.use('/report', reportRouter)

app.use('/header', Header_footerRouter)
app.use('/device', DeviceRouter)
// app.use('/customer',Customer_settingRouter)
app.use('/operator', Manage_operatorRouter)

app.use('/shift', ShiftRouter)

app.use('/vehicle', vehicleRouter)

app.use('/rate', vehicle_rateRouter)

app.use('/gst', gstRouter)

app.use('/archive', archiveRouter)

app.use('/superadmin', SuperAdminRouter)


// Example route that triggers an error
app.get('/api/error', (req, res, next) => {
  try {
    throw new Error('This is a test error');
  } catch (err) {
    logger.error(err); // Log the error
    res.status(500).send('Something broke!');
  }
});


app.get('*', function (req, res) {
  res.render('auth/error_404')
  // res.redirect('/auth')
  // res.send('what???', 404);
});

app.use((err, req, res, next) => {
  logger.error(err);
  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({
    status: false,
    message: 'Internal Server Error',
  });
});

process.on('unhandledRejection', (err) => {
  logger.error(err);
});

process.on('uncaughtException', (err) => {
  logger.error(err);
});

app.listen(port, (err) => {
  if (err) {
    logger.error(err);
    throw new Error(err)
  }
  console.table([
    { "Server": "Running", "Port": port }
  ]);
});