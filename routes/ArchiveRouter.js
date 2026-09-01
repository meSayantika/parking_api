const express = require('express');
const { AuthCheckedMW } = require('../middleware/AuthChecked.middleware');
const { upload_to_archive, get_unbilled_archive, get_billed_archive, save_unbilled_archive, save_billed_archive } = require('../controller/customer/Archive.controller');

const archiveRouter = express.Router();

archiveRouter.get('/upload_to_archive', AuthCheckedMW, upload_to_archive);
archiveRouter.post('/get_unbilled_archive', AuthCheckedMW, get_unbilled_archive);
archiveRouter.post('/get_billed_archive', AuthCheckedMW, get_billed_archive);
archiveRouter.post('/save_unbilled_archive', AuthCheckedMW, save_unbilled_archive);
archiveRouter.post('/save_billed_archive', AuthCheckedMW, save_billed_archive);

module.exports = { archiveRouter };
