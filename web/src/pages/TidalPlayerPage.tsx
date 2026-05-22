import React from 'react';
import { TidalDockPlayer } from '../components/TidalDockPlayer';

const TidalPlayerPage = () => {
    return (
        <div className="flex flex-col min-h-[calc(100vh-100px)] text-hud-text-primary relative">
            <div className="flex-1">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-hud-text-primary mb-2">Tidal Dock Player UI</h1>
                    <p className="text-hud-text-secondary">
                        이 페이지는 Tidal 디자인 템플릿을 테스트하기 위해 만들어진 전용 페이지입니다.
                        화면 하단에 플레이어가 고정되어 있습니다.
                    </p>
                </div>
                
                <div className="p-6 bg-hud-surface-muted border border-hud-border-secondary rounded-xl mb-10">
                    <h2 className="text-lg font-semibold text-hud-text-primary mb-4">최근 재생한 항목 (Mock)</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="flex flex-col gap-2 group cursor-pointer">
                                <div className="aspect-square rounded-md border border-hud-border-secondary overflow-hidden relative">
                                    <img 
                                        src={`https://images.unsplash.com/photo-${1600000000000 + i * 10000}?q=80&w=200&auto=format&fit=crop`} 
                                        alt="Album cover" 
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200&auto=format&fit=crop';
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="w-10 h-10 rounded-full bg-hud-accent-primary text-hud-onAccent flex items-center justify-center translate-y-2 group-hover:translate-y-0 transition-transform">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-hud-text-primary truncate">Sample Album {i}</h4>
                                    <p className="text-xs text-hud-text-secondary truncate">Various Artists</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Floating Player Wrapper */}
            <div className="sticky bottom-6 z-50 w-full flex justify-center pb-2">
                <div className="w-full max-w-[1200px]">
                    <TidalDockPlayer />
                </div>
            </div>
        </div>
    );
};

export default TidalPlayerPage;
