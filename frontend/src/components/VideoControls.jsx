import React, { useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Repeat, Gauge, MessageSquare, SplitSquareHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatSMPTE, calculateCurrentFrame } from '../utils/timeUtils';

const VideoControls = ({ isPlaying, onTogglePlay, currentTime, duration, volume = 1, onVolumeChange, onFullscreen, loop, onToggleLoop, playbackRate, onPlaybackRateChange, onToggleComments, isCompareMode, compareAudioEnabled, onToggleCompareAudio, onStepFrame, frameRate = 24, startFrame = 0 }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(1);

  // Local formatSMPTE removed - now using imported one

  const currentFrame = calculateCurrentFrame(currentTime, frameRate, startFrame);

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (onVolumeChange) {
      if (newMuted) {
        setPrevVolume(volume);
        onVolumeChange(0);
      } else {
        onVolumeChange(prevVolume || 1);
      }
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    if (onVolumeChange) {
      onVolumeChange(newVolume);
    }
    setIsMuted(newVolume === 0);
  };

  return (
    <div className="h-16 md:h-12 bg-card border-t border-border flex items-center justify-between px-2 md:px-4 select-none">
      <div className="flex items-center gap-1 md:gap-4">
        <button
          onClick={onTogglePlay}
          className="w-10 h-10 flex items-center justify-center hover:text-primary transition-colors text-foreground active:scale-95"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={24} fill="currentColor" className="md:w-5 md:h-5" /> : <Play size={24} fill="currentColor" className="md:w-5 md:h-5" />}
        </button>

        {/* Mobile Frame Stepping Controls */}
        <div className="flex md:hidden items-center">
          <button
            onClick={() => onStepFrame && onStepFrame(-1)}
            className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-95"
            title="Previous Frame"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={() => onStepFrame && onStepFrame(1)}
            className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-95"
            title="Next Frame"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        <button
          onClick={onToggleLoop}
          className={`w-10 h-10 flex items-center justify-center transition-colors active:scale-95 ${loop ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          title="Loop"
        >
          <Repeat size={20} className="md:w-5 md:h-5" />
        </button>

        {onToggleComments && (
          <button
            onClick={onToggleComments}
            className="md:hidden w-10 h-10 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground active:scale-95"
            title="Comments"
          >
            <MessageSquare size={20} />
          </button>
        )}

        <span className="text-xs font-mono text-muted-foreground ml-1 hidden md:inline-block">
          {formatSMPTE(currentTime, frameRate)} / {formatSMPTE(duration, frameRate)} • Frame: {currentFrame} / {calculateCurrentFrame(duration, frameRate, startFrame)}
        </span>
      </div>

      <div className="flex items-center gap-1 md:gap-4">
        {/* Compare Audio Toggle */}
        {isCompareMode && (
          <button
            onClick={onToggleCompareAudio}
            className={`h-10 px-2 md:h-8 md:px-2 rounded flex items-center gap-1 transition-colors active:scale-95 ${compareAudioEnabled ? 'bg-green-500/20 text-green-500' : 'text-muted-foreground hover:text-foreground'}`}
            title={compareAudioEnabled ? "Audio Mixed (50/50)" : "Audio V1 Only"}
          >
            <SplitSquareHorizontal size={18} className="md:w-4 md:h-4" />
            <span className="hidden md:inline text-xs">{compareAudioEnabled ? 'Mix 50/50' : 'V1 Only'}</span>
          </button>
        )}

        {/* Playback Speed Button */}
        <button
          onClick={() => {
            const rates = [0.25, 0.5, 1, 1.5, 2];
            const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
            onPlaybackRateChange(rates[nextIndex]);
          }}
          className="h-10 w-10 md:w-8 md:h-auto flex items-center justify-center text-xs font-mono font-bold hover:text-primary transition-colors text-muted-foreground hover:text-foreground active:scale-95"
          title="Playback Speed"
        >
          {playbackRate}x
        </button>

        <div className="flex items-center gap-2 group/vol hidden md:flex">
          <button
            onClick={toggleMute}
            className="w-10 h-10 flex items-center justify-center hover:text-primary transition-colors text-muted-foreground hover:text-foreground active:scale-95"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <div className="w-0 overflow-hidden group-hover/vol:w-24 transition-all duration-300 ease-in-out flex items-center">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        </div>

        <button
          onClick={onFullscreen}
          className="w-10 h-10 flex items-center justify-center hover:text-primary transition-colors text-muted-foreground hover:text-foreground active:scale-95"
          title="Fullscreen"
        >
          <Maximize size={20} className="md:w-5 md:h-5" />
        </button>
      </div>
    </div>
  );
};

export default VideoControls;
