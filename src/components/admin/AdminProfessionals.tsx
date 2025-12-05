import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Professional {
  id: string;
  name: string;
  specialty: string;
  work_days: number[];
  start_time: string;
  end_time: string;
}

const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function AdminProfessionals() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    specialty: 'Massagem',
    work_days: [1, 2, 3, 4, 5],
    start_time: '09:00',
    end_time: '17:00'
  });

  useEffect(() => {
    fetchProfessionals();
  }, []);

  const fetchProfessionals = async () => {
    try {
      const data = await api.getProfessionals();
      setProfessionals(data);
    } catch (error) {
      console.error('Error fetching professionals:', error);
    }
    setLoading(false);
  };

  const handleNew = () => {
    setEditingId(null);
    setFormData({
      name: '',
      specialty: 'Massagem',
      work_days: [1, 2, 3, 4, 5],
      start_time: '09:00',
      end_time: '17:00'
    });
    setShowDialog(true);
  };

  const handleEdit = (prof: Professional) => {
    setEditingId(prof.id);
    setFormData({
      name: prof.name,
      specialty: prof.specialty,
      work_days: prof.work_days || [1, 2, 3, 4, 5],
      start_time: prof.start_time?.substring(0, 5) || '09:00',
      end_time: prof.end_time?.substring(0, 5) || '17:00'
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Nome é obrigatório.' });
      return;
    }

    const payload = {
      name: formData.name,
      specialty: formData.specialty,
      work_days: formData.work_days,
      start_time: formData.start_time + ':00',
      end_time: formData.end_time + ':00'
    };

    try {
      if (editingId) {
        await api.updateProfessional(editingId, payload);
        toast({ title: 'Sucesso', description: 'Profissional atualizado.' });
      } else {
        await api.createProfessional(payload);
        toast({ title: 'Sucesso', description: 'Profissional criado.' });
      }
      fetchProfessionals();
      setShowDialog(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar.' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este profissional?')) return;

    try {
      await api.deleteProfessional(id);
      toast({ title: 'Sucesso', description: 'Profissional excluído.' });
      fetchProfessionals();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir.' });
    }
  };

  const toggleWorkDay = (day: number) => {
    if (formData.work_days.includes(day)) {
      setFormData({ ...formData, work_days: formData.work_days.filter(d => d !== day) });
    } else {
      setFormData({ ...formData, work_days: [...formData.work_days, day].sort() });
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
          Novo Profissional
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Dias de Trabalho</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {professionals.map(prof => (
                <TableRow key={prof.id}>
                  <TableCell className="font-medium">{prof.name}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      prof.specialty === 'Massagem' ? 'bg-rose-100 text-rose-700' :
                      prof.specialty === 'Psicólogo' ? 'bg-violet-100 text-violet-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {prof.specialty}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {(prof.work_days || []).map(d => (
                        <span key={d} className="px-2 py-0.5 bg-secondary rounded text-xs">
                          {dayNames[d]}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {prof.start_time?.substring(0, 5) || '09:00'} - {prof.end_time?.substring(0, 5) || '17:00'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(prof)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive"
                        onClick={() => handleDelete(prof.id)}
                      >
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
            <DialogTitle>{editingId ? 'Editar' : 'Novo'} Profissional</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do profissional"
              />
            </div>
            <div className="space-y-2">
              <Label>Especialidade</Label>
              <Select value={formData.specialty} onValueChange={(v) => setFormData({ ...formData, specialty: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Massagem">Massagem</SelectItem>
                  <SelectItem value="Psicólogo">Psicólogo</SelectItem>
                  <SelectItem value="Nutricionista">Nutricionista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dias de Trabalho</Label>
              <div className="flex gap-2">
                {dayNames.map((name, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => toggleWorkDay(index)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      formData.work_days.includes(index)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
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
