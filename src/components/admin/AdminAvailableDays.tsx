import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
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
  specialty: string;
}

export default function AdminAvailableDays() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<string>('');
  const [availableDays, setAvailableDays] = useState<Date[]>([]);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfessionals();
  }, []);

  useEffect(() => {
    if (selectedProfessional) {
      fetchAvailableDays();
    }
  }, [selectedProfessional]);

  const fetchProfessionals = async () => {
    try {
      const data = await api.getProfessionals();
      setProfessionals(data);
      if (data.length > 0) {
        setSelectedProfessional(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching professionals:', error);
    }
    setLoading(false);
  };

  const fetchAvailableDays = async () => {
    const today = startOfDay(new Date());
    const maxDate = addDays(today, 60);

    try {
      const data = await api.getAvailableDays(
        selectedProfessional,
        format(today, 'yyyy-MM-dd'),
        format(maxDate, 'yyyy-MM-dd')
      );
      const dates = data.map((d: any) => new Date(d.date + 'T12:00:00'));
      setAvailableDays(dates);
      setSelectedDates(dates);
    } catch (error) {
      console.error('Error fetching available days:', error);
      setAvailableDays([]);
      setSelectedDates([]);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      // Delete existing available days for this professional
      const existingDays = await api.getAvailableDays(
        selectedProfessional,
        format(startOfDay(new Date()), 'yyyy-MM-dd'),
        format(addDays(startOfDay(new Date()), 60), 'yyyy-MM-dd')
      );
      
      for (const day of existingDays) {
        await api.deleteAvailableDay(day.id);
      }

      // Insert new available days
      for (const date of selectedDates) {
        await api.createAvailableDay(selectedProfessional, format(date, 'yyyy-MM-dd'));
      }

      toast({ 
        title: 'Sucesso', 
        description: selectedDates.length > 0 
          ? `${selectedDates.length} dias marcados como disponíveis.` 
          : 'Disponibilidade limpa.'
      });
      setAvailableDays(selectedDates);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar.' });
    }

    setSaving(false);
  };

  const handleClearAll = () => {
    setSelectedDates([]);
  };

  const today = startOfDay(new Date());
  const maxDate = addDays(today, 60);

  const modifiers = {
    available: selectedDates,
  };

  const modifiersStyles = {
    available: {
      backgroundColor: 'hsl(var(--primary))',
      color: 'hsl(var(--primary-foreground))',
      borderRadius: '0.5rem',
    },
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
            Marcar Disponibilidade
          </CardTitle>
          <CardDescription>
            Selecione os dias em que o profissional estará disponível para agendamentos.
            Clique nas datas para marcar/desmarcar.
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
                    {p.name} - {p.specialty}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <Calendar
                mode="multiple"
                selected={selectedDates}
                onSelect={(dates) => dates && setSelectedDates(dates)}
                locale={ptBR}
                disabled={(date) => {
                  const normalizedDate = startOfDay(date);
                  return normalizedDate < today || normalizedDate > maxDate || date.getDay() === 0 || date.getDay() === 6;
                }}
                modifiers={modifiers}
                modifiersStyles={modifiersStyles}
                className="rounded-md border pointer-events-auto"
                numberOfMonths={2}
              />
            </div>

            <div className="lg:w-64 space-y-4">
              <Card className="bg-secondary/30">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">{selectedDates.length}</div>
                    <div className="text-sm text-muted-foreground">dias selecionados</div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Button onClick={handleSave} className="w-full gradient-primary" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Disponibilidade'}
                </Button>
                <Button variant="outline" onClick={handleClearAll} className="w-full">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar Seleção
                </Button>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Dias em azul estão marcados como disponíveis</p>
                <p>• Usuários só podem agendar nos dias marcados</p>
                <p>• Se nenhum dia estiver marcado, aplica-se a regra padrão</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
