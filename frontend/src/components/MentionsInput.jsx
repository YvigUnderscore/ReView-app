import React, { useState, useEffect, useRef } from 'react';

const MentionsInput = ({
    value,
    onChange,
    placeholder,
    onKeyDown,
    onFocus,
    className,
    teamMembers = [],
    teamRoles = [],
    onPaste
}) => {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [cursorPosition, setCursorPosition] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    const [suggestions, setSuggestions] = useState([]);
    const textareaRef = useRef(null);

    // Filter suggestions based on search term
    useEffect(() => {
        if (!showSuggestions) return;

        const lowerTerm = searchTerm.toLowerCase();

        // Combine members and roles into one list
        // Format: { id, name, type: 'member'|'role' }
        const memberOptions = teamMembers.map(m => ({
            id: m.id,
            name: m.name,
            type: 'member',
            avatarPath: m.avatarPath
        }));

        const roleOptions = teamRoles.map(r => ({
            id: r.id,
            name: r.name,
            type: 'role',
            color: r.color
        }));

        const allOptions = [...memberOptions, ...roleOptions];
        const filtered = allOptions.filter(opt => opt.name.toLowerCase().startsWith(lowerTerm));

        setSuggestions(filtered);
        setSuggestionIndex(0);
    }, [searchTerm, teamMembers, teamRoles, showSuggestions]);

    const handleChange = (e) => {
        const newValue = e.target.value;
        const newCursorPos = e.target.selectionStart;

        onChange(e);
        setCursorPosition(newCursorPos);

        // Check for trigger '@'
        // We look backwards from cursor to find the last '@' that isn't followed by a space
        const textBeforeCursor = newValue.substring(0, newCursorPos);
        const lastAt = textBeforeCursor.lastIndexOf('@');

        if (lastAt !== -1) {
            // Check if there are spaces between @ and cursor (allow spaces in names? usually no for simple mentions, but let's stick to simple "no space" or "partial name")
            // Actually, many systems allow "Firstname Lastname". But typical @mention is @username or @Firstname.
            // Let's assume single word or simple matching until space.
            // Wait, regex: /@(\w*)$/
            const query = textBeforeCursor.substring(lastAt + 1);
            if (!/\s/.test(query)) {
                setSearchTerm(query);
                setShowSuggestions(true);
                return;
            }
        }

        setShowSuggestions(false);
    };

    const insertMention = (suggestion) => {
        const textBeforeCursor = value.substring(0, cursorPosition);
        const lastAt = textBeforeCursor.lastIndexOf('@');
        const textAfterCursor = value.substring(cursorPosition);

        // Replace spaces with underscores for the tag
        const tagName = suggestion.name.replace(/\s+/g, '_');
        const newValue = value.substring(0, lastAt) + `@${tagName} ` + textAfterCursor;

        // Call onChange with new value (simulating event if needed or just updating parent)
        // Since parent expects event, we create a fake one or parent needs to handle raw string?
        // Standard React pattern: parent passes `onChange` taking event.
        // We'll create a synthetic event.
        const fakeEvent = { target: { value: newValue } };
        onChange(fakeEvent);

        setShowSuggestions(false);
        textareaRef.current.focus();
    };

    const handleKeyDown = (e) => {
        if (showSuggestions && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSuggestionIndex(prev => (prev + 1) % suggestions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertMention(suggestions[suggestionIndex]);
            } else if (e.key === 'Escape') {
                setShowSuggestions(false);
            }
        } else {
            if (onKeyDown) onKeyDown(e);
        }
    };

    return (
        <div className="relative w-full">
            <textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={onFocus}
                onPaste={onPaste}
                placeholder={placeholder}
                className={className}
            />

            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute bottom-full left-0 w-64 max-h-48 overflow-y-auto bg-popover border border-border shadow-md rounded-md z-50 mb-1">
                    {suggestions.map((item, idx) => (
                        <div
                            key={`${item.type}-${item.id}`}
                            className={`p-2 cursor-pointer flex items-center gap-2 text-sm ${idx === suggestionIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}
                            onClick={() => insertMention(item)}
                        >
                            {item.type === 'member' ? (
                                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] overflow-hidden">
                                     {item.avatarPath ? (
                                         <img src={`/api/media/avatars/${item.avatarPath}`} alt={item.name} className="w-full h-full object-cover"/>
                                     ) : (
                                         item.name.substring(0, 2).toUpperCase()
                                     )}
                                </div>
                            ) : (
                                <div
                                    className="w-5 h-5 rounded flex items-center justify-center text-[10px] text-white"
                                    style={{ backgroundColor: item.color || '#888' }}
                                >
                                    #
                                </div>
                            )}
                            <span className="truncate">{item.name}</span>
                            {item.type === 'role' && <span className="text-xs text-muted-foreground ml-auto">Role</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MentionsInput;
