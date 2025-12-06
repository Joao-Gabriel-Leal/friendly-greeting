import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Edit, Ban, CheckCircle, Search, KeyRound, MoreVertical, ShieldOff, Clock, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { emailService } from '@/lib/emailService';

interface User {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  suspended_until: string | null;
  blocked: boolean;
  created_at: string;
  role: 'user' | 'admin';
}

interface Specialty {
  id: string;
  name: string;
}

interface SpecialtyBlock {
  id: string;
  specialty_id: string;
  blocked_until: string | null;
}

export default function AdminUsers() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'user' as 'user' | 'admin' });
  const [newPassword, setNewPassword] = useState('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [blockReason, setBlockReason] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchSpecialties();
  }, []);

  const fetchUsers = async () => {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesData && !profilesError) {
      const userIds = profilesData.map(p => p.user_id);
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);

      const usersWithRoles = profilesData.map(user => ({
        ...user,
        blocked: user.blocked || false,
        role: (rolesMap.get(user.user_id) || 'user') as 'user' | 'admin'
      }));

      setUsers(usersWithRoles);
    }
    setLoading(false);
  };

  const fetchSpecialties = async () => {
    const { data } = await supabase.from('specialties').select('id, name').eq('active', true);
    setSpecialties(data || []);
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

  const handleChangePassword = (user: User) => {
    setEditingUser(user);
    setNewPassword('');
    setShowPasswordDialog(true);
  };

  const handleSavePassword = async () => {
    if (!editingUser || newPassword.length < 6) {
      toast({ variant: 'destructive', title: 'Erro', description: 'A senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    try {
      const response = await supabase.functions.invoke('admin-update-password', {
        body: { userId: editingUser.user_id, newPassword },
      });

      if (response.error) {
        toast({ variant: 'destructive', title: 'Erro', description: response.error.message || 'Não foi possível alterar a senha.' });
      } else {
        toast({ title: 'Sucesso', description: 'Senha alterada com sucesso.' });
        setShowPasswordDialog(false);
        setNewPassword('');
      }
    } catch (error) {
      console.error('Error updating password:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao alterar a senha. Tente novamente.' });
    }
  };

  const handleOpenSuspendDialog = (user: User) => {
    setEditingUser(user);
    setSelectedSpecialties([]);
    setShowSuspendDialog(true);
  };

  const handleSuspendBySpecialty = async () => {
    if (!editingUser) return;

    const suspendedUntil = addMonths(new Date(), 2).toISOString();

    if (selectedSpecialties.length === 0) {
      // Suspender conta inteira
      const { error } = await supabase
        .from('profiles')
        .update({ suspended_until: suspendedUntil })
        .eq('id', editingUser.id);

      if (error) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível suspender a conta.' });
        return;
      }

      // Enviar e-mail
      await emailService.sendSuspensionEmail({
        userEmail: editingUser.email,
        userName: editingUser.name,
        reason: 'Suspensão aplicada pela administração',
        suspendedUntil,
      });

      toast({ title: 'Sucesso', description: 'Conta suspensa por 2 meses.' });
    } else {
      // Suspender especialidades específicas
      for (const specId of selectedSpecialties) {
        const { error } = await supabase
          .from('user_specialty_blocks')
          .upsert({
            user_id: editingUser.user_id,
            specialty_id: specId,
            blocked_until: suspendedUntil,
            reason: 'Suspensão aplicada pela administração',
          }, { onConflict: 'user_id,specialty_id' });

        if (error) {
          console.error('Error blocking specialty:', error);
        }
      }

      const specNames = specialties
        .filter(s => selectedSpecialties.includes(s.id))
        .map(s => s.name)
        .join(', ');

      // Enviar e-mail
      await emailService.sendSuspensionEmail({
        userEmail: editingUser.email,
        userName: editingUser.name,
        reason: 'Suspensão de especialidade aplicada pela administração',
        suspendedUntil,
        specialty: specNames,
      });

      toast({ title: 'Sucesso', description: `Especialidades suspensas: ${specNames}` });
    }

    fetchUsers();
    setShowSuspendDialog(false);
  };

  const handleRemoveSuspension = async (user: User) => {
    const { error } = await supabase
      .from('profiles')
      .update({ suspended_until: null })
      .eq('id', user.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível remover a suspensão.' });
      return;
    }

    // Remover bloqueios de especialidades também
    await supabase
      .from('user_specialty_blocks')
      .delete()
      .eq('user_id', user.user_id);

    // Enviar e-mail de reativação
    await emailService.sendSuspensionLiftedEmail({
      userEmail: user.email,
      userName: user.name,
      liftedByAdmin: true,
    });

    toast({ title: 'Sucesso', description: 'Suspensão removida com sucesso.' });
    fetchUsers();
  };

  const handleOpenBlockDialog = (user: User) => {
    setEditingUser(user);
    setBlockReason('');
    setShowBlockDialog(true);
  };

  const handleBlockAccount = async () => {
    if (!editingUser) return;

    const { error } = await supabase
      .from('profiles')
      .update({ blocked: true })
      .eq('id', editingUser.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível bloquear a conta.' });
      return;
    }

    // Enviar e-mail
    await emailService.sendAccountBlockedEmail({
      userEmail: editingUser.email,
      userName: editingUser.name,
      reason: blockReason || 'Decisão administrativa',
    });

    toast({ title: 'Sucesso', description: 'Conta bloqueada com sucesso.' });
    fetchUsers();
    setShowBlockDialog(false);
  };

  const handleUnblockAccount = async (user: User) => {
    const { error } = await supabase
      .from('profiles')
      .update({ blocked: false })
      .eq('id', user.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível desbloquear a conta.' });
      return;
    }

    // Enviar e-mail de reativação
    await emailService.sendSuspensionLiftedEmail({
      userEmail: user.email,
      userName: user.name,
      liftedByAdmin: true,
    });

    toast({ title: 'Sucesso', description: 'Conta desbloqueada com sucesso.' });
    fetchUsers();
  };

  const toggleSpecialtySelection = (specId: string) => {
    setSelectedSpecialties(prev => 
      prev.includes(specId) 
        ? prev.filter(id => id !== specId)
        : [...prev, specId]
    );
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
                const isBlocked = user.blocked;
                
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
                      {isBlocked ? (
                        <span className="text-destructive text-sm font-medium flex items-center gap-1">
                          <Lock className="h-3 w-3" /> Bloqueado
                        </span>
                      ) : isSuspended ? (
                        <span className="text-warning text-sm">
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleChangePassword(user)}>
                            <KeyRound className="h-4 w-4 mr-2" />
                            Alterar senha
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(user)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {isSuspended ? (
                            <DropdownMenuItem onClick={() => handleRemoveSuspension(user)}>
                              <CheckCircle className="h-4 w-4 mr-2 text-success" />
                              Remover suspensão
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleOpenSuspendDialog(user)}>
                              <Clock className="h-4 w-4 mr-2 text-warning" />
                              Suspender por 2 meses
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {isBlocked ? (
                            <DropdownMenuItem onClick={() => handleUnblockAccount(user)}>
                              <ShieldOff className="h-4 w-4 mr-2 text-success" />
                              Desbloquear conta
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem 
                              onClick={() => handleOpenBlockDialog(user)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Ban className="h-4 w-4 mr-2" />
                              Bloquear conta
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Editar Usuário */}
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

      {/* Dialog Alterar Senha */}
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
            <Button onClick={handleSavePassword} className="gradient-primary">Alterar Senha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Suspender por Especialidade */}
      <Dialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspender Conta</DialogTitle>
            <DialogDescription>
              Suspender <strong>{editingUser?.name}</strong> por 2 meses.
              Selecione especialidades específicas ou deixe em branco para suspender a conta inteira.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Especialidades a suspender (opcional)</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {specialties.map(spec => (
                <div key={spec.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={spec.id}
                    checked={selectedSpecialties.includes(spec.id)}
                    onCheckedChange={() => toggleSpecialtySelection(spec.id)}
                  />
                  <label htmlFor={spec.id} className="text-sm cursor-pointer">{spec.name}</label>
                </div>
              ))}
            </div>
            {selectedSpecialties.length === 0 && (
              <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                Nenhuma especialidade selecionada = suspensão total da conta
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuspendDialog(false)}>Cancelar</Button>
            <Button onClick={handleSuspendBySpecialty} variant="destructive">
              Suspender
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Bloquear Conta */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear Conta</DialogTitle>
            <DialogDescription>
              Ao bloquear, <strong>{editingUser?.name}</strong> não conseguirá acessar o sistema e verá a mensagem "Conta bloqueada. Contate os administradores."
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo do bloqueio (opcional)</Label>
              <Input
                placeholder="Ex: Uso indevido do sistema"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlockDialog(false)}>Cancelar</Button>
            <Button onClick={handleBlockAccount} variant="destructive">
              <Ban className="h-4 w-4 mr-2" />
              Bloquear Conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
