import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Loader2, Heart, Brain, Apple } from 'lucide-react';

interface Specialty {
  id: string;
  name: string;
  professionals: { id: string; name: string }[];
}

interface SpecialtySelectorProps {
  onSelect: (specialty: string, specialtyId: string, professionalId: string, professionalName: string) => void;
  onBack: () => void;
}

const specialtyIcons: Record<string, React.ReactNode> = {
  'Massagem': <Heart className="h-8 w-8" />,
  'Psicologia': <Brain className="h-8 w-8" />,
  'Nutrição': <Apple className="h-8 w-8" />,
};

const specialtyColors: Record<string, string> = {
  'Massagem': 'from-rose-500 to-pink-500',
  'Psicologia': 'from-violet-500 to-purple-500',
  'Nutrição': 'from-emerald-500 to-green-500',
};

export default function SpecialtySelector({ onSelect, onBack }: SpecialtySelectorProps) {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSpecialties();
  }, []);

  const fetchSpecialties = async () => {
    try {
      const { data: specialtiesData } = await supabase
        .from('specialties')
        .select('id, name')
        .eq('active', true);

      const { data: profSpecData } = await supabase
        .from('professional_specialties')
        .select('specialty_id, professional_id, professionals (id, name)');

      const specialtiesWithProfs = (specialtiesData || []).map(spec => {
        const profs = profSpecData
          ?.filter(ps => ps.specialty_id === spec.id)
          .map(ps => ps.professionals as unknown as { id: string; name: string })
          .filter(Boolean) || [];
        
        return { ...spec, professionals: profs };
      }).filter(s => s.professionals.length > 0);

      setSpecialties(specialtiesWithProfs);
    } catch (error) {
      console.error('Error fetching specialties:', error);
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
        {specialties.map((spec) => (
          <Card 
            key={spec.id}
            className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] overflow-hidden"
            onClick={() => onSelect(spec.name, spec.id, spec.professionals[0].id, spec.professionals[0].name)}
          >
            <CardContent className="p-0">
              <div className="flex items-center">
                <div className={`w-24 h-24 bg-gradient-to-br ${specialtyColors[spec.name] || 'from-gray-500 to-gray-600'} flex items-center justify-center text-white`}>
                  {specialtyIcons[spec.name] || <Heart className="h-8 w-8" />}
                </div>
                <div className="p-6 flex-1">
                  <h3 className="text-xl font-semibold text-foreground">{spec.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {spec.professionals.map(p => p.name).join(', ')}
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
