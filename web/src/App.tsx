import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'

// Dashboard
import Dashboard from './pages/dashboard/Dashboard'
import Analytics from './pages/dashboard/Analytics'

// Email
import EmailInbox from './pages/email/EmailInbox'
import EmailCompose from './pages/email/EmailCompose'
import EmailDetail from './pages/email/EmailDetail'

// Core Pages
import Widgets from './pages/Widgets'
import Profile from './pages/Profile'
import Calendar from './pages/Calendar'
import Settings from './pages/Settings'
import ScrumBoard from './pages/ScrumBoard'
import Products from './pages/Products'
import Pricing from './pages/Pricing'
import Gallery from './pages/Gallery'

// Auth
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'

// Listings
import ListingList from './pages/listings/ListingList'
import ListingDetail from './pages/listings/ListingDetail'
import ListingForm from './pages/listings/ListingForm'

// AI Studio
import AiChat from './pages/ai/AiChat'
import AiImageGenerator from './pages/ai/AiImageGenerator'

// POS System
import PosCustomerOrder from './pages/pos/PosCustomerOrder'
import PosKitchenOrder from './pages/pos/PosKitchenOrder'
import PosCounterCheckout from './pages/pos/PosCounterCheckout'
import PosTableBooking from './pages/pos/PosTableBooking'
import PosMenuStock from './pages/pos/PosMenuStock'

// UI Components
import UiBootstrap from './pages/ui/UiBootstrap'
import UiButtons from './pages/ui/UiButtons'
import UiCard from './pages/ui/UiCard'
import UiIcons from './pages/ui/UiIcons'
import UiModalNotification from './pages/ui/UiModalNotification'
import UiTypography from './pages/ui/UiTypography'
import UiTabsAccordions from './pages/ui/UiTabsAccordions'

// Forms
import FormElements from './pages/forms/FormElements'
import FormPlugins from './pages/forms/FormPlugins'
import FormWizards from './pages/forms/FormWizards'

// Tables
import TableElements from './pages/tables/TableElements'
import TablePlugins from './pages/tables/TablePlugins'

// Charts
import ChartJs from './pages/charts/ChartJs'

// Misc Pages
import Error404 from './pages/Error404'
import ComingSoon from './pages/ComingSoon'

// Tidal Player Test
import TidalPlayerPage from './pages/TidalPlayerPage'

function App() {
    return (
        <Router>
            <AuthProvider>
            <Routes>
                {/* Public Pages (No Auth Required) */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/coming-soon" element={<ComingSoon />} />
                <Route path="/404" element={<Error404 />} />

                {/* Protected Pages */}
                <Route path="/" element={<RequireAuth><MainLayout /></RequireAuth>}>
                    <Route index element={<Dashboard />} />
                    <Route path="analytics" element={<Analytics />} />

                    {/* Email */}
                    <Route path="email/inbox" element={<EmailInbox />} />
                    <Route path="email/compose" element={<EmailCompose />} />
                    <Route path="email/detail/:id" element={<EmailDetail />} />

                    {/* Core Pages */}
                    <Route path="widgets" element={<Widgets />} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="calendar" element={<Calendar />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="scrum-board" element={<ScrumBoard />} />
                    <Route path="products" element={<Products />} />
                    <Route path="pricing" element={<Pricing />} />
                    <Route path="gallery" element={<Gallery />} />

                    {/* AI Studio */}
                    <Route path="ai/chat" element={<AiChat />} />
                    <Route path="ai/image-generator" element={<AiImageGenerator />} />

                    {/* POS System */}
                    <Route path="pos/customer-order" element={<PosCustomerOrder />} />
                    <Route path="pos/kitchen-order" element={<PosKitchenOrder />} />
                    <Route path="pos/counter-checkout" element={<PosCounterCheckout />} />
                    <Route path="pos/table-booking" element={<PosTableBooking />} />
                    <Route path="pos/menu-stock" element={<PosMenuStock />} />

                    {/* UI Components */}
                    <Route path="ui/bootstrap" element={<UiBootstrap />} />
                    <Route path="ui/buttons" element={<UiButtons />} />
                    <Route path="ui/card" element={<UiCard />} />
                    <Route path="ui/icons" element={<UiIcons />} />
                    <Route path="ui/modal-notification" element={<UiModalNotification />} />
                    <Route path="ui/typography" element={<UiTypography />} />
                    <Route path="ui/tabs-accordions" element={<UiTabsAccordions />} />

                    {/* Forms */}
                    <Route path="form/elements" element={<FormElements />} />
                    <Route path="form/plugins" element={<FormPlugins />} />
                    <Route path="form/wizards" element={<FormWizards />} />

                    {/* Tables */}
                    <Route path="table/elements" element={<TableElements />} />
                    <Route path="table/plugins" element={<TablePlugins />} />

                    {/* Charts */}
                    <Route path="chart/chartjs" element={<ChartJs />} />

                    {/* Listings */}
                    <Route path="listings" element={<ListingList />} />
                    <Route path="listings/new" element={<ListingForm />} />
                    <Route path="listings/:id" element={<ListingDetail />} />
                    <Route path="listings/:id/edit" element={<ListingForm />} />

                    {/* Tidal Player Test */}
                    <Route path="tidal-player" element={<TidalPlayerPage />} />
                </Route>

                {/* 404 Fallback */}
                <Route path="*" element={<Error404 />} />
            </Routes>
            </AuthProvider>
        </Router>
    )
}

export default App
