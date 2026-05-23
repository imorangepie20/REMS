import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'

// Dashboard
import Dashboard from './pages/dashboard/Dashboard'

// Core Pages
import Profile from './pages/Profile'
import Settings from './pages/Settings'

// Auth
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'

// Listings
import ListingList from './pages/listings/ListingList'
import ListingDetail from './pages/listings/ListingDetail'
import ListingForm from './pages/listings/ListingForm'

// Customers
import CustomerList from './pages/customers/CustomerList'
import CustomerDetail from './pages/customers/CustomerDetail'
import CustomerForm from './pages/customers/CustomerForm'

// Misc Pages
import Error404 from './pages/Error404'

function App() {
    return (
        <Router>
            <AuthProvider>
            <Routes>
                {/* Public Pages (No Auth Required) */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />

                {/* Protected Pages */}
                <Route path="/" element={<RequireAuth><MainLayout /></RequireAuth>}>
                    <Route index element={<Dashboard />} />

                    {/* Core Pages */}
                    <Route path="profile" element={<Profile />} />
                    <Route path="settings" element={<Settings />} />

                    {/* Listings */}
                    <Route path="listings" element={<ListingList />} />
                    <Route path="listings/new" element={<ListingForm />} />
                    <Route path="listings/:id" element={<ListingDetail />} />
                    <Route path="listings/:id/edit" element={<ListingForm />} />

                    {/* Customers */}
                    <Route path="customers" element={<CustomerList />} />
                    <Route path="customers/new" element={<CustomerForm />} />
                    <Route path="customers/:id" element={<CustomerDetail />} />
                    <Route path="customers/:id/edit" element={<CustomerForm />} />

                    {/* 404 Fallback — inside RequireAuth so unknown paths redirect to /login when unauthenticated */}
                    <Route path="*" element={<Error404 />} />
                </Route>
            </Routes>
            </AuthProvider>
        </Router>
    )
}

export default App
