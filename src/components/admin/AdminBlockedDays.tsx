import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BlockedDay {
  id: string;
  professional_id: string | null;
  blocked_date: string;
  reason: string | null;
  professionals: { name: string } | null;
}

interface Professional {
  id: string;
  name: string;
}

export default function AdminBlockedDays() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [blockedDays, setBlockedDays] = useState<BlockedDay[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    professional_id: 'all',
    blocked_date: '',
    reason: ''
  });

  useEffect(() => {
    fetchBlockedDays();
    fetchProfessionals();
  }, []);

  const fetchBlockedDays = async () => {
    const { data, error } = await supabase
      .from('blocked_days')
      .select(`*, professionals (name)`)
      .order('blocked_date', { ascending: false });

    if (data && !error) {
      setBlockedDays(data as unknown as BlockedDay[]);
    }
    setLoading(false);
  };

  const fetchProfessionals = async () => {
    const { data } = await supabase.from('professionals').select('id, name');
    if (data) setProfessionals(data);
  };

  const handleNew = () => {
    setFormData({ professional_id: 'all', blocked_date: '', reason: '' });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.blocked_date) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Data é obrigatória.' });
      return;
    }

    const { error } = await supabase.from('blocked_days').insert({
      professional_id: formData.professional_id === 'all' ? null : formData.professional_id,
      blocked_date: formData.blocked_date,
      reason: formData.reason || null
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível bloquear o dia.' });
    } else {
      toast({ title: 'Sucesso', description: 'Dia bloqueado com sucesso.' });
      fetchBlockedDays();
      setShowDialog(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este bloqueio?')) return;

    const { error } = await supabase.from('blocked_days').delete().eq('id', id);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível remover.' });
    } else {
      toast({ title: 'Sucesso', description: 'Bloqueio removido.' });
      fetchBlockedDays();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-end">
        <Button onClick={handleNew} className="gradient-primary">
          <Plus className="h-4 w-4 mr-2" />
          Bloquear Dia
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blockedDays.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum dia bloqueado
                  </TableCell>
                </TableRow>
              ) : (
                blockedDays.map(day => (
                  <TableRow key={day.id}>
                    <TableCell className="font-medium">
                      {format(parseISO(day.blocked_date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {day.professionals?.name || (
                        <span className="text-warning font-medium">Todos os profissionais</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {day.reason || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive"
                        onClick={() => handleDelete(day.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear Dia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Profissional</Label>
              <Select 
                value={formData.professional_id} 
                onValueChange={(v) => setFormData({ ...formData, professional_id: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os profissionais</SelectItem>
                  {professionals.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={formData.blocked_date}
                onChange={(e) => setFormData({ ...formData, blocked_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Input
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Ex: Feriado, Manutenção..."
              />
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
