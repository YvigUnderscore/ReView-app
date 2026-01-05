// Format date based on the user's or system's preference
// Format string should be "DD/MM/YYYY" or "MM/DD/YYYY"
export const formatDate = (dateInput, format = "DD/MM/YYYY") => {
    if (!dateInput) return "";
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "";

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    if (format === "MM/DD/YYYY") {
        return `${month}/${day}/${year}`;
    }
    // Default to DD/MM/YYYY
    return `${day}/${month}/${year}`;
};

export const formatDateTime = (dateInput, format = "DD/MM/YYYY") => {
    if (!dateInput) return "";
    const date = new Date(dateInput);
    const dateStr = formatDate(date, format);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} ${timeStr}`;
};
