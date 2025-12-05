import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Loader2, Heart, Brain, Apple } from 'lucide-react';

interface Professional {
  id: string;
  name: string;
  specialty: string;
}

interface SpecialtySelectorProps {
  onSelect: (specialty: string, professionalId: string, professionalName: string) => void;
  onBack: () => void;
}

const specialtyIcons: Record<string, React.ReactNode> = {
  'Massagem': <Heart className="h-8 w-8" />,
  'Psicólogo': <Brain className="h-8 w-8" />,
  'Nutricionista': <Apple className="h-8 w-8" />,
};

const specialtyColors: Record<string, string> = {
  'Massagem': 'from-rose-500 to-pink-500',
  'Psicólogo': 'from-violet-500 to-purple-500',
  'Nutricionista': 'from-emerald-500 to-green-500',
};

export default function SpecialtySelector({ onSelect, onBack }: SpecialtySelectorProps) {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const groupedBySpecialty = professionals.reduce((acc, prof) => {
    if (!acc[prof.specialty]) {
      acc[prof.specialty] = [];
    }
    acc[prof.specialty].push(prof);
    return acc;
  }, {} as Record<string, Professional[]>);

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <Button variant="ghost" onClick={onBack} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>

      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">Escolha a Especialidade</h2>
        <p className="text-muted-foreground">Selecione o tipo de atendimento desejado</p>
      </div>

      <div className="grid gap-4">
        {Object.entries(groupedBySpecialty).map(([specialty, profs]) => (
          <Card 
            key={specialty}
            className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] overflow-hidden"
            onClick={() => onSelect(specialty, profs[0].id, profs[0].name)}
          >
            <CardContent className="p-0">
              <div className="flex items-center">
                <div className={`w-24 h-24 bg-gradient-to-br ${specialtyColors[specialty]} flex items-center justify-center text-white`}>
                  {specialtyIcons[specialty]}
                </div>
                <div className="p-6 flex-1">
                  <h3 className="text-xl font-semibold text-foreground">{specialty}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {profs.map(p => p.name).join(', ')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
