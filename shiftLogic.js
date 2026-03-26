/**
 * Shift definitions:
 * Shift 1: 06:00 – 14:00
 * Shift 2: 14:00 – 22:00
 * Shift 3: 22:00 – 06:00 (Next Day)
 */

function getShiftBoundaries(dateString, shiftNumber) {
    const baseDate = new Date(dateString);
    let start, end;
    
    // Explicitly parse local strings to avoid timezone drift
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    
    const nextDate = new Date(baseDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDayStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth()+1).padStart(2,'0')}-${String(nextDate.getDate()).padStart(2,'0')}`;
    
    if (shiftNumber === 1) {
        start = new Date(`${year}-${month}-${day}T06:00:00`);
        end = new Date(`${year}-${month}-${day}T14:00:00`);
    } else if (shiftNumber === 2) {
        start = new Date(`${year}-${month}-${day}T14:00:00`);
        end = new Date(`${year}-${month}-${day}T22:00:00`);
    } else if (shiftNumber === 3) {
        start = new Date(`${year}-${month}-${day}T22:00:00`);
        end = new Date(`${nextDayStr}T06:00:00`);
    } else if (shiftNumber === 'all') {
        start = new Date(`${year}-${month}-${day}T06:00:00`);
        end = new Date(`${nextDayStr}T06:00:00`);
    }

    return { start, end };
}

// Check if an event overlaps with the shift
function isEventInShift(eventStartStr, eventEndStr, shiftStart, shiftEnd) {
    const evStart = new Date(eventStartStr);
    const evEnd = eventEndStr ? new Date(eventEndStr) : new Date(); // If ongoing, end is conceptually now

    // Overlap condition: Event starts before shift ends AND Event ends after shift starts
    return evStart < shiftEnd && evEnd > shiftStart;
}

function formatTime(dateStr) {
    if (!dateStr) return 'Ongoing';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    const today = new Date();
    // Return relative date string
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
