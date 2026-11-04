import React from 'react';
import {
  ThumbsUp,
  Heart,
  Flame,
  Smile,
  PartyPopper,
  Rocket,
  Sparkles,
  Star,
  Lightbulb,
  Award,
  Zap,
  Check,
} from 'lucide-react';

export interface ReactionDefinition {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  fillClass?: string;
  alias?: string[];
}

export const REACTION_DEFINITIONS: ReactionDefinition[] = [
  {
    id: 'thumbs_up',
    label: 'Like',
    icon: ThumbsUp,
    colorClass: 'text-blue-500',
    fillClass: 'fill-blue-500/20',
    alias: ['👍', 'like'],
  },
  {
    id: 'heart',
    label: 'Love',
    icon: Heart,
    colorClass: 'text-rose-500',
    fillClass: 'fill-rose-500/20',
    alias: ['❤️', 'love', '😍'],
  },
  {
    id: 'fire',
    label: 'Fire',
    icon: Flame,
    colorClass: 'text-orange-500',
    fillClass: 'fill-orange-500/20',
    alias: ['🔥', 'flame'],
  },
  {
    id: 'smile',
    label: 'Joy',
    icon: Smile,
    colorClass: 'text-amber-500',
    fillClass: 'fill-amber-500/20',
    alias: ['😂', 'laugh', '😊'],
  },
  {
    id: 'party',
    label: 'Celebrate',
    icon: PartyPopper,
    colorClass: 'text-purple-500',
    fillClass: 'fill-purple-500/20',
    alias: ['🎉', 'celebrate', '🙌', '👏'],
  },
  {
    id: 'rocket',
    label: 'Rocket',
    icon: Rocket,
    colorClass: 'text-indigo-500',
    fillClass: 'fill-indigo-500/20',
    alias: ['🚀', 'launch'],
  },
  {
    id: 'sparkles',
    label: 'Sparkles',
    icon: Sparkles,
    colorClass: 'text-yellow-500',
    fillClass: 'fill-yellow-500/20',
    alias: ['✨', 'shine'],
  },
  {
    id: 'star',
    label: 'Star',
    icon: Star,
    colorClass: 'text-amber-400',
    fillClass: 'fill-amber-400/20',
    alias: ['⭐', 'favorite'],
  },
  {
    id: 'idea',
    label: 'Idea',
    icon: Lightbulb,
    colorClass: 'text-yellow-500',
    fillClass: 'fill-yellow-500/20',
    alias: ['💡', 'lightbulb'],
  },
  {
    id: 'award',
    label: 'Award',
    icon: Award,
    colorClass: 'text-violet-500',
    fillClass: 'fill-violet-500/20',
    alias: ['🏆', 'trophy'],
  },
  {
    id: 'zap',
    label: 'Fast',
    icon: Zap,
    colorClass: 'text-amber-400',
    fillClass: 'fill-amber-400/20',
    alias: ['⚡', 'lightning'],
  },
  {
    id: 'check',
    label: 'Done',
    icon: Check,
    colorClass: 'text-emerald-500',
    alias: ['✅', 'done', '💯'],
  },
];

export const QUICK_REACTIONS = REACTION_DEFINITIONS.slice(0, 5);

export const getReactionDefinition = (idOrAlias: string): ReactionDefinition => {
  const clean = idOrAlias.trim();
  const found = REACTION_DEFINITIONS.find(
    (r) => r.id === clean || r.alias?.includes(clean)
  );
  return (
    found || {
      id: clean,
      label: clean,
      icon: ThumbsUp,
      colorClass: 'text-slate-500',
    }
  );
};

interface ReactionIconProps {
  name: string;
  className?: string;
}

export const ReactionIcon: React.FC<ReactionIconProps> = ({ name, className = 'w-3.5 h-3.5' }) => {
  const def = getReactionDefinition(name);
  const IconComponent = def.icon;
  return (
    <IconComponent
      className={`${className} ${def.colorClass} ${def.fillClass || ''} transition-transform`}
    />
  );
};
