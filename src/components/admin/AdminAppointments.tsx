import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Edit, Trash2, CheckCircle, Search, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';

interface Appointment {
  id: string;
  user_id: string;
  professional_id: string;
  specialty_id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  notes: string | null;
  user_name?: string;
  user_email?: string;
  professional_name?: string;
  specialty_name?: string;
}

interface User {
  user_id: string;
  name: string;
  email: string;
}

interface Professional {
  id: string;
  name: string;
}

interface Specialty {
  id: string;
  name: string;
}

const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

export default function AdminAppointments() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    user_id: '',
    professional_id: '',
    specialty_id: '',
    date: '',
    time: '09:00'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [appointmentsRes, profilesRes, professionalsRes, specialtiesRes] = await Promise.all([
        supabase.from('appointments').select('*').order('appointment_date', { ascending: false }),
        supabase.from('profiles').select('user_id, name, email'),
        supabase.from('professionals').select('id, name'),
        supabase.from('specialties').select('id, name')
      ]);

      const profilesMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) || []);
      const professionalsMap = new Map(professionalsRes.data?.map(p => [p.id, p]) || []);
      const specialtiesMap = new Map(specialtiesRes.data?.map(s => [s.id, s.name]) || []);

      const enrichedAppointments = (appointmentsRes.data || []).map(apt => ({
        ...apt,
        user_name: profilesMap.get(apt.user_id)?.name || 'N/A',
        user_email: profilesMap.get(apt.user_id)?.email || 'N/A',
        professional_name: professionalsMap.get(apt.professional_id)?.name || 'N/A',
        specialty_name: specialtiesMap.get(apt.specialty_id) || 'N/A'
      }));

      setAppointments(enrichedAppointments);
      setUsers(profilesRes.data || []);
      setProfessionals(professionalsRes.data || []);
      setSpecialties(specialtiesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const handleNew = () => {
    setEditingId(null);
    setFormData({ user_id: '', professional_id: '', specialty_id: '', date: '', time: '09:00' });
    setShowDialog(true);
  };

  const handleEdit = (apt: Appointment) => {
    setEditingId(apt.id);
    setFormData({
      user_id: apt.user_id,
      professional_id: apt.professional_id,
      specialty_id: apt.specialty_id,
      date: apt.appointment_date,
      time: apt.appointment_time.substring(0, 5)
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.user_id || !formData.professional_id || !formData.specialty_id || !formData.date) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha todos os campos.' });
      return;
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('appointments')
          .update({
            professional_id: formData.professional_id,
            specialty_id: formData.specialty_id,
            appointment_date: formData.date,
            appointment_time: formData.time + ':00'
          })
          .eq('id', editingId);

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Agendamento atualizado.' });
      } else {
        const { error } = await supabase.from('appointments').insert({
          user_id: formData.user_id,
          professional_id: formData.professional_id,
          specialty_id: formData.specialty_id,
          appointment_date: formData.date,
          appointment_time: formData.time + ':00',
        });

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Agendamento criado.' });
      }
      fetchData();
      setShowDialog(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar o status.' });
    } else {
      toast({ title: 'Status atualizado' });
      fetchData();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este agendamento?')) return;
    
    const { error } = await supabase.from('appointments').delete().eq('id', id);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir.' });
    } else {
      toast({ title: 'Agendamento excluído' });
      fetchData();
    }
  };

  const filteredAppointments = appointments.filter(apt => {
    const matchesSearch = 
      apt.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.professional_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || apt.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="scheduled">Agendados</SelectItem>
              <SelectItem value="completed">Concluídos</SelectItem>
              <SelectItem value="cancelled">Cancelados</SelectItem>
              <SelectItem value="no_show">Faltas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleNew} className="gradient-primary">
          <Plus className="h-4 w-4 mr-2" />Novo Agendamento
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAppointments.map(apt => (
                <TableRow key={apt.id}>
                  <TableCell>
                    <div className="font-medium">{format(parseISO(apt.appointment_date), 'dd/MM/yyyy')}</div>
                    <div className="text-sm text-muted-foreground">{apt.appointment_time.substring(0, 5)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{apt.user_name}</div>
                    <div className="text-sm text-muted-foreground">{apt.user_email}</div>
                  </TableCell>
                  <TableCell>{apt.professional_name}</TableCell>
                  <TableCell>{apt.specialty_name}</TableCell>
                  <TableCell>
                    <Select value={apt.status} onValueChange={(newStatus) => handleStatusChange(apt.id, newStatus)}>
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">
                          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />Agendado</span>
                        </SelectItem>
                        <SelectItem value="completed">
                          <span className="inline-flex items-center gap-1"><CheckCircle className="h-3 w-3" />Concluído</span>
                        </SelectItem>
                        <SelectItem value="cancelled">
                          <span className="inline-flex items-center gap-1"><XCircle className="h-3 w-3" />Cancelado</span>
                        </SelectItem>
                        <SelectItem value="no_show">
                          <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Falta</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(apt)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(apt.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Novo'} Agendamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Usuário</Label>
              <Select value={formData.user_id} onValueChange={(v) => setFormData({ ...formData, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um usuário" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.name} ({u.email})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Especialidade</Label>
              <Select value={formData.specialty_id} onValueChange={(v) => setFormData({ ...formData, specialty_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione uma especialidade" /></SelectTrigger>
                <SelectContent>
                  {specialties.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Profissional</Label>
              <Select value={formData.professional_id} onValueChange={(v) => setFormData({ ...formData, professional_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um profissional" /></SelectTrigger>
                <SelectContent>
                  {professionals.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Horário</Label>
              <Select value={formData.time} onValueChange={(v) => setFormData({ ...formData, time: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {timeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
    </div>
  );
}
