import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { FirebaseProvider } from './contexts/FirebaseContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Properties from './pages/Properties';
import Services from './pages/Services';
import Contact from './pages/Contact';
import PropertyDetail from './pages/PropertyDetail';
import AdminDashboard from './pages/AdminDashboard';
import AdminPayments from './pages/AdminPayments';
import AdminContracts from './pages/AdminContracts';
import AdminReceipts from './pages/AdminReceipts';
import AdminMonthlyReports from './pages/AdminMonthlyReports';
import AdminProperties from './pages/AdminProperties';
import AdminMessages from './pages/AdminMessages';
import AdminUserManagement from './pages/AdminUserManagement';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import WhatsAppButton from './components/WhatsAppButton';

export default function App() {
  return (
    <FirebaseProvider>
      <Router>
        <div className="min-h-screen bg-white flex flex-col">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/biens" element={<Properties />} />
              <Route path="/biens/:id" element={<PropertyDetail />} />
              <Route path="/services" element={<Services />} />
              <Route path="/contact" element={<Contact />} />
              
              {/* Admin Routes */}
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/biens" element={<AdminProperties />} />
              <Route path="/admin/paiements" element={<AdminPayments />} />
              <Route path="/admin/contrats" element={<AdminContracts />} />
              <Route path="/admin/quittances" element={<AdminReceipts />} />
              <Route path="/admin/bilans" element={<AdminMonthlyReports />} />
              <Route path="/admin/messages" element={<AdminMessages />} />
              <Route path="/admin/users" element={<AdminUserManagement />} />
              <Route path="/admin/super" element={<SuperAdminDashboard />} />
            </Routes>
          </main>
          <Footer />
          <WhatsAppButton />
        </div>
      </Router>
    </FirebaseProvider>
  );
}
