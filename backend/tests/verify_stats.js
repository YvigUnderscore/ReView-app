const { initSystemStats } = require('../services/systemStatsService');

// Mock IO
const io = {
    to: (room) => ({
        emit: (event, data) => {
            console.log(`[${room}] ${event}:`, data);
        }
    })
};

console.log('Testing System Stats...');
// We can't easily wait for setInterval in a script that should exit,
// so we'll just run the logic once by importing and hacking or just waiting.
// Let's just wait 6 seconds.

initSystemStats(io);

setTimeout(() => {
    console.log('Test complete (should have seen one emit).');
    process.exit(0);
}, 6000);
