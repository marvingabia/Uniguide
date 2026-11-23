/**
 * =====================================================
 * APPOINTMENT SMART SLOT RECOMMENDATION (ML Engine)
 * =====================================================
 *
 * Rule-based intelligent matching algorithm.
 * Analyzes appointment purpose + student profile +
 * available time slots to auto-assign the best slot.
 *
 * This is the Phase 1 ML implementation.
 * Phase 2 will use trained model from accumulated data.
 */

// ── Purpose → Slot preference mapping ──────────────────────────
// Each purpose has preferred time characteristics
const PURPOSE_PREFERENCES = {
  // Needs privacy → late morning or afternoon, avoid early rush
  'Personal Concern':     { preferAfternoon: true,  needsPrivacy: true,  duration: 60 },
  'Mental Health':        { preferAfternoon: true,  needsPrivacy: true,  duration: 60 },
  'Family Concern':       { preferAfternoon: true,  needsPrivacy: true,  duration: 60 },

  // Academic → morning preferred, focused time
  'Academic Concern':     { preferMorning: true,    needsPrivacy: false, duration: 30 },
  'Academic':             { preferMorning: true,    needsPrivacy: false, duration: 30 },

  // Quick transaction → any slot, short
  'Good Moral Pickup':    { preferMorning: true,    needsPrivacy: false, duration: 15 },
  'OJT':                  { preferMorning: true,    needsPrivacy: false, duration: 15 },
  'Scholarship':          { preferMorning: true,    needsPrivacy: false, duration: 15 },
  'Employment':           { preferMorning: true,    needsPrivacy: false, duration: 15 },
  'Document Submission':  { preferMorning: true,    needsPrivacy: false, duration: 15 },

  // Counseling session → afternoon, longer duration
  'Counseling':           { preferAfternoon: true,  needsPrivacy: true,  duration: 60 },
  'Career Counseling':    { preferAfternoon: true,  needsPrivacy: false, duration: 45 },

  // Default fallback
  'default':              { preferMorning: false,   needsPrivacy: false, duration: 30 }
};

// ── Time slot scoring ───────────────────────────────────────────
function getHourFromSlot(timeStr) {
  if (!timeStr) return 12;
  // Handle formats: "9:00 AM", "09:00", "14:00", "2:00 PM"
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return 12;
  let hour = parseInt(match[1]);
  const period = match[3];
  if (period) {
    if (period.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (period.toUpperCase() === 'AM' && hour === 12) hour = 0;
  }
  return hour;
}

function scoreSlot(slot, prefs, existingBookings) {
  let score = 100; // base score

  const hour = getHourFromSlot(slot.time || slot.timeSlot || slot.startTime || '');

  // ── Time preference scoring ──
  if (prefs.preferMorning && hour >= 8 && hour < 12) score += 30;
  if (prefs.preferAfternoon && hour >= 13 && hour < 17) score += 30;
  if (prefs.preferMorning && hour >= 13) score -= 10;   // penalty for wrong time
  if (prefs.preferAfternoon && hour < 12) score -= 10;

  // ── Privacy preference ──
  // Later afternoon slots tend to be quieter
  if (prefs.needsPrivacy && hour >= 15) score += 20;
  if (prefs.needsPrivacy && hour <= 9) score -= 10; // crowded morning

  // ── Availability scoring ──
  const capacity = parseInt(slot.capacity || slot.maxSlots || 1);
  const booked = existingBookings.filter(b =>
    b.assignedSlotId === slot.id ||
    (b.date === slot.date && b.timeSlot === (slot.time || slot.timeSlot))
  ).length;

  const remaining = capacity - booked;
  if (remaining <= 0) return -1; // fully booked — disqualify
  if (remaining === 1) score -= 15; // almost full
  if (remaining >= 3) score += 10;  // plenty of room

  // ── Day of week preference ──
  if (slot.date) {
    const day = new Date(slot.date).getDay();
    // Avoid Mondays for sensitive topics (usually busy admin day)
    if (prefs.needsPrivacy && day === 1) score -= 15;
    // Mid-week slots preferred for counseling
    if ((day === 2 || day === 3 || day === 4) && prefs.needsPrivacy) score += 10;
  }

  return score;
}

// ── Main ML function ────────────────────────────────────────────
/**
 * Recommends and returns the best available time slot
 * based on appointment purpose and student profile.
 *
 * @param {string} purpose - Appointment purpose
 * @param {object} student - Student profile { course, yearLevel, ... }
 * @param {Array}  availableSlots - Time slots set by guidance counselor
 * @param {Array}  existingBookings - Already booked appointments
 * @returns {object|null} Best slot or null if none available
 */
export function recommendSlot(purpose, student, availableSlots, existingBookings = []) {
  if (!availableSlots || availableSlots.length === 0) return null;

  // Get preferences for this purpose
  const prefs = PURPOSE_PREFERENCES[purpose] ||
    // Partial match — check if purpose contains any key
    Object.entries(PURPOSE_PREFERENCES).find(([key]) =>
      purpose?.toLowerCase().includes(key.toLowerCase())
    )?.[1] ||
    PURPOSE_PREFERENCES['default'];

  // Score every available slot
  const scored = availableSlots
    .filter(slot => slot.isAvailable !== false) // only available slots
    .map(slot => ({
      slot,
      score: scoreSlot(slot, prefs, existingBookings)
    }))
    .filter(s => s.score > 0) // remove fully booked
    .sort((a, b) => b.score - a.score); // highest score first

  if (scored.length === 0) return null;

  const best = scored[0];

  console.log(`🤖 ML Recommendation for "${purpose}":`);
  console.log(`   Best slot: ${best.slot.date} ${best.slot.time || best.slot.timeSlot} (score: ${best.score})`);
  if (scored.length > 1) {
    console.log(`   Alternative: ${scored[1].slot.date} ${scored[1].slot.time || scored[1].slot.timeSlot} (score: ${scored[1].score})`);
  }

  return {
    recommended: best.slot,
    alternatives: scored.slice(1, 3).map(s => s.slot), // top 2 alternatives
    confidence: best.score >= 120 ? 'high' : best.score >= 100 ? 'medium' : 'low',
    reason: buildReason(purpose, prefs, best.slot)
  };
}

function buildReason(purpose, prefs, slot) {
  const hour = getHourFromSlot(slot.time || slot.timeSlot || '');
  const timeLabel = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  if (prefs.needsPrivacy) {
    return `${timeLabel} slot recommended for ${purpose} to ensure privacy and focused discussion`;
  }
  return `${timeLabel} slot recommended based on ${purpose} appointment type`;
}
