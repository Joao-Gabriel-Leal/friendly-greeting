import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  specialtyId: string;
  specialty: string;
  onSelect: (date: Date) => void;
  onBack: () => void;
}

export default function DateSelector({ professionalId, specialtyId, specialty, onSelect, onBack }: DateSelectorProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [availableDays, setAvailableDays] = useState<number[]>([]);
  const [blockedDates, setBlockedDates] = useState<Date[]>([]);
  const [existingAppointment, setExistingAppointment] = useState<{ id: string; date: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchAvailability(),
        checkExistingAppointment()
      ]);
      setLoading(false);
    };
    loadData();
  }, [professionalId, specialtyId]);

  const fetchAvailability = async () => {
    const today = startOfDay(new Date());
    const maxDate = addDays(today, 30);

    try {
      // Fetch available days of week for the professional
      const { data: availableData } = await supabase
        .from('available_days')
        .select('day_of_week')
        .eq('professional_id', professionalId);

      if (availableData) {
        setAvailableDays(availableData.map(d => d.day_of_week));
      }

      // Fetch blocked dates
      const { data: blockedData } = await supabase
        .from('blocked_days')
        .select('blocked_date')
        .or(`professional_id.eq.${professionalId},professional_id.is.null`)
        .gte('blocked_date', format(today, 'yyyy-MM-dd'))
        .lte('blocked_date', format(maxDate, 'yyyy-MM-dd'));

      if (blockedData) {
        setBlockedDates(blockedData.map(d => new Date(d.blocked_date + 'T12:00:00')));
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
    }
  };

  const checkExistingAppointment = async () => {
    if (!user) return;

    try {
      const today = new Date();
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);

      const { data } = await supabase
        .from('appointments')
        .select('id, appointment_date')
        .eq('user_id', user.id)
        .eq('specialty_id', specialtyId)
        .in('status', ['scheduled', 'completed'])
        .gte('appointment_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('appointment_date', format(monthEnd, 'yyyy-MM-dd'))
        .maybeSingle();

      if (data) {
        setExistingAppointment({ id: data.id, date: data.appointment_date });
      }
    } catch (error) {
      console.error('Error checking existing appointment:', error);
    }
  };

  const isDateAvailable = (date: Date) => {
    const normalizedDate = startOfDay(date);
    const today = startOfDay(new Date());
    const maxDate = addDays(today, 30);

    if (normalizedDate < today || normalizedDate > maxDate) return false;

    const dayOfWeek = date.getDay();
    
    // If available days are configured, check if this day is allowed
    if (availableDays.length > 0 && !availableDays.includes(dayOfWeek)) {
      return false;
    }

    // Default: exclude weekends if no availability configured
    if (availableDays.length === 0 && (dayOfWeek === 0 || dayOfWeek === 6)) {
      return false;
    }

    if (isBrazilianHoliday(date)) return false;

    if (blockedDates.some(blocked => isSameDay(blocked, date))) return false;

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
