import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { format, addDays, startOfDay, isSameDay, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { isBrazilianHoliday } from '@/lib/brazilianHolidays';

interface DateSelectorProps {
  professionalId: string;
  specialty: string;
  onSelect: (date: Date) => void;
  onBack: () => void;
}

export default function DateSelector({ professionalId, specialty, onSelect, onBack }: DateSelectorProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [availableDays, setAvailableDays] = useState<Date[]>([]);
  const [blockedDays, setBlockedDays] = useState<Date[]>([]);
  const [existingAppointment, setExistingAppointment] = useState<{ id: string; date: string } | null>(null);
  const [specialtyBlocked, setSpecialtyBlocked] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchAvailability(),
        checkExistingAppointment(),
        checkSpecialtyBlock()
      ]);
      setLoading(false);
    };
    loadData();
  }, [professionalId, specialty]);

  const fetchAvailability = async () => {
    const today = startOfDay(new Date());
    const maxDate = addDays(today, 30);

    try {
      // Fetch available days marked by admin
      const available = await api.getAvailableDays(
        professionalId,
        format(today, 'yyyy-MM-dd'),
        format(maxDate, 'yyyy-MM-dd')
      );

      // Fetch blocked days
      const blocked = await api.getBlockedDays(
        professionalId,
        format(today, 'yyyy-MM-dd'),
        format(maxDate, 'yyyy-MM-dd')
      );

      if (available) {
        setAvailableDays(available.map((d: any) => new Date(d.date + 'T12:00:00')));
      }

      if (blocked) {
        setBlockedDays(blocked.map((d: any) => new Date(d.date + 'T12:00:00')));
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
    }
  };

  const checkExistingAppointment = async () => {
    if (!user) return;

    try {
      const appointments = await api.getMyAppointments();
      const today = new Date();
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);

      const existing = appointments.find((apt: any) => 
        apt.procedure === specialty &&
        ['scheduled', 'completed'].includes(apt.status) &&
        new Date(apt.date) >= monthStart &&
        new Date(apt.date) <= monthEnd
      );

      if (existing) {
        setExistingAppointment({ id: existing.id, date: existing.date });
      }
    } catch (error) {
      console.error('Error checking existing appointment:', error);
    }
  };

  const checkSpecialtyBlock = async () => {
    if (!user) return;

    try {
      const blocks = await api.getSpecialtyBlocks(user.id);
      const block = blocks.find((b: any) => 
        b.specialty === specialty && new Date(b.blocked_until) > new Date()
      );

      if (block) {
        setSpecialtyBlocked(new Date(block.blocked_until));
      }
    } catch (error) {
      console.error('Error checking specialty block:', error);
    }
  };

  const isDateAvailable = (date: Date) => {
    const normalizedDate = startOfDay(date);
    const today = startOfDay(new Date());
    const maxDate = addDays(today, 30);

    if (normalizedDate < today || normalizedDate > maxDate) return false;

    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;

    if (isBrazilianHoliday(date)) return false;

    if (blockedDays.some(blocked => isSameDay(blocked, date))) return false;

    if (availableDays.length > 0) {
      return availableDays.some(available => isSameDay(available, date));
    }

    return true;
  };

  const handleSelect = () => {
    if (selectedDate) {
      onSelect(selectedDate);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (specialtyBlocked) {
    return (
      <div className="max-w-md mx-auto animate-fade-in">
        <Button variant="ghost" onClick={onBack} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <Card className="border-destructive">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Especialidade Bloqueada</CardTitle>
            <CardDescription>
              Você está temporariamente impedido de agendar <strong>{specialty}</strong> até{' '}
              {format(specialtyBlocked, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Entre em contato com a administração para mais informações.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (existingAppointment) {
    return (
      <div className="max-w-md mx-auto animate-fade-in">
        <Button variant="ghost" onClick={onBack} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <Card className="border-warning">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-warning/10 flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-warning" />
            </div>
            <CardTitle>Limite atingido</CardTitle>
            <CardDescription>
              Você já possui um agendamento de <strong>{specialty}</strong> este mês
              (dia {format(new Date(existingAppointment.date + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}).
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Para agendar novamente, cancele o agendamento atual ou aguarde o próximo mês.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <Button variant="ghost" onClick={onBack} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>

      <Card>
        <CardHeader className="text-center">
          <CardTitle>Selecione a Data</CardTitle>
          <CardDescription>{specialty} - Próximos 30 dias</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={ptBR}
            disabled={(date) => !isDateAvailable(date)}
            className="rounded-md border pointer-events-auto"
          />

          {selectedDate && (
            <div className="mt-6 w-full">
              <p className="text-center text-sm text-muted-foreground mb-4">
                Data selecionada: <span className="font-semibold text-foreground">
                  {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                </span>
              </p>
              <Button onClick={handleSelect} className="w-full gradient-primary">
                Continuar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
