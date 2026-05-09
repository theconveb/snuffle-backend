const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');

// GET /api/pets — list all pets for user
router.get('/', auth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('pets')
      .select('*')
      .eq('user_id', req.userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pets — create pet
router.post('/', auth, async (req, res) => {
  try {
    const { name, species, breed, date_of_birth, gender, weight_kg, color, microchip_id, avatar_url } = req.body;
    if (!name || !species) return res.status(400).json({ error: 'Name and species required' });

    const { data, error } = await supabase.from('pets')
      .insert({ user_id: req.userId, name, species, breed, date_of_birth, gender, weight_kg, color, microchip_id, avatar_url })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pets/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('pets')
      .select(`*, health_conditions(*), medications(*), vaccinations(*), health_conditions(*)`)
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pets/:id
router.patch('/:id', auth, async (req, res) => {
  try {
    const { name, species, breed, date_of_birth, gender, weight_kg, color, microchip_id, avatar_url } = req.body;
    const { data, error } = await supabase.from('pets')
      .update({ name, species, breed, date_of_birth, gender, weight_kg, color, microchip_id, avatar_url, updated_at: new Date() })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/pets/:id (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const { error } = await supabase.from('pets')
      .update({ is_active: false })
      .eq('id', req.params.id)
      .eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Pet removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pets/:id/summary — dashboard summary for one pet
router.get('/:id/summary', auth, async (req, res) => {
  try {
    const petId = req.params.id;
    const [petRes, logsRes, medsRes, routinesRes, expensesRes] = await Promise.all([
      supabase.from('pets').select('*').eq('id', petId).single(),
      supabase.from('health_logs').select('*').eq('pet_id', petId).order('logged_at', { ascending: false }).limit(10),
      supabase.from('medications').select('*').eq('pet_id', petId).eq('is_active', true),
      supabase.from('routines').select('*, routine_completions(completed_at)').eq('pet_id', petId).eq('is_active', true),
      supabase.from('expenses').select('category, amount').eq('pet_id', petId)
        .gte('expense_date', new Date(new Date().setDate(1)).toISOString().split('T')[0])
    ]);

    const totalMonthlySpend = (expensesRes.data || []).reduce((sum, e) => sum + parseFloat(e.amount), 0);

    res.json({
      pet: petRes.data,
      recent_logs: logsRes.data || [],
      active_medications: medsRes.data || [],
      routines: routinesRes.data || [],
      monthly_spend: totalMonthlySpend
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// GET /api/pets/:id/insights — smart health insights
router.get('/:id/insights', auth, async (req, res) => {
  try {
    const petId = req.params.id;
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const week3ago = new Date(today); week3ago.setDate(week3ago.getDate() - 21);
    const week2ago = new Date(today); week2ago.setDate(week2ago.getDate() - 14);
    const week1ago = new Date(today); week1ago.setDate(week1ago.getDate() - 7);
    const days3ago = new Date(today); days3ago.setDate(days3ago.getDate() - 3);
    const hours12ago = new Date(); hours12ago.setHours(hours12ago.getHours() - 12);

    // Fetch all needed data in parallel
    const [
      { data: todayLogs },
      { data: weekLogs },
      { data: prevWeekLogs },
      { data: activeMeds },
      { data: recentWeights },
      { data: lastVetVisit },
      { data: last3DaysActivity },
      { data: pet },
    ] = await Promise.all([
      supabase.from('quick_logs').select('*').eq('pet_id', petId).gte('logged_at', today.toISOString()),
      supabase.from('quick_logs').select('*').eq('pet_id', petId).gte('logged_at', week1ago.toISOString()),
      supabase.from('quick_logs').select('*').eq('pet_id', petId)
        .gte('logged_at', week2ago.toISOString()).lt('logged_at', week1ago.toISOString()),
      supabase.from('medications').select('*').eq('pet_id', petId).eq('is_active', true),
      supabase.from('health_logs').select('logged_at').eq('pet_id', petId).eq('log_type', 'weight')
        .gte('logged_at', week3ago.toISOString()).order('logged_at'),
      supabase.from('health_logs').select('logged_at').eq('pet_id', petId).eq('log_type', 'vet_visit')
        .order('logged_at', { ascending: false }).limit(1),
      supabase.from('activity_sessions').select('*').eq('pet_id', petId)
        .gte('started_at', days3ago.toISOString()),
      supabase.from('pets').select('*').eq('id', petId).single(),
    ]);

    const alerts = [];
    let score = 100;

    // ── Feeding check ─────────────────────
    const todayFeeds = (todayLogs || []).filter(l => l.log_type === 'feed').length;
    if (todayFeeds === 0) {
      alerts.push({ type: 'warning', emoji: '🍽️', title: 'No meal logged today', message: `${pet.data?.name || 'Your pet'} hasn't been fed yet today.`, priority: 1 });
      score -= 15;
    }

    // ── Walk / activity check ─────────────
    const recentWalks = (last3DaysActivity || []).filter(a => a.session_type === 'walk' || a.session_type === 'run');
    if (recentWalks.length === 0 && pet.data?.species === 'dog') {
      alerts.push({ type: 'warning', emoji: '🦮', title: 'No walk in 3 days', message: 'Dogs need daily walks for their physical and mental health.', priority: 2 });
      score -= 10;
    }

    // ── Pee check (12 hours) ──────────────
    const recentPee = (todayLogs || []).filter(l => l.log_type === 'pee');
    if (recentPee.length === 0) {
      alerts.push({ type: 'info', emoji: '💧', title: 'No pee logged today', message: 'Make sure your pet has had enough water and bathroom breaks.', priority: 3 });
      score -= 5;
    }

    // ── Vomit detection ───────────────────
    const todayVomits = (todayLogs || []).filter(l => l.log_type === 'vomit').length;
    const weekVomits = (weekLogs || []).filter(l => l.log_type === 'vomit').length;
    if (todayVomits >= 2) {
      alerts.push({ type: 'danger', emoji: '🤢', title: `Vomited ${todayVomits} times today`, message: 'Multiple vomiting episodes today. Consider visiting a vet if it continues.', priority: 0 });
      score -= 25;
    } else if (weekVomits >= 4) {
      alerts.push({ type: 'warning', emoji: '🤢', title: 'Frequent vomiting this week', message: `${weekVomits} vomiting episodes this week. Monitor closely and consult your vet.`, priority: 1 });
      score -= 15;
    }

    // ── Poo frequency change ─────────────
    const weekPoos = (weekLogs || []).filter(l => l.log_type === 'poo').length;
    const prevWeekPoos = (prevWeekLogs || []).filter(l => l.log_type === 'poo').length;
    if (prevWeekPoos > 0 && weekPoos > prevWeekPoos * 1.8) {
      alerts.push({ type: 'warning', emoji: '💩', title: 'Higher poo frequency this week', message: 'Bowel movements are significantly higher than last week. Could be a dietary issue.', priority: 2 });
      score -= 10;
    }
    if (weekPoos === 0) {
      alerts.push({ type: 'warning', emoji: '💩', title: 'No poo logged this week', message: 'No bowel movements logged. Make sure to track or check if your pet is constipated.', priority: 2 });
      score -= 10;
    }

    // ── Medication compliance ─────────────
    const medsDue = (activeMeds || []).filter(m => {
      if (!m.refill_date) return false;
      const refill = new Date(m.refill_date);
      const daysLeft = Math.ceil((refill - new Date()) / (1000 * 60 * 60 * 24));
      return daysLeft <= 3 && daysLeft >= 0;
    });
    if (medsDue.length > 0) {
      alerts.push({ type: 'warning', emoji: '💊', title: `Refill needed: ${medsDue[0].name}`, message: `${medsDue[0].name} needs to be refilled within 3 days.`, priority: 1 });
      score -= 10;
    }

    // ── Vet visit check ───────────────────
    if (lastVetVisit && lastVetVisit.length > 0) {
      const lastVisit = new Date(lastVetVisit[0].logged_at);
      const monthsSince = Math.floor((new Date() - lastVisit) / (1000 * 60 * 60 * 24 * 30));
      if (monthsSince >= 6) {
        alerts.push({ type: 'info', emoji: '🏥', title: `Vet visit ${monthsSince} months ago`, message: 'Regular vet checkups every 6 months are recommended.', priority: 3 });
        score -= 5;
      }
    } else {
      alerts.push({ type: 'info', emoji: '🏥', title: 'No vet visit recorded', message: 'Log your next vet visit to track your pet\'s medical history.', priority: 4 });
    }

    // ── Good alerts ───────────────────────
    if (todayFeeds >= 2 && recentWalks.length > 0 && todayVomits === 0) {
      alerts.push({ type: 'success', emoji: '⭐', title: 'Great day so far!', message: `${pet.data?.name || 'Your pet'} has been fed and walked today. Keep it up!`, priority: 5 });
    }

    // ── Weekly summary ────────────────────
    const weekSummary = {
      feeds: (weekLogs || []).filter(l => l.log_type === 'feed').length,
      walks: recentWalks.length,
      poos: weekPoos,
      vomits: weekVomits,
      pees: (weekLogs || []).filter(l => l.log_type === 'pee').length,
    };

    // Sort alerts by priority
    alerts.sort((a, b) => a.priority - b.priority);

    res.json({
      score: Math.max(0, score),
      score_label: score >= 80 ? 'Great' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Attention',
      alerts,
      today: {
        feeds: todayFeeds,
        pees: recentPee.length,
        poos: (todayLogs || []).filter(l => l.log_type === 'poo').length,
        vomits: todayVomits,
        walks: (last3DaysActivity || []).filter(a => {
          const d = new Date(a.started_at);
          return d >= today;
        }).length,
      },
      week_summary: weekSummary,
      active_meds: (activeMeds || []).length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});