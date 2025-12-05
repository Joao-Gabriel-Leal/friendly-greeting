import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Professional {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  specialties: string[];
}

interface Specialty {
  id: string;
  name: string;
}

export default function AdminProfessionals() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    selectedSpecialties: [] as string[]
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [profRes, specRes, profSpecRes] = await Promise.all([
      supabase.from('professionals').select('*').order('name'),
      supabase.from('specialties').select('id, name'),
      supabase.from('professional_specialties').select('professional_id, specialty_id')
    ]);

    const specialtiesMap = new Map(specRes.data?.map(s => [s.id, s.name]) || []);
    
    const professionalsWithSpecialties = (profRes.data || []).map(prof => {
      const profSpecialties = profSpecRes.data
        ?.filter(ps => ps.professional_id === prof.id)
        .map(ps => specialtiesMap.get(ps.specialty_id) || '')
        .filter(Boolean) || [];
      
      return { ...prof, specialties: profSpecialties };
    });

    setProfessionals(professionalsWithSpecialties);
    setSpecialties(specRes.data || []);
    setLoading(false);
  };

  const handleNew = () => {
    setEditingId(null);
    setFormData({ name: '', email: '', phone: '', selectedSpecialties: [] });
    setShowDialog(true);
  };

  const handleEdit = async (prof: Professional) => {
    setEditingId(prof.id);
    
    // Get current specialty IDs
    const { data } = await supabase
      .from('professional_specialties')
      .select('specialty_id')
      .eq('professional_id', prof.id);
    
    setFormData({
      name: prof.name,
      email: prof.email || '',
      phone: prof.phone || '',
      selectedSpecialties: data?.map(d => d.specialty_id) || []
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Nome é obrigatório.' });
      return;
    }

    try {
      if (editingId) {
        // Update professional
        const { error } = await supabase
          .from('professionals')
          .update({
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null
          })
          .eq('id', editingId);

        if (error) throw error;

        // Update specialties
        await supabase
          .from('professional_specialties')
          .delete()
          .eq('professional_id', editingId);

        if (formData.selectedSpecialties.length > 0) {
          await supabase.from('professional_specialties').insert(
            formData.selectedSpecialties.map(specId => ({
              professional_id: editingId,
              specialty_id: specId
            }))
          );
        }

        toast({ title: 'Sucesso', description: 'Profissional atualizado.' });
      } else {
        // Create professional
        const { data: newProf, error } = await supabase
          .from('professionals')
          .insert({
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null
          })
          .select()
          .single();

        if (error) throw error;

        // Add specialties
        if (formData.selectedSpecialties.length > 0 && newProf) {
          await supabase.from('professional_specialties').insert(
            formData.selectedSpecialties.map(specId => ({
              professional_id: newProf.id,
              specialty_id: specId
            }))
          );
        }

        toast({ title: 'Sucesso', description: 'Profissional criado.' });
      }
      
      fetchData();
      setShowDialog(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar.' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este profissional?')) return;

    const { error } = await supabase.from('professionals').delete().eq('id', id);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir.' });
    } else {
      toast({ title: 'Sucesso', description: 'Profissional excluído.' });
      fetchData();
    }
  };

  const toggleSpecialty = (specId: string) => {
    if (formData.selectedSpecialties.includes(specId)) {
      setFormData({ 
        ...formData, 
        selectedSpecialties: formData.selectedSpecialties.filter(id => id !== specId) 
      });
    } else {
      setFormData({ 
        ...formData, 
        selectedSpecialties: [...formData.selectedSpecialties, specId] 
      });
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
                <TableHead>Email</TableHead>
                <TableHead>Especialidades</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {professionals.map(prof => (
                <TableRow key={prof.id}>
                  <TableCell className="font-medium">{prof.name}</TableCell>
                  <TableCell className="text-muted-foreground">{prof.email || '-'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {prof.specialties.map(spec => (
                        <span 
                          key={spec} 
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            spec === 'Massagem' ? 'bg-rose-100 text-rose-700' :
                            spec === 'Psicologia' ? 'bg-violet-100 text-violet-700' :
                            'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      prof.active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                    }`}>
                      {prof.active ? 'Ativo' : 'Inativo'}
                    </span>
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
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label>Especialidades</Label>
              <div className="space-y-2">
                {specialties.map(spec => (
                  <div key={spec.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`spec-${spec.id}`}
                      checked={formData.selectedSpecialties.includes(spec.id)}
                      onCheckedChange={() => toggleSpecialty(spec.id)}
                    />
                    <Label htmlFor={`spec-${spec.id}`} className="cursor-pointer">
                      {spec.name}
                    </Label>
                  </div>
                ))}
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
