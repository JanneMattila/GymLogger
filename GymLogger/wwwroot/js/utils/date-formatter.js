// Date formatting utilities
export function formatTimestamp(timestamp, sessionDate = null) {
    const date = new Date(timestamp);
    const today = new Date().toISOString().split('T')[0];
    const timestampDate = date.toISOString().split('T')[0];

    if (sessionDate && sessionDate === today && timestampDate === today) {
        // Relative time for today's workout
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
    }

    // Absolute time for history
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return time;
}

export function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateOnly = date.toISOString().split('T')[0];
    const todayOnly = today.toISOString().split('T')[0];
    const yesterdayOnly = yesterday.toISOString().split('T')[0];

    if (dateOnly === todayOnly) return 'Today';
    if (dateOnly === yesterdayOnly) return 'Yesterday';

    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${dayName}, ${dateStr}`;
}

export function getDayName(dayOfWeek) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek];
}

export function getTodayString() {
    return new Date().toISOString().split('T')[0];
}
