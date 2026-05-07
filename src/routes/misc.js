const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── QUICK LOG ────────────────────────────────────────────
// POST /api/quick-log — one-tap log
router.post('/quick-log', auth, async (req, res) => {
  try {
    const { pet_id, log_type } = req.body;
    if (!pet_id || !log_type) return res.status(400).json({ error: 'pet_id and log_type required' });

    const allowed = ['pee', 'poo', 'feed', 'walk', 'vomit'];
    if (!allowed.includes(log_type)) return res.status(400).json({ error: `log_type must be one of: ${allowed.join(', ')}` });

    const { data, error } = await supabase.from('quick_logs')
      .insert({ pet_id, log_type }).select().single();
    if (error) throw error;

    // Mirror to health_logs for trend tracking
    if (['pee', 'poo', 'vomit'].includes(log_type)) {
      await supabase.from('health_logs').insert({ pet_id, log_type, logged_at: new Date() });
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/quick-log?pet_id=&date=
router.get('/quick-log', auth, async (req, res) => {
  try {
    const { pet_id, date } = req.query;
    if (!pet_id) return res.status(400).json({ error: 'pet_id required' });

    const from = date ? new Date(date) : new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setHours(23, 59, 59, 999);

    const { data, error } = await supabase.from('quick_logs')
      .select('*').eq('pet_id', pet_id)
      .gte('logged_at', from.toISOString())
      .lte('logged_at', to.toISOString())
      .order('logged_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports.quickLog = router;

// ─── DOCUMENTS ────────────────────────────────────────────
const docsRouter = express.Router();

// GET /api/documents?pet_id=
docsRouter.get('/', auth, async (req, res) => {
  try {
    const { pet_id } = req.query;
    if (!pet_id) return res.status(400).json({ error: 'pet_id required' });
    const { data, error } = await supabase.from('medical_documents')
      .select('*').eq('pet_id', pet_id).order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents — upload file
docsRouter.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    const { pet_id, title, document_type, notes, document_date } = req.body;
    if (!pet_id || !title) return res.status(400).json({ error: 'pet_id and title required' });

    let file_url = null;
    let file_type = null;
    let file_size_bytes = null;

    if (req.file) {
      const ext = req.file.originalname.split('.').pop();
      const fileName = `${pet_id}/${Date.now()}.${ext}`;
      file_type = ext;
      file_size_bytes = req.file.size;

      const { error: uploadError } = await supabase.storage
        .from(process.env.STORAGE_BUCKET || 'pawfind-documents')
        .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from(process.env.STORAGE_BUCKET || 'pawfind-documents')
          .getPublicUrl(fileName);
        file_url = urlData.publicUrl;
      }
    }

    const { data, error } = await supabase.from('medical_documents')
      .insert({ pet_id, title, document_type, file_url, file_type, file_size_bytes, notes, document_date })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/documents/:id
docsRouter.delete('/:id', auth, async (req, res) => {
  try {
    const { error } = await supabase.from('medical_documents').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Document removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports.documents = docsRouter;

// ─── NOTIFICATIONS ─────────────────────────────────────────
const notifRouter = express.Router();

// GET /api/notifications
notifRouter.get('/', auth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('notifications')
      .select('*').eq('user_id', req.userId)
      .order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications — create custom notification
notifRouter.post('/', auth, async (req, res) => {
  try {
    const { pet_id, title, body, type, scheduled_at } = req.body;
    const { data, error } = await supabase.from('notifications')
      .insert({ user_id: req.userId, pet_id, title, body, type, scheduled_at })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id/read
notifRouter.patch('/:id/read', auth, async (req, res) => {
  try {
    const { error } = await supabase.from('notifications')
      .update({ is_read: true }).eq('id', req.params.id).eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/read-all
notifRouter.patch('/read-all', auth, async (req, res) => {
  try {
    const { error } = await supabase.from('notifications')
      .update({ is_read: true }).eq('user_id', req.userId).eq('is_read', false);
    if (error) throw error;
    res.json({ message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports.notifications = notifRouter;
