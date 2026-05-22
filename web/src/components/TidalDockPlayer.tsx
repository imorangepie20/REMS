import React, { useState } from 'react';
import {
    Heart,
    ListMusic,
    Maximize2,
    Pause,
    Play,
    Repeat,
    Shuffle,
    SkipBack,
    SkipForward,
    Volume2,
    X,
} from 'lucide-react';

export const TidalDockPlayer = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [progress, setProgress] = useState(30);
    const [volume, setVolume] = useState(0.8);

    const togglePlay = () => setIsPlaying(!isPlaying);
    const toggleLike = () => setIsLiked(!isLiked);

    return (
        <div className="w-full bg-hud-media-chrome backdrop-blur-xl border border-hud-border-secondary rounded-2xl shadow-2xl relative overflow-hidden transition-all duration-300">
            <div className="sm:hidden absolute top-0 left-0 right-0 h-[2px] bg-hud-media-track">
                <div className="h-full bg-hud-accent-primary" style={{ width: `${progress}%` }} />
            </div>

            <div className="flex items-center justify-between h-[64px] sm:h-[88px] px-2 sm:px-5 gap-2 sm:gap-4">

                <div className="flex-1 flex items-center gap-2 sm:gap-3 min-w-0 justify-start">
                    <div className="relative h-10 w-10 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-md group cursor-pointer bg-hud-media-art">
                        <img
                            src="https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200&auto=format&fit=crop"
                            alt="Album Cover"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Maximize2 size={16} className="text-hud-media" />
                        </div>
                    </div>
                    <div className="flex flex-col justify-center min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <h3 className="truncate text-sm sm:text-base font-semibold text-hud-media">
                                This Hell
                            </h3>
                            <span className="hidden xl:inline-flex shrink-0 rounded bg-hud-media-track px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-hud-media-muted uppercase">
                                TIDAL
                            </span>
                        </div>
                        <p className="truncate text-xs sm:text-sm text-hud-media-muted hover:underline cursor-pointer">
                            Rina Sawayama
                        </p>
                    </div>
                    <button
                        onClick={toggleLike}
                        className={`hidden md:flex ml-2 shrink-0 h-8 w-8 items-center justify-center rounded-full transition-colors ${isLiked ? 'text-hud-accent-danger hover:text-hud-accent-danger/80' : 'text-hud-media-muted hover:text-hud-media'}`}
                    >
                        <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
                    </button>
                </div>

                <div className="hidden sm:flex flex-shrink-0 w-auto sm:w-[340px] md:w-[400px] flex-col justify-center items-center gap-1.5">
                    <div className="flex items-center justify-center gap-4 sm:gap-6">
                        <button className="hidden sm:flex items-center justify-center text-hud-media-muted hover:text-hud-media transition-colors">
                            <Shuffle size={18} />
                        </button>
                        <button className="flex items-center justify-center text-hud-media hover:text-hud-media/80 transition-colors">
                            <SkipBack size={22} fill="currentColor" />
                        </button>
                        <button
                            onClick={togglePlay}
                            className="h-12 w-12 flex items-center justify-center rounded-full bg-hud-media-play text-hud-media-play hover:scale-105 transition-transform"
                        >
                            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="translate-x-0.5" />}
                        </button>
                        <button className="flex items-center justify-center text-hud-media hover:text-hud-media/80 transition-colors">
                            <SkipForward size={22} fill="currentColor" />
                        </button>
                        <button className="hidden sm:flex items-center justify-center text-hud-media-muted hover:text-hud-media transition-colors">
                            <Repeat size={18} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3 w-full group mt-1">
                        <span className="w-8 text-right text-[10px] font-medium text-hud-media-muted tabular-nums">1:32</span>
                        <div className="relative flex h-1.5 sm:h-2 flex-1 cursor-pointer items-center">
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={progress}
                                onChange={(e) => setProgress(Number(e.target.value))}
                                className="absolute inset-0 z-10 w-full cursor-pointer opacity-0"
                            />
                            <div className="h-1 w-full overflow-hidden rounded-full bg-hud-media-track transition-all group-hover:h-1.5">
                                <div
                                    className="h-full rounded-full bg-hud-accent-primary shadow-hud-glow"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                        <span className="w-8 text-left text-[10px] font-medium text-hud-media-muted tabular-nums">3:51</span>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 sm:gap-4 min-w-0 sm:flex-1">

                    <div className="flex sm:hidden items-center gap-2 mr-1">
                        <button
                            onClick={togglePlay}
                            className="flex items-center justify-center text-hud-media hover:text-hud-media/80 transition-transform active:scale-95"
                        >
                            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="translate-x-0.5" />}
                        </button>
                        <button className="flex items-center justify-center text-hud-media hover:text-hud-media/80 transition-colors">
                            <SkipForward size={22} fill="currentColor" />
                        </button>
                    </div>

                    <div className="hidden lg:flex items-center justify-center rounded bg-hud-accent-primary/10 border border-hud-border-primary px-1.5 py-0.5" title="Master Quality">
                        <span className="text-[9px] font-bold tracking-widest text-hud-accent-primary uppercase">MASTER</span>
                    </div>

                    <button className="hidden md:flex items-center justify-center text-hud-media-muted hover:text-hud-media transition-colors">
                        <ListMusic size={20} />
                    </button>

                    <div className="hidden lg:flex items-center gap-2 w-24 group">
                        <button className="text-hud-media-muted hover:text-hud-media transition-colors shrink-0">
                            <Volume2 size={20} />
                        </button>
                        <div className="relative flex h-1.5 flex-1 cursor-pointer items-center">
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={volume}
                                onChange={(e) => setVolume(Number(e.target.value))}
                                className="absolute inset-0 z-10 w-full cursor-pointer opacity-0"
                            />
                            <div className="h-1 w-full overflow-hidden rounded-full bg-hud-media-track transition-all group-hover:h-1.5">
                                <div className="h-full rounded-full bg-hud-media" style={{ width: `${volume * 100}%` }} />
                            </div>
                        </div>
                    </div>

                    <button className="flex shrink-0 items-center justify-center text-hud-media-muted hover:text-hud-media transition-colors" title="Expand Player">
                        <Maximize2 className="w-5 h-5 sm:w-[22px] sm:h-[22px]" />
                    </button>

                    <div className="hidden sm:block h-5 w-px bg-hud-media-track shrink-0"></div>

                    <button className="flex shrink-0 items-center justify-center text-hud-media-muted hover:text-hud-media transition-colors" title="Close Player">
                        <X className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                </div>
            </div>
        </div>
    );
};
