import { Link, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    Building,
    Users,
    User,
    Settings,
} from 'lucide-react'

interface SidebarProps {
    collapsed: boolean
    onToggle: () => void
}

interface MenuItem {
    title: string
    icon: React.ReactNode
    path: string
}

const menuItems: MenuItem[] = [
    { title: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
    { title: '매물', icon: <Building size={20} />, path: '/listings' },
    { title: '고객', icon: <Users size={20} />, path: '/customers' },
    { title: 'Profile', icon: <User size={20} />, path: '/profile' },
    { title: 'Settings', icon: <Settings size={20} />, path: '/settings' },
]

const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
    const location = useLocation()

    const isActive = (path: string) => location.pathname === path

    return (
        <aside
            className={`fixed top-0 left-0 h-full bg-hud-bg-secondary border-r border-hud-border-secondary z-50 transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'
                }`}
        >
            {/* Logo */}
            <div className="h-16 flex items-center justify-center border-b border-hud-border-secondary">
                <Link to="/" className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-hud-accent-primary to-hud-accent-info rounded-lg flex items-center justify-center font-bold text-hud-onAccent">
                        H
                    </div>
                    {!collapsed && (
                        <span className="font-semibold text-lg text-glow">ALPHA TEAM</span>
                    )}
                </Link>
            </div>

            {/* Navigation */}
            <nav className="py-4 overflow-y-auto h-[calc(100%-4rem)]">
                <ul className="space-y-1 px-3">
                    {menuItems.map((item) => (
                        <li key={item.title}>
                            <Link
                                to={item.path}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-hud ${isActive(item.path)
                                    ? 'menu-active text-hud-accent-primary'
                                    : 'text-hud-text-secondary hover:bg-hud-bg-hover hover:text-hud-text-primary'
                                    }`}
                            >
                                {item.icon}
                                {!collapsed && <span className="text-sm">{item.title}</span>}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>
        </aside>
    )
}

export default Sidebar
