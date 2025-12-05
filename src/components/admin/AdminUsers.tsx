import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Edit, Trash2, Ban, CheckCircle, Search, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface User {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  suspended_until: string | null;
  created_at: string;
  role: 'user' | 'admin';
}

export default function AdminUsers() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'user' as 'user' | 'admin' });
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesData && !profilesError) {
      // Fetch roles for all users
      const userIds = profilesData.map(p => p.user_id);
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);

      const usersWithRoles = profilesData.map(user => ({
        ...user,
        role: (rolesMap.get(user.user_id) || 'user') as 'user' | 'admin'
      }));

      setUsers(usersWithRoles);
    }
    setLoading(false);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({ name: user.name, email: user.email, role: user.role });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!editingUser) return;

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ name: formData.name })
      .eq('id', editingUser.id);

    if (profileError) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar o usuário.' });
      return;
    }

    // Update role in user_roles table
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({ 
        user_id: editingUser.user_id, 
        role: formData.role 
      }, { onConflict: 'user_id,role' });

    if (roleError) {
      console.error('Error updating role:', roleError);
    }

    toast({ title: 'Sucesso', description: 'Usuário atualizado com sucesso.' });
    fetchUsers();
    setShowDialog(false);
  };

  const handleSuspend = async (user: User, suspend: boolean) => {
    const suspendedUntil = suspend 
      ? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() 
      : null;

    const { error } = await supabase
      .from('profiles')
      .update({ suspended_until: suspendedUntil })
      .eq('id', user.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar a suspensão.' });
    } else {
      toast({ 
        title: 'Sucesso', 
        description: suspend ? 'Usuário suspenso por 60 dias.' : 'Suspensão removida.' 
      });
      fetchUsers();
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) return;

    const { error } = await supabase.from('profiles').delete().eq('id', user.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir o usuário.' });
    } else {
      toast({ title: 'Sucesso', description: 'Usuário excluído com sucesso.' });
      fetchUsers();
    }
  };

  const handleChangePassword = (user: User) => {
    setEditingUser(user);
    setNewPassword('');
    setShowPasswordDialog(true);
  };

  const handleSavePassword = async () => {
    if (!editingUser || newPassword.length < 6) {
      toast({ 
        variant: 'destructive', 
        title: 'Erro', 
        description: 'A senha deve ter no mínimo 6 caracteres.' 
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('admin-update-password', {
        body: {
          userId: editingUser.user_id,
          newPassword: newPassword,
        },
      });

      if (response.error) {
        toast({ 
          variant: 'destructive', 
          title: 'Erro', 
          description: response.error.message || 'Não foi possível alterar a senha.' 
        });
      } else {
        toast({ title: 'Sucesso', description: 'Senha alterada com sucesso.' });
        setShowPasswordDialog(false);
        setNewPassword('');
      }
    } catch (error) {
      console.error('Error updating password:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Erro', 
        description: 'Erro ao alterar a senha. Tente novamente.' 
      });
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map(user => {
                const isSuspended = user.suspended_until && new Date(user.suspended_until) > new Date();
                
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'admin' 
                          ? 'bg-primary/10 text-primary' 
                          : 'bg-secondary text-secondary-foreground'
                      }`}>
                        {user.role === 'admin' ? 'Admin' : 'Usuário'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {isSuspended ? (
                        <span className="text-destructive text-sm">
                          Suspenso até {format(parseISO(user.suspended_until!), 'dd/MM/yyyy')}
                        </span>
                      ) : (
                        <span className="text-success text-sm">Ativo</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(parseISO(user.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(user)} title="Editar">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleChangePassword(user)} 
                          title="Alterar senha"
                        >
                          <KeyRound className="h-4 w-4 text-blue-500" />
                        </Button>
                        {isSuspended ? (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-success"
                            onClick={() => handleSuspend(user, false)}
                            title="Reativar usuário"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-warning"
                            onClick={() => handleSuspend(user, true)}
                            title="Suspender conta"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive"
                          onClick={() => handleDelete(user)}
                          title="Excluir usuário"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={formData.email} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formData.role} onValueChange={(v: 'user' | 'admin') => setFormData({ ...formData, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="gradient-primary">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Definir nova senha para <strong>{editingUser?.name}</strong>:
            </p>
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>Cancelar</Button>
            <Button onClick={handleSavePassword} className="gradient-primary">
              Alterar Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
