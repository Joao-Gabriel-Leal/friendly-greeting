import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Clock, CheckCircle } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface TimeSelectorProps {
  professionalId: string;
  professionalName: string;
  specialtyId: string;
  specialty: string;
  date: Date;
  onComplete: () => void;
  onBack: () => void;
}

const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

export default function TimeSelector({ professionalId, professionalName, specialtyId, specialty, date, onComplete, onBack }: TimeSelectorProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  useEffect(() => {
    fetchBookedSlots();
  }, [date, professionalId]);

  const fetchBookedSlots = async () => {
    try {
      // Get slots booked for this specialty on this date (by any professional)
      const { data } = await supabase
        .from('appointments')
        .select('appointment_time')
        .eq('specialty_id', specialtyId)
        .eq('appointment_date', format(date, 'yyyy-MM-dd'))
        .in('status', ['scheduled', 'completed']);

      if (data) {
        setBookedSlots(data.map(a => a.appointment_time.substring(0, 5)));
      }
    } catch (error) {
      console.error('Error fetching booked slots:', error);
      setBookedSlots([]);
    }
    setLoading(false);
  };

  const handleBook = async () => {
    if (!selectedTime || !user) return;

    setBooking(true);

    try {
      const { error } = await supabase.from('appointments').insert({
        user_id: user.id,
        professional_id: professionalId,
        specialty_id: specialtyId,
        appointment_date: format(date, 'yyyy-MM-dd'),
        appointment_time: selectedTime + ':00',
      });

      if (error) throw error;

      toast({
        title: 'Agendamento confirmado!',
        description: `${specialty} em ${format(date, "dd/MM", { locale: ptBR })} às ${selectedTime}`,
      });
      onComplete();
    } catch (error: any) {
      if (error.message?.includes('duplicate') || error.code === '23505') {
        toast({
          variant: 'destructive',
          title: 'Horário indisponível',
          description: 'Este horário acabou de ser reservado. Por favor, escolha outro.',
        });
        fetchBookedSlots();
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao agendar',
          description: 'Não foi possível realizar o agendamento. Tente novamente.',
        });
      }
    }

    setBooking(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isSlotPast = (slot: string): boolean => {
    if (!isToday(date)) return false;
    const now = new Date();
    const [hours, minutes] = slot.split(':').map(Number);
    const slotTime = new Date();
    slotTime.setHours(hours, minutes, 0, 0);
    return slotTime <= now;
  };

  const availableSlots = timeSlots.filter(slot => !bookedSlots.includes(slot) && !isSlotPast(slot));

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <Button variant="ghost" onClick={onBack} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>

      <Card>
        <CardHeader className="text-center">
          <CardTitle>Selecione o Horário</CardTitle>
          <CardDescription>
            {specialty} - {format(date, "dd 'de' MMMM", { locale: ptBR })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {availableSlots.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Não há horários disponíveis nesta data.
              </p>
              <Button variant="outline" onClick={onBack} className="mt-4">
                Escolher outra data
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {timeSlots.map(slot => {
                  const isBooked = bookedSlots.includes(slot);
                  const isPast = isSlotPast(slot);
                  const isUnavailable = isBooked || isPast;
                  const isSelected = selectedTime === slot;

                  return (
                    <Button
                      key={slot}
                      variant={isSelected ? 'default' : 'outline'}
                      className={`h-14 text-lg ${isSelected ? 'gradient-primary' : ''} ${
                        isUnavailable ? 'opacity-40 cursor-not-allowed bg-muted' : ''
                      }`}
                      disabled={isUnavailable}
                      onClick={() => !isUnavailable && setSelectedTime(slot)}
                    >
                      {isUnavailable ? (
                        <span className="line-through">{slot}</span>
                      ) : (
                        <>
                          {isSelected && <CheckCircle className="h-4 w-4 mr-2" />}
                          {slot}
                        </>
                      )}
                    </Button>
                  );
                })}
              </div>

              {selectedTime && (
                <Button
                  onClick={handleBook}
                  className="w-full mt-6 gradient-primary h-12"
                  disabled={booking}
                >
                  {booking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Confirmar Agendamento'
                  )}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
