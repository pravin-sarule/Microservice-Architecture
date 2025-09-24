
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const { protect } = require('../middleware/auth');
const templateController = require('../controllers/templateController');

// Template routes
router.get('/', protect, templateController.getTemplates);
router.get('/:id/open', protect, templateController.openDocxTemplateAsHtml);
router.get('/:id', protect, templateController.getTemplateById);
router.get('/user', protect, templateController.getUserTemplates);

// DOCX to HTML preview route
router.get('/:id/html', protect, templateController.openDocxTemplateAsHtml);
router.get('/:id/preview-docx', protect, templateController.getDocxTemplatePreview);

// User draft routes
// router.post('/draft', protect, upload.single('file'), templateController.saveUserDraft);
// router.get('/draft/:id/export', protect, templateController.exportUserDraft);
router.post('/draft/html', protect, templateController.saveEditedHtmlDraft);
router.get('/draft/:id/pdf', protect, templateController.downloadHtmlDraftAsPdf);

// Admin route to add a new HTML template
// router.post('/admin/html', protect, templateController.addHtmlTemplate);

module.exports = router;

