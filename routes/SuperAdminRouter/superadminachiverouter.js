const express = require('express');
const { AuthSuperCheckedMW } = require('../../middleware/AuthChecked.middleware');
const {
  upload_to_archive,
  get_unbilled_archive,
  get_billed_archive,
  save_unbilled_archive,
  save_billed_archive,
} = require('../../controller/superadmin/superadminArchive.controller');

const superadminachiverouter = express.Router();

superadminachiverouter.get('/upload_to_archive', AuthSuperCheckedMW, upload_to_archive);
superadminachiverouter.post('/get_unbilled_archive', AuthSuperCheckedMW, get_unbilled_archive);
superadminachiverouter.post('/get_billed_archive', AuthSuperCheckedMW, get_billed_archive);
superadminachiverouter.post('/save_unbilled_archive', AuthSuperCheckedMW, save_unbilled_archive);
superadminachiverouter.post('/save_billed_archive', AuthSuperCheckedMW, save_billed_archive);

module.exports = { superadminachiverouter };
