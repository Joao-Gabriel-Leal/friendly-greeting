import { Heart, Brain, Apple, Stethoscope, Activity, Pill, Scissors, Eye, Ear, Bone } from 'lucide-react';
import React from 'react';

// Ícones únicos para cada especialidade
export const specialtyIcons: Record<string, React.ReactNode> = {
  'Massagem': <Heart className="h-8 w-8" />,
  'Nutricionista': <Apple className="h-8 w-8" />,
  'Nutrição': <Apple className="h-8 w-8" />,
  'Psicólogo': <Brain className="h-8 w-8" />,
  'Psicologia': <Brain className="h-8 w-8" />,
  'Médico': <Stethoscope className="h-8 w-8" />,
  'Fisioterapia': <Activity className="h-8 w-8" />,
  'Farmácia': <Pill className="h-8 w-8" />,
  'Estética': <Scissors className="h-8 w-8" />,
  'Oftalmologia': <Eye className="h-8 w-8" />,
  'Otorrinolaringologia': <Ear className="h-8 w-8" />,
  'Ortopedia': <Bone className="h-8 w-8" />,
};

// Cores únicas para cada especialidade
export const specialtyColors: Record<string, string> = {
  'Massagem': 'from-rose-500 to-pink-500',
  'Nutricionista': 'from-emerald-500 to-green-500',
  'Nutrição': 'from-emerald-500 to-green-500',
  'Psicólogo': 'from-violet-500 to-purple-500',
  'Psicologia': 'from-violet-500 to-purple-500',
  'Médico': 'from-blue-500 to-cyan-500',
  'Fisioterapia': 'from-orange-500 to-amber-500',
  'Farmácia': 'from-red-500 to-rose-500',
  'Estética': 'from-fuchsia-500 to-pink-500',
  'Oftalmologia': 'from-sky-500 to-blue-500',
  'Otorrinolaringologia': 'from-teal-500 to-cyan-500',
  'Ortopedia': 'from-slate-500 to-gray-500',
};

// Função para obter ícone com fallback
export function getSpecialtyIcon(name: string, className?: string): React.ReactNode {
  const Icon = specialtyIcons[name];
  if (Icon) return Icon;
  
  // Fallback baseado na primeira letra para garantir variedade
  const firstChar = name.charAt(0).toUpperCase();
  const fallbackIcons = [Heart, Brain, Apple, Stethoscope, Activity];
  const index = firstChar.charCodeAt(0) % fallbackIcons.length;
  const FallbackIcon = fallbackIcons[index];
  return <FallbackIcon className={className || "h-8 w-8"} />;
}

// Função para obter cor com fallback
export function getSpecialtyColor(name: string): string {
  const color = specialtyColors[name];
  if (color) return color;
  
  // Fallback baseado na primeira letra
  const firstChar = name.charAt(0).toUpperCase();
  const fallbackColors = [
    'from-rose-500 to-pink-500',
    'from-violet-500 to-purple-500',
    'from-emerald-500 to-green-500',
    'from-blue-500 to-cyan-500',
    'from-orange-500 to-amber-500',
  ];
  const index = firstChar.charCodeAt(0) % fallbackColors.length;
  return fallbackColors[index];
}
