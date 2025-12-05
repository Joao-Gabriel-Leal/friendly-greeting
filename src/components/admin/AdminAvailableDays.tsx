import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CalendarCheck, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, startOfDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Professional {
  id: string;
  name: string;
}

interface AvailableDay {
  id: string;
  professional_id: string;
  day_of_week: number;
}

export default function AdminAvailableDays() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<string>('');
  const [availableDays, setAvailableDays] = useState<number[]>([]);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  useEffect(() => {
    fetchProfessionals();
  }, []);

  useEffect(() => {
    if (selectedProfessional) {
      fetchAvailableDays();
    }
  }, [selectedProfessional]);

  const fetchProfessionals = async () => {
    const { data, error } = await supabase.from('professionals').select('id, name');
    if (data && !error) {
      setProfessionals(data);
      if (data.length > 0) {
        setSelectedProfessional(data[0].id);
      }
    }
    setLoading(false);
  };

  const fetchAvailableDays = async () => {
    const { data, error } = await supabase
      .from('available_days')
      .select('day_of_week')
      .eq('professional_id', selectedProfessional);

    if (data && !error) {
      const days = data.map(d => d.day_of_week);
      setAvailableDays(days);
      setSelectedDays(days);
    } else {
      setAvailableDays([]);
      setSelectedDays([]);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      // Delete existing available days for this professional
      await supabase
        .from('available_days')
        .delete()
        .eq('professional_id', selectedProfessional);

      // Insert new available days
      if (selectedDays.length > 0) {
        const inserts = selectedDays.map(day => ({
          professional_id: selectedProfessional,
          day_of_week: day,
          start_time: '09:00:00',
          end_time: '17:00:00'
        }));

        const { error } = await supabase.from('available_days').insert(inserts);
        if (error) throw error;
      }

      toast({ 
        title: 'Sucesso', 
        description: selectedDays.length > 0 
          ? `${selectedDays.length} dias marcados como disponíveis.` 
          : 'Disponibilidade limpa.'
      });
      setAvailableDays(selectedDays);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar.' });
    }

    setSaving(false);
  };

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day].sort());
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" />
            Configurar Dias de Trabalho
          </CardTitle>
          <CardDescription>
            Selecione os dias da semana em que o profissional estará disponível para agendamentos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="max-w-xs">
            <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um profissional" />
              </SelectTrigger>
              <SelectContent>
                {professionals.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Clique nos dias para ativar/desativar:</p>
                <div className="flex flex-wrap gap-3">
                  {dayNames.map((name, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => toggleDay(index)}
                      className={`px-6 py-4 rounded-lg text-sm font-medium transition-all ${
                        selectedDays.includes(index)
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:w-64 space-y-4">
              <Card className="bg-secondary/30">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">{selectedDays.length}</div>
                    <div className="text-sm text-muted-foreground">dias selecionados</div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Button onClick={handleSave} className="w-full gradient-primary" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Disponibilidade'}
                </Button>
                <Button variant="outline" onClick={() => setSelectedDays([])} className="w-full">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar Seleção
                </Button>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Dias marcados ficam disponíveis para agendamento</p>
                <p>• O horário padrão é das 09h às 17h</p>
                <p>• Usuários só podem agendar nos dias marcados</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
