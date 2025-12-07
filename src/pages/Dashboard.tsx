import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Loader2 } from 'lucide-react';
import UserDashboard from '@/components/user/UserDashboard';
import AdminDashboard from '@/components/admin/AdminDashboard';
import ProfessionalDashboard from '@/components/professional/ProfessionalDashboard';

export default function Dashboard() {
  const { user, profile, loading, isAdmin, isProfessional, isSuspended, suspendedUntil, refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Refresh profile on mount to ensure we have latest role
  useEffect(() => {
    if (user && !loading) {
      refreshProfile();
    }
  }, [user]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAdmin) {
    return <AdminDashboard />;
  }

  if (isProfessional) {
    return <ProfessionalDashboard />;
  }

  return <UserDashboard isSuspended={isSuspended} suspendedUntil={suspendedUntil} />;
}
