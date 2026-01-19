/**
 * Utility functions for precise time and frame conversions.
 * Acts as the single source of truth for frame logic to avoid consistency issues.
 */

/**
 * Converts a time in seconds to the nearest frame index.
 * Uses Math.round to ensure we snap to the closest frame boundary.
 * 
 * @param {number} time - Time in seconds
 * @param {number} frameRate - Frames per second
 * @returns {number} Frame index (0-based relative to time 0)
 */
export const timeToFrame = (time, frameRate) => {
    if (!frameRate) return 0;
    // Use Math.floor with a small epsilon to handle floating point inaccuracies
    // (e.g. 1.00001 -> 1, 0.99999 -> 0, but 0.9999999 with epsilon -> 1 if close enough)
    // Actually, simple floor is safer for video players, but we need to handle
    // slightly short times due to float precision (e.g. 0.999999 should be 1 if it's meant to be 1).
    // Standard approach: add a small epsilon like 0.0001
    return Math.floor((time || 0) * frameRate + 0.0001);
};

/**
 * Converts a frame index to exact time in seconds.
 * 
 * @param {number} frame - Frame index
 * @param {number} frameRate - Frames per second
 * @returns {number} Time in seconds
 */
export const frameToTime = (frame, frameRate) => {
    if (!frameRate) return 0;
    // Add a small epsilon (1ms) to ensure we land strictly INSIDE the frame
    // and not on the boundary which might round down to previous frame
    return (frame / frameRate) + 0.001;
};

/**
 * Formats time as SMPTE timecode (HH:MM:SS:FF).
 * 
 * @param {number} time - Current time in seconds
 * @param {number} frameRate - Frames per second
 * @param {number} startFrame - Optional offset for the frame count (default 0)
 * @returns {string} SMPTE string
 */
export const formatSMPTE = (time, frameRate, startFrame = 0) => {
    // 1. Get the exact frame index relative to 0
    const frameIndex = timeToFrame(time, frameRate);

    // 2. Calculate time components from this exact frame count
    //    We go back to seconds from the integer frame count to ensure consistency
    const secondsTotal = frameIndex / frameRate;

    const hours = Math.floor(secondsTotal / 3600);
    const minutes = Math.floor((secondsTotal % 3600) / 60);
    const seconds = Math.floor(secondsTotal % 60);

    // 3. Calculate the frame part of the timecode
    const frames = Math.floor(frameIndex % frameRate);

    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
};

/**
 * Calculates the display frame number (including startFrame offset).
 * 
 * @param {number} time - Current time in seconds
 * @param {number} frameRate - Frames per second
 * @param {number} startFrame - Offset to add
 * @returns {number} Display frame number
 */
export const calculateCurrentFrame = (time, frameRate, startFrame = 0) => {
    return timeToFrame(time, frameRate) + startFrame;
};
