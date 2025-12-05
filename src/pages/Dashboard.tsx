import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Loader2 } from 'lucide-react';
import UserDashboard from '@/components/user/UserDashboard';
import AdminDashboard from '@/components/admin/AdminDashboard';

export default function Dashboard() {
  const { user, profile, loading, isAdmin, isSuspended, suspendedUntil } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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

  return <UserDashboard isSuspended={isSuspended} suspendedUntil={suspendedUntil} />;
}
