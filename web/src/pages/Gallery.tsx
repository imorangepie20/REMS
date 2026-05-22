import { useState } from 'react'
import { X, ZoomIn, Download, Heart, Share2 } from 'lucide-react'

const galleryGradients = [
    'from-hud-accent-primary to-hud-accent-info',
    'from-hud-accent-secondary to-hud-accent-warning',
    'from-hud-accent-warning to-hud-accent-danger',
    'from-hud-accent-success to-hud-accent-primary',
    'from-hud-accent-info to-hud-accent-secondary',
    'from-hud-accent-primary to-hud-accent-secondary',
    'from-hud-accent-danger to-hud-accent-secondary',
    'from-hud-accent-info to-hud-accent-success',
    'from-hud-accent-success to-hud-accent-info',
    'from-hud-accent-secondary to-hud-accent-primary',
    'from-hud-accent-warning to-hud-accent-info',
    'from-hud-accent-primary to-hud-accent-warning',
]

const galleryItems = [
    { id: 1, title: 'Mountain Landscape', category: 'Nature' },
    { id: 2, title: 'City Skyline', category: 'Urban' },
    { id: 3, title: 'Ocean Sunset', category: 'Nature' },
    { id: 4, title: 'Forest Path', category: 'Nature' },
    { id: 5, title: 'Abstract Art', category: 'Art' },
    { id: 6, title: 'Night City', category: 'Urban' },
    { id: 7, title: 'Desert Dunes', category: 'Nature' },
    { id: 8, title: 'Street Photography', category: 'Urban' },
    { id: 9, title: 'Wildlife', category: 'Nature' },
    { id: 10, title: 'Architecture', category: 'Urban' },
    { id: 11, title: 'Minimalist', category: 'Art' },
    { id: 12, title: 'Portrait', category: 'People' },
].map((item, i) => ({ ...item, color: galleryGradients[i % galleryGradients.length] }))

const categories = ['All', 'Nature', 'Urban', 'Art', 'People']

const Gallery = () => {
    const [selectedCategory, setSelectedCategory] = useState('All')
    const [selectedImage, setSelectedImage] = useState<typeof galleryItems[0] | null>(null)

    const filteredItems = galleryItems.filter(
        item => selectedCategory === 'All' || item.category === selectedCategory
    )

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-hud-text-primary">Gallery</h1>
                <p className="text-hud-text-muted mt-1">A beautiful image gallery with lightbox.</p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
                {categories.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-hud ${selectedCategory === cat
                                ? 'bg-hud-accent-primary text-hud-onAccent'
                                : 'bg-hud-bg-secondary text-hud-text-secondary hover:text-hud-text-primary'
                            }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredItems.map((item) => (
                    <div
                        key={item.id}
                        onClick={() => setSelectedImage(item)}
                        className="group relative aspect-square rounded-lg overflow-hidden cursor-pointer hud-card hud-card-bottom"
                    >
                        <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-80`} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-4xl">🖼️</span>
                        </div>

                        <div className="absolute inset-0 bg-hud-overlay opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                            <button className="p-3 bg-hud-accent-primary rounded-full text-hud-onAccent">
                                <ZoomIn size={20} />
                            </button>
                            <p className="text-sm text-hud-overlay font-medium">{item.title}</p>
                            <span className="text-xs text-hud-overlay-muted">{item.category}</span>
                        </div>
                    </div>
                ))}
            </div>

            {selectedImage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-hud-overlay backdrop-blur-sm"
                        onClick={() => setSelectedImage(null)}
                    />
                    <div className="relative max-w-4xl w-full animate-fade-in">
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="absolute -top-12 right-0 p-2 text-hud-overlay-muted hover:text-hud-overlay transition-hud"
                        >
                            <X size={24} />
                        </button>

                        <div className={`aspect-video rounded-lg overflow-hidden bg-gradient-to-br ${selectedImage.color}`}>
                            <div className="w-full h-full flex items-center justify-center">
                                <span className="text-8xl">🖼️</span>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-semibold text-hud-overlay">{selectedImage.title}</h3>
                                <p className="text-sm text-hud-overlay-muted">{selectedImage.category}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button className="p-2 rounded-lg bg-hud-overlay-control text-hud-overlay hover:bg-hud-overlay-control/80 transition-hud">
                                    <Heart size={20} />
                                </button>
                                <button className="p-2 rounded-lg bg-hud-overlay-control text-hud-overlay hover:bg-hud-overlay-control/80 transition-hud">
                                    <Share2 size={20} />
                                </button>
                                <button className="p-2 rounded-lg bg-hud-overlay-control text-hud-overlay hover:bg-hud-overlay-control/80 transition-hud">
                                    <Download size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Gallery
