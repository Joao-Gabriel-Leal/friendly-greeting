import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, LogOut, User, Clock, AlertTriangle } from 'lucide-react';
import SpecialtySelector from './SpecialtySelector';
import DateSelector from './DateSelector';
import TimeSelector from './TimeSelector';
import MyAppointments from './MyAppointments';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserDashboardProps {
  isSuspended: boolean;
  suspendedUntil: Date | null;
}

type Step = 'home' | 'specialty' | 'date' | 'time' | 'appointments';

export default function UserDashboard({ isSuspended, suspendedUntil }: UserDashboardProps) {
  const { profile, signOut } = useAuth();
  const [step, setStep] = useState<Step>('home');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<string | null>(null);
  const [selectedProfessionalName, setSelectedProfessionalName] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const handleSpecialtySelect = (specialty: string, specialtyId: string, professionalId: string, professionalName: string) => {
    setSelectedSpecialty(specialty);
    setSelectedSpecialtyId(specialtyId);
    setSelectedProfessional(professionalId);
    setSelectedProfessionalName(professionalName);
    setStep('date');
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setStep('time');
  };

  const handleBack = () => {
    if (step === 'date') {
      setStep('specialty');
      setSelectedSpecialty(null);
      setSelectedSpecialtyId(null);
      setSelectedProfessional(null);
      setSelectedProfessionalName(null);
    } else if (step === 'time') {
      setStep('date');
      setSelectedDate(null);
    } else {
      setStep('home');
    }
  };

  const handleComplete = () => {
    setStep('appointments');
    setSelectedSpecialty(null);
    setSelectedSpecialtyId(null);
    setSelectedProfessional(null);
    setSelectedProfessionalName(null);
    setSelectedDate(null);
  };

  if (isSuspended && suspendedUntil) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground">Agendamento</span>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto border-destructive">
            <CardHeader className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-destructive">Conta Suspensa</CardTitle>
              <CardDescription>
                Você está suspenso até{' '}
                <span className="font-semibold text-foreground">
                  {format(suspendedUntil, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                A suspensão ocorre quando há cancelamento no dia da consulta ou falta.
                Entre em contato com a administração para mais informações.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <span className="font-semibold text-foreground block">Agendamento</span>
              <span className="text-xs text-muted-foreground">
                Olá, {profile?.name}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {step === 'home' && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">Bem-vindo ao Sistema</h1>
              <p className="text-muted-foreground">O que você gostaria de fazer?</p>
            </div>

            <div className="grid gap-4">
              <Card 
                className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
                onClick={() => setStep('specialty')}
              >
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                    <Clock className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Novo Agendamento</h3>
                    <p className="text-sm text-muted-foreground">Agende uma consulta</p>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
                onClick={() => setStep('appointments')}
              >
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                    <User className="h-6 w-6 text-secondary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Meus Agendamentos</h3>
                    <p className="text-sm text-muted-foreground">Ver e gerenciar suas consultas</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-secondary/30 border-secondary">
              <CardContent className="p-4">
                <h4 className="font-medium text-foreground mb-2">Regras importantes:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Apenas 1 agendamento por mês por especialidade</li>
                  <li>• Horários disponíveis: 09h às 17h</li>
                  <li>• Cancelar no dia da consulta gera suspensão de 60 dias</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'specialty' && (
          <SpecialtySelector onSelect={handleSpecialtySelect} onBack={handleBack} />
        )}

        {step === 'date' && selectedProfessional && selectedSpecialtyId && (
          <DateSelector 
            professionalId={selectedProfessional}
            specialtyId={selectedSpecialtyId}
            specialty={selectedSpecialty!}
            onSelect={handleDateSelect}
            onBack={handleBack}
          />
        )}

        {step === 'time' && selectedProfessional && selectedDate && selectedSpecialtyId && (
          <TimeSelector
            professionalId={selectedProfessional}
            professionalName={selectedProfessionalName!}
            specialtyId={selectedSpecialtyId}
            specialty={selectedSpecialty!}
            date={selectedDate}
            onComplete={handleComplete}
            onBack={handleBack}
          />
        )}

        {step === 'appointments' && (
          <MyAppointments onBack={() => setStep('home')} />
        )}
      </main>
    </div>
  );
}
